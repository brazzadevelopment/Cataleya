// Cataleya Cup kroz sve turnire: status turnira, pobjednici, povijest kluba.

import { finalRanking, matchOutcome } from './advancement';
import { localDate } from './time';
import type { Category, Match, Team, Tournament } from './types';

export type TournamentStatus = 'live' | 'upcoming' | 'done';

export const ZONE = 'Europe/Zagreb';

export function today(now = new Date()): string {
  return localDate(now.toISOString(), ZONE);
}

/** U tijeku (od prvog do zadnjeg dana), uskoro ili završen (ili zaključen). */
export function tournamentStatus(t: Pick<Tournament, 'start_date' | 'end_date' | 'closed_at'>, day = today()): TournamentStatus {
  if (t.closed_at || t.end_date < day) return 'done';
  if (t.start_date > day) return 'upcoming';
  return 'live';
}

export function daysUntil(date: string, day = today()): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000);
}

/** Turniri po skupinama za početnu: u tijeku, uskoro (najbliži prvi), završeni (najnoviji prvi). */
export function groupTournaments(list: Tournament[], day = today()) {
  const by = (s: TournamentStatus) => list.filter((t) => tournamentStatus(t, day) === s);
  return {
    live: by('live').sort((a, b) => a.start_date.localeCompare(b.start_date)),
    upcoming: by('upcoming').sort((a, b) => a.start_date.localeCompare(b.start_date)),
    done: by('done').sort((a, b) => b.start_date.localeCompare(a.start_date)),
  };
}

export interface Podium {
  tournament: Tournament;
  category: Category;
  /** Mjesta 1–3 (i dalje ako ih je organizator upisao). */
  places: { place: number; teamId: string }[];
}

/** Pobjednici po turniru i godištu, iz utakmica za plasman. */
export function podiums(data: { matches: Match[]; tournaments: Tournament[]; categories: Category[] }): Podium[] {
  const out: Podium[] = [];
  for (const t of [...data.tournaments].sort((a, b) => b.start_date.localeCompare(a.start_date))) {
    for (const c of data.categories.filter((x) => x.tournament_id === t.id).sort((a, b) => a.sort_order - b.sort_order)) {
      const places = finalRanking(data.matches.filter((m) => m.category_id === c.id)).filter((p) => p.place <= 3);
      if (places.length) out.push({ tournament: t, category: c, places: places.map(({ place, teamId }) => ({ place, teamId })) });
    }
  }
  return out;
}

export type Result = 'W' | 'D' | 'L';

/** Ishod utakmice za momčad: pobjeda, neriješeno (bez jedanaesteraca) ili poraz. */
export function resultFor(m: Match, teamId: string): Result | null {
  if (m.status !== 'finished' || m.home_score == null || m.away_score == null) return null;
  const o = matchOutcome(m);
  if (!o) return 'D';
  return o.winner === teamId ? 'W' : 'L';
}

export interface ClubRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

/** Zbroj svih odigranih utakmica momčadi jednog kluba. */
export function clubRecord(matches: Match[], teams: Pick<Team, 'id'>[]): ClubRecord {
  const ids = new Set(teams.map((t) => t.id));
  const r: ClubRecord = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const m of matches) {
    const side = ids.has(m.home_team_id ?? '') ? 'home' : ids.has(m.away_team_id ?? '') ? 'away' : null;
    const team = side === 'home' ? m.home_team_id : m.away_team_id;
    const res = side && team ? resultFor(m, team) : null;
    if (!res) continue;
    r.played++;
    if (res === 'W') r.won++;
    else if (res === 'D') r.drawn++;
    else r.lost++;
    r.goalsFor += (side === 'home' ? m.home_score : m.away_score) ?? 0;
    r.goalsAgainst += (side === 'home' ? m.away_score : m.home_score) ?? 0;
  }
  return r;
}
