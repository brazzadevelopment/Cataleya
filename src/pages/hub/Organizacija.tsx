import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field, Input, SelectBox, Sheet } from '../../admin/kit';
import { ClubBadge, PageTitle } from '../../components/HubLayout';
import { Button, Chip, Icon, SectionTitle } from '../../components/ui';
import { setOrgSession, useOrgSession } from '../../data/follow';
import { source, type LoginResult } from '../../data/source';
import { DEMO_ORG_PIN } from '../../data/demo';
import { tournamentStatus } from '../../lib/hub';
import { MutationError, slugify, type CopyOptions, type Mutation } from '../../lib/mutations';
import { dateSpan } from '../../lib/time';
import type { Club, Session, Tournament } from '../../lib/types';

/** Spremi prijavu i otvori pravo mjesto: organizacija, uređivanje turnira ili zapisnik. */
export function rememberLogin(s: LoginResult): string {
  if (s.role === 'owner') {
    setOrgSession({ tournamentId: '', role: 'owner', fieldId: null, token: s.token });
    return '/organizacija';
  }
  try {
    localStorage.setItem(`turnir.session.${s.tournamentId}`, JSON.stringify({ tournamentId: s.tournamentId, role: s.role, fieldId: s.fieldId, token: s.token }));
  } catch {
    // bez pohrane prijava traje dok je stranica otvorena
  }
  return `/t/${s.slug}/${s.role === 'field' ? 'zapisnik' : 'admin'}`;
}

/** Prijava jednim PIN-om: organizacija, glavni PIN turnira ili PIN terena. */
export function GlobalLogin() {
  const nav = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await source.login(null, pin);
      if (!s) {
        setError('PIN nije točan.');
        setPin('');
        return;
      }
      nav(rememberLogin(s), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prijava nije uspjela.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xs pt-8 text-center">
      <img src="/logo.svg" alt="" className="mx-auto size-16" />
      <h1 className="heading mt-4 text-xl">Prijava</h1>
      <p className="mt-2 text-[13px] text-white/60">Za organizatore i zapisničare. Gledatelji i roditelji ne trebaju prijavu.</p>
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="PIN"
        aria-label="PIN"
        className="mt-6 h-16 w-full rounded-2xl bg-white/8 text-center text-3xl font-black tracking-[0.5em] ring-1 ring-white/15 placeholder:tracking-normal placeholder:text-white/30"
      />
      {error && <p className="mt-3 text-sm font-bold text-[#ff8197]">{error}</p>}
      <Button type="submit" disabled={pin.length < 4 || busy} className="mt-4 w-full">{busy ? 'Provjeravam…' : 'Uđi'}</Button>
      <p className="mt-5 text-[12px] leading-relaxed text-white/45">
        Zapisničar: PIN svog terena. Organizator turnira: glavni PIN turnira. Organizacija Cataleya Cupa: PIN organizacije.
      </p>
      {source.mode === 'demo' && <p className="mt-3 text-[12px] text-white/45">Demo: organizacija {DEMO_ORG_PIN}, turnir 9000, tereni 1001…</p>}
    </form>
  );
}

function useOrgSave(org: Session | null) {
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(mutations: Mutation[], okText = 'Spremljeno') {
    if (!org) return null;
    setBusy(true);
    setStatus(null);
    try {
      const r = await source.mutate(org, mutations);
      setStatus({ text: okText, ok: true });
      return r;
    } catch (e) {
      if (e instanceof MutationError && e.status === 401) setOrgSession(null);
      setStatus({ text: e instanceof Error ? e.message : 'Spremanje nije uspjelo.', ok: false });
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { save, status, busy };
}

function StatusLine({ status }: { status: { text: string; ok: boolean } | null }) {
  if (!status) return null;
  return <p className={`mt-2 text-[13px] font-bold ${status.ok ? 'text-[#7ee2a8]' : 'text-[#ff8197]'}`}>{status.text}</p>;
}

/** Organizacija Cataleya Cupa: svi turniri, novi turnir, klubovi, PIN-ovi organizacije. */
export function Organizacija() {
  const org = useOrgSession();
  const [tab, setTab] = useState<'turniri' | 'klubovi' | 'pin'>('turniri');
  if (!org) return <GlobalLogin />;

  return (
    <div>
      <div className="flex items-center gap-2">
        <PageTitle>Organizacija</PageTitle>
        <button type="button" onClick={() => setOrgSession(null)} className="ml-auto inline-flex h-9 items-center gap-1 pl-2 text-[12px] font-bold text-white/55">
          <Icon name="logout" className="size-4" /> Odjava
        </button>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={tab === 'turniri'} onClick={() => setTab('turniri')}>Turniri</Chip>
        <Chip active={tab === 'klubovi'} onClick={() => setTab('klubovi')}>Klubovi</Chip>
        <Chip active={tab === 'pin'} onClick={() => setTab('pin')}>PIN organizacije</Chip>
      </div>
      {tab === 'turniri' && <TournamentsTab org={org} />}
      {tab === 'klubovi' && <ClubsTab org={org} />}
      {tab === 'pin' && <OrgPinTab org={org} />}
    </div>
  );
}

const STATUS_LABEL = { live: 'U tijeku', upcoming: 'Uskoro', done: 'Završen' } as const;

function TournamentsTab({ org }: { org: Session }) {
  const nav = useNavigate();
  const [list, setList] = useState<Tournament[] | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    source.listTournaments(true).then(setList).catch(() => setList([]));
  }, []);

  return (
    <div>
      <Button className="mt-4 w-full" onClick={() => setCreating(true)}><Icon name="plus" className="size-5" /> Novi turnir</Button>
      <SectionTitle>Svi turniri</SectionTitle>
      <div className="space-y-3">
        {(list ?? []).map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-extrabold">{t.name}</div>
                <div className="mt-0.5 text-[12px] text-white/60">{dateSpan(t.start_date, t.end_date)}{t.place ? ` · ${t.place}` : ''}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${t.is_published ? 'bg-brand/20 text-brand-soft' : 'bg-white/10 text-white/60'}`}>
                {t.is_published ? STATUS_LABEL[tournamentStatus(t)] : 'Skica'}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" onClick={() => nav(`/t/${t.slug}/admin`)}><Icon name="edit" className="size-4" /> Uredi</Button>
              <Button variant="ghost" onClick={() => nav(`/t/${t.slug}`)}>Pogledaj</Button>
            </div>
          </div>
        ))}
        {list && !list.length && <p className="text-center text-white/60">Još nema turnira.</p>}
      </div>
      {creating && list && <NewTournament org={org} list={list} onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewTournament({ org, list, onClose }: { org: Session; list: Tournament[]; onClose(): void }) {
  const nav = useNavigate();
  const { save, status, busy } = useOrgSave(org);
  const last = [...list].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [place, setPlace] = useState(last?.place ?? 'Zadar');
  const [venue, setVenue] = useState(last?.venue ?? '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [copyFrom, setCopyFrom] = useState(last?.id ?? '');
  const [copy, setCopy] = useState<CopyOptions>({ categories: true, fields: true, teams: false });

  async function create() {
    const r = await save([{
      type: 'createTournament',
      row: { name, slug: slug || slugify(name), place: place || null, venue: venue || null, start_date: start, end_date: end || start },
      copyFrom: copyFrom || null,
      copy,
    }], 'Turnir je napravljen');
    if (r?.created) nav(`/t/${r.created.slug}/admin`);
  }

  const toggle = (k: keyof CopyOptions) => setCopy((c) => ({ ...c, [k]: !c[k] }));

  return (
    <Sheet title="Novi turnir" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Naziv"><Input value={name} placeholder="npr. Cataleya Cup Zima 2027" onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} /></Field>
        <Field label="Adresa turnira" hint={`cataleya.klubapp.hr/t/${slug || '…'}`}>
          <Input value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prvi dan"><Input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value); }} /></Field>
          <Field label="Zadnji dan"><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mjesto"><Input value={place} onChange={(e) => setPlace(e.target.value)} /></Field>
          <Field label="Lokacija"><Input value={venue} placeholder="npr. SC Višnjik" onChange={(e) => setVenue(e.target.value)} /></Field>
        </div>
        <Field label="Kopiraj iz turnira" hint="Pravila i kriteriji se uvijek kopiraju. Raspored se ubacuje iz Excela u uređivanju turnira.">
          <SelectBox value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} options={[['', 'Ništa, prazan turnir'], ...list.map((t) => [t.id, t.name] as [string, string])]} />
        </Field>
        {copyFrom && (
          <div className="space-y-2">
            {([['categories', 'Godišta (kategorije)'], ['fields', 'Tereni'], ['teams', 'Momčadi (prijavljeni klubovi)']] as [keyof CopyOptions, string][]).map(([k, l]) => (
              <button key={k} type="button" onClick={() => toggle(k)} className="flex w-full items-center justify-between rounded-xl bg-white/6 px-3 py-2.5 text-left text-[14px] font-semibold">
                {l}
                <span className={`relative h-6 w-10 rounded-full transition ${copy[k] ? 'bg-brand' : 'bg-white/20'}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${copy[k] ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="text-[12px] text-white/50">Novi turnir je skica: gledatelji ga ne vide dok ga ne objaviš (Uređivanje → Turnir).</p>
        <Button className="w-full" disabled={busy || name.trim().length < 3 || !start} onClick={() => void create()}>{busy ? 'Radim…' : 'Napravi turnir'}</Button>
        <StatusLine status={status} />
      </div>
    </Sheet>
  );
}

function ClubsTab({ org }: { org: Session }) {
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [edit, setEdit] = useState<Club | null>(null);
  const [q, setQ] = useState('');
  const load = () => source.listClubs().then(setClubs).catch(() => setClubs([]));
  useEffect(() => {
    void load();
  }, []);
  const shown = (clubs ?? []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="mt-4 flex gap-2">
        <Input value={q} placeholder="Traži klub" onChange={(e) => setQ(e.target.value)} />
        <Button onClick={() => setEdit({ id: crypto.randomUUID(), name: '', short_name: null, city: null, logo_path: null })}><Icon name="plus" className="size-5" /></Button>
      </div>
      <p className="mt-2 text-[12px] text-white/50">Momčad se klubu dodjeljuje u uređivanju turnira (Momčadi). Klub se vidi na svim turnirima.</p>
      <div className="card mt-3 divide-y divide-line">
        {shown.map((c) => (
          <button key={c.id} type="button" onClick={() => setEdit(c)} className="flex w-full items-center gap-3 px-3.5 py-2 text-left">
            <ClubBadge club={c} size="size-8" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{c.name}</span>
              {c.city && <span className="block text-[12px] text-white/50">{c.city}</span>}
            </span>
            <Icon name="edit" className="size-4 text-white/40" />
          </button>
        ))}
      </div>
      {edit && <ClubEditor org={org} club={edit} onClose={() => { setEdit(null); void load(); }} />}
    </div>
  );
}

function ClubEditor({ org, club, onClose }: { org: Session; club: Club; onClose(): void }) {
  const { save, status, busy } = useOrgSave(org);
  const [c, setC] = useState(club);
  const [uploading, setUploading] = useState(false);
  const isNew = !club.name;

  async function upload(file: File) {
    setUploading(true);
    try {
      const path = await source.uploadImage(org, file);
      setC((x) => ({ ...x, logo_path: path }));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Sheet title={isNew ? 'Novi klub' : c.name} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <ClubBadge club={c} size="size-16" />
          <label className="cursor-pointer rounded-xl bg-white/8 px-3 py-2 text-[13px] font-bold ring-1 ring-white/12">
            {uploading ? 'Učitavam…' : 'Grb kluba'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
        </div>
        <Field label="Naziv"><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kratko ime"><Input value={c.short_name ?? ''} onChange={(e) => setC({ ...c, short_name: e.target.value || null })} /></Field>
          <Field label="Mjesto"><Input value={c.city ?? ''} onChange={(e) => setC({ ...c, city: e.target.value || null })} /></Field>
        </div>
        <Button className="w-full" disabled={busy || !c.name.trim()} onClick={async () => { if (await save([{ type: 'upsert', table: 'clubs', row: { ...c } }])) onClose(); }}>Spremi</Button>
        {!isNew && (
          <Button variant="danger" className="w-full" disabled={busy} onClick={async () => {
            if (confirm(`Obrisati klub ${c.name}? Momčadi ostaju, samo bez kluba.`) && (await save([{ type: 'delete', table: 'clubs', id: c.id }]))) onClose();
          }}>Obriši klub</Button>
        )}
        <StatusLine status={status} />
      </div>
    </Sheet>
  );
}

function OrgPinTab({ org }: { org: Session }) {
  const { save, status, busy } = useOrgSave(org);
  const [label, setLabel] = useState('');
  const [pin, setPin] = useState('');
  return (
    <div className="mt-4 space-y-3">
      <p className="text-[13px] leading-relaxed text-white/70">
        PIN organizacije vrijedi za sve turnire: novi turnir, klubovi i uređivanje svakog turnira. Svaka osoba može imati svoj PIN. Promjena PIN-a odjavljuje one koji su ušli starim.
      </p>
      <Field label="Ime osobe"><Input value={label} placeholder="npr. Vedran" onChange={(e) => setLabel(e.target.value)} /></Field>
      <Field label="Novi PIN (4 do 8 znamenki)"><Input value={pin} inputMode="numeric" onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} /></Field>
      <Button className="w-full" disabled={busy || pin.length < 4 || !label.trim()} onClick={async () => { if (await save([{ type: 'setOrgPin', label, pin }], 'PIN je spremljen. Zapiši ga.')) setPin(''); }}>Spremi PIN</Button>
      <StatusLine status={status} />
      <p className="text-[12px] text-white/45">Isto ime = promjena PIN-a te osobe. Novo ime = novi PIN.</p>
      <Link to="/" className="block pt-4 text-center text-[13px] font-bold text-brand-soft">Natrag na Cataleya Cup</Link>
    </div>
  );
}
