// Serverski dio: provjera PIN-a i sve izmjene. Ne ovisi o tome gdje radi;
// pokreće ga Supabase Edge Function (supabase/functions/api), koja daje
// klijent s ključem service_role i tajnu za potpisivanje prijave.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeAdvancement } from '../src/lib/advancement.js';
import { authorize, CONTENT_TABLES, isOrgTable, MutationError, ORG_MUTATIONS, type CopyOptions, type Mutation, type NewTournament, type TableName } from '../src/lib/mutations.js';
import type { Group, GroupTeam, Match, Role, Tournament } from '../src/lib/types.js';
import { checkSubscribe, FCM_PREFIX, type MatchChange, type SubscribeBody } from './notify.js';

export interface TokenData {
  t: string; // tournament id; '*' za organizaciju (svi turniri)
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
  const { data } = s.r === 'owner'
    ? await db.from('org_pins').select('updated_at').eq('id', s.p).maybeSingle()
    : await db.from('pins').select('updated_at').eq('id', s.p).eq('tournament_id', s.t).maybeSingle();
  return !!data && new Date((data as { updated_at: string }).updated_at).getTime() === new Date(s.v).getTime();
}

const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// ---------------------------------------------------------------------
// POST login { tournamentId?, pin } → { tournamentId, slug, role, fieldId, token }
// Bez turnira: prvo PIN organizacije, pa PIN-ovi turnira koji su u tijeku.
// ---------------------------------------------------------------------

interface PinRow { id: string; role: Role; field_id: string | null; updated_at: string }

async function checkPin(db: SupabaseClient, tournamentId: string, pin: string): Promise<PinRow | null> {
  const { data, error } = await db.rpc('check_pin', { p_tournament_id: tournamentId, p_pin: pin });
  if (error) throw error;
  return (data as PinRow[])[0] ?? null;
}

export async function login(db: SupabaseClient, secret: string, body: unknown): Promise<Reply> {
  const { tournamentId, pin } = (body ?? {}) as { tournamentId?: unknown; pin?: unknown };
  if (typeof pin !== 'string' || !/^[0-9]{4,8}$/.test(pin) || (tournamentId != null && !isUuid(tournamentId))) {
    return fail(401, 'PIN nije točan.');
  }
  try {
    if (isUuid(tournamentId)) {
      const { data: t } = await db.from('tournaments').select('slug, closed_at').eq('id', tournamentId).maybeSingle();
      const tour = t as { slug: string; closed_at: string | null } | null;
      const match = tour ? await checkPin(db, tournamentId, pin) : null;
      if (match) {
        if (tour!.closed_at && match.role === 'field') return fail(403, 'Turnir je završen. PIN terena više ne vrijedi.');
        const token = signToken(secret, { t: tournamentId, r: match.role, f: match.field_id, p: match.id, v: match.updated_at });
        return { status: 200, body: { tournamentId, slug: tour!.slug, role: match.role, fieldId: match.field_id, token } };
      }
    }
    // PIN organizacije vrijedi svugdje.
    const { data: org, error } = await db.rpc('check_org_pin', { p_pin: pin });
    if (error) throw error;
    const o = (org as { id: string; updated_at: string }[])[0];
    if (o) {
      const token = signToken(secret, { t: '*', r: 'owner', f: null, p: o.id, v: o.updated_at });
      return { status: 200, body: { tournamentId: isUuid(tournamentId) ? tournamentId : null, role: 'owner', fieldId: null, token } };
    }
    if (isUuid(tournamentId)) return fail(401, 'PIN nije točan.');
    // Bez odabranog turnira: turniri koji nisu zaključeni.
    const { data: open } = await db.from('tournaments').select('id, slug').is('closed_at', null).order('start_date', { ascending: false });
    for (const t of (open ?? []) as { id: string; slug: string }[]) {
      const match = await checkPin(db, t.id, pin);
      if (match) {
        const token = signToken(secret, { t: t.id, r: match.role, f: match.field_id, p: match.id, v: match.updated_at });
        return { status: 200, body: { tournamentId: t.id, slug: t.slug, role: match.role, fieldId: match.field_id, token } };
      }
    }
    return fail(401, 'PIN nije točan.');
  } catch (e) {
    console.error(e);
    return fail(500, 'Prijava trenutno ne radi. Pokušaj ponovno.');
  }
}

// ---------------------------------------------------------------------
// POST mutate { mutations: Mutation[] } uz token iz prijave
// ---------------------------------------------------------------------

export async function mutate(db: SupabaseClient, secret: string, token: string | null, body: unknown): Promise<Reply> {
  const session = verifyToken(secret, token);
  if (!session) return fail(401, 'Prijava je istekla. Upiši PIN ponovno.');
  const { mutations, tournamentId } = (body ?? {}) as { mutations?: Mutation[]; tournamentId?: unknown };
  if (!Array.isArray(mutations) || mutations.length === 0 || mutations.length > 300) {
    return fail(400, 'Neispravan zahtjev.');
  }
  if (!(await pinStillValid(db, session))) return fail(401, 'PIN je promijenjen. Upiši novi PIN.');

  // Organizacija radi u turniru koji je odabrala.
  let s = session;
  if (session.r === 'owner') {
    const needsTournament = mutations.some((m) => !ORG_MUTATIONS.has(m?.type) && !(m?.type !== 'score' && 'table' in m && isOrgTable(m.table)));
    if (needsTournament) {
      if (!isUuid(tournamentId)) return fail(400, 'Odaberi turnir.');
      const { data } = await db.from('tournaments').select('id').eq('id', tournamentId).maybeSingle();
      if (!data) return fail(404, 'Turnir ne postoji.');
      s = { ...session, t: tournamentId };
    }
  }

  const categories = new Set<string>();
  const changes: MatchChange[] = [];
  const out: Record<string, unknown> = {};
  try {
    for (const raw of mutations) {
      for (const c of await apply(db, s, raw, changes, out)) categories.add(c);
    }
    for (const c of categories) await advance(db, s.t, c);
    return { status: 200, body: { ok: true, ...out }, changes };
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
  if (s.r !== 'admin' && s.r !== 'owner') return fail(403, 'Za ovo treba glavni PIN.');
  const { type, data } = (body ?? {}) as { type?: string; data?: string };
  const ext = type ? TYPES[type] : undefined;
  const base64 = typeof data === 'string' ? data.replace(/^data:[^;]+;base64,/, '') : '';
  if (!ext || !base64) return fail(400, 'Slika mora biti PNG, JPG, WEBP ili SVG.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_UPLOAD) return fail(400, 'Slika je veća od 3 MB.');
  if (!(await pinStillValid(db, s))) return fail(401, 'PIN je promijenjen. Upiši novi PIN.');
  const path = `${s.t === '*' ? 'klubovi' : s.t}/${crypto.randomUUID()}.${ext}`;
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
    endpoint: b.fcmToken ? FCM_PREFIX + b.fcmToken : b.subscription!.endpoint,
    tournament_id: b.tournamentId ?? null,
    p256dh: b.fcmToken ? '' : b.subscription!.keys.p256dh,
    auth: b.fcmToken ? '' : b.subscription!.keys.auth,
    team_ids: b.teamIds,
    club_ids: b.clubIds ?? [],
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
async function apply(db: SupabaseClient, s: TokenData, raw: Mutation, changes: MatchChange[], out: Record<string, unknown>): Promise<string[]> {
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

  if (m.type === 'createTournament') {
    out.created = await createTournament(db, m.row, m.copyFrom ?? null, m.copy ?? {});
    return [];
  }

  if (m.type === 'setOrgPin') {
    const { error } = await db.rpc('set_org_pin', { p_label: m.label, p_pin: m.pin });
    if (error) throw new MutationError(error.message.includes('već koristi') ? 'Taj PIN već koristi netko drugi.' : 'PIN nije spremljen.');
    return [];
  }

  if (m.type === 'closeTournament') {
    const { error } = await db.from('tournaments').update({ closed_at: m.reopen ? null : new Date().toISOString() }).eq('id', s.t);
    if (error) throw error;
    // Zaključan turnir: PIN-ovi terena prestaju vrijediti.
    if (!m.reopen) await db.from('pins').delete().eq('tournament_id', s.t).eq('role', 'field');
    return [];
  }

  if ((m.type === 'upsert' || m.type === 'delete') && m.table === 'clubs') {
    if (m.type === 'delete') {
      const { error } = await db.from('clubs').delete().eq('id', m.id);
      if (error) throw error;
      return [];
    }
    if (typeof m.row.name !== 'string' || !m.row.name.trim()) throw new MutationError('Upiši naziv kluba.');
    const { error } = await db.from('clubs').upsert({ ...m.row, name: m.row.name.trim() }, { onConflict: 'id' });
    if (error) throw error;
    return [];
  }

  if ((m.type === 'upsert' || m.type === 'delete') && CONTENT_TABLES.has(m.table)) {
    await applyContent(db, m);
    return [];
  }

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

/** Novi turnir; po želji s godištima, terenima i momčadima iz prethodnog. */
async function createTournament(db: SupabaseClient, row: NewTournament, copyFrom: string | null, copy: CopyOptions): Promise<{ id: string; slug: string }> {
  const { data: taken } = await db.from('tournaments').select('id').eq('slug', row.slug).maybeSingle();
  if (taken) throw new MutationError('Turnir s tom adresom već postoji.', 409);

  let base: Partial<Tournament> = {};
  if (copyFrom) {
    if (!isUuid(copyFrom)) throw new MutationError('Nepoznat turnir za kopiranje.');
    const { data } = await db.from('tournaments').select('*').eq('id', copyFrom).maybeSingle();
    if (!data) throw new MutationError('Nepoznat turnir za kopiranje.');
    base = data as Tournament;
  }
  const { data: created, error } = await db.from('tournaments').insert({
    ...row,
    series: row.series ?? base.series ?? null,
    timezone: base.timezone ?? 'Europe/Zagreb',
    logo_path: base.logo_path ?? null,
    color_primary: base.color_primary ?? '#019c61',
    color_secondary: base.color_secondary ?? '#061a10',
    description: base.description ?? null,
    rules: base.rules ?? null,
    points_win: base.points_win ?? 3,
    points_draw: base.points_draw ?? 1,
    points_loss: base.points_loss ?? 0,
    tiebreakers: base.tiebreakers ?? ['head_to_head', 'goal_difference', 'goals_for', 'fewer_goals_against', 'fewer_cards', 'lot'],
    scorers_enabled: base.scorers_enabled ?? false,
    is_published: false,
  }).select('id, slug').single();
  if (error) throw error;
  const t = created as { id: string; slug: string };
  if (!copyFrom) return t;

  const catMap = new Map<string, string>();
  if (copy.categories || copy.teams) {
    const { data: cats } = await db.from('categories').select('*').eq('tournament_id', copyFrom);
    const rows = ((cats ?? []) as { id: string; name: string; birth_year: number | null; match_minutes: number; players_on_field: number | null; sort_order: number }[])
      .map((c) => {
        const id = crypto.randomUUID();
        catMap.set(c.id, id);
        return { id, tournament_id: t.id, name: c.name, birth_year: c.birth_year, match_minutes: c.match_minutes, players_on_field: c.players_on_field, sort_order: c.sort_order };
      });
    if (rows.length) {
      const { error: e } = await db.from('categories').insert(rows);
      if (e) throw e;
    }
  }
  if (copy.fields) {
    const { data: fields } = await db.from('fields').select('name, venue, maps_url, sort_order').eq('tournament_id', copyFrom);
    const rows = ((fields ?? []) as Record<string, unknown>[]).map((f) => ({ ...f, tournament_id: t.id }));
    if (rows.length) {
      const { error: e } = await db.from('fields').insert(rows);
      if (e) throw e;
    }
  }
  if (copy.teams) {
    const { data: teams } = await db.from('teams').select('category_id, name, short_name, logo_path, club_id').eq('tournament_id', copyFrom);
    const rows = ((teams ?? []) as { category_id: string }[])
      .filter((x) => catMap.has(x.category_id))
      .map((x) => ({ ...x, category_id: catMap.get(x.category_id), tournament_id: t.id }));
    if (rows.length) {
      const { error: e } = await db.from('teams').insert(rows);
      if (e) throw e;
    }
  }
  return t;
}

/** Vijesti, galerija, video, sponzori, tekstovi stranica, poruke (samo organizacija). */
async function applyContent(db: SupabaseClient, m: Extract<Mutation, { type: 'upsert' | 'delete' }>) {
  if (m.type === 'delete') {
    if (!isUuid(m.id)) throw new MutationError('Nedostaje oznaka zapisa.');
    const { error } = await db.from(m.table).delete().eq('id', m.id);
    if (error) throw error;
    return;
  }
  if (m.table === 'site_settings') {
    const { error } = await db.from('site_settings').upsert({ ...m.row, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    return;
  }
  if (!isUuid(m.row.id)) throw new MutationError('Nedostaje oznaka zapisa.');
  if (m.table === 'contact_messages') {
    const { error } = await db.from('contact_messages').update({ handled: m.row.handled }).eq('id', m.row.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from(m.table).upsert(m.row, { onConflict: 'id' });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// POST contact { name, email, phone?, message, website (zamka za robote) }
// POST messages (PIN organizacije) → poruke s kontakt forme
// ---------------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recent = new Map<string, number[]>();

export async function contact(db: SupabaseClient, body: unknown, ip = ''): Promise<Reply> {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() : '');
  // Robot je ispunio skriveno polje: tiho „uspije”, ništa se ne sprema.
  if (str('website')) return { status: 200, body: { ok: true } };
  const name = str('name'), email = str('email'), phone = str('phone'), message = str('message');
  if (!name || name.length > 120) return fail(400, 'Upiši ime i prezime.');
  if (!EMAIL.test(email) || email.length > 200) return fail(400, 'Upiši ispravnu e-mail adresu.');
  if (phone.length > 40) return fail(400, 'Broj telefona je predugačak.');
  if (message.length < 5 || message.length > 4000) return fail(400, 'Napiši poruku (najviše 4000 znakova).');
  if (b.consent !== true) return fail(400, 'Potvrdi da smijemo spremiti tvoje podatke radi odgovora.');
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60000);
  if (list.length >= 5) return fail(429, 'Poslano je previše poruka. Pokušaj ponovno za nekoliko minuta.');
  recent.set(ip, [...list, now]);
  const { error } = await db.from('contact_messages').insert({ name, email, phone: phone || null, message });
  if (error) {
    console.error(error);
    return fail(500, 'Poruka nije poslana. Pokušaj ponovno.');
  }
  return { status: 200, body: { ok: true } };
}

export async function messages(db: SupabaseClient, secret: string, token: string | null): Promise<Reply> {
  const s = verifyToken(secret, token);
  if (!s) return fail(401, 'Prijava je istekla. Upiši PIN ponovno.');
  if (s.r !== 'owner') return fail(403, 'Za ovo treba PIN organizacije.');
  if (!(await pinStillValid(db, s))) return fail(401, 'PIN je promijenjen. Upiši novi PIN.');
  const { data, error } = await db.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) {
    console.error(error);
    return fail(500, 'Poruke se ne mogu učitati.');
  }
  return { status: 200, body: { messages: data } };
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
export type { ServiceAccount } from './fcm.js';
export { b64urlEncode, rawPublicKey } from './push.js';
