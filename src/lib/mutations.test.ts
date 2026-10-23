import { describe, expect, it } from 'vitest';
import { applyToSnapshot, authorize, MutationError, type ScorePatch } from './mutations';
import { demoSnapshot } from '../data/seed';

const patch: ScorePatch = { home_score: 1, away_score: 0, home_penalties: null, away_penalties: null, status: 'live' };
const field1 = { role: 'field' as const, fieldId: 'teren-1' };
const organizer = { role: 'admin' as const, fieldId: null };

describe('tko smije što', () => {
  it('zapisničar upisuje rezultat samo na svom terenu', () => {
    expect(() => authorize({ type: 'score', matchId: 'm', patch }, field1, { field_id: 'teren-1' })).not.toThrow();
    expect(() => authorize({ type: 'score', matchId: 'm', patch }, field1, { field_id: 'teren-2' })).toThrow(MutationError);
  });

  it('zapisničar ne smije mijenjati raspored, momčadi ni PIN-ove', () => {
    expect(() => authorize({ type: 'upsert', table: 'matches', row: { id: 'm', field_id: 'teren-1' } }, field1)).toThrow(/glavni PIN/);
    expect(() => authorize({ type: 'delete', table: 'teams', id: 'x' }, field1)).toThrow(MutationError);
    expect(() => authorize({ type: 'setPin', fieldId: 'teren-1', pin: '1234' }, field1)).toThrow(MutationError);
  });

  it('organizator smije sve, ali samo dopuštena polja', () => {
    const m = authorize({ type: 'upsert', table: 'teams', row: { id: 't', name: 'NK X', tournament_id: 'tuđi', category_id: 'c' } }, organizer);
    expect(m).toEqual({ type: 'upsert', table: 'teams', row: { id: 't', name: 'NK X', category_id: 'c' } });
  });

  it('turnir se ne može obrisati iz aplikacije', () => {
    expect(() => authorize({ type: 'delete', table: 'tournaments', id: 'x' }, organizer)).toThrow(MutationError);
  });

  it('provjerava rezultat i PIN', () => {
    expect(() => authorize({ type: 'score', matchId: 'm', patch: { ...patch, home_score: -1 } }, organizer, { field_id: null })).toThrow();
    expect(() => authorize({ type: 'score', matchId: 'm', patch: { ...patch, away_score: null } }, organizer, { field_id: null })).toThrow();
    expect(() => authorize({ type: 'score', matchId: 'm', patch: { ...patch, home_score: null, away_score: null, status: 'finished' } }, organizer, { field_id: null })).toThrow();
    expect(() => authorize({ type: 'setPin', fieldId: null, pin: '12' }, organizer)).toThrow(/4 do 8/);
  });
});

describe('primjena izmjena u demo načinu', () => {
  it('nakon zadnjeg rezultata skupine momčad se sama upiše u četvrtfinale', () => {
    let s = demoSnapshot();
    const groupA = s.matches.filter((m) => m.group_id === 'u2019-grp-a');
    for (const m of groupA) {
      // NK Zagreb pobjeđuje sve; ostalo neriješeno 0:0, osim Arbanasi pobjeđuju Varaždin narančasti
      const zagrebHome = m.home_team_id === 'tm-u2019-nk-zagreb';
      const zagrebAway = m.away_team_id === 'tm-u2019-nk-zagreb';
      const arb = m.home_team_id === 'tm-u2019-nk-varazdin-narancasti' && m.away_team_id === 'tm-u2019-nk-arbanasi';
      const [h, a] = zagrebHome ? [2, 0] : zagrebAway ? [0, 2] : arb ? [0, 1] : [0, 0];
      s = applyToSnapshot(s, { type: 'score', matchId: m.id, patch: { home_score: h, away_score: a, home_penalties: null, away_penalties: null, status: 'finished' } });
    }
    const qf1 = s.matches.find((m) => m.code === 'ČF1')!;
    const qf2 = s.matches.find((m) => m.code === 'ČF2')!;
    expect(qf1.home_team_id).toBe('tm-u2019-nk-zagreb');
    expect(qf2.away_team_id).toBe('tm-u2019-nk-arbanasi');
  });

  it('brisanje momčadi je miče iz skupine i utakmica', () => {
    const s = applyToSnapshot(demoSnapshot(), { type: 'delete', table: 'teams', id: 'tm-u2019-nk-zagreb' });
    expect(s.teams.some((t) => t.id === 'tm-u2019-nk-zagreb')).toBe(false);
    expect(s.groupTeams.some((g) => g.team_id === 'tm-u2019-nk-zagreb')).toBe(false);
    expect(s.matches.some((m) => m.home_team_id === 'tm-u2019-nk-zagreb' || m.away_team_id === 'tm-u2019-nk-zagreb')).toBe(false);
  });
});
