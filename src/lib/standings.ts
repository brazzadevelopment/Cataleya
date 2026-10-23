import type { GroupTeam, Match, Tiebreaker } from './types.js';

export interface TableSettings {
  points_win: number;
  points_draw: number;
  points_loss: number;
  /** Kriteriji nakon bodova, redom kako ih je organizator postavio. */
  tiebreakers: Tiebreaker[];
}

export interface TableRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Žuti i crveni kartoni ukupno. */
  cards: number;
  /** Mjesto u skupini (1 = prvo). Momčadi koje nisu razdvojene dijele mjesto. */
  rank: number;
  /** Kriteriji nisu razdvojili ovu momčad od druge; organizator treba odrediti redoslijed. */
  needsLot: boolean;
}

export interface GroupTable {
  rows: TableRow[];
  /** Sve utakmice skupine su završene (otkazane se ne broje). */
  complete: boolean;
  /** Postoji izjednačenje koje samo organizator može riješiti. */
  needsLot: boolean;
}

interface Totals {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  cards: number;
}

const emptyTotals = (): Totals => ({
  played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, cards: 0,
});

function isCounted(m: Match): m is Match & { home_team_id: string; away_team_id: string; home_score: number; away_score: number } {
  return m.status === 'finished'
    && m.home_team_id != null && m.away_team_id != null
    && m.home_score != null && m.away_score != null;
}

function totalsFor(teamIds: string[], matches: Match[], s: TableSettings): Map<string, Totals> {
  const ids = new Set(teamIds);
  const out = new Map<string, Totals>(teamIds.map((id) => [id, emptyTotals()]));
  for (const m of matches) {
    if (!isCounted(m) || !ids.has(m.home_team_id) || !ids.has(m.away_team_id)) continue;
    const h = out.get(m.home_team_id)!;
    const a = out.get(m.away_team_id)!;
    h.played++; a.played++;
    h.cards += (m.home_yellow ?? 0) + (m.home_red ?? 0);
    a.cards += (m.away_yellow ?? 0) + (m.away_red ?? 0);
    h.goalsFor += m.home_score; h.goalsAgainst += m.away_score;
    a.goalsFor += m.away_score; a.goalsAgainst += m.home_score;
    if (m.home_score > m.away_score) {
      h.won++; a.lost++; h.points += s.points_win; a.points += s.points_loss;
    } else if (m.home_score < m.away_score) {
      a.won++; h.lost++; a.points += s.points_win; h.points += s.points_loss;
    } else {
      h.drawn++; a.drawn++; h.points += s.points_draw; a.points += s.points_draw;
    }
  }
  return out;
}

/**
 * Razvrsta skupinu momčadi s istim bodovima prema kriterijima, redom.
 * Vraća podskupine: svaka je jedna momčad ili više momčadi koje
 * nijedan kriterij nije razdvojio.
 *
 * Međusobni susret: mala tablica samo utakmica između momčadi u toj
 * podskupini (bodovi u tim utakmicama). Kad kriterij razdvoji dio
 * momčadi, za one koje su i dalje izjednačene ide se na sljedeći kriterij.
 */
function breakTie(
  tied: string[],
  criteria: Tiebreaker[],
  overall: Map<string, Totals>,
  matches: Match[],
  lot: Map<string, number | null>,
  s: TableSettings,
): string[][] {
  if (tied.length < 2 || criteria.length === 0) return [tied];
  const [criterion, ...rest] = criteria;

  let key: (id: string) => number | null;
  switch (criterion) {
    case 'head_to_head': {
      const h2h = totalsFor(tied, matches, s);
      key = (id) => h2h.get(id)!.points;
      break;
    }
    case 'goal_difference':
      key = (id) => overall.get(id)!.goalsFor - overall.get(id)!.goalsAgainst;
      break;
    case 'goals_for':
      key = (id) => overall.get(id)!.goalsFor;
      break;
    case 'wins':
      key = (id) => overall.get(id)!.won;
      break;
    case 'fewer_goals_against':
      key = (id) => -overall.get(id)!.goalsAgainst;
      break;
    case 'fewer_cards':
      key = (id) => -overall.get(id)!.cards;
      break;
    case 'lot':
      // Bez upisanog ždrijeba nema razdvajanja.
      if (tied.some((id) => lot.get(id) == null)) return breakTie(tied, rest, overall, matches, lot, s);
      key = (id) => -(lot.get(id) as number);
      break;
  }

  const buckets = new Map<number, string[]>();
  for (const id of tied) {
    const k = key(id) ?? 0;
    buckets.set(k, [...(buckets.get(k) ?? []), id]);
  }
  const ordered = [...buckets.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);
  if (ordered.length === 1) return breakTie(tied, rest, overall, matches, lot, s);
  return ordered.flatMap((ids) => breakTie(ids, rest, overall, matches, lot, s));
}

/** Tablica jedne skupine iz rezultata njezinih utakmica. */
export function computeGroupTable(
  groupTeams: Pick<GroupTeam, 'team_id' | 'lot_rank'>[],
  groupMatches: Match[],
  settings: TableSettings,
  /** Za ispis kad su momčadi potpuno jednake; ne utječe na mjesto. */
  displayName: (teamId: string) => string = (id) => id,
): GroupTable {
  const teamIds = groupTeams.map((gt) => gt.team_id);
  const lot = new Map(groupTeams.map((gt) => [gt.team_id, gt.lot_rank]));
  const overall = totalsFor(teamIds, groupMatches, settings);

  const byPoints = new Map<number, string[]>();
  for (const id of teamIds) {
    const p = overall.get(id)!.points;
    byPoints.set(p, [...(byPoints.get(p) ?? []), id]);
  }
  const blocks = [...byPoints.entries()]
    .sort((a, b) => b[0] - a[0])
    .flatMap(([, ids]) => breakTie(ids, settings.tiebreakers, overall, groupMatches, lot, settings));

  const rows: TableRow[] = [];
  let position = 1;
  for (const block of blocks) {
    const sorted = [...block].sort((a, b) => displayName(a).localeCompare(displayName(b), 'hr'));
    for (const id of sorted) {
      const t = overall.get(id)!;
      rows.push({
        teamId: id,
        ...t,
        goalDiff: t.goalsFor - t.goalsAgainst,
        rank: position,
        needsLot: block.length > 1,
      });
    }
    position += block.length;
  }

  const relevant = groupMatches.filter((m) => m.status !== 'cancelled');
  const complete = relevant.length > 0 && relevant.every((m) => m.status === 'finished');
  return { rows, complete, needsLot: rows.some((r) => r.needsLot) };
}

/**
 * Momčad na zadanom mjestu, ali samo ako je skupina završena i to mjesto
 * nije dio neriješenog izjednačenja. Inače null.
 */
export function teamAtPosition(table: GroupTable, position: number): string | null {
  if (!table.complete) return null;
  const atRank = table.rows.filter((r) => r.rank === position);
  return atRank.length === 1 ? atRank[0].teamId : null;
}

/** Momčad s istog mjesta iz različitih skupina, npr. svi drugoplasirani. */
export interface CrossRow extends TableRow {
  groupName: string;
  /** Mjesto među momčadima s istog mjesta (1 = najbolja). Izjednačene dijele mjesto. */
  crossRank: number;
}

export interface CrossTable {
  rows: CrossRow[];
  /** Sve skupine su gotove i svako mjesto je jasno. */
  complete: boolean;
}

/**
 * Poredak momčadi s istog mjesta iz svih skupina (npr. "6 najboljih
 * drugoplasiranih"). Uspoređuju se bodovi pa kriteriji iz postavki,
 * bez međusobnog susreta (te momčadi nisu igrale jedna protiv druge)
 * i bez ždrijeba, koji organizator tada određuje ručno.
 */
export function rankAcrossGroups(
  tables: { groupName: string; table: GroupTable }[],
  position: number,
  settings: TableSettings,
): CrossTable {
  const rows: Omit<CrossRow, 'crossRank'>[] = [];
  let complete = tables.length > 0;
  for (const { groupName, table } of tables) {
    const atRank = table.rows.filter((r) => r.rank === position);
    if (!table.complete || atRank.length !== 1) complete = false;
    if (atRank.length === 1) rows.push({ ...atRank[0], groupName });
  }
  const keys: ((r: TableRow) => number)[] = [(r) => r.points];
  for (const c of settings.tiebreakers) {
    if (c === 'goal_difference') keys.push((r) => r.goalDiff);
    else if (c === 'goals_for') keys.push((r) => r.goalsFor);
    else if (c === 'wins') keys.push((r) => r.won);
    else if (c === 'fewer_goals_against') keys.push((r) => -r.goalsAgainst);
    else if (c === 'fewer_cards') keys.push((r) => -r.cards);
  }
  const cmp = (a: TableRow, b: TableRow) => {
    for (const k of keys) if (k(a) !== k(b)) return k(b) - k(a);
    return 0;
  };
  rows.sort((a, b) => cmp(a, b) || a.groupName.localeCompare(b.groupName));
  const ranked: CrossRow[] = [];
  rows.forEach((r, i) => {
    const prev = ranked[i - 1];
    ranked.push({ ...r, crossRank: prev && cmp(prev, r) === 0 ? prev.crossRank : i + 1 });
  });
  return { rows: ranked, complete };
}

/** N-ta najbolja momčad s istog mjesta, ako je poredak gotov i jasan. */
export function nthAcrossGroups(cross: CrossTable, nth: number): string | null {
  if (!cross.complete) return null;
  const at = cross.rows.filter((r) => r.crossRank === nth);
  return at.length === 1 ? at[0].teamId : null;
}
