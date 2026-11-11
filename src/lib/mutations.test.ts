import { describe, expect, it } from 'vitest';
import { applyToSnapshot, authorize, MutationError, type ScorePatch } from './mutations';
import { clubNameOf, slugify, youtubeId } from './mutations';
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

describe('organizacija, novi turnir i klubovi', () => {
  const owner = { role: 'owner' as const, fieldId: null };
  const admin = { role: 'admin' as const, fieldId: null };
  const field = { role: 'field' as const, fieldId: 'f1' };
  const nt = { type: 'createTournament' as const, row: { name: 'Cataleya Cup Zima 2027', slug: 'cataleya-cup-zima-2027', start_date: '2027-01-15', end_date: '2027-01-17' } };

  it('novi turnir i PIN organizacije smije samo organizacija', () => {
    expect(() => authorize(nt, owner)).not.toThrow();
    expect(() => authorize(nt, admin)).toThrow(/organizacije/);
    expect(() => authorize(nt, field)).toThrow();
    expect(() => authorize({ type: 'setOrgPin', label: 'Vedran', pin: '4321' }, owner)).not.toThrow();
    expect(() => authorize({ type: 'setOrgPin', label: 'Vedran', pin: '4321' }, admin)).toThrow();
  });

  it('provjerava naziv, adresu i datume novog turnira', () => {
    expect(() => authorize({ ...nt, row: { ...nt.row, slug: 'Zima 2027' } }, owner)).toThrow(/mala slova/);
    expect(() => authorize({ ...nt, row: { ...nt.row, end_date: '2027-01-14' } }, owner)).toThrow(/prije/);
    expect(() => authorize({ ...nt, row: { ...nt.row, name: 'X' } }, owner)).toThrow(/naziv/);
  });

  it('zaključavanje turnira: glavni PIN da, teren ne', () => {
    expect(() => authorize({ type: 'closeTournament' }, admin)).not.toThrow();
    expect(() => authorize({ type: 'closeTournament' }, field)).toThrow();
  });

  it('klub uređuje organizator turnira, briše samo organizacija', () => {
    const up = { type: 'upsert' as const, table: 'clubs' as const, row: { id: 'c1', name: 'NŠK Nova Zora', city: 'Zadar', hack: 1 } };
    expect(authorize(up, admin)).toEqual({ ...up, row: { id: 'c1', name: 'NŠK Nova Zora', city: 'Zadar' } });
    expect(() => authorize({ type: 'delete', table: 'clubs', id: 'c1' }, admin)).toThrow(/organizacija/);
    expect(() => authorize({ type: 'delete', table: 'clubs', id: 'c1' }, owner)).not.toThrow();
  });

  it('naziv kluba i adresa turnira', () => {
    expect(clubNameOf('NK Lokomotiva plavi')).toBe('NK Lokomotiva');
    expect(clubNameOf('NK Karlovac plavi 1919')).toBe('NK Karlovac 1919');
    expect(clubNameOf('NŠK Nova Zora')).toBe('NŠK Nova Zora');
    expect(slugify('Cataleya Cup · Zima 2027 (Višnjik)')).toBe('cataleya-cup-zima-2027-visnjik');
  });
});

describe('sadržaj aplikacije (vijesti, sponzori, video…)', () => {
  const owner = { role: 'owner' as const, fieldId: null };
  it('uređuje samo organizacija, ne organizator turnira ni zapisničar', () => {
    const m = { type: 'upsert' as const, table: 'news' as const, row: { id: 'n', title: 'Ždrijeb' } };
    expect(() => authorize(m, owner)).not.toThrow();
    expect(() => authorize(m, organizer)).toThrow(/PIN organizacije/);
    expect(() => authorize(m, field1)).toThrow(MutationError);
  });

  it('provjerava sadržaj', () => {
    expect(() => authorize({ type: 'upsert', table: 'news', row: { id: 'n', title: ' ' } }, owner)).toThrow(/naslov/);
    expect(() => authorize({ type: 'upsert', table: 'videos', row: { id: 'v', title: 'Finale', youtube_id: 'krivo' } }, owner)).toThrow(/YouTube/);
    expect(() => authorize({ type: 'upsert', table: 'sponsors', row: { id: 's', name: 'Firma', url: 'javascript:alert(1)' } }, owner)).toThrow(/https/);
    expect(() => authorize({ type: 'delete', table: 'site_settings', id: 'about' }, owner)).toThrow(MutationError);
  });

  it('poruke s kontakt forme: organizacija smije samo označiti riješeno', () => {
    const r = authorize({ type: 'upsert', table: 'contact_messages', row: { id: 'p', handled: true, message: 'promijenjeno' } }, owner);
    expect(r).toEqual({ type: 'upsert', table: 'contact_messages', row: { id: 'p', handled: true } });
  });

  it('YouTube link u ID', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/live/dQw4w9WgXcQ?si=x')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('nije link')).toBeNull();
  });

  it('vrsta turnira samo Indoor, Proljeće ili Jesen', () => {
    expect(() => authorize({ type: 'upsert', table: 'tournaments', row: { series: 'ljeto' } }, organizer)).toThrow(/vrsta/);
    expect(authorize({ type: 'upsert', table: 'tournaments', row: { series: 'indoor' } }, organizer)).toMatchObject({ row: { series: 'indoor' } });
  });
});
