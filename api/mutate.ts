import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeAdvancement } from '../src/lib/advancement.js';
import { authorize, MutationError, type Mutation, type TableName } from '../src/lib/mutations.js';
import type { Group, GroupTeam, Match, Tournament } from '../src/lib/types.js';
import { admin, fail, onlyPost, pinStillValid, verifyToken, type TokenData } from './_lib.js';

// POST { mutations: Mutation[] }, Authorization: Bearer <token iz /api/login>
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!onlyPost(req, res)) return;
  const session = verifyToken(req.headers.authorization);
  if (!session) return fail(res, 401, 'Prijava je istekla. Upiši PIN ponovno.');

  const mutations = (req.body as { mutations?: Mutation[] })?.mutations;
  if (!Array.isArray(mutations) || mutations.length === 0 || mutations.length > 300) {
    return fail(res, 400, 'Neispravan zahtjev.');
  }

  const db = admin();
  if (!(await pinStillValid(db, session))) return fail(res, 401, 'PIN je promijenjen. Upiši novi PIN.');
  const categories = new Set<string>();
  try {
    for (const raw of mutations) {
      for (const c of await apply(db, session, raw)) categories.add(c);
    }
    for (const c of categories) await advance(db, session.t, c);
    res.status(200).json({ ok: true });
  } catch (e) {
    if (e instanceof MutationError) return fail(res, e.status, e.message);
    console.error(e);
    const msg = (e as { message?: string })?.message ?? '';
    if (/duplicate key|already exists|23505/.test(msg)) return fail(res, 409, 'Već postoji zapis s istim nazivom ili oznakom.');
    fail(res, 500, 'Spremanje nije uspjelo. Pokušaj ponovno.');
  }
}

const KEY: Partial<Record<TableName, string>> = { group_teams: 'team_id' };

/** Primijeni jednu izmjenu; vrati kategorije kojima treba preračunati nastavak. */
async function apply(db: SupabaseClient, s: TokenData, raw: Mutation): Promise<string[]> {
  const actor = { role: s.r, fieldId: s.f };

  if (raw.type === 'score') {
    const { data: match } = await db.from('matches').select('id, field_id, category_id, tournament_id')
      .eq('id', raw.matchId).eq('tournament_id', s.t).maybeSingle();
    const m = authorize(raw, actor, match);
    if (m.type !== 'score') return [];
    const { error } = await db.from('matches').update(m.patch).eq('id', m.matchId).eq('tournament_id', s.t);
    if (error) throw error;
    return [match!.category_id];
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
  const { data: existing } = await db.from(m.table).select('tournament_id').eq(key, id).maybeSingle();
  if (existing && (existing as { tournament_id: string }).tournament_id !== s.t) throw new MutationError('Nemaš ovlasti za taj zapis.', 403);

  const row: Record<string, unknown> = { ...m.row, tournament_id: s.t };
  const { error } = await db.from(m.table).upsert(row, { onConflict: m.table === 'group_teams' ? 'group_id,team_id' : 'id' });
  if (error) throw error;
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
