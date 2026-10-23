import { describe, expect, it } from 'vitest';
import { computeGroupTable, teamAtPosition, type TableSettings } from './standings';
import type { Match, Tiebreaker } from './types';
import { blankMatch } from '../data/seed';

const settings = (tiebreakers: Tiebreaker[] = ['head_to_head', 'goal_difference', 'goals_for', 'lot']): TableSettings => ({
  points_win: 3, points_draw: 1, points_loss: 0, tiebreakers,
});

let seq = 0;
function played(home: string, away: string, hs: number, as: number, status: Match['status'] = 'finished'): Match {
  return blankMatch({
    id: `x${++seq}`, tournament_id: 't', category_id: 'c', group_id: 'g',
    home_team_id: home, away_team_id: away, home_score: hs, away_score: as, status,
  });
}

const teams = (...ids: string[]) => ids.map((team_id) => ({ team_id, lot_rank: null }));
const order = (t: ReturnType<typeof computeGroupTable>) => t.rows.map((r) => r.teamId);

describe('tablica skupine', () => {
  it('broji bodove 3 / 1 / 0, golove i gol-razliku', () => {
    const t = computeGroupTable(teams('A', 'B', 'C'), [
      played('A', 'B', 2, 0),
      played('B', 'C', 1, 1),
      played('C', 'A', 0, 3),
    ], settings());
    expect(order(t)).toEqual(['A', 'B', 'C']);
    expect(t.rows[0]).toMatchObject({ played: 2, won: 2, points: 6, goalsFor: 5, goalsAgainst: 0, goalDiff: 5 });
    expect(t.rows[1]).toMatchObject({ points: 1, drawn: 1, lost: 1, goalDiff: -2 });
    expect(t.complete).toBe(true);
  });

  it('broji samo završene utakmice', () => {
    const t = computeGroupTable(teams('A', 'B'), [played('A', 'B', 5, 0, 'live')], settings());
    expect(t.rows.every((r) => r.points === 0 && r.played === 0)).toBe(true);
    expect(t.complete).toBe(false);
  });

  it('koristi bodove koje je postavio organizator', () => {
    const t = computeGroupTable(teams('A', 'B'), [played('A', 'B', 1, 0)],
      { points_win: 2, points_draw: 1, points_loss: 0, tiebreakers: [] });
    expect(t.rows[0].points).toBe(2);
  });

  it('međusobni susret je jači od gol-razlike', () => {
    // A i B imaju po 6 bodova; B ima bolju gol-razliku, ali je A pobijedio B.
    const t = computeGroupTable(teams('A', 'B', 'C', 'D'), [
      played('A', 'B', 1, 0),
      played('A', 'C', 1, 0),
      played('D', 'A', 1, 0),
      played('B', 'C', 5, 0),
      played('B', 'D', 5, 0),
      played('C', 'D', 0, 0),
    ], settings());
    expect(order(t).slice(0, 2)).toEqual(['A', 'B']);
    expect(t.rows[0].goalDiff).toBeLessThan(t.rows[1].goalDiff);
  });

  it('s drugim redoslijedom kriterija prvo gleda gol-razliku', () => {
    const t = computeGroupTable(teams('A', 'B', 'C', 'D'), [
      played('A', 'B', 1, 0),
      played('A', 'C', 1, 0),
      played('D', 'A', 1, 0),
      played('B', 'C', 5, 0),
      played('B', 'D', 5, 0),
      played('C', 'D', 0, 0),
    ], settings(['goal_difference', 'head_to_head', 'goals_for', 'lot']));
    expect(order(t).slice(0, 2)).toEqual(['B', 'A']);
  });

  it('kad je međusobni susret neriješen, odlučuje gol-razlika', () => {
    const t = computeGroupTable(teams('A', 'B', 'C'), [
      played('A', 'B', 1, 1),
      played('A', 'C', 4, 0),
      played('B', 'C', 1, 0),
    ], settings());
    expect(order(t)).toEqual(['A', 'B', 'C']);
    expect(t.rows[0].points).toBe(t.rows[1].points);
  });

  it('kad je i gol-razlika ista, odlučuje više postignutih golova', () => {
    const t = computeGroupTable(teams('A', 'B', 'C'), [
      played('A', 'B', 2, 2),
      played('A', 'C', 1, 0),
      played('B', 'C', 2, 1),
    ], settings());
    // A: GR +1, golovi 3; B: GR +1, golovi 4
    expect(order(t)).toEqual(['B', 'A', 'C']);
  });

  it('tri momčadi s istim bodovima: mala tablica njihovih međusobnih utakmica', () => {
    // A, B, C svaka po 6 bodova (pobijedile D), u krugu A>B, B>C, C>A
    // pa su i međusobno jednake → gol-razlika iz svih utakmica.
    const t = computeGroupTable(teams('A', 'B', 'C', 'D'), [
      played('A', 'B', 1, 0),
      played('B', 'C', 1, 0),
      played('C', 'A', 1, 0),
      played('A', 'D', 3, 0),
      played('B', 'D', 2, 0),
      played('C', 'D', 1, 0),
    ], settings());
    expect(order(t)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('međusobni susret razdvoji jednu momčad, ostale idu na sljedeći kriterij', () => {
    // A, B, C po 7 bodova. Međusobno: A 6, B 1, C 1 → A prvi.
    // B i C su međusobno jednaki → gol-razlika iz svih utakmica (B +3, C +1).
    const t = computeGroupTable(teams('A', 'B', 'C', 'D', 'E'), [
      played('A', 'B', 1, 0),
      played('A', 'C', 1, 0),
      played('B', 'C', 0, 0),
      played('A', 'D', 0, 0),
      played('E', 'A', 1, 0),
      played('B', 'D', 1, 0),
      played('B', 'E', 3, 0),
      played('C', 'D', 1, 0),
      played('C', 'E', 1, 0),
      played('D', 'E', 0, 0),
    ], settings());
    expect(order(t)).toEqual(['A', 'B', 'C', 'E', 'D']);
    expect(t.rows.slice(0, 3).map((r) => r.points)).toEqual([7, 7, 7]);
    expect(t.needsLot).toBe(false);
  });

  it('potpuno jednake momčadi dijele mjesto dok organizator ne upiše ždrijeb', () => {
    const matches = [played('A', 'B', 1, 1), played('A', 'C', 1, 0), played('B', 'C', 1, 0)];
    const t = computeGroupTable(teams('A', 'B', 'C'), matches, settings());
    expect(t.needsLot).toBe(true);
    expect(t.rows.slice(0, 2).map((r) => r.rank)).toEqual([1, 1]);
    expect(t.rows[2].rank).toBe(3);
    expect(teamAtPosition(t, 1)).toBeNull();
    expect(teamAtPosition(t, 2)).toBeNull();
    expect(teamAtPosition(t, 3)).toBe('C');

    const drawn = computeGroupTable(
      [{ team_id: 'A', lot_rank: 2 }, { team_id: 'B', lot_rank: 1 }, { team_id: 'C', lot_rank: null }],
      matches, settings(),
    );
    expect(drawn.needsLot).toBe(false);
    expect(order(drawn)).toEqual(['B', 'A', 'C']);
    expect(teamAtPosition(drawn, 1)).toBe('B');
    expect(teamAtPosition(drawn, 2)).toBe('A');
  });

  it('bez ždrijeba u kriterijima jednake momčadi ostaju izjednačene', () => {
    const t = computeGroupTable(teams('A', 'B'), [played('A', 'B', 0, 0)], settings(['goal_difference']));
    expect(t.needsLot).toBe(true);
  });

  it('nema mjesta u sljedećoj fazi dok skupina nije gotova', () => {
    const t = computeGroupTable(teams('A', 'B', 'C'), [
      played('A', 'B', 3, 0),
      played('A', 'C', 3, 0),
      played('B', 'C', 0, 0, 'scheduled'),
    ], settings());
    expect(t.complete).toBe(false);
    expect(teamAtPosition(t, 1)).toBeNull();
  });

  it('otkazane utakmice ne sprječavaju završetak skupine', () => {
    const cancelled = blankMatch({ id: 'c1', tournament_id: 't', category_id: 'c', group_id: 'g', home_team_id: 'B', away_team_id: 'C', status: 'cancelled' });
    const t = computeGroupTable(teams('A', 'B', 'C'), [played('A', 'B', 1, 0), played('A', 'C', 1, 0), cancelled], settings());
    expect(t.complete).toBe(true);
    expect(teamAtPosition(t, 1)).toBe('A');
  });
});
