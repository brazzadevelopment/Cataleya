import { sourceLabel } from './advancement';
import { localDate, timeRange } from './time';
import type { Match, MatchStage, Snapshot } from './types';

export const STAGE_LABEL: Record<MatchStage, string> = {
  group: 'Skupina',
  round_of_16: 'Osmina finala',
  quarterfinal: 'Četvrtfinale',
  semifinal: 'Polufinale',
  third_place: 'Za 3. mjesto',
  final: 'Finale',
  placement: 'Za plasman',
};

export const STAGE_ORDER: MatchStage[] = ['group', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final', 'placement'];

export function teamName(s: Snapshot, id: string | null): string | null {
  if (!id) return null;
  return s.teams.find((t) => t.id === id)?.name ?? null;
}

/** Naziv momčadi ili oznaka mjesta ('1. A', 'Pobjednik ČF1'). */
export function sideLabel(s: Snapshot, m: Match, side: 'home' | 'away'): { name: string; known: boolean } {
  const id = side === 'home' ? m.home_team_id : m.away_team_id;
  const name = teamName(s, id);
  if (name) return { name, known: true };
  const src = sourceLabel(side === 'home' ? m.home_source : m.away_source);
  return { name: src ?? 'Još nije poznato', known: false };
}

export function fieldName(s: Snapshot, id: string | null): string | null {
  return id ? s.fields.find((f) => f.id === id)?.name ?? null : null;
}

export function matchMinutes(s: Snapshot, m: Match): number {
  return m.duration_minutes ?? s.categories.find((c) => c.id === m.category_id)?.match_minutes ?? 25;
}

export function matchTime(s: Snapshot, m: Match): string | null {
  return m.starts_at ? timeRange(m.starts_at, matchMinutes(s, m), s.tournament.timezone) : null;
}

export function matchDay(s: Snapshot, m: Match): string | null {
  return m.starts_at ? localDate(m.starts_at, s.tournament.timezone) : null;
}

/** 'Skupina A', 'Četvrtfinale 1', 'Finale' */
export function matchPhase(s: Snapshot, m: Match): string {
  if (m.stage === 'group') {
    const g = s.groups.find((x) => x.id === m.group_id);
    return g ? `Skupina ${g.name}` : 'Skupina';
  }
  return m.label ?? (m.code ? `${STAGE_LABEL[m.stage]} · ${m.code}` : STAGE_LABEL[m.stage]);
}

export function byTime(a: Match, b: Match): number {
  if (a.starts_at && b.starts_at) return a.starts_at.localeCompare(b.starts_at) || (a.field_id ?? '').localeCompare(b.field_id ?? '');
  if (a.starts_at) return -1;
  if (b.starts_at) return 1;
  return STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || (a.code ?? '').localeCompare(b.code ?? '');
}

export function hasScore(m: Match): boolean {
  return m.home_score != null && m.away_score != null;
}

export function involves(m: Match, teamIds: Set<string>): boolean {
  return (m.home_team_id != null && teamIds.has(m.home_team_id)) || (m.away_team_id != null && teamIds.has(m.away_team_id));
}

export function initials(name: string): string {
  const words = name.replace(/^(H?NK|NŠK|NK|ŠNK|GNK)\s+/i, '').split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]).join('') || name.slice(0, 2)).toUpperCase();
}
