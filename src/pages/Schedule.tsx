import { useMemo, useState } from 'react';
import { MatchCard } from '../components/MatchCard';
import { Chip, Empty, SectionTitle } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { dayLabel, dayShort, localDate } from '../lib/time';
import { byTime, involves } from '../lib/view';

export function Schedule() {
  const { snap, categoryId } = useTournament();
  const tz = snap.tournament.timezone;
  const all = useMemo(() => snap.matches.filter((m) => m.category_id === categoryId).sort(byTime), [snap, categoryId]);
  const days = [...new Set(all.filter((m) => m.starts_at).map((m) => localDate(m.starts_at!, tz)))];
  const unscheduled = all.filter((m) => !m.starts_at);

  const today = localDate(new Date().toISOString(), tz);
  const [day, setDay] = useState<string>(() => (days.includes(today) ? today : days[0] ?? 'tbd'));
  const [field, setField] = useState<string>('');
  const [team, setTeam] = useState<string>('');

  const teams = snap.teams.filter((t) => t.category_id === categoryId).sort((a, b) => a.name.localeCompare(b.name, 'hr'));
  const shown = (day === 'tbd' ? unscheduled : all.filter((m) => m.starts_at && localDate(m.starts_at, tz) === day))
    .filter((m) => !field || m.field_id === field)
    .filter((m) => !team || involves(m, new Set([team])));

  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => <Chip key={d} active={day === d} onClick={() => setDay(d)}>{dayShort(d)}</Chip>)}
        {unscheduled.length > 0 && <Chip active={day === 'tbd'} onClick={() => setDay('tbd')}>Nastavak</Chip>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Select value={field} onChange={setField} label="Svi tereni" options={snap.fields.map((f) => [f.id, f.name])} />
        <Select value={team} onChange={setTeam} label="Sve momčadi" options={teams.map((t) => [t.id, t.name])} />
      </div>

      <SectionTitle>{day === 'tbd' ? 'Termin još nije poznat' : dayLabel(day)}</SectionTitle>
      {shown.length ? (
        <div className="space-y-3">{shown.map((m) => <MatchCard key={m.id} match={m} />)}</div>
      ) : (
        <Empty>Nema utakmica za odabrani filter.</Empty>
      )}
    </div>
  );
}

export function Select({ value, onChange, label, options }: {
  value: string; onChange(v: string): void; label: string; options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full min-w-0 truncate rounded-xl bg-white/8 px-3 text-[13px] font-bold text-white ring-1 ring-white/12"
    >
      <option value="">{label}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
