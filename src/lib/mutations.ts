// Izmjene podataka. Isti opis izmjene koristi demo način (primjenjuje ga
// u pregledniku) i serverska funkcija api/mutate (primjenjuje ga u bazi),
// pa su pravila o tome tko smije što na jednom mjestu.

import { computeAdvancement, type TeamAssignment } from './advancement.js';
import type { Match, MatchStatus, Role, Snapshot } from './types.js';

export type TableName = 'tournaments' | 'categories' | 'fields' | 'teams' | 'groups' | 'group_teams' | 'matches';

export interface ScorePatch {
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  status: MatchStatus;
  home_yellow?: number;
  away_yellow?: number;
  home_red?: number;
  away_red?: number;
}

export type Mutation =
  | { type: 'score'; matchId: string; patch: ScorePatch }
  | { type: 'upsert'; table: TableName; row: Record<string, unknown> }
  | { type: 'delete'; table: TableName; id: string }
  | { type: 'setPin'; fieldId: string | null; pin: string };

export interface Actor {
  role: Role;
  fieldId: string | null;
}

/** Polja koja smije mijenjati organizator, po tablici. */
const EDITABLE: Record<TableName, string[]> = {
  tournaments: ['name', 'place', 'venue', 'start_date', 'end_date', 'logo_path', 'cover_path', 'color_primary',
    'color_secondary', 'description', 'rules', 'points_win', 'points_draw', 'points_loss', 'tiebreakers',
    'scorers_enabled', 'is_published'],
  categories: ['id', 'name', 'birth_year', 'match_minutes', 'players_on_field', 'sort_order'],
  fields: ['id', 'name', 'venue', 'maps_url', 'sort_order'],
  teams: ['id', 'category_id', 'name', 'short_name', 'logo_path'],
  groups: ['id', 'category_id', 'name', 'sort_order'],
  group_teams: ['category_id', 'group_id', 'team_id', 'lot_rank'],
  matches: ['id', 'category_id', 'stage', 'group_id', 'code', 'label', 'home_team_id', 'away_team_id',
    'home_source', 'away_source', 'field_id', 'starts_at', 'duration_minutes', 'home_score', 'away_score',
    'home_penalties', 'away_penalties', 'status', 'home_yellow', 'away_yellow', 'home_red', 'away_red', 'bracket',
    'winner_place', 'loser_place', 'teams_locked'],
};

export class MutationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function validScore(n: number | null): boolean {
  return n === null || (Number.isInteger(n) && n >= 0 && n < 100);
}

export function validateScorePatch(p: ScorePatch): void {
  if (![p.home_score, p.away_score, p.home_penalties, p.away_penalties].every(validScore)) {
    throw new MutationError('Rezultat mora biti cijeli broj od 0 do 99.');
  }
  if ((p.home_score === null) !== (p.away_score === null)) throw new MutationError('Upiši golove za obje momčadi.');
  if ((p.home_penalties === null) !== (p.away_penalties === null)) throw new MutationError('Upiši jedanaesterce za obje momčadi.');
  if (p.status === 'finished' && p.home_score === null) throw new MutationError('Završena utakmica mora imati rezultat.');
  if (!['scheduled', 'live', 'finished', 'cancelled'].includes(p.status)) throw new MutationError('Nepoznat status.');
  for (const c of [p.home_yellow, p.away_yellow, p.home_red, p.away_red]) {
    if (c !== undefined && !(Number.isInteger(c) && c >= 0 && c < 30)) throw new MutationError('Broj kartona nije ispravan.');
  }
}

/**
 * Provjeri smije li osoba napraviti izmjenu i vrati očišćen redak.
 * `match` je utakmica iz baze kad se upisuje rezultat.
 */
export function authorize(m: Mutation, actor: Actor, match?: Pick<Match, 'field_id'> | null): Mutation {
  if (m.type === 'score') {
    if (!match) throw new MutationError('Utakmica ne postoji.', 404);
    if (actor.role === 'field' && match.field_id !== actor.fieldId) {
      throw new MutationError('Ova utakmica nije na tvom terenu.', 403);
    }
    validateScorePatch(m.patch);
    const { home_score, away_score, home_penalties, away_penalties, status, home_yellow, away_yellow, home_red, away_red } = m.patch;
    const cards = Object.fromEntries(Object.entries({ home_yellow, away_yellow, home_red, away_red }).filter(([, v]) => v !== undefined));
    return { type: 'score', matchId: m.matchId, patch: { home_score, away_score, home_penalties, away_penalties, status, ...cards } };
  }
  if (actor.role !== 'admin') throw new MutationError('Za ovo treba glavni PIN.', 403);
  if (m.type === 'setPin') {
    if (!/^[0-9]{4,8}$/.test(m.pin)) throw new MutationError('PIN mora imati 4 do 8 znamenki.');
    return m;
  }
  if (!(m.table in EDITABLE)) throw new MutationError('Nepoznata tablica.');
  if (m.type === 'delete') {
    if (m.table === 'tournaments') throw new MutationError('Turnir se ne briše iz aplikacije.', 403);
    return m;
  }
  const allowed = EDITABLE[m.table];
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m.row)) if (allowed.includes(k)) row[k] = v;
  if (m.table === 'matches' && row.status === 'finished' && row.home_score == null) {
    throw new MutationError('Završena utakmica mora imati rezultat.');
  }
  return { ...m, row };
}

/** Kategorije na koje izmjena može utjecati (za ponovni izračun ždrijeba). */
export function affectedCategories(m: Mutation, s: Snapshot): string[] {
  if (m.type === 'score') {
    const match = s.matches.find((x) => x.id === m.matchId);
    return match ? [match.category_id] : [];
  }
  if (m.type === 'setPin') return [];
  if (m.table === 'tournaments') return s.categories.map((c) => c.id);
  if (m.table === 'matches' || m.table === 'group_teams') {
    const fromRow = m.type === 'upsert' ? (m.row.category_id as string | undefined) : undefined;
    if (fromRow) return [fromRow];
    if (m.type === 'upsert' && m.table === 'matches') {
      const existing = s.matches.find((x) => x.id === m.row.id);
      return existing ? [existing.category_id] : [];
    }
    return s.categories.map((c) => c.id);
  }
  return [];
}

/** Momčadi za sljedeću fazu u jednoj kategoriji, prema trenutnim podacima. */
export function advancementFor(s: Snapshot, categoryId: string): TeamAssignment[] {
  return computeAdvancement({
    groups: s.groups.filter((g) => g.category_id === categoryId),
    groupTeams: s.groupTeams.filter((gt) => gt.category_id === categoryId),
    matches: s.matches.filter((m) => m.category_id === categoryId),
    settings: s.tournament,
  });
}

// ---------------------------------------------------------------------
// Primjena na snimku podataka (demo način)
// ---------------------------------------------------------------------

const KEY: Record<TableName, keyof Snapshot> = {
  tournaments: 'tournament', categories: 'categories', fields: 'fields', teams: 'teams',
  groups: 'groups', group_teams: 'groupTeams', matches: 'matches',
};

function rowKey(table: TableName, row: Record<string, unknown>): string {
  return table === 'group_teams' ? String(row.team_id) : String(row.id);
}

export function applyToSnapshot(s: Snapshot, m: Mutation): Snapshot {
  const next: Snapshot = structuredClone(s);
  if (m.type === 'setPin') return next;
  if (m.type === 'score') {
    const match = next.matches.find((x) => x.id === m.matchId);
    if (match) Object.assign(match, m.patch);
  } else if (m.table === 'tournaments') {
    if (m.type === 'upsert') Object.assign(next.tournament, m.row);
  } else {
    const list = next[KEY[m.table]] as unknown as Record<string, unknown>[];
    if (m.type === 'delete') {
      const i = list.findIndex((r) => rowKey(m.table, r) === m.id);
      if (i >= 0) list.splice(i, 1);
      cascadeDelete(next, m.table, m.id);
    } else {
      const row = { tournament_id: s.tournament.id, ...m.row };
      const existing = list.find((r) => rowKey(m.table, r) === rowKey(m.table, row));
      if (existing) Object.assign(existing, row);
      else list.push(row);
    }
  }
  for (const c of affectedCategories(m, next)) {
    for (const u of advancementFor(next, c)) {
      Object.assign(next.matches.find((x) => x.id === u.id)!, u);
    }
  }
  return next;
}

/** Isto što rade strani ključevi u bazi. */
function cascadeDelete(s: Snapshot, table: TableName, id: string): void {
  if (table === 'categories') {
    s.teams = s.teams.filter((t) => t.category_id !== id);
    s.groups = s.groups.filter((g) => g.category_id !== id);
    s.groupTeams = s.groupTeams.filter((g) => g.category_id !== id);
    s.matches = s.matches.filter((m) => m.category_id !== id);
  } else if (table === 'teams') {
    s.groupTeams = s.groupTeams.filter((g) => g.team_id !== id);
    for (const m of s.matches) {
      if (m.home_team_id === id) m.home_team_id = null;
      if (m.away_team_id === id) m.away_team_id = null;
    }
  } else if (table === 'groups') {
    s.groupTeams = s.groupTeams.filter((g) => g.group_id !== id);
    for (const m of s.matches) if (m.group_id === id) m.group_id = null;
  } else if (table === 'fields') {
    for (const m of s.matches) if (m.field_id === id) m.field_id = null;
  }
}
