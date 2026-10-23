import { describe, expect, it } from 'vitest';
import { demoSnapshot, prettyName } from './seed';
import { localDate } from '../lib/time';

const s = demoSnapshot();

describe('Cataleya Cup 2026: podaci iz rasporeda', () => {
  it('ima 4 godišta i broj skupina iz propozicija', () => {
    const count = (c: string) => s.groups.filter((g) => g.category_id === c).length;
    expect(s.categories.map((c) => c.name)).toEqual(['2016.', '2017.', '2018.', '2019.']);
    expect([count('u2016'), count('u2017'), count('u2018'), count('u2019')]).toEqual([10, 10, 9, 4]);
  });

  it('svaka skupina ima 4 momčadi i 6 utakmica, svatko igra sa svakim jednom', () => {
    for (const g of s.groups) {
      const teamIds = s.groupTeams.filter((gt) => gt.group_id === g.id).map((gt) => gt.team_id);
      expect(teamIds, `${g.category_id} ${g.name}`).toHaveLength(4);
      const ms = s.matches.filter((m) => m.group_id === g.id);
      expect(ms, `${g.category_id} ${g.name}`).toHaveLength(6);
      const pairs = new Set(ms.map((m) => [m.home_team_id, m.away_team_id].sort().join('|')));
      expect(pairs.size, `${g.category_id} ${g.name}`).toBe(6);
      for (const m of ms) {
        expect(teamIds).toContain(m.home_team_id);
        expect(teamIds).toContain(m.away_team_id);
      }
    }
  });

  it('nijedna momčad ne igra dvije utakmice u isto vrijeme, nijedan teren nema dvije utakmice odjednom', () => {
    const seenTeam = new Set<string>();
    const seenField = new Set<string>();
    for (const m of s.matches.filter((x) => x.starts_at)) {
      for (const t of [m.home_team_id, m.away_team_id].filter(Boolean)) {
        const k = `${t}@${m.starts_at}`;
        expect(seenTeam.has(k), k).toBe(false);
        seenTeam.add(k);
      }
      const f = `${m.field_id}@${m.starts_at}`;
      expect(seenField.has(f), f).toBe(false);
      seenField.add(f);
    }
  });

  it('broj utakmica skupina po godištu', () => {
    const n = (c: string) => s.matches.filter((m) => m.category_id === c && m.stage === 'group').length;
    expect([n('u2016'), n('u2017'), n('u2018'), n('u2019')]).toEqual([60, 60, 54, 24]);
  });

  it('osmine A i B turnira u subotu za 2016., 2017. i 2018.', () => {
    for (const c of ['u2016', 'u2017', 'u2018']) {
      const ko = s.matches.filter((m) => m.category_id === c && m.stage === 'round_of_16');
      expect(ko.filter((m) => m.bracket === 'A')).toHaveLength(8);
      expect(ko.filter((m) => m.bracket === 'B')).toHaveLength(8);
      expect(ko.every((m) => localDate(m.starts_at!, 'Europe/Zagreb') === '2026-10-24')).toBe(true);
    }
  });

  it('prvi termin 2019. je u petak u 16:00 na Privlaci', () => {
    const first = s.matches.filter((m) => m.category_id === 'u2019' && m.starts_at).sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))[0];
    expect(first.starts_at).toBe('2026-10-23T14:00:00.000Z');
    expect(s.fields.find((f) => f.id === first.field_id)?.venue).toBe('Privlaka, prirodni teren');
  });

  it('uređuje nazive', () => {
    expect(prettyName('NK PRIMORAC STO BIJELI')).toBe('NK Primorac Stobreč bijeli');
    expect(prettyName('NŠK NOVA ZORA')).toBe('NŠK Nova Zora');
    expect(prettyName('NK JADRAN LUKA PLOČE')).toBe('NK Jadran Luka Ploče');
    expect(prettyName('NK VARAŽDIN NARANČASTI')).toBe('NK Varaždin narančasti');
  });
});
