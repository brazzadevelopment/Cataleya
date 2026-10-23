import { useState } from 'react';
import { Button, Icon } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { blankMatch } from '../data/seed';
import { matchTeam, normalize, parseSchedule, type Cell, type ImportedMatch } from '../lib/excel';
import type { Mutation } from '../lib/mutations';
import { dayShort, zonedToIso } from '../lib/time';
import { Field, Input, newId, Sheet, Status, useSave } from './kit';

interface Row extends ImportedMatch {
  homeId: string | null;
  awayId: string | null;
  fieldId: string | null;
  groupId: string | null;
  duplicate: boolean;
}

export function ExcelImport({ onClose }: { onClose(): void }) {
  const { snap, categoryId } = useTournament();
  const tz = snap.tournament.timezone;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [defaultDate, setDefaultDate] = useState(snap.tournament.start_date);
  const [fileName, setFileName] = useState('');
  const { save, status, busy } = useSave();

  const teams = snap.teams.filter((t) => t.category_id === categoryId);

  async function read(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    let cells: Cell[][];
    try {
      if (/\.csv$/i.test(file.name)) {
        const text = await file.text();
        const sep = text.includes(';') ? ';' : ',';
        cells = text.split(/\r?\n/).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, '')));
      } else {
        const { default: readXlsx } = await import('read-excel-file');
        cells = (await readXlsx(file)) as Cell[][];
      }
    } catch {
      setWarnings(['Datoteka se ne može pročitati. Spremi je kao .xlsx ili .csv.']);
      setRows([]);
      return;
    }
    const year = Number(snap.tournament.start_date.slice(0, 4));
    const result = parseSchedule(cells, { year, defaultDate });
    setWarnings(result.warnings);
    setRows(result.matches.map((im) => resolveRow(im)));
  }

  function resolveRow(im: ImportedMatch): Row {
    const home = matchTeam(im.home, teams);
    const away = matchTeam(im.away, teams);
    const field = im.field ? snap.fields.find((f) => normalize(f.name) === normalize(im.field!)) : null;
    const gHome = snap.groupTeams.find((g) => g.team_id === home?.id)?.group_id;
    const gAway = snap.groupTeams.find((g) => g.team_id === away?.id)?.group_id;
    const named = im.group ? snap.groups.find((g) => g.category_id === categoryId && g.name === im.group)?.id : null;
    const groupId = named ?? (gHome && gHome === gAway ? gHome : null);
    const startsAt = im.date ? zonedToIso(im.date, im.time, tz) : null;
    const duplicate = !!home && !!away && snap.matches.some((m) =>
      m.category_id === categoryId && m.starts_at === startsAt
      && ((m.home_team_id === home.id && m.away_team_id === away.id) || (m.home_team_id === away.id && m.away_team_id === home.id)));
    return { ...im, homeId: home?.id ?? null, awayId: away?.id ?? null, fieldId: field?.id ?? null, groupId, duplicate };
  }

  const good = (rows ?? []).filter((r) => r.homeId && r.awayId && r.date && !r.duplicate);
  const unknownTeams = [...new Set((rows ?? []).flatMap((r) => [!r.homeId && r.home, !r.awayId && r.away]).filter(Boolean))] as string[];
  const unknownFields = [...new Set((rows ?? []).filter((r) => r.field && !r.fieldId).map((r) => r.field!))];

  async function commit() {
    const category = snap.categories.find((c) => c.id === categoryId);
    const mutations: Mutation[] = good.map((r) => {
      const m = blankMatch({
        id: newId(), tournament_id: snap.tournament.id, category_id: categoryId,
        stage: r.groupId ? 'group' : 'placement',
        group_id: r.groupId,
        home_team_id: r.homeId, away_team_id: r.awayId,
        field_id: r.fieldId,
        starts_at: zonedToIso(r.date!, r.time, tz),
        duration_minutes: r.minutes && r.minutes !== category?.match_minutes ? r.minutes : null,
      });
      const { tournament_id: _t, ...row } = m;
      return { type: 'upsert', table: 'matches', row };
    });
    if (await save(mutations, `Uvezeno ${mutations.length} utakmica.`)) setTimeout(onClose, 900);
  }

  return (
    <Sheet title="Uvoz rasporeda iz Excela" onClose={onClose}>
      <div className="space-y-3 text-[13px] leading-relaxed text-white/75">
        <p>Raspored može biti kao tablica s vremenom i stupcima <b>Teren 1</b>, <b>Teren 2</b> (u ćeliji „NK A – NK B”), ili kao popis sa stupcima <b>Datum, Vrijeme, Teren, Domaćin, Gost</b>.</p>
        <Field label="Datum ako ga nema u tablici">
          <Input type="date" value={defaultDate} onChange={(e) => setDefaultDate(e.target.value)} />
        </Field>
        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 text-sm font-extrabold text-white">
          <Icon name="upload" className="size-5" /> {fileName || 'Odaberi .xlsx ili .csv'}
          <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => void read(e.target.files?.[0])} />
        </label>

        {warnings.map((w) => <p key={w} className="font-semibold text-gold">{w}</p>)}

        {rows && rows.length > 0 && (
          <>
            {unknownTeams.length > 0 && (
              <p className="rounded-xl bg-live/15 p-3 text-[#ff9cae]">
                Ne poznajem momčadi: <b>{unknownTeams.join(', ')}</b>. Dodaj ih u „Momčadi” ili ispravi naziv u Excelu.
              </p>
            )}
            {unknownFields.length > 0 && (
              <p className="rounded-xl bg-gold/10 p-3 text-gold">Nepoznati tereni: <b>{unknownFields.join(', ')}</b>. Utakmice će biti bez terena.</p>
            )}
            <div className="card max-h-72 divide-y divide-line overflow-y-auto">
              {rows.map((r, i) => {
                const ok = r.homeId && r.awayId && r.date && !r.duplicate;
                return (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 text-[12px] ${ok ? '' : 'opacity-50'}`}>
                    <span className="w-16 shrink-0 font-bold">{r.date ? dayShort(r.date).split(' ')[0] : '?'} {r.time}</span>
                    <span className="min-w-0 flex-1 truncate">{r.home} – {r.away}</span>
                    <span className="shrink-0 text-white/50">{r.duplicate ? 'već postoji' : r.field ?? ''}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={commit} disabled={busy || good.length === 0}>Uvezi {good.length} utakmica</Button>
              <Status status={status} />
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
