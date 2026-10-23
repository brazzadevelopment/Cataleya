import { useState } from 'react';
import { Button } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { blankMatch } from '../data/seed';
import { parseSource } from '../lib/advancement';
import { localDate, localTime, zonedToIso } from '../lib/time';
import type { Match, MatchStage } from '../lib/types';
import { STAGE_LABEL, STAGE_ORDER } from '../lib/view';
import { Field, Input, newId, SelectBox, Sheet, Status, useSave } from './kit';

/** Uređivanje jedne utakmice: termin, teren, momčadi ili pravilo prolaska, plasman. */
export function MatchEditor({ match, stage, onClose }: { match?: Match; stage?: MatchStage; onClose(): void }) {
  const { snap, categoryId } = useTournament();
  const tz = snap.tournament.timezone;
  const initial = match ?? blankMatch({ id: newId(), tournament_id: snap.tournament.id, category_id: categoryId, stage: stage ?? 'group' });
  const [m, setM] = useState<Match>(initial);
  const [date, setDate] = useState(initial.starts_at ? localDate(initial.starts_at, tz) : '');
  const [time, setTime] = useState(initial.starts_at ? localTime(initial.starts_at, tz) : '');
  const { save, status, busy } = useSave();
  const set = <K extends keyof Match>(k: K, v: Match[K]) => setM((x) => ({ ...x, [k]: v }));

  const teams = snap.teams.filter((t) => t.category_id === m.category_id).sort((a, b) => a.name.localeCompare(b.name, 'hr'));
  const groups = snap.groups.filter((g) => g.category_id === m.category_id);
  const teamOptions: [string, string][] = [['', '— prema pravilu / nije poznato —'], ...teams.map((t) => [t.id, t.name] as [string, string])];
  const knockout = m.stage !== 'group';

  const sourceOk = (s: string | null) => !s || parseSource(s) != null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceOk(m.home_source) || !sourceOk(m.away_source)) return;
    const starts_at = date && time ? zonedToIso(date, time, tz) : null;
    const original = match;
    const teamsChangedByHand = !!original && (original.home_team_id !== m.home_team_id || original.away_team_id !== m.away_team_id);
    const norm = (s: string | null) => {
      const p = parseSource(s);
      return !p ? null : p.kind === 'group' ? `${p.position}${p.group}` : `${p.kind === 'winner' ? 'W' : 'L'}:${p.code}`;
    };
    const row = {
      ...m,
      starts_at,
      code: m.code?.trim() || null,
      label: m.label?.trim() || null,
      home_source: norm(m.home_source),
      away_source: norm(m.away_source),
      // Ručna promjena momčadi u utakmici s pravilom: automatika je više ne dira.
      teams_locked: m.teams_locked || (teamsChangedByHand && !!(m.home_source || m.away_source)),
    };
    const { tournament_id: _t, updated_at: _u, ...clean } = row;
    if (await save([{ type: 'upsert', table: 'matches', row: clean }])) onClose();
  }

  async function remove() {
    if (!match || !confirm('Obrisati ovu utakmicu?')) return;
    if (await save([{ type: 'delete', table: 'matches', id: match.id }])) onClose();
  }

  return (
    <Sheet title={match ? 'Uredi utakmicu' : 'Nova utakmica'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Faza">
            <SelectBox value={m.stage} onChange={(e) => set('stage', e.target.value as MatchStage)} options={STAGE_ORDER.map((s) => [s, STAGE_LABEL[s]])} />
          </Field>
          {knockout ? (
            <Field label="Oznaka" hint="npr. ČF1, PF1, F">
              <Input value={m.code ?? ''} onChange={(e) => set('code', e.target.value.replace(/\s/g, '').slice(0, 12) || null)} />
            </Field>
          ) : (
            <Field label="Skupina">
              <SelectBox value={m.group_id ?? ''} onChange={(e) => set('group_id', e.target.value || null)} options={[['', '—'], ...groups.map((g) => [g.id, g.name] as [string, string])]} />
            </Field>
          )}
        </div>
        {knockout && (
          <Field label="Naziv (po želji)" hint="npr. Četvrtfinale 1, Za 5. mjesto">
            <Input value={m.label ?? ''} onChange={(e) => set('label', e.target.value || null)} />
          </Field>
        )}

        <div className="grid grid-cols-[1.3fr_1fr] gap-3">
          <Field label="Datum"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Početak"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-[1.3fr_1fr] gap-3">
          <Field label="Teren">
            <SelectBox value={m.field_id ?? ''} onChange={(e) => set('field_id', e.target.value || null)} options={[['', '— nije određen —'], ...snap.fields.map((f) => [f.id, f.name] as [string, string])]} />
          </Field>
          <Field label="Trajanje (min)">
            <Input type="number" min={1} placeholder={String(snap.categories.find((c) => c.id === m.category_id)?.match_minutes ?? '')} value={m.duration_minutes ?? ''} onChange={(e) => set('duration_minutes', e.target.value ? Number(e.target.value) : null)} />
          </Field>
        </div>

        {(['home', 'away'] as const).map((side) => {
          const srcKey = `${side}_source` as const;
          const teamKey = `${side}_team_id` as const;
          return (
            <div key={side} className="card space-y-2 p-3">
              <div className="text-[12px] font-extrabold tracking-wider text-gold uppercase">{side === 'home' ? 'Domaćin' : 'Gost'}</div>
              {knockout && (
                <Field label="Tko ulazi (pravilo)" hint="1A = 1. u skupini A · W:ČF1 = pobjednik ČF1 · L:PF1 = poraženi PF1">
                  <Input value={m[srcKey] ?? ''} onChange={(e) => set(srcKey, e.target.value || null)} placeholder="npr. 1A" className={sourceOk(m[srcKey]) ? '' : 'ring-live'} />
                </Field>
              )}
              <Field label="Momčad">
                <SelectBox value={m[teamKey] ?? ''} onChange={(e) => set(teamKey, e.target.value || null)} options={teamOptions} />
              </Field>
            </div>
          );
        })}

        {knockout && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pobjednik osvaja mjesto"><Input type="number" min={1} value={m.winner_place ?? ''} onChange={(e) => set('winner_place', e.target.value ? Number(e.target.value) : null)} /></Field>
              <Field label="Poraženi osvaja mjesto"><Input type="number" min={1} value={m.loser_place ?? ''} onChange={(e) => set('loser_place', e.target.value ? Number(e.target.value) : null)} /></Field>
            </div>
            <label className="flex items-start gap-3 text-[13px] font-semibold">
              <input type="checkbox" checked={m.teams_locked} onChange={(e) => set('teams_locked', e.target.checked)} className="mt-0.5 size-5 accent-[#f2c230]" />
              <span>Ručno određene momčadi<span className="block text-[11px] font-normal text-white/50">Automatika neće mijenjati momčadi u ovoj utakmici.</span></span>
            </label>
          </>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" disabled={busy}>Spremi</Button>
          {match && <Button variant="danger" onClick={remove} disabled={busy}>Obriši</Button>}
          <Status status={status} />
        </div>
      </form>
    </Sheet>
  );
}
