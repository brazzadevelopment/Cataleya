// Iz početnih podataka (src/data/seed.ts) napravi supabase/seed.sql.
// Pokretanje: npm run seed-sql
//
// Podaci su u sažetom JSON-u, a SQL ih raspakira. Svaki zapis dobiva
// stalni UUID: md5('cataleya:' || kratka_oznaka), pa se seed može
// pokrenuti više puta bez dupliciranja.
// PIN-ovi NISU u datoteci; postavljaju se nakon uvoza (vidi UPUTE.md).

import { writeFileSync } from 'node:fs';
import { demoSnapshot } from '../src/data/seed';
import { localDate, localTime } from '../src/lib/time';

const s = demoSnapshot();
const t = s.tournament;
const tz = t.timezone;

// Kratke oznake umjesto dugih demo id-jeva
const short = new Map<string, string>();
const key = (prefix: string, id: string | null) => {
  if (id == null) return null;
  if (!short.has(id)) short.set(id, `${prefix}${[...short.values()].filter((v) => v.startsWith(prefix)).length}`);
  return short.get(id)!;
};

const C = s.categories.map((c) => [key('c', c.id), c.name, c.birth_year, c.match_minutes, c.players_on_field, c.sort_order]);
const F = s.fields.map((f) => [key('f', f.id), f.name, f.venue, f.sort_order]);
const G = s.groups.map((g) => [key('g', g.id), short.get(g.category_id), g.name, g.sort_order]);
const TM = s.teams.map((x) => [key('t', x.id), short.get(x.category_id), x.name]);
const GT = s.groupTeams.map((x) => [short.get(x.group_id), short.get(x.team_id)]);
const M = s.matches.map((m) => [
  key('m', m.id), short.get(m.category_id), m.stage, key('g', m.group_id), m.code, m.label,
  key('t', m.home_team_id), key('t', m.away_team_id), m.home_source, m.away_source, key('f', m.field_id),
  m.starts_at ? `${localDate(m.starts_at, tz)} ${localTime(m.starts_at, tz)}` : null,
  m.duration_minutes, m.bracket,
]);

const { id: _id, ...tournament } = { ...t, logo_path: null };
const data = JSON.stringify({ T: tournament, C, F, G, TM, GT, M });

const sql = `-- Cataleya Cup 2026: početni podaci. Napravljeno skriptom scripts/seed-sql.ts.
-- Pokreni NAKON schema.sql. Zatim postavi PIN-ove (UPUTE.md).

do $seed$
declare
  d jsonb := $json$${data}$json$::jsonb;
  tid uuid := md5('cataleya:T')::uuid;
  u text := 'cataleya:';
begin
  insert into public.tournaments (id, slug, name, place, venue, start_date, end_date, timezone, logo_path, cover_path,
    color_primary, color_secondary, description, rules, points_win, points_draw, points_loss, tiebreakers,
    scorers_enabled, is_published)
  select tid, x.slug, x.name, x.place, x.venue, x.start_date, x.end_date, x.timezone, null, null,
    x.color_primary, x.color_secondary, x.description, x.rules, x.points_win, x.points_draw, x.points_loss,
    x.tiebreakers, x.scorers_enabled, x.is_published
  from jsonb_populate_record(null::public.tournaments, d->'T') x
  on conflict (id) do nothing;

  insert into public.categories (id, tournament_id, name, birth_year, match_minutes, players_on_field, sort_order)
  select md5(u || (r->>0))::uuid, tid, r->>1, (r->>2)::smallint, (r->>3)::smallint, (r->>4)::smallint, (r->>5)::smallint
  from jsonb_array_elements(d->'C') r on conflict (id) do nothing;

  insert into public.fields (id, tournament_id, name, venue, sort_order)
  select md5(u || (r->>0))::uuid, tid, r->>1, r->>2, (r->>3)::smallint
  from jsonb_array_elements(d->'F') r on conflict (id) do nothing;

  insert into public.groups (id, tournament_id, category_id, name, sort_order)
  select md5(u || (r->>0))::uuid, tid, md5(u || (r->>1))::uuid, r->>2, (r->>3)::smallint
  from jsonb_array_elements(d->'G') r on conflict (id) do nothing;

  insert into public.teams (id, tournament_id, category_id, name)
  select md5(u || (r->>0))::uuid, tid, md5(u || (r->>1))::uuid, r->>2
  from jsonb_array_elements(d->'TM') r on conflict (id) do nothing;

  insert into public.group_teams (tournament_id, category_id, group_id, team_id)
  select tid, g.category_id, g.id, md5(u || (r->>1))::uuid
  from jsonb_array_elements(d->'GT') r
  join public.groups g on g.id = md5(u || (r->>0))::uuid
  on conflict (group_id, team_id) do nothing;

  insert into public.matches (id, tournament_id, category_id, stage, group_id, code, label, home_team_id, away_team_id,
    home_source, away_source, field_id, starts_at, duration_minutes, bracket)
  select md5(u || (r->>0))::uuid, tid, md5(u || (r->>1))::uuid, (r->>2)::public.match_stage,
    case when r->>3 is null then null else md5(u || (r->>3))::uuid end,
    r->>4, r->>5,
    case when r->>6 is null then null else md5(u || (r->>6))::uuid end,
    case when r->>7 is null then null else md5(u || (r->>7))::uuid end,
    r->>8, r->>9,
    case when r->>10 is null then null else md5(u || (r->>10))::uuid end,
    case when r->>11 is null then null else ((r->>11) || ' ' || ${`'${tz}'`})::timestamp at time zone ${`'${tz}'`} end,
    (r->>12)::smallint, r->>13
  from jsonb_array_elements(d->'M') r on conflict (id) do nothing;
end
$seed$;
`;

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log(`supabase/seed.sql: ${s.teams.length} momčadi, ${s.matches.length} utakmica, ${Math.round(sql.length / 1024)} KB`);
