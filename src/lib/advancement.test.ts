import { describe, expect, it } from 'vitest';
import { computeAdvancement, finalRanking, matchOutcome, parseSource, sourceLabel, type CategoryData } from './advancement';
import { blankMatch, demoSnapshot } from '../data/seed';
import type { Match } from './types';

const base = { tournament_id: 't', category_id: 'c' };

function knockout(id: string, code: string, home: string, away: string, extra: Partial<Match> = {}): Match {
  return blankMatch({ ...base, id, code, stage: 'semifinal', home_source: home, away_source: away, ...extra });
}

function finish(m: Match, hs: number, as: number, pens?: [number, number]): Match {
  return { ...m, home_score: hs, away_score: as, home_penalties: pens?.[0] ?? null, away_penalties: pens?.[1] ?? null, status: 'finished' };
}

function settle(data: CategoryData): CategoryData {
  const updates = computeAdvancement(data);
  const byId = new Map(updates.map((u) => [u.id, u]));
  return { ...data, matches: data.matches.map((m) => (byId.has(m.id) ? { ...m, ...byId.get(m.id)! } : m)) };
}

function demoCategory(): CategoryData {
  const s = demoSnapshot();
  const c = (x: { category_id: string }) => x.category_id === 'u2019';
  return {
    groups: s.groups.filter(c), groupTeams: s.groupTeams.filter(c), matches: s.matches.filter(c),
    settings: { points_win: 3, points_draw: 1, points_loss: 0, tiebreakers: ['head_to_head', 'goal_difference', 'goals_for', 'lot'] },
  };
}

/** Odigra sve utakmice skupine: domaćin pobjeđuje osim kad je zadano drukčije. */
function playGroup(data: CategoryData, group: string, results: Record<string, [number, number]> = {}): CategoryData {
  const gid = data.groups.find((g) => g.name === group)!.id;
  return {
    ...data,
    matches: data.matches.map((m) => {
      if (m.group_id !== gid) return m;
      const r = results[`${m.home_team_id}|${m.away_team_id}`] ?? [1, 0];
      return finish(m, r[0], r[1]);
    }),
  };
}

describe('oznake mjesta', () => {
  it('čita 1A, W:ČF1 i L:PF2', () => {
    expect(parseSource('1A')).toEqual({ kind: 'group', position: 1, group: 'A' });
    expect(parseSource('2. b')).toEqual({ kind: 'group', position: 2, group: 'B' });
    expect(parseSource('W:ČF1')).toEqual({ kind: 'winner', code: 'ČF1' });
    expect(parseSource('L:PF2')).toEqual({ kind: 'loser', code: 'PF2' });
    expect(parseSource('2#6')).toEqual({ kind: 'best', position: 2, nth: 6 });
    expect(parseSource('nešto')).toBeNull();
  });

  it('prikazuje se gledateljima', () => {
    expect(sourceLabel('1A')).toBe('1. A');
    expect(sourceLabel('W:ČF1')).toBe('Pobjednik ČF1');
    expect(sourceLabel('L:PF2')).toBe('Poraženi PF2');
    expect(sourceLabel('2#6')).toBe('6. drugoplasirani');
    expect(sourceLabel('4#2')).toBe('2. četvrtoplasirani');
  });
});

describe('ishod utakmice i jedanaesterci', () => {
  const m = blankMatch({ ...base, id: 'm', home_team_id: 'H', away_team_id: 'A' });

  it('pobjednik po golovima', () => {
    expect(matchOutcome(finish(m, 2, 1))).toEqual({ winner: 'H', loser: 'A' });
    expect(matchOutcome(finish(m, 0, 3))).toEqual({ winner: 'A', loser: 'H' });
  });

  it('kod neriješenog odlučuju jedanaesterci', () => {
    expect(matchOutcome(finish(m, 1, 1, [4, 5]))).toEqual({ winner: 'A', loser: 'H' });
    expect(matchOutcome(finish(m, 0, 0, [3, 2]))).toEqual({ winner: 'H', loser: 'A' });
  });

  it('neriješeno bez jedanaesteraca nema pobjednika', () => {
    expect(matchOutcome(finish(m, 2, 2))).toBeNull();
  });

  it('nezavršena utakmica nema pobjednika', () => {
    expect(matchOutcome({ ...finish(m, 3, 0), status: 'live' })).toBeNull();
  });
});

describe('automatsko upisivanje u sljedeću fazu', () => {
  it('ne upisuje ništa dok skupine nisu gotove', () => {
    expect(computeAdvancement(demoCategory())).toEqual([]);
  });

  it('kad su skupine A i B gotove, popuni ČF1 i ČF2', () => {
    let data = demoCategory();
    // Skupina A: Zagreb pobjeđuje sve, Arbanasi drugi.
    data = playGroup(data, 'A', {
      'tm-u2019-nk-zagreb|tm-u2019-nk-arbanasi': [3, 0],
      'tm-u2019-nk-varazdin-narancasti|tm-u2019-nk-zadarnova-bijeli': [0, 1],
      'tm-u2019-nk-varazdin-narancasti|tm-u2019-nk-arbanasi': [0, 2],
      'tm-u2019-nk-zagreb|tm-u2019-nk-zadarnova-bijeli': [2, 0],
      'tm-u2019-nk-varazdin-narancasti|tm-u2019-nk-zagreb': [0, 4],
      'tm-u2019-nk-arbanasi|tm-u2019-nk-zadarnova-bijeli': [2, 0],
    });
    // A je gotova, B nije: upišu se samo mjesta iz skupine A.
    expect(computeAdvancement(data)).toEqual([
      { id: 'u2019-qf1', home_team_id: 'tm-u2019-nk-zagreb', away_team_id: null },
      { id: 'u2019-qf2', home_team_id: null, away_team_id: 'tm-u2019-nk-arbanasi' },
    ]);

    data = playGroup(data, 'B', {
      'tm-u2019-nk-inker|tm-u2019-hnk-zadar': [0, 2],
      'tm-u2019-nk-lokomotiva-plavi|tm-u2019-nsk-nova-zora': [0, 1],
      'tm-u2019-nk-lokomotiva-plavi|tm-u2019-hnk-zadar': [0, 3],
      'tm-u2019-nk-inker|tm-u2019-nsk-nova-zora': [0, 1],
      'tm-u2019-nk-lokomotiva-plavi|tm-u2019-nk-inker': [1, 0],
      'tm-u2019-hnk-zadar|tm-u2019-nsk-nova-zora': [2, 0],
    });
    const settled = settle(data);
    const qf1 = settled.matches.find((m) => m.code === 'ČF1')!;
    const qf2 = settled.matches.find((m) => m.code === 'ČF2')!;
    const qf3 = settled.matches.find((m) => m.code === 'ČF3')!;
    expect([qf1.home_team_id, qf1.away_team_id]).toEqual(['tm-u2019-nk-zagreb', 'tm-u2019-nsk-nova-zora']);
    expect([qf2.home_team_id, qf2.away_team_id]).toEqual(['tm-u2019-hnk-zadar', 'tm-u2019-nk-arbanasi']);
    expect([qf3.home_team_id, qf3.away_team_id]).toEqual([null, null]);
  });

  it('pobjednik ide dalje sam, i nakon jedanaesteraca', () => {
    let data: CategoryData = {
      groups: [], groupTeams: [], settings: demoCategory().settings,
      matches: [
        blankMatch({ ...base, id: 'q1', code: 'ČF1', stage: 'quarterfinal', home_team_id: 'A', away_team_id: 'B' }),
        blankMatch({ ...base, id: 'q2', code: 'ČF2', stage: 'quarterfinal', home_team_id: 'C', away_team_id: 'D' }),
        knockout('s1', 'PF1', 'W:ČF1', 'W:ČF2'),
        knockout('l1', '5M', 'L:ČF1', 'L:ČF2', { stage: 'placement' }),
      ],
    };
    data.matches[0] = finish(data.matches[0], 2, 0);
    data.matches[1] = finish(data.matches[1], 1, 1, [3, 4]);
    data = settle(data);
    const sf = data.matches.find((m) => m.id === 's1')!;
    const pl = data.matches.find((m) => m.id === 'l1')!;
    expect([sf.home_team_id, sf.away_team_id]).toEqual(['A', 'D']);
    expect([pl.home_team_id, pl.away_team_id]).toEqual(['B', 'C']);
  });

  it('neriješeno bez jedanaesteraca ostavlja mjesto prazno', () => {
    const data: CategoryData = {
      groups: [], groupTeams: [], settings: demoCategory().settings,
      matches: [
        finish(blankMatch({ ...base, id: 'q1', code: 'ČF1', stage: 'quarterfinal', home_team_id: 'A', away_team_id: 'B' }), 1, 1),
        knockout('s1', 'PF1', 'W:ČF1', 'W:ČF2'),
      ],
    };
    expect(computeAdvancement(data)).toEqual([]);
  });

  it('popunjava više krugova odjednom (četvrtfinale → polufinale → finale)', () => {
    const qf = (id: string, h: string, a: string) =>
      finish(blankMatch({ ...base, id, code: id.toUpperCase(), stage: 'quarterfinal', home_team_id: h, away_team_id: a }), 1, 0);
    const data: CategoryData = {
      groups: [], groupTeams: [], settings: demoCategory().settings,
      matches: [
        qf('q1', 'A', 'B'), qf('q2', 'C', 'D'),
        // polufinale već odigrano (npr. ispravak unatrag), finale čeka
        finish(knockout('s1', 'S1', 'W:Q1', 'W:Q2', { home_team_id: 'A', away_team_id: 'C' }), 0, 2),
        knockout('f', 'F', 'W:S1', 'L:S1', { stage: 'final' }),
      ],
    };
    const f = settle(data).matches.find((m) => m.id === 'f')!;
    expect([f.home_team_id, f.away_team_id]).toEqual(['C', 'A']);
  });

  it('ne dira ručno zaključane ni započete utakmice', () => {
    const q = finish(blankMatch({ ...base, id: 'q1', code: 'ČF1', stage: 'quarterfinal', home_team_id: 'A', away_team_id: 'B' }), 1, 0);
    const locked = knockout('s1', 'PF1', 'W:ČF1', 'W:ČF2', { teams_locked: true, home_team_id: 'X' });
    const live = knockout('s2', 'PF2', 'W:ČF1', 'W:ČF2', { status: 'live', home_team_id: 'Y' });
    expect(computeAdvancement({ groups: [], groupTeams: [], settings: demoCategory().settings, matches: [q, locked, live] })).toEqual([]);
  });

  it('ispravak rezultata mijenja momčad u nezapočetoj utakmici', () => {
    const q = blankMatch({ ...base, id: 'q1', code: 'ČF1', stage: 'quarterfinal', home_team_id: 'A', away_team_id: 'B' });
    const s = knockout('s1', 'PF1', 'W:ČF1', 'L:ČF1');
    let data: CategoryData = { groups: [], groupTeams: [], settings: demoCategory().settings, matches: [finish(q, 2, 0), s] };
    data = settle(data);
    expect(data.matches[1].home_team_id).toBe('A');
    data = { ...data, matches: [finish(q, 0, 2), data.matches[1]] };
    data = settle(data);
    expect([data.matches[1].home_team_id, data.matches[1].away_team_id]).toEqual(['B', 'A']);
  });
});

describe('konačni poredak', () => {
  it('slaže mjesta iz utakmica s plasmanom', () => {
    const f = finish(blankMatch({ ...base, id: 'f', home_team_id: 'A', away_team_id: 'B', winner_place: 1, loser_place: 2 }), 0, 1);
    const third = finish(blankMatch({ ...base, id: 't', home_team_id: 'C', away_team_id: 'D', winner_place: 3, loser_place: 4 }), 2, 2, [5, 4]);
    const notYet = blankMatch({ ...base, id: 'p', home_team_id: 'E', away_team_id: 'F', winner_place: 5, loser_place: 6 });
    expect(finalRanking([third, f, notYet]).map((p) => [p.place, p.teamId])).toEqual([[1, 'B'], [2, 'A'], [3, 'C'], [4, 'D']]);
  });
});

describe('osmina finala 2016. iz pravog rasporeda', () => {
  it('kad su sve skupine gotove, upišu se prvi i najbolji drugoplasirani', () => {
    const snap = demoSnapshot();
    const c = (x: { category_id: string }) => x.category_id === 'u2016';
    const groups = snap.groups.filter(c);
    const gts = snap.groupTeams.filter(c);
    // U svakoj skupini redoslijed momčadi kako su upisane pobjeđuje sve iza sebe,
    // a prva momčad skupine A daje najviše golova pa su drugoplasirani različiti po gol-razlici.
    const order = new Map(groups.flatMap((g, gi) => gts.filter((x) => x.group_id === g.id).map((x, i) => [x.team_id, [gi, i]] as const)));
    const matches = snap.matches.filter(c).map((m) => {
      if (m.stage !== 'group') return m;
      const [gi, hi] = order.get(m.home_team_id!)!;
      const [, ai] = order.get(m.away_team_id!)!;
      const margin = gi + 1; // skupina A pobjeđuje s 1 razlike, J s 10
      return hi < ai ? finish(m, margin, 0) : finish(m, 0, margin);
    });
    const data = settle({ groups, groupTeams: gts, matches, settings: demoCategory().settings });
    const os1 = data.matches.find((m) => m.code === 'OS1')!; // 1A – 2#6
    const os7 = data.matches.find((m) => m.code === 'OS7')!; // 1D – 2#1
    const firstOf = (g: string) => gts.filter((x) => x.group_id === `u2016-grp-${g}`)[0].team_id;
    const secondOf = (g: string) => gts.filter((x) => x.group_id === `u2016-grp-${g}`)[1].team_id;
    expect(os1.home_team_id).toBe(firstOf('a'));
    // drugi iz J ima najveću gol-razliku (skupina J ima najveće razlike) → 1. najbolji drugi
    expect(os7.away_team_id).toBe(secondOf('j'));
    // 6. najbolji drugi = drugi iz E (J, I, H, G, F, E)
    expect(os1.away_team_id).toBe(secondOf('e'));
    // B turnir: U5 = 9. najbolji drugi (iz B) – 3A
    const u5 = data.matches.find((m) => m.code === 'U5')!;
    expect([u5.home_team_id, u5.away_team_id]).toEqual([secondOf('b'), gts.filter((x) => x.group_id === 'u2016-grp-a')[2].team_id]);
  });
});
