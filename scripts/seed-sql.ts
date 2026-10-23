// Iz početnih podataka (src/data/seed.ts) napravi supabase/seed.sql.
// Pokretanje: npm run seed-sql
// PIN-ovi NISU u datoteci; postavljaju se ručno nakon uvoza (vidi UPUTE.md).

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { demoSnapshot } from '../src/data/seed';

const s = demoSnapshot();

// Isti demo id uvijek daje isti UUID, pa se seed može pokrenuti više puta.
const ids = new Map<string, string>();
function uuid(id: string | null): string | null {
  if (id == null) return null;
  if (!ids.has(id)) {
    const h = createHash('sha256').update(`cataleya:${id}`).digest('hex');
    ids.set(id, `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`);
  }
  return ids.get(id)!;
}

function lit(v: unknown): string {
  if (v == null) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `array[${v.map(lit).join(', ')}]::text[]`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function insert(table: string, rows: Record<string, unknown>[], conflict = 'id'): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const values = rows.map((r) => `  (${cols.map((c) => lit(r[c])).join(', ')})`).join(',\n');
  return `insert into public.${table} (${cols.join(', ')}) values\n${values}\non conflict (${conflict}) do nothing;\n\n`;
}

const t = s.tournament;
const T = uuid(t.id);
let sql = `-- Cataleya Cup 2026: početni podaci. Napravljeno skriptom scripts/seed-sql.ts.\n-- Pokreni NAKON schema.sql. Zatim postavi PIN-ove (UPUTE.md).\n\nbegin;\n\n`;
sql += insert('tournaments', [{ ...t, id: T, logo_path: null }]);
sql += insert('categories', s.categories.map((c) => ({ ...c, id: uuid(c.id), tournament_id: T })));
sql += insert('fields', s.fields.map((f) => ({ ...f, id: uuid(f.id), tournament_id: T })));
sql += insert('teams', s.teams.map((x) => ({ ...x, id: uuid(x.id), tournament_id: T, category_id: uuid(x.category_id) })));
sql += insert('groups', s.groups.map((g) => ({ ...g, id: uuid(g.id), tournament_id: T, category_id: uuid(g.category_id) })));
sql += insert('group_teams', s.groupTeams.map((g) => ({ ...g, tournament_id: T, category_id: uuid(g.category_id), group_id: uuid(g.group_id), team_id: uuid(g.team_id) })), 'group_id, team_id');
sql += insert('matches', s.matches.map((m) => ({
  ...m, id: uuid(m.id), tournament_id: T, category_id: uuid(m.category_id), group_id: uuid(m.group_id),
  home_team_id: uuid(m.home_team_id), away_team_id: uuid(m.away_team_id), field_id: uuid(m.field_id),
})));
sql += `commit;\n\n-- PIN-ovi: zamijeni XXXX svojim PIN-om (4 do 8 znamenki, svi različiti) i pokreni.\n`;
sql += `-- select set_pin('${T}', null, 'XXXX');  -- glavni PIN (organizator)\n`;
for (const f of s.fields) sql += `-- select set_pin('${T}', '${uuid(f.id)}', 'XXXX');  -- ${f.name}\n`;

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log(`supabase/seed.sql: ${s.teams.length} momčadi, ${s.matches.length} utakmica`);
