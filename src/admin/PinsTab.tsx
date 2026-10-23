import { useState } from 'react';
import { Button, Icon, SectionTitle } from '../components/ui';
import { source } from '../data/source';
import { useTournament } from '../data/TournamentContext';
import type { Field as FieldRow } from '../lib/types';
import { Field, Input, newId, Sheet, Status, useSave } from './kit';

export function PinsTab() {
  const { snap } = useTournament();
  const [editField, setEditField] = useState<FieldRow | 'new' | null>(null);
  const fields = [...snap.fields].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      <p className="mt-2 text-[13px] leading-relaxed text-white/65">
        <b>Glavni PIN</b> otvara sve. <b>PIN terena</b> otvara samo upis rezultata za utakmice na tom terenu.
        PIN se nigdje ne prikazuje nakon spremanja; ako ga zaboraviš, postavi novi.
      </p>
      {source.mode === 'demo' && <p className="mt-2 text-[12px] text-bloom-cyan">Demo: glavni PIN 9000, tereni redom 1001, 1002, …</p>}

      <SectionTitle>Glavni PIN</SectionTitle>
      <PinRow fieldId={null} label="Organizator" />

      <SectionTitle action={<button type="button" onClick={() => setEditField('new')} className="text-[12px] font-bold text-gold">+ Teren</button>}>
        Tereni
      </SectionTitle>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.id} className="card p-3">
            <div className="mb-2 flex items-center">
              <span className="font-extrabold">{f.name}</span>
              {f.maps_url && <a href={f.maps_url} target="_blank" rel="noreferrer" className="ml-2 text-[12px] font-bold text-gold">karta</a>}
              <button type="button" onClick={() => setEditField(f)} className="ml-auto grid size-9 place-items-center rounded-lg text-white/50" aria-label="Uredi teren"><Icon name="edit" className="size-4" /></button>
            </div>
            <PinRow fieldId={f.id} label={`PIN za ${f.name}`} bare />
          </div>
        ))}
      </div>

      {editField && <FieldEditor field={editField === 'new' ? null : editField} onClose={() => setEditField(null)} />}
    </div>
  );
}

function PinRow({ fieldId, label, bare = false }: { fieldId: string | null; label: string; bare?: boolean }) {
  const [pin, setPin] = useState('');
  const { save, status, busy } = useSave();
  return (
    <form
      className={`${bare ? '' : 'card p-3'} flex flex-wrap items-center gap-2`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (await save([{ type: 'setPin', fieldId, pin }], `Novi PIN je ${pin}. Zapiši ga.`)) setPin('');
      }}
    >
      <Input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        inputMode="numeric"
        placeholder="Novi PIN (4 do 8 znamenki)"
        aria-label={label}
        className="flex-1 tracking-widest"
      />
      <Button type="submit" disabled={pin.length < 4 || busy}>Postavi</Button>
      <div className="w-full"><Status status={status} /></div>
    </form>
  );
}

function FieldEditor({ field, onClose }: { field: FieldRow | null; onClose(): void }) {
  const { snap } = useTournament();
  const [f, setF] = useState<Omit<FieldRow, 'tournament_id'>>(field ?? { id: newId(), name: `Teren ${snap.fields.length + 1}`, venue: null, maps_url: null, sort_order: snap.fields.length + 1 });
  const { save, status, busy } = useSave();
  return (
    <Sheet title={field ? 'Teren' : 'Novi teren'} onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const { id, name, venue, maps_url, sort_order } = f;
        if (await save([{ type: 'upsert', table: 'fields', row: { id, name, venue, maps_url, sort_order } }])) onClose();
      }}>
        <Field label="Naziv"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Lokacija" hint="npr. Arbanasi, SC Višnjik"><Input value={f.venue ?? ''} onChange={(e) => setF({ ...f, venue: e.target.value || null })} /></Field>
        <Field label="Link na Google Maps" hint="U Google Mapsu: Dijeli → Kopiraj link">
          <Input type="url" value={f.maps_url ?? ''} onChange={(e) => setF({ ...f, maps_url: e.target.value || null })} placeholder="https://maps.app.goo.gl/…" />
        </Field>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={busy}>Spremi</Button>
          {field && <Button variant="danger" disabled={busy} onClick={async () => {
            if (confirm('Obrisati teren? Utakmice ostaju bez terena.') && await save([{ type: 'delete', table: 'fields', id: field.id }])) onClose();
          }}>Obriši</Button>}
          <Status status={status} />
        </div>
      </form>
    </Sheet>
  );
}
