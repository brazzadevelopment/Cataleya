import { useState } from 'react';
import { Button, Empty, Icon, SectionTitle } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { dayLabel, localDate } from '../lib/time';
import type { Match } from '../lib/types';
import { byTime, fieldName, matchPhase, matchTime, sideLabel } from '../lib/view';
import { ExcelImport } from './ExcelImport';
import { MatchEditor } from './MatchEditor';

export function ScheduleTab() {
  const { snap, categoryId } = useTournament();
  const tz = snap.tournament.timezone;
  const [editing, setEditing] = useState<Match | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const matches = snap.matches.filter((m) => m.category_id === categoryId).sort(byTime);
  const days = new Map<string, Match[]>();
  for (const m of matches) {
    const d = m.starts_at ? localDate(m.starts_at, tz) : 'tbd';
    days.set(d, [...(days.get(d) ?? []), m]);
  }

  return (
    <div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button onClick={() => setEditing('new')}><Icon name="plus" className="size-4" /> Utakmica</Button>
        <Button variant="ghost" onClick={() => setImporting(true)}><Icon name="upload" className="size-4" /> Uvoz iz Excela</Button>
      </div>

      {matches.length === 0 && <div className="mt-4"><Empty>Još nema utakmica.</Empty></div>}
      {[...days.entries()].map(([d, list]) => (
        <section key={d}>
          <SectionTitle>{d === 'tbd' ? 'Bez termina' : dayLabel(d)}</SectionTitle>
          <div className="card divide-y divide-line">
            {list.map((m) => (
              <button key={m.id} type="button" onClick={() => setEditing(m)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
                <div className="w-[74px] shrink-0 text-[12px] font-bold leading-tight text-white/70">
                  {matchTime(snap, m)?.split(' – ')[0] ?? '—'}
                  <div className="font-semibold text-white/45">{fieldName(snap, m.field_id) ?? ''}</div>
                </div>
                <div className="min-w-0 flex-1 text-[13px] leading-snug">
                  <div className="truncate font-bold">{sideLabel(snap, m, 'home').name}</div>
                  <div className="truncate font-bold">{sideLabel(snap, m, 'away').name}</div>
                  <div className="truncate text-[11px] text-gold/80">{matchPhase(snap, m)}</div>
                </div>
                <Icon name="edit" className="size-4 shrink-0 text-white/40" />
              </button>
            ))}
          </div>
        </section>
      ))}

      {editing && <MatchEditor match={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {importing && <ExcelImport onClose={() => setImporting(false)} />}
    </div>
  );
}
