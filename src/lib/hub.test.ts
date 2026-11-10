import { describe, expect, it } from 'vitest';
import { blankMatch } from '../data/seed';
import { clubRecord, daysUntil, groupTournaments, podiums, resultFor, tournamentStatus } from './hub';
import type { Category, Tournament } from './types';

const t = (id: string, start: string, end: string, closed_at: string | null = null) =>
  ({ id, slug: id, name: id, start_date: start, end_date: end, closed_at }) as Tournament;

describe('turniri na početnoj', () => {
  it('status po datumu i zaključavanju', () => {
    expect(tournamentStatus(t('a', '2026-10-23', '2026-10-25'), '2026-10-24')).toBe('live');
    expect(tournamentStatus(t('a', '2026-10-23', '2026-10-25'), '2026-10-26')).toBe('done');
    expect(tournamentStatus(t('a', '2027-01-15', '2027-01-17'), '2026-11-10')).toBe('upcoming');
    expect(tournamentStatus(t('a', '2026-10-23', '2026-10-25', '2026-10-25T20:00:00Z'), '2026-10-25')).toBe('done');
    expect(daysUntil('2027-01-15', '2026-11-10')).toBe(66);
  });

  it('razvrstava: uskoro najbliži prvi, arhiva najnovija prva', () => {
    const g = groupTournaments([t('lis', '2026-10-23', '2026-10-25'), t('pro', '2027-04-10', '2027-04-12'), t('zim', '2027-01-15', '2027-01-17'), t('lis25', '2025-10-23', '2025-10-25')], '2026-11-10');
    expect(g.live).toEqual([]);
    expect(g.upcoming.map((x) => x.id)).toEqual(['zim', 'pro']);
    expect(g.done.map((x) => x.id)).toEqual(['lis', 'lis25']);
  });
});

describe('pobjednici i klub', () => {
  const base = { tournament_id: 'T', category_id: 'c' };
  const final = blankMatch({ ...base, id: 'f', stage: 'final', home_team_id: 'a', away_team_id: 'b', home_score: 1, away_score: 1, home_penalties: 3, away_penalties: 4, status: 'finished', winner_place: 1, loser_place: 2 });
  const third = blankMatch({ ...base, id: '3', stage: 'third_place', home_team_id: 'c', away_team_id: 'd', home_score: 2, away_score: 0, status: 'finished', winner_place: 3, loser_place: 4 });

  it('postolje po turniru i godištu', () => {
    const p = podiums({ matches: [final, third], tournaments: [t('T', '2026-10-23', '2026-10-25')], categories: [{ id: 'c', tournament_id: 'T', name: '2016.', sort_order: 0 } as Category] });
    expect(p).toHaveLength(1);
    expect(p[0].places).toEqual([{ place: 1, teamId: 'b' }, { place: 2, teamId: 'a' }, { place: 3, teamId: 'c' }]);
  });

  it('ishod i zbroj kluba (jedanaesterci odlučuju pobjednika)', () => {
    expect(resultFor(final, 'b')).toBe('W');
    expect(resultFor(final, 'a')).toBe('L');
    expect(clubRecord([final, third], [{ id: 'a' }, { id: 'c' }])).toEqual({ played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 3, goalsAgainst: 1 });
  });
});
