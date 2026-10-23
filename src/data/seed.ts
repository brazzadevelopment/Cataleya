// Početni podaci: Cataleya Cup 2026 (4 godišta), iz cataleya.ts.
// Koristi ih demo način, a scripts/seed-sql.ts iz njih radi SQL za Supabase.

import { zonedToIso } from '../lib/time';
import type { Category, Field, Group, GroupTeam, Match, Snapshot, Team, Tournament } from '../lib/types';
import { CATALEYA, type Day, type RawCategory } from './cataleya';

const TZ = 'Europe/Zagreb';
const T = 'cataleya-2026';
const DAYS: Record<Day, string> = { pet: '2026-10-23', sub: '2026-10-24', ned: '2026-10-25' };

const RULES = `Turnir se igra po jednostrukom bod sustavu po skupinama.

Redoslijed u skupini određuje se prema:
1. broj osvojenih bodova
2. rezultat međusobnog susreta
3. gol-razlika
4. više postignutih golova
5. manje primljenih golova
6. manje žutih/crvenih kartona
7. ždrijeb

A turnir
2016. i 2017.: osmina finala, prolaze prvi iz svake skupine i 6 najboljih drugoplasiranih.
2018.: osmina finala, prolaze prvi iz svake skupine i 7 najboljih drugoplasiranih.
2019.: četvrtfinale, prolaze prva dva iz svake skupine.

B turnir
2016. i 2017.: 4 posljednja drugoplasirana, svi trećeplasirani i 2 najbolja četvrtoplasirana.
2018.: 2 posljednja drugoplasirana, svi trećeplasirani i 5 najboljih četvrtoplasiranih.
2019.: svi trećeplasirani i četvrtoplasirani.

Ako utakmica drugog dijela natjecanja završi neriješeno, izvode se kazneni udarci: svaka momčad po pet udaraca (različiti igrači), a zatim po jedan do konačnog pobjednika.

Trajanje utakmica: 2016. i 2017. igraju 30 minuta, 2018. i 2019. 25 minuta, bez pauze.
Broj igrača: 2016. i 2017. 7+1, 2018. i 2019. 6+1. Izmjene su neograničene i leteće.

Žuti kartoni se ne zbrajaju, brišu se nakon svake utakmice. Igrač s crvenim kartonom ima pravo nastupa na sljedećoj utakmici, osim ako turnirska komisija ne odluči drukčije.

Momčadi dobivaju pehare i medalje za 1., 2., 3. i 4. mjesto, a dodjeljuju se i priznanja za najboljeg igrača i najboljeg vratara turnira.`;

const tournament: Tournament = {
  id: T,
  slug: 'cataleya-cup-2026',
  name: 'Cataleya Cup 2026',
  place: 'Zadar',
  venue: null,
  start_date: '2026-10-23',
  end_date: '2026-10-25',
  timezone: TZ,
  logo_path: '/emblem.svg',
  cover_path: null,
  color_primary: '#0f3d24',
  color_secondary: '#f2c230',
  description: '9. međunarodni nogometni turnir. Organizatori: Udruga sportske rekreacije Cataleya Kids Zaton i Društvo sportske rekreacije Cataleya.',
  rules: RULES,
  points_win: 3,
  points_draw: 1,
  points_loss: 0,
  tiebreakers: ['head_to_head', 'goal_difference', 'goals_for', 'fewer_goals_against', 'fewer_cards', 'lot'],
  scorers_enabled: false,
  is_published: true,
};

// ---------------------------------------------------------------------
// Nazivi momčadi
// ---------------------------------------------------------------------

const PREFIXES = new Set(['NK', 'HNK', 'GNK', 'ŠNG', 'ŠN', 'RNK', 'FK', 'SV', 'NŠK', 'AFC', 'NOPO', 'GOŠK']);
const LOWER = new Set(['bijeli', 'plavi', 'crveni', 'crni', 'zeleni', 'žuti', 'modri', 'rumeni', 'narančasti']);

/** 'NK PRIMORAC STO BIJELI' → 'NK Primorac Stobreč bijeli' */
export function prettyName(raw: string): string {
  return raw.trim().split(/\s+/).map((w) => {
    if (w === 'STO') return 'Stobreč';
    if (PREFIXES.has(w) || /^\d+$/.test(w)) return w;
    const lower = w.toLocaleLowerCase('hr');
    if (LOWER.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase('hr') + lower.slice(1);
  }).join(' ');
}

const IGNORE = new Set(['nk', 'hnk', 'gnk', 'sng', 'sn', 'rnk', 'fk', 'sv', 'nsk', 'zg']);
const ALIAS: Record<string, string> = { sto: 'stobrec', s: 'stobrec', hellfort: 'helffort', arbansi: 'arbanasi' };

function tokens(name: string): Set<string> {
  return new Set(
    name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .split(/[^a-z0-9]+/).filter((t) => t && !IGNORE.has(t)).map((t) => ALIAS[t] ?? t),
  );
}

const subset = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));

/** Pronađi momčad iz skupine za naziv kako je napisan u rasporedu. */
export function resolveTeam(raw: string, candidates: string[]): string {
  const t = tokens(raw);
  const exact = candidates.filter((c) => { const ct = tokens(c); return subset(t, ct) && subset(ct, t); });
  if (exact.length === 1) return exact[0];
  const loose = candidates.filter((c) => { const ct = tokens(c); return subset(t, ct) || subset(ct, t); });
  if (loose.length === 1) return loose[0];
  throw new Error(`Ne mogu prepoznati momčad „${raw}” (kandidati: ${loose.join(', ') || 'nijedan'})`);
}

export function teamIdFromName(name: string, prefix = ''): string {
  return 'tm-' + prefix + name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function blankMatch(partial: Partial<Match> & Pick<Match, 'id' | 'tournament_id' | 'category_id'>): Match {
  return {
    stage: 'group', group_id: null, code: null, label: null,
    home_team_id: null, away_team_id: null, home_source: null, away_source: null,
    field_id: null, starts_at: null, duration_minutes: null,
    home_score: null, away_score: null, home_penalties: null, away_penalties: null,
    status: 'scheduled', home_yellow: 0, away_yellow: 0, home_red: 0, away_red: 0, bracket: null,
    winner_place: null, loser_place: null, teams_locked: false,
    ...partial,
  };
}

// ---------------------------------------------------------------------
// Sastavljanje
// ---------------------------------------------------------------------

function slot(range: string): { start: string; minutes: number } {
  const m = /^(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})$/.exec(range.trim());
  if (!m) throw new Error(`Neispravno vrijeme ${range}`);
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  return { start: `${m[1].padStart(2, '0')}:${m[2]}`, minutes: end - start };
}

function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function shortVenue(v: string): string {
  return v.replace('SC ', '').replace(', umjetni teren', ' umjetni').replace(', prirodni teren', ' prirodni');
}

function build(): Snapshot {
  const categories: Category[] = [];
  const fields = new Map<string, Field>();
  const teams: Team[] = [];
  const groups: Group[] = [];
  const groupTeams: GroupTeam[] = [];
  const matches: Match[] = [];

  CATALEYA.forEach((raw: RawCategory, ci) => {
    const C = raw.key;
    categories.push({
      id: C, tournament_id: T, name: raw.name, birth_year: raw.birthYear,
      match_minutes: raw.minutes, players_on_field: Number(raw.players.split('+')[0]) + 1, sort_order: ci,
    });

    const fieldOf: Record<string, string> = {};
    for (const [k, [venue, name]] of Object.entries(raw.fields)) {
      const id = `fld-${slug(`${venue} ${name}`)}`;
      fieldOf[k] = id;
      if (!fields.has(id)) {
        fields.set(id, { id, tournament_id: T, name: `${shortVenue(venue)} ${name.replace('Teren ', '')}`, venue, maps_url: null, sort_order: fields.size });
      }
    }

    const groupOfTeam = new Map<string, string>();
    const allNames: string[] = [];
    Object.entries(raw.groups).forEach(([g, names], gi) => {
      const gid = `${C}-grp-${g.toLowerCase()}`;
      groups.push({ id: gid, tournament_id: T, category_id: C, name: g, sort_order: gi });
      for (const n of names) {
        const id = teamIdFromName(n, `${C}-`);
        teams.push({ id, tournament_id: T, category_id: C, name: prettyName(n), short_name: null, logo_path: null });
        groupTeams.push({ tournament_id: T, category_id: C, group_id: gid, team_id: id, lot_rank: null });
        groupOfTeam.set(n, gid);
        allNames.push(n);
      }
    });

    raw.matches.forEach(([day, range, f, pair], i) => {
      const [h, a] = pair.split(/\s+-\s*|\s*-\s+/).map((x) => x.trim());
      const home = resolveTeam(h, allNames);
      const away = resolveTeam(a, allNames);
      const gid = groupOfTeam.get(home)!;
      if (groupOfTeam.get(away) !== gid) throw new Error(`${raw.name}: ${home} i ${away} nisu u istoj skupini`);
      const { start, minutes } = slot(range);
      matches.push(blankMatch({
        id: `${C}-m${String(i + 1).padStart(3, '0')}`, tournament_id: T, category_id: C,
        stage: 'group', group_id: gid,
        home_team_id: teamIdFromName(home, `${C}-`), away_team_id: teamIdFromName(away, `${C}-`),
        field_id: fieldOf[f], starts_at: zonedToIso(DAYS[day], start, TZ),
        duration_minutes: minutes !== raw.minutes ? minutes : null,
      }));
    });

    for (const [code, bracket, range, f, home, away] of raw.knockout) {
      const { start, minutes } = slot(range);
      matches.push(blankMatch({
        id: `${C}-${code.toLowerCase()}`, tournament_id: T, category_id: C,
        stage: 'round_of_16', code, bracket, label: `${bracket} turnir · osmina finala`,
        home_source: home, away_source: away,
        field_id: fieldOf[f], starts_at: zonedToIso(DAYS.sub, start, TZ),
        duration_minutes: minutes !== raw.minutes ? minutes : null,
      }));
    }
  });

  // 2019.: četvrtfinale A turnira (prva dva iz skupine). Parovi su prijedlog
  // dok organizator ne objavi nedjeljni raspored.
  const QF: [string, string, string][] = [['ČF1', '1A', '2B'], ['ČF2', '1B', '2A'], ['ČF3', '1C', '2D'], ['ČF4', '1D', '2C']];
  QF.forEach(([code, home, away], i) => {
    matches.push(blankMatch({
      id: `u2019-qf${i + 1}`, tournament_id: T, category_id: 'u2019',
      stage: 'quarterfinal', code, bracket: 'A', label: `A turnir · četvrtfinale ${i + 1}`,
      home_source: home, away_source: away,
    }));
  });

  return { tournament, categories, fields: [...fields.values()], teams, groups, groupTeams, matches };
}

const SNAPSHOT = build();

/** Demo PIN-ovi: organizator 9000, tereni redom 1001, 1002, … */
export const DEMO_PINS = {
  admin: '9000',
  fields: Object.fromEntries(SNAPSHOT.fields.map((f, i) => [f.id, String(1001 + i)])) as Record<string, string>,
};

export function demoSnapshot(): Snapshot {
  return structuredClone(SNAPSHOT);
}
