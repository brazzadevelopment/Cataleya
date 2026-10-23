import { computeGroupTable, teamAtPosition, type GroupTable, type TableSettings } from './standings.js';
import type { Group, GroupTeam, Match } from './types.js';

// ---------------------------------------------------------------------
// Mjesta u utakmicama sljedeće faze: '1A', 'W:ČF1', 'L:PF2'
// ---------------------------------------------------------------------

export type Source =
  | { kind: 'group'; position: number; group: string }
  | { kind: 'winner'; code: string }
  | { kind: 'loser'; code: string };

export function parseSource(raw: string | null | undefined): Source | null {
  if (!raw) return null;
  const s = raw.trim();
  const g = /^([1-9][0-9]?)\s*\.?\s*([A-Z]{1,2})$/.exec(s.toUpperCase());
  if (g) return { kind: 'group', position: Number(g[1]), group: g[2] };
  const wl = /^([WL]):(\S{1,12})$/.exec(s);
  if (wl) return { kind: wl[1] === 'W' ? 'winner' : 'loser', code: wl[2] };
  return null;
}

export function formatSource(src: Source): string {
  return src.kind === 'group'
    ? `${src.position}. ${src.group}`
    : src.kind === 'winner'
      ? `Pobjednik ${src.code}`
      : `Poraženi ${src.code}`;
}

export function sourceLabel(raw: string | null | undefined): string | null {
  const src = parseSource(raw);
  return src ? formatSource(src) : null;
}

// ---------------------------------------------------------------------
// Ishod utakmice
// ---------------------------------------------------------------------

export interface Outcome {
  winner: string;
  loser: string;
}

/**
 * Pobjednik i poraženi u završenoj utakmici. Kod neriješenog odlučuju
 * jedanaesterci; bez njih (ili ako su i oni neriješeni) nema pobjednika.
 */
export function matchOutcome(m: Match): Outcome | null {
  if (m.status !== 'finished' || !m.home_team_id || !m.away_team_id) return null;
  if (m.home_score == null || m.away_score == null) return null;
  let homeWins: boolean;
  if (m.home_score !== m.away_score) {
    homeWins = m.home_score > m.away_score;
  } else if (m.home_penalties != null && m.away_penalties != null && m.home_penalties !== m.away_penalties) {
    homeWins = m.home_penalties > m.away_penalties;
  } else {
    return null;
  }
  return homeWins
    ? { winner: m.home_team_id, loser: m.away_team_id }
    : { winner: m.away_team_id, loser: m.home_team_id };
}

// ---------------------------------------------------------------------
// Automatsko upisivanje u sljedeću fazu
// ---------------------------------------------------------------------

export interface CategoryData {
  groups: Group[];
  groupTeams: GroupTeam[];
  matches: Match[];
  settings: TableSettings;
}

export interface TeamAssignment {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
}

export function groupTables(data: Pick<CategoryData, 'groups' | 'groupTeams' | 'matches' | 'settings'>): Map<string, GroupTable> {
  const tables = new Map<string, GroupTable>();
  for (const g of data.groups) {
    tables.set(
      g.name,
      computeGroupTable(
        data.groupTeams.filter((gt) => gt.group_id === g.id),
        data.matches.filter((m) => m.group_id === g.id && m.stage === 'group'),
        data.settings,
      ),
    );
  }
  return tables;
}

function resolve(src: Source | null, tables: Map<string, GroupTable>, byCode: Map<string, Match>): string | null {
  if (!src) return null;
  if (src.kind === 'group') {
    const table = tables.get(src.group);
    return table ? teamAtPosition(table, src.position) : null;
  }
  const m = byCode.get(src.code);
  const outcome = m ? matchOutcome(m) : null;
  if (!outcome) return null;
  return src.kind === 'winner' ? outcome.winner : outcome.loser;
}

/**
 * Koje momčadi treba upisati u utakmice sljedeće faze jedne kategorije.
 *
 * Mijenja samo utakmice koje imaju upisano pravilo (home_source / away_source),
 * nisu ručno zaključane i još nisu počele. Mjesto ostaje prazno dok ishod
 * nije siguran (skupina nije gotova, izjednačenje bez ždrijeba, neriješeno
 * bez jedanaesteraca).
 *
 * Vraća samo utakmice kojima se nešto mijenja.
 */
export function computeAdvancement(data: CategoryData): TeamAssignment[] {
  const tables = groupTables(data);
  const current = new Map(data.matches.map((m) => [m.id, { ...m }]));
  const changed = new Set<string>();

  // Ponavlja dok se nešto mijenja; dovoljno je jer se ishodi čitaju samo
  // iz završenih utakmica, a mijenjaju se samo nezapočete.
  for (let pass = 0; pass < 10; pass++) {
    const byCode = new Map([...current.values()].filter((m) => m.code).map((m) => [m.code!, m]));
    let any = false;
    for (const m of current.values()) {
      if (m.teams_locked || m.status !== 'scheduled') continue;
      if (!m.home_source && !m.away_source) continue;
      const home = m.home_source ? resolve(parseSource(m.home_source), tables, byCode) : m.home_team_id;
      const away = m.away_source ? resolve(parseSource(m.away_source), tables, byCode) : m.away_team_id;
      if (home !== m.home_team_id || away !== m.away_team_id) {
        m.home_team_id = home;
        m.away_team_id = away;
        changed.add(m.id);
        any = true;
      }
    }
    if (!any) break;
  }

  return [...changed].map((id) => {
    const m = current.get(id)!;
    return { id, home_team_id: m.home_team_id, away_team_id: m.away_team_id };
  });
}

// ---------------------------------------------------------------------
// Konačni poredak
// ---------------------------------------------------------------------

export interface FinalPlace {
  place: number;
  teamId: string;
  matchId: string;
}

/** Mjesta iz završenih utakmica kojima je organizator dodijelio plasman. */
export function finalRanking(matches: Match[]): FinalPlace[] {
  const out: FinalPlace[] = [];
  for (const m of matches) {
    if (m.winner_place == null && m.loser_place == null) continue;
    const o = matchOutcome(m);
    if (!o) continue;
    if (m.winner_place != null) out.push({ place: m.winner_place, teamId: o.winner, matchId: m.id });
    if (m.loser_place != null) out.push({ place: m.loser_place, teamId: o.loser, matchId: m.id });
  }
  return out.sort((a, b) => a.place - b.place);
}
