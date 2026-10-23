import { describe, expect, it } from 'vitest';
import { blankMatch } from '../src/data/seed';
import type { Match } from '../src/lib/types';
import { checkSubscribe, matchNotes } from './notify';

const names: Record<string, string> = { h: 'NK Inker', a: 'NŠK Nova Zora' };
const name = (id: string) => names[id];
const m = (extra: Partial<Match> = {}): Match =>
  blankMatch({ id: 'm1', tournament_id: 't', category_id: 'c', stage: 'group', home_team_id: 'h', away_team_id: 'a', ...extra });

describe('obavijesti o utakmici', () => {
  it('javlja početak, gol, karton i kraj', () => {
    const start = matchNotes({ before: m(), after: m({ status: 'live', home_score: 0, away_score: 0 }) }, name, '2019. godište');
    expect(start.map((n) => [n.event, n.title, n.body])).toEqual([['start', '▶️ Počela je utakmica', 'NK Inker – NŠK Nova Zora · 2019. godište']]);

    const goal = matchNotes({ before: m({ status: 'live', home_score: 0, away_score: 0 }), after: m({ status: 'live', home_score: 0, away_score: 1 }) }, name);
    expect(goal.map((n) => [n.event, n.title, n.body])).toEqual([['goal', '⚽ Gol! NŠK Nova Zora', 'NK Inker 0:1 NŠK Nova Zora']]);
    expect(goal[0].teams).toEqual(['h', 'a']);

    const card = matchNotes({ before: m({ status: 'live' }), after: m({ status: 'live', home_yellow: 1 }) }, name);
    expect(card.map((n) => n.title)).toEqual(['🟨 Žuti karton: NK Inker']);

    const end = matchNotes({ before: m({ status: 'live', home_score: 2, away_score: 2 }), after: m({ status: 'finished', home_score: 2, away_score: 2, home_penalties: 4, away_penalties: 3 }) }, name);
    expect(end.map((n) => [n.event, n.body])).toEqual([['end', 'NK Inker 2:2 NŠK Nova Zora (jedanaesterci 4:3)']]);
  });

  it('ne javlja ispravke, ni utakmice bez poznatih momčadi', () => {
    expect(matchNotes({ before: m({ status: 'live', home_score: 2 }), after: m({ status: 'live', home_score: 1 }) }, name)).toEqual([]);
    expect(matchNotes({ before: m({ home_team_id: null }), after: m({ home_team_id: null, status: 'live' }) }, name)).toEqual([]);
  });

  it('naknadno upisan rezultat javlja samo kraj, bez golova', () => {
    const n = matchNotes({ before: m(), after: m({ status: 'finished', home_score: 3, away_score: 1 }) }, name);
    expect(n.map((x) => x.event)).toEqual(['end']);
  });
});

describe('pretplata', () => {
  const ok = {
    tournamentId: '22932050-a898-99b2-bccb-6a14c141e40f',
    subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } },
    teamIds: ['22932050-a898-99b2-bccb-6a14c141e40f'],
    events: ['goal', 'end'],
  };
  it('prima ispravnu, odbija čudne', () => {
    expect(checkSubscribe(ok)).toBeNull();
    expect(checkSubscribe({ ...ok, subscription: { ...ok.subscription, endpoint: 'https://example.com/x' } })).not.toBeNull();
    expect(checkSubscribe({ ...ok, events: ['spam'] })).not.toBeNull();
    expect(checkSubscribe({ ...ok, teamIds: ['nije-uuid'] })).not.toBeNull();
    expect(checkSubscribe(null)).not.toBeNull();
  });
});
