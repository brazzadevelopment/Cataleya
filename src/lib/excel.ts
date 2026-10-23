// Uvoz rasporeda iz Excela. Prima retke tablice (ćelije kao tekst, broj ili datum)
// i prepoznaje dva oblika:
//
// (a) mreža, kao organizatorov raspored:
//       Petak 23. 10.
//       Vrijeme        | Teren 1                  | Teren 2
//       16:00 – 16:25  | NK Špansko – NK Sabunjar | NK Zadarnova plavi – NK Varaždin plavi
//
// (b) popis, jedna utakmica po retku:
//       Datum | Vrijeme | Teren | Domaćin | Gost | Skupina

export type Cell = string | number | Date | boolean | null | undefined;

export interface ImportedMatch {
  row: number; // redak u Excelu (1 = prvi)
  date: string | null; // YYYY-MM-DD
  time: string; // HH:MM
  minutes: number | null; // trajanje iz '16:00 – 16:25'
  field: string | null;
  home: string;
  away: string;
  group: string | null;
}

export interface ImportResult {
  matches: ImportedMatch[];
  warnings: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cellText(c: Cell): string {
  if (c == null) return '';
  if (c instanceof Date) {
    // Excel vrijeme bez datuma dolazi kao 30. 12. 1899.
    if (c.getUTCFullYear() < 1901) return `${pad(c.getUTCHours())}:${pad(c.getUTCMinutes())}`;
    return `${c.getUTCFullYear()}-${pad(c.getUTCMonth() + 1)}-${pad(c.getUTCDate())}`;
  }
  if (typeof c === 'number') {
    if (c >= 0 && c < 1) {
      const mins = Math.round(c * 24 * 60);
      return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
    }
    return String(c);
  }
  return String(c).trim();
}

const TIME = /(\d{1,2})[:.h](\d{2})(?:\s*[–—-]\s*(\d{1,2})[:.h](\d{2}))?/;

function parseTime(s: string): { time: string; minutes: number | null } | null {
  const m = TIME.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  let minutes: number | null = null;
  if (m[3]) {
    minutes = Number(m[3]) * 60 + Number(m[4]) - (h * 60 + mi);
    if (minutes <= 0) minutes = null;
  }
  return { time: `${pad(h)}:${pad(mi)}`, minutes };
}

function parseDate(s: string, year: number): string | null {
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*(\d{4})?/.exec(s);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${m[3] ?? year}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

/** 'NK A – NK B' → ['NK A', 'NK B'] */
export function splitPair(s: string): [string, string] | null {
  const parts = s.split(/\s+[–—-]\s+|\s*[–—]\s*|\s+vs\.?\s+|\s+:\s+/i).map((p) => p.trim()).filter(Boolean);
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

const HEADERS = {
  date: ['datum', 'dan'],
  time: ['vrijeme', 'pocetak', 'sat', 'termin'],
  field: ['teren', 'igraliste'],
  home: ['domacin', 'domaci', 'momcad 1', 'ekipa 1', 'tim 1'],
  away: ['gost', 'gosti', 'momcad 2', 'ekipa 2', 'tim 2'],
  group: ['skupina', 'grupa'],
};

function findColumn(header: string[], names: string[]): number {
  return header.findIndex((h) => names.some((n) => h === n || h.startsWith(n + ' ')));
}

export function parseSchedule(rows: Cell[][], opts: { year: number; defaultDate?: string | null }): ImportResult {
  const text = rows.map((r) => r.map(cellText));
  const norm = text.map((r) => r.map(normalize));
  const warnings: string[] = [];

  // (b) popis: zaglavlje s domaćinom i gostom
  const listHeader = norm.findIndex((r) => findColumn(r, HEADERS.home) >= 0 && findColumn(r, HEADERS.away) >= 0);
  if (listHeader >= 0) {
    const h = norm[listHeader];
    const col = Object.fromEntries(Object.entries(HEADERS).map(([k, v]) => [k, findColumn(h, v)])) as Record<keyof typeof HEADERS, number>;
    const matches: ImportedMatch[] = [];
    let date = opts.defaultDate ?? null;
    for (let i = listHeader + 1; i < text.length; i++) {
      const r = text[i];
      const home = r[col.home] ?? '';
      const away = r[col.away] ?? '';
      if (!home && !away) continue;
      if (col.date >= 0 && r[col.date]) date = parseDate(r[col.date], opts.year) ?? date;
      const t = col.time >= 0 ? parseTime(r[col.time] ?? '') : null;
      if (!home || !away || !t) {
        warnings.push(`Redak ${i + 1}: nedostaje ${!t ? 'vrijeme' : 'momčad'}.`);
        continue;
      }
      matches.push({
        row: i + 1, date, time: t.time, minutes: t.minutes,
        field: col.field >= 0 ? r[col.field] || null : null,
        home, away,
        group: col.group >= 0 ? (r[col.group] || '').replace(/^(skupina|grupa)\s*/i, '').toUpperCase() || null : null,
      });
    }
    return { matches, warnings };
  }

  // (a) mreža: redak s nazivima terena, ispod njega vremena i parovi
  const matches: ImportedMatch[] = [];
  let date = opts.defaultDate ?? null;
  let fields: (string | null)[] = [];
  let timeCol = 0;
  for (let i = 0; i < text.length; i++) {
    const r = text[i];
    const n = norm[i];
    const filled = r.filter(Boolean);
    if (!filled.length) continue;

    const fieldCols = n.map((c) => (/^(teren|igraliste)\b/.test(c) ? c : null));
    if (fieldCols.some(Boolean)) {
      fields = r.map((c, j) => (fieldCols[j] ? c : null));
      timeCol = Math.max(0, n.findIndex((c) => HEADERS.time.includes(c)));
      const d = r.map((c) => parseDate(c, opts.year)).find(Boolean);
      if (d) date = d;
      continue;
    }

    const t = parseTime(r[timeCol] ?? '');
    const pairs = r.map((c, j) => (j !== timeCol ? splitPair(c) : null));
    if (t && pairs.some(Boolean)) {
      pairs.forEach((p, j) => {
        if (!p) return;
        matches.push({ row: i + 1, date, time: t.time, minutes: t.minutes, field: fields[j] ?? null, home: p[0], away: p[1], group: null });
      });
      continue;
    }

    // Redak s datumom, npr. 'Raspored, petak 23. 10.'
    if (filled.length <= 2) {
      const d = filled.map((c) => parseDate(c, opts.year)).find(Boolean);
      if (d) date = d;
    }
  }
  if (!matches.length) warnings.push('Nisam prepoznao raspored. Provjeri da tablica ima stupce Teren 1, Teren 2… ili Domaćin i Gost.');
  if (matches.some((m) => !m.date)) warnings.push('Za neke utakmice nema datuma. Odaberi datum prije uvoza.');
  return { matches, warnings };
}

/** Pronađi momčad po nazivu (bez obzira na velika slova i kvačice). */
export function matchTeam<T extends { id: string; name: string }>(name: string, teams: T[]): T | null {
  const n = normalize(name);
  const exact = teams.find((t) => normalize(t.name) === n);
  if (exact) return exact;
  const strip = (s: string) => s.replace(/^(h?nk|nsk|snk|gnk|nk)\s+/, '');
  const loose = teams.filter((t) => strip(normalize(t.name)) === strip(n));
  return loose.length === 1 ? loose[0] : null;
}
