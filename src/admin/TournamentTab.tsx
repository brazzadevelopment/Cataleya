import { useState } from 'react';
import { Button, Icon, SectionTitle } from '../components/ui';
import { assetUrl, source } from '../data/source';
import { useTournament } from '../data/TournamentContext';
import type { Tiebreaker, Tournament } from '../lib/types';
import { Field, Input, Status, TextArea, useSave } from './kit';

const TB_LABEL: Record<Tiebreaker, string> = {
  head_to_head: 'Međusobni susret',
  goal_difference: 'Gol-razlika',
  goals_for: 'Više postignutih golova',
  wins: 'Više pobjeda',
  fewer_goals_against: 'Manje primljenih golova',
  fewer_cards: 'Manje žutih/crvenih kartona',
  lot: 'Ždrijeb (organizator ručno)',
};

export function TournamentTab() {
  const { snap, session } = useTournament();
  const [t, setT] = useState<Tournament>(snap.tournament);
  const { save, status, busy } = useSave();
  const set = <K extends keyof Tournament>(k: K, v: Tournament[K]) => setT({ ...t, [k]: v });

  const unused = (Object.keys(TB_LABEL) as Tiebreaker[]).filter((k) => !t.tiebreakers.includes(k));
  const move = (i: number, d: number) => {
    const list = [...t.tiebreakers];
    const [x] = list.splice(i, 1);
    list.splice(i + d, 0, x);
    set('tiebreakers', list);
  };

  async function upload(file: File | undefined) {
    if (!file || !session) return;
    try {
      set('logo_path', await source.uploadImage(session, file));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Učitavanje nije uspjelo.');
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const { id: _id, slug: _slug, timezone: _tz, ...row } = t;
        void save([{ type: 'upsert', table: 'tournaments', row }]);
      }}
    >
      <SectionTitle>Osnovno</SectionTitle>
      <Field label="Naziv"><Input value={t.name} onChange={(e) => set('name', e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mjesto"><Input value={t.place ?? ''} onChange={(e) => set('place', e.target.value || null)} /></Field>
        <Field label="Teren / podloga"><Input value={t.venue ?? ''} onChange={(e) => set('venue', e.target.value || null)} /></Field>
        <Field label="Od"><Input type="date" value={t.start_date} onChange={(e) => set('start_date', e.target.value)} required /></Field>
        <Field label="Do"><Input type="date" value={t.end_date} onChange={(e) => set('end_date', e.target.value)} required /></Field>
      </div>
      <Field label="Opis"><TextArea value={t.description ?? ''} onChange={(e) => set('description', e.target.value || null)} /></Field>

      <SectionTitle>Logo</SectionTitle>
      <div className="flex items-center gap-4">
        <img src={assetUrl(t.logo_path) ?? '/emblem.svg'} alt="" className="size-20 rounded-xl bg-white/5 object-contain p-2" />
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-white/8 px-4 text-sm font-extrabold ring-1 ring-white/12">
          <Icon name="upload" className="size-4" /> Promijeni logo
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
      </div>

      <SectionTitle>Pravila</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Pobjeda"><Input type="number" min={0} value={t.points_win} onChange={(e) => set('points_win', Number(e.target.value))} /></Field>
        <Field label="Neriješeno"><Input type="number" min={0} value={t.points_draw} onChange={(e) => set('points_draw', Number(e.target.value))} /></Field>
        <Field label="Poraz"><Input type="number" min={0} value={t.points_loss} onChange={(e) => set('points_loss', Number(e.target.value))} /></Field>
      </div>

      <div>
        <span className="mb-1 block text-[12px] font-bold text-white/60">Kod jednakih bodova odlučuje redom</span>
        <div className="card divide-y divide-line">
          {t.tiebreakers.map((k, i) => (
            <div key={k} className="flex items-center gap-2 py-1.5 pl-3.5 pr-1.5">
              <span className="w-5 text-[13px] font-black text-gold">{i + 1}.</span>
              <span className="flex-1 text-[14px] font-semibold">{TB_LABEL[k]}</span>
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-9 place-items-center rounded-lg disabled:opacity-20" aria-label="Gore"><Icon name="back" className="size-4 rotate-90" /></button>
              <button type="button" disabled={i === t.tiebreakers.length - 1} onClick={() => move(i, 1)} className="grid size-9 place-items-center rounded-lg disabled:opacity-20" aria-label="Dolje"><Icon name="back" className="size-4 -rotate-90" /></button>
              <button type="button" onClick={() => set('tiebreakers', t.tiebreakers.filter((x) => x !== k))} className="grid size-9 place-items-center rounded-lg text-white/50" aria-label="Makni"><Icon name="x" className="size-4" /></button>
            </div>
          ))}
        </div>
        {unused.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {unused.map((k) => (
              <button key={k} type="button" onClick={() => set('tiebreakers', [...t.tiebreakers, k])} className="h-8 rounded-full bg-white/8 px-3 text-[12px] font-bold text-white/70 ring-1 ring-white/12">
                + {TB_LABEL[k]}
              </button>
            ))}
          </div>
        )}
      </div>

      <Field label="Pravila turnira (vide ih gledatelji)" hint="Zalijepi pravila kad ih dobiješ.">
        <TextArea value={t.rules ?? ''} onChange={(e) => set('rules', e.target.value || null)} className="min-h-40" />
      </Field>

      <label className="flex items-center gap-3 text-[14px] font-semibold">
        <input type="checkbox" checked={t.is_published} onChange={(e) => set('is_published', e.target.checked)} className="size-5 accent-[#f2c230]" />
        Turnir je javan (vidljiv na popisu turnira)
      </label>

      <div className="sticky bottom-3 flex items-center gap-3 rounded-2xl bg-pitch-950/90 p-2 backdrop-blur">
        <Button type="submit" disabled={busy}>Spremi</Button>
        <Status status={status} />
      </div>
    </form>
  );
}
