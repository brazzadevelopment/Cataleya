import { describe, expect, it } from 'vitest';
import { matchTeam, parseSchedule, splitPair } from './excel';
import { demoSnapshot } from '../data/seed';

describe('uvoz rasporeda iz Excela', () => {
  it('čita mrežu kao u organizatorovom rasporedu', () => {
    const rows = [
      ['Raspored, petak 23. 10.', null, null],
      ['Vrijeme', 'Teren 1', 'Teren 2'],
      ['16:00 – 16:25', 'NK Špansko – NK Sabunjar', 'NK Zadarnova plavi – NK Varaždin plavi'],
      ['16:30 – 16:55', 'NK Rudeš – NK Pakoštane', 'NK Inker – HNK Zadar'],
      [null, null, null],
      ['Subota 24. 10.', null, null],
      ['Vrijeme', 'Teren 1', 'Teren 2'],
      ['09:00 – 09:25', 'NK Rudeš – NK Lokomotiva bijeli', 'NK Abeceda – NK Pakoštane'],
    ];
    const { matches, warnings } = parseSchedule(rows, { year: 2026 });
    expect(warnings).toEqual([]);
    expect(matches).toHaveLength(6);
    expect(matches[0]).toMatchObject({ date: '2026-10-23', time: '16:00', minutes: 25, field: 'Teren 1', home: 'NK Špansko', away: 'NK Sabunjar' });
    expect(matches[3]).toMatchObject({ field: 'Teren 2', home: 'NK Inker', away: 'HNK Zadar' });
    expect(matches[5]).toMatchObject({ date: '2026-10-24', time: '09:00', home: 'NK Abeceda' });
  });

  it('čita vrijeme koje Excel spremi kao broj ili datum', () => {
    const rows = [
      ['Vrijeme', 'Teren 1'],
      [16 / 24, 'NK A – NK B'],
      [new Date(Date.UTC(1899, 11, 30, 16, 30)), 'NK C - NK D'],
    ];
    const { matches } = parseSchedule(rows, { year: 2026, defaultDate: '2026-10-23' });
    expect(matches.map((m) => m.time)).toEqual(['16:00', '16:30']);
    expect(matches[1]).toMatchObject({ home: 'NK C', away: 'NK D', date: '2026-10-23' });
  });

  it('čita popis s domaćinom i gostom', () => {
    const rows = [
      ['Datum', 'Vrijeme', 'Teren', 'Domaćin', 'Gost', 'Skupina'],
      ['23.10.2026', '17:00', 'Teren 1', 'NK Lokomotiva plavi', 'NŠK Nova Zora', 'B'],
      [null, '17:30', 'Teren 2', 'NK Abeceda', 'NK Lokomotiva bijeli', 'Skupina C'],
      [null, null, null, null, null, null],
    ];
    const { matches } = parseSchedule(rows, { year: 2026 });
    expect(matches).toEqual([
      { row: 2, date: '2026-10-23', time: '17:00', minutes: null, field: 'Teren 1', home: 'NK Lokomotiva plavi', away: 'NŠK Nova Zora', group: 'B' },
      { row: 3, date: '2026-10-23', time: '17:30', minutes: null, field: 'Teren 2', home: 'NK Abeceda', away: 'NK Lokomotiva bijeli', group: 'C' },
    ]);
  });

  it('javlja kad ne prepozna tablicu', () => {
    expect(parseSchedule([['nešto'], ['drugo']], { year: 2026 }).warnings.length).toBeGreaterThan(0);
  });

  it('razdvaja parove s raznim crticama', () => {
    expect(splitPair('NK A – NK B')).toEqual(['NK A', 'NK B']);
    expect(splitPair('NK A-NK B')).toBeNull(); // crtica bez razmaka može biti dio imena
    expect(splitPair('NK A vs NK B')).toEqual(['NK A', 'NK B']);
  });

  it('pronalazi momčad bez obzira na kvačice i velika slova', () => {
    const teams = demoSnapshot().teams;
    expect(matchTeam('nk spansko', teams)?.name).toBe('NK Špansko');
    expect(matchTeam('NSK NOVA ZORA', teams)?.name).toBe('NŠK Nova Zora');
    expect(matchTeam('Nova Zora', teams)?.name).toBe('NŠK Nova Zora');
    expect(matchTeam('NK Hajduk', teams)).toBeNull();
  });
});
