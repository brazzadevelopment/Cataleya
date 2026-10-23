// Serverski dio: provjera PIN-a i sve izmjene. Ne ovisi o tome gdje radi;
// pokreće ga Supabase Edge Function (supabase/functions/api), koja daje
// klijent s ključem service_role i tajnu za potpisivanje prijave.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeAdvancement } from '../src/lib/advancement.js';
import { authorize, MutationError, type Mutation, type TableName } from '../src/lib/mutations.js';
import type { Group, GroupTeam, Match, Role, Tournament } from '../src/lib/types.js';
import { checkSubscribe, type MatchChange, type SubscribeBody } from './notify.js';

export interface TokenData {
  t: string; // tournament id
  r: Role;
  f: string | null; // field id
  p: string; // id PIN-a
  v: string; // kad je PIN postavljen; nakon promjene PIN-a stara prijava ne vrijedi
  exp: number; // ms
}

export interface Reply {
  status: number;
  body: unknown;
  /** Promijenjene utakmice, za obavijesti nakon odgovora. */
  changes?: MatchChange[];
}

const SESSION_DAYS = 4;
const fail = (status: number, error: string): Reply => ({ status, body: { error } });
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');

export function signToken(secret: string, data: Omit<TokenData, 'exp'>): string {
  const payload = b64(JSON.stringify({ ...data, exp: Date.now() + SESSION_DAYS * 86400000 }));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(secret: string, token: string | null | undefined): TokenData | null {
  const raw = token?.replace(/^Bearer\s+/i, '');
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenData;
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

/** Vrijedi li još PIN kojim je osoba ušla (nije promijenjen ni obrisan). */
async function pinStillValid(db: SupabaseClient, s: TokenData): Promise<boolean> {
  const { data } = await db.from('pins').select('updated_at').eq('id', s.p).eq('tournament_id', s.t).maybeSingle();
  return !!data && new Date((data as { updated_at: string }).updated_at).getTime() === new Date(s.v).getTime();
}

const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// ---------------------------------------------------------------------
// POST login { tournamentId, pin } → { tournamentId, role, fieldId, token }
// ---------------------------------------------------------------------

export async function login(db: SupabaseClient, secret: string, body: unknown): Promise<Reply> {
  const { tournamentId, pin } = (body ?? {}) as { tournamentId?: unknown; pin?: unknown };
  if (!isUuid(tournamentId) || typeof pin !== 'string' || !/^[0-9]{4,8}$/.test(pin)) {
    return fail(401, 'PIN nije točan.');
  }
  const { data, error } = await db.rpc('check_pin', { p_tournament_id: tournamentId, p_pin: pin });
  if (error) {
    console.error(error);
    return fail(500, 'Prijava trenutno ne radi. Pokušaj ponovno.');
  }
  const match = (data as { id: string; role: Role; field_id: string | null; updated_at: string }[])[0];
  if (!match) return fail(401, 'PIN nije točan.');
  const token = signToken(secret, { t: tournamentId, r: match.role, f: match.field_id, p: match.id, v: match.updated_at });
  return { status: 200, body: { tournamentId, role: match.role, fieldId: match.field_id, token } };
}

// ---------------------------------------------------------------------
// POST mutate { mutations: Mutation[] } uz token iz prijave
// ---------------------------------------------------------------------

export async function mutate(db: SupabaseClient, secret: string, token: string | null, body: unknown): Promise<Reply> {
  const session = verifyToken(secret, token);
  if (!session) return fail(401, 'Prijava je istekla. Upiši PIN ponovno.');
  const mutations = (body as { mutations?: Mutation[] } | null)?.mutations;
  if (!Array.isArray(mutations) || mutations.length === 0 || mutations.length > 300) {
    return fail(400, 'Neispravan zahtjev.');
  }
  if (!(await pinStillValid(db, session))) return fail(401, 'PIN je promijenjen. Upiši novi PIN.');

  const categories = new Set<string>();
  const changes: MatchChange[] = [];
  try {
    for (const raw of mutations) {
      for (const c of await apply(db, session, raw, changes)) categories.add(c);
    }
    for (const c of categories) await advance(db, session.t, c);
    return { status: 200, body: { ok: true }, changes };
  } catch (e) {
    if (e instanceof MutationError) return fail(e.status, e.message);
    console.error(e);
    const msg = (e as { message?: string })?.message ?? '';
    if (/duplicate key|already exists|23505/.test(msg)) return fail(409, 'Već postoji zapis s istim nazivom ili oznakom.');
    return fail(500, 'Spremanje nije uspjelo. Pokušaj ponovno.');
  }
}

// ---------------------------------------------------------------------
// POST upload { type, data: 'data:image/png;base64,…' } → { path } (glavni PIN)
// ---------------------------------------------------------------------

const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
const MAX_UPLOAD = 3 * 1024 * 1024;

export async function upload(db: SupabaseClient, secret: string, token: string | null, body: unknown): Promise<Reply> {
  const s = verifyToken(secret, token);
  if (!s) return fail(401, 'Prijava je istekla. Upiši PIN ponovno.');
  if (s.r !== 'admin') return fail(403, 'Za ovo treba glavni PIN.');
  const { type, data } = (body ?? {}) as { type?: string; data?: string };
  const ext = type ? TYPES[type] : undefined;
  const base64 = typeof data === 'string' ? data.replace(/^data:[^;]+;base64,/, '') : '';
  if (!ext || !base64) return fail(400, 'Slika mora biti PNG, JPG, WEBP ili SVG.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_UPLOAD) return fail(400, 'Slika je veća od 3 MB.');
  if (!(await pinStillValid(db, s))) return fail(401, 'PIN je promijenjen. Upiši novi PIN.');
  const path = `${s.t}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from('logos').upload(path, bytes, { contentType: type, upsert: false });
  if (error) {
    console.error(error);
    return fail(500, 'Slika nije spremljena.');
  }
  return { status: 200, body: { path } };
}

// ---------------------------------------------------------------------
// POST subscribe / unsubscribe: obavijesti za omiljene momčadi (bez PIN-a)
// ---------------------------------------------------------------------

export async function subscribe(db: SupabaseClient, body: unknown): Promise<Reply> {
  const err = checkSubscribe(body);
  if (err) return fail(400, err);
  const b = body as SubscribeBody;
  const { error } = await db.from('push_subscriptions').upsert({
    endpoint: b.subscription.endpoint,
    tournament_id: b.tournamentId,
    p256dh: b.subscription.keys.p256dh,
    auth: b.subscription.keys.auth,
    team_ids: b.teamIds,
    events: b.events,
  }, { onConflict: 'endpoint' });
  if (error) {
    console.error(error);
    return fail(500, 'Obavijesti nisu uključene. Pokušaj ponovno.');
  }
  return { status: 200, body: { ok: true } };
}

export async function unsubscribe(db: SupabaseClient, body: unknown): Promise<Reply> {
  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return fail(400, 'Neispravan zahtjev.');
  const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) {
    console.error(error);
    return fail(500, 'Obavijesti nisu isključene. Pokušaj ponovno.');
  }
  return { status: 200, body: { ok: true } };
}

const KEY: Partial<Record<TableName, string>> = { group_teams: 'team_id' };

/** Primijeni jednu izmjenu; vrati kategorije kojima treba preračunati nastavak. */
async function apply(db: SupabaseClient, s: TokenData, raw: Mutation, changes: MatchChange[]): Promise<string[]> {
  const actor = { role: s.r, fieldId: s.f };

  if (raw.type === 'score') {
    const { data: match } = await db.from('matches').select('*')
      .eq('id', raw.matchId).eq('tournament_id', s.t).maybeSingle();
    const m = authorize(raw, actor, match);
    if (m.type !== 'score') return [];
    const { error } = await db.from('matches').update(m.patch).eq('id', m.matchId).eq('tournament_id', s.t);
    if (error) throw error;
    const before = match as Match;
    changes.push({ before, after: { ...before, ...m.patch } as Match });
    return [before.category_id];
  }

  const m = authorize(raw, actor);

  if (m.type === 'setPin') {
    if (m.fieldId) await ensureOwn(db, 'fields', 'id', m.fieldId, s.t);
    const { error } = await db.rpc('set_pin', { p_tournament_id: s.t, p_field_id: m.fieldId, p_pin: m.pin });
    if (error) throw new MutationError(error.message.includes('već koristi') ? 'Taj PIN već koristi netko drugi u ovom turniru.' : 'PIN nije spremljen.');
    return [];
  }

  if (m.type === 'delete') {
    const key = KEY[m.table] ?? 'id';
    const { data: before } = await db.from(m.table).select('category_id').eq(key, m.id).eq('tournament_id', s.t).maybeSingle();
    const { error } = await db.from(m.table).delete().eq(key, m.id).eq('tournament_id', s.t);
    if (error) throw error;
    const cat = (before as { category_id?: string } | null)?.category_id;
    return cat && (m.table === 'matches' || m.table === 'group_teams' || m.table === 'teams') ? [cat] : [];
  }

  if (m.type !== 'upsert') return [];
  if (m.table === 'tournaments') {
    const { error } = await db.from('tournaments').update(m.row).eq('id', s.t);
    if (error) throw error;
    const { data } = await db.from('categories').select('id').eq('tournament_id', s.t);
    return (data ?? []).map((c: { id: string }) => c.id);
  }

  const key = KEY[m.table] ?? 'id';
  const id = m.row[key];
  if (typeof id !== 'string') throw new MutationError('Nedostaje oznaka zapisa.');
  // Zapis s istim id-jem ne smije pripadati drugom turniru.
  const { data: existing } = await db.from(m.table).select(m.table === 'matches' ? '*' : 'tournament_id').eq(key, id).maybeSingle();
  if (existing && (existing as { tournament_id: string }).tournament_id !== s.t) throw new MutationError('Nemaš ovlasti za taj zapis.', 403);

  const row: Record<string, unknown> = { ...m.row, tournament_id: s.t };
  const { error } = await db.from(m.table).upsert(row, { onConflict: m.table === 'group_teams' ? 'group_id,team_id' : 'id' });
  if (error) throw error;
  if (m.table === 'matches' && existing) {
    const before = existing as unknown as Match;
    changes.push({ before, after: { ...before, ...row } as Match });
  }
  const cat = row.category_id as string | undefined;
  if (m.table === 'matches' || m.table === 'group_teams') {
    if (cat) return [cat];
    const { data } = await db.from(m.table).select('category_id').eq(key, id).maybeSingle();
    return data ? [(data as { category_id: string }).category_id] : [];
  }
  return [];
}

async function ensureOwn(db: SupabaseClient, table: string, key: string, id: string, tournamentId: string) {
  const { data } = await db.from(table).select('tournament_id').eq(key, id).maybeSingle();
  if (!data || (data as { tournament_id: string }).tournament_id !== tournamentId) {
    throw new MutationError('Nemaš ovlasti za taj zapis.', 403);
  }
}

/** Upiši momčadi u sljedeću fazu prema pravilima (ista funkcija kao u pregledniku). */
async function advance(db: SupabaseClient, tournamentId: string, categoryId: string) {
  const [t, g, gt, m] = await Promise.all([
    db.from('tournaments').select('*').eq('id', tournamentId).single(),
    db.from('groups').select('*').eq('category_id', categoryId),
    db.from('group_teams').select('*').eq('category_id', categoryId),
    db.from('matches').select('*').eq('category_id', categoryId),
  ]);
  for (const r of [t, g, gt, m]) if (r.error) throw r.error;
  const updates = computeAdvancement({
    groups: g.data as Group[],
    groupTeams: gt.data as GroupTeam[],
    matches: m.data as Match[],
    settings: t.data as Tournament,
  });
  for (const u of updates) {
    const { error } = await db.from('matches')
      .update({ home_team_id: u.home_team_id, away_team_id: u.away_team_id })
      .eq('id', u.id).eq('tournament_id', tournamentId);
    if (error) throw error;
  }
}

export { notify, type MatchChange } from './notify.js';
export type { VapidKeys } from './push.js';
export { b64urlEncode, rawPublicKey } from './push.js';
