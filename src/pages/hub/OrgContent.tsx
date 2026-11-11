// Organizacija: vijesti, galerija, video, sponzori, tekstovi stranica i poruke.
import { useEffect, useRef, useState } from 'react';
import { Field, Input, SelectBox, Sheet, TextArea } from '../../admin/kit';
import { SponsorLogo } from '../../components/SponsorStrip';
import { Button, Empty, Icon } from '../../components/ui';
import { reloadContent, useContent } from '../../data/content';
import { setOrgSession } from '../../data/follow';
import { assetUrl, source } from '../../data/source';
import { shrinkImage } from '../../lib/image';
import { MutationError, youtubeId, type Mutation } from '../../lib/mutations';
import type { ContactMessage, NewsItem, Session, Sponsor, Video } from '../../lib/types';
import { newsDate } from '../site/common';

type Status = { text: string; ok: boolean } | null;

function useContentSave(org: Session) {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  async function save(mutations: Mutation[], okText = 'Spremljeno'): Promise<boolean> {
    setBusy(true);
    setStatus(null);
    try {
      await source.mutate(org, mutations);
      await reloadContent();
      setStatus({ text: okText, ok: true });
      return true;
    } catch (e) {
      if (e instanceof MutationError && e.status === 401) setOrgSession(null);
      setStatus({ text: e instanceof Error ? e.message : 'Spremanje nije uspjelo.', ok: false });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { save, status, busy, setStatus };
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return <p className={`mt-2 text-[13px] font-bold ${status.ok ? 'text-[#c8ffd9]' : 'text-[#ffd0d8]'}`}>{status.text}</p>;
}

/** Odabir slike: smanji je i pošalji na server, vrati putanju. */
function ImagePick({ org, value, onChange, label = 'Slika' }: { org: Session; value: string | null; onChange(p: string | null): void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = assetUrl(value);
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {url ? <img src={url} alt="" className="h-16 w-24 rounded-lg bg-white object-contain" /> : <div className="grid h-16 w-24 place-items-center rounded-lg bg-white/10 text-white/40"><Icon name="image" className="size-6" /></div>}
        <Button variant="ghost" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Šaljem…' : url ? 'Promijeni' : 'Odaberi'}</Button>
        {url && <button type="button" onClick={() => onChange(null)} className="text-[12px] font-bold text-white/60">Makni</button>}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          setErr(null);
          try {
            onChange(await source.uploadImage(org, await shrinkImage(f)));
          } catch (x) {
            setErr(x instanceof Error ? x.message : 'Slika nije spremljena.');
          } finally {
            setBusy(false);
          }
        }}
      />
      {err && <span className="mt-1 block text-[12px] font-bold text-[#ffd0d8]">{err}</span>}
    </Field>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------------------------------------------------------------- Vijesti

export function NewsTab({ org }: { org: Session }) {
  const c = useContent();
  const [edit, setEdit] = useState<NewsItem | null>(null);
  const fresh = (): NewsItem => ({ id: crypto.randomUUID(), title: '', summary: '', body: '', image_path: null, published_at: new Date().toISOString(), is_published: true });
  return (
    <div className="mt-4">
      <Button className="w-full" onClick={() => setEdit(fresh())}><Icon name="plus" className="size-4" /> Nova vijest</Button>
      <div className="mt-3 space-y-2">
        {c?.news.length ? c.news.map((n) => (
          <button key={n.id} type="button" onClick={() => setEdit(n)} className="card flex w-full items-center gap-3 p-3 text-left">
            {n.image_path ? <img src={assetUrl(n.image_path) ?? ''} alt="" className="size-12 shrink-0 rounded-lg object-cover" /> : <Icon name="news" className="size-6 shrink-0 text-white/50" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{n.title}</span>
              <span className="block text-[12px] text-white/60">{newsDate(n.published_at)}{n.is_published ? '' : ' · skica'}</span>
            </span>
            <Icon name="edit" className="size-4 shrink-0 text-white/50" />
          </button>
        )) : <Empty>Još nema vijesti.</Empty>}
      </div>
      {edit && <NewsEditor org={org} item={edit} isNew={!c?.news.some((n) => n.id === edit.id)} onClose={() => setEdit(null)} />}
    </div>
  );
}

function NewsEditor({ org, item, isNew, onClose }: { org: Session; item: NewsItem; isNew: boolean; onClose(): void }) {
  const [n, setN] = useState(item);
  const { save, status, busy } = useContentSave(org);
  const set = (k: keyof NewsItem, v: unknown) => setN((x) => ({ ...x, [k]: v }));
  return (
    <Sheet title={isNew ? 'Nova vijest' : 'Uredi vijest'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Naslov"><Input id="v-naslov" value={n.title} onChange={(e) => set('title', e.target.value)} maxLength={200} /></Field>
        <Field label="Kratki sažetak" hint="Vidi se na početnoj, ispod naslova."><TextArea id="v-sazetak" value={n.summary ?? ''} onChange={(e) => set('summary', e.target.value)} rows={2} maxLength={500} /></Field>
        <Field label="Tekst" hint="Prazan red = novi odlomak."><TextArea id="v-tekst" value={n.body ?? ''} onChange={(e) => set('body', e.target.value)} rows={8} /></Field>
        <ImagePick org={org} value={n.image_path} onChange={(p) => set('image_path', p)} label="Naslovna slika" />
        <Field label="Datum objave"><Input id="v-datum" type="datetime-local" value={toLocalInput(n.published_at)} onChange={(e) => e.target.value && set('published_at', new Date(e.target.value).toISOString())} /></Field>
        <label className="flex items-center gap-3 text-[14px] font-bold">
          <input type="checkbox" checked={n.is_published} onChange={(e) => set('is_published', e.target.checked)} className="size-5 accent-white" />
          Objavljeno (bez kvačice je skica)
        </label>
        <div className="flex gap-2 pt-1">
          <Button className="flex-1" disabled={busy} onClick={async () => { if (await save([{ type: 'upsert', table: 'news', row: { ...n } }])) onClose(); }}>Spremi</Button>
          {!isNew && <Button variant="danger" disabled={busy} onClick={async () => { if (await save([{ type: 'delete', table: 'news', id: n.id }])) onClose(); }}><Icon name="trash" className="size-4" /></Button>}
        </div>
        <StatusLine status={status} />
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Galerija

export function GalleryTab({ org }: { org: Session }) {
  const c = useContent();
  const ref = useRef<HTMLInputElement>(null);
  const { save, status, busy, setStatus } = useContentSave(org);
  const [progress, setProgress] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; caption: string } | null>(null);
  async function addFiles(files: File[]) {
    const rows: Mutation[] = [];
    for (const [i, f] of files.entries()) {
      setProgress(`Šaljem ${i + 1} / ${files.length}…`);
      try {
        const path = await source.uploadImage(org, await shrinkImage(f));
        rows.push({ type: 'upsert', table: 'gallery', row: { id: crypto.randomUUID(), image_path: path, caption: null, sort_order: 0 } });
      } catch (e) {
        setStatus({ text: `${f.name}: ${e instanceof Error ? e.message : 'nije spremljena'}`, ok: false });
      }
    }
    setProgress(null);
    if (rows.length) await save(rows, `Dodano fotografija: ${rows.length}`);
  }
  return (
    <div className="mt-4">
      <Button className="w-full" disabled={busy || !!progress} onClick={() => ref.current?.click()}><Icon name="upload" className="size-4" /> {progress ?? 'Dodaj fotografije'}</Button>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) void addFiles(f); }} />
      <StatusLine status={status} />
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {c?.gallery.map((g) => (
          <button key={g.id} type="button" onClick={() => setEdit({ id: g.id, caption: g.caption ?? '' })} className="relative aspect-square overflow-hidden rounded-lg bg-white/10">
            <img src={assetUrl(g.image_path) ?? ''} alt="" className="size-full object-cover" />
            {g.caption && <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{g.caption}</span>}
          </button>
        ))}
      </div>
      {c && !c.gallery.length && <div className="mt-3"><Empty>Još nema fotografija.</Empty></div>}
      {edit && (
        <Sheet title="Fotografija" onClose={() => setEdit(null)}>
          <div className="space-y-3">
            <img src={assetUrl(c?.gallery.find((g) => g.id === edit.id)?.image_path) ?? ''} alt="" className="max-h-64 w-full rounded-xl object-contain" />
            <Field label="Opis (nije obavezno)"><Input id="g-opis" value={edit.caption} onChange={(e) => setEdit({ ...edit, caption: e.target.value })} maxLength={300} /></Field>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy} onClick={async () => {
                const g = c?.gallery.find((x) => x.id === edit.id);
                if (g && await save([{ type: 'upsert', table: 'gallery', row: { id: g.id, image_path: g.image_path, caption: edit.caption || null } }])) setEdit(null);
              }}>Spremi</Button>
              <Button variant="danger" disabled={busy} onClick={async () => { if (await save([{ type: 'delete', table: 'gallery', id: edit.id }], 'Obrisano')) setEdit(null); }}><Icon name="trash" className="size-4" /></Button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Video

export function VideosTab({ org }: { org: Session }) {
  const c = useContent();
  const { save, status, busy } = useContentSave(org);
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [isLive, setIsLive] = useState(false);
  const id = youtubeId(link);
  return (
    <div className="mt-4">
      <div className="card space-y-3 p-4">
        <Field label="YouTube link" hint="Zalijepi link videa ili prijenosa uživo (youtube.com/live/…, youtu.be/…).">
          <Input id="yt-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/…" inputMode="url" />
        </Field>
        <Field label="Naslov"><Input id="yt-naslov" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="npr. Finale 2016. godište – uživo" maxLength={200} /></Field>
        <label className="flex items-center gap-3 text-[14px] font-bold">
          <input type="checkbox" checked={isLive} onChange={(e) => setIsLive(e.target.checked)} className="size-5 accent-white" />
          Prijenos uživo (ide na vrh početne)
        </label>
        {link && !id && <p className="text-[12px] font-bold text-[#ffd0d8]">To nije YouTube link.</p>}
        <Button className="w-full" disabled={busy || !id || !title.trim()} onClick={async () => {
          if (await save([{ type: 'upsert', table: 'videos', row: { id: crypto.randomUUID(), youtube_id: id, title: title.trim(), is_live: isLive, published_at: new Date().toISOString() } }], 'Video dodan')) {
            setLink(''); setTitle(''); setIsLive(false);
          }
        }}>Dodaj video</Button>
        <StatusLine status={status} />
      </div>
      <div className="mt-3 space-y-2">
        {c?.videos.map((v: Video) => (
          <div key={v.id} className="card flex items-center gap-3 p-2.5">
            <img src={`https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`} alt="" className="h-12 w-20 shrink-0 rounded-md object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold">{v.title}</span>
              <button type="button" disabled={busy} onClick={() => void save([{ type: 'upsert', table: 'videos', row: { id: v.id, title: v.title, youtube_id: v.youtube_id, is_live: !v.is_live } }])}
                className={`mt-0.5 text-[12px] font-bold ${v.is_live ? 'text-[#ffd0d8]' : 'text-white/60'}`}>
                {v.is_live ? '● Uživo – završi prijenos' : 'Označi kao uživo'}
              </button>
            </span>
            <button type="button" aria-label="Obriši video" disabled={busy} onClick={() => void save([{ type: 'delete', table: 'videos', id: v.id }], 'Obrisano')} className="grid size-9 place-items-center rounded-full bg-white/8 text-white/70">
              <Icon name="trash" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Sponzori

const TIER_OPTIONS: [string, string][] = [['glavni', 'Glavni sponzor'], ['zlatni', 'Zlatni sponzor'], ['partner', 'Partner']];

export function SponsorsTab({ org }: { org: Session }) {
  const c = useContent();
  const [edit, setEdit] = useState<Sponsor | null>(null);
  const fresh = (): Sponsor => ({ id: crypto.randomUUID(), name: '', logo_path: null, url: null, tier: 'partner', sort_order: (c?.sponsors.length ?? 0) + 1, is_active: true });
  return (
    <div className="mt-4">
      <Button className="w-full" onClick={() => setEdit(fresh())}><Icon name="plus" className="size-4" /> Novi sponzor</Button>
      <p className="mt-2 text-[12px] text-white/60">Sponzori se vrte na početnoj i u svakom turniru. Glavni su prvi.</p>
      <div className="mt-3 space-y-2">
        {c?.sponsors.map((s) => (
          <button key={s.id} type="button" onClick={() => setEdit(s)} className={`card flex w-full items-center gap-3 p-2.5 text-left ${s.is_active ? '' : 'opacity-50'}`}>
            <SponsorLogo s={{ ...s, url: null }} className="h-12 w-24" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{s.name}</span>
              <span className="block text-[12px] text-white/60">{TIER_OPTIONS.find(([k]) => k === s.tier)?.[1]}{s.is_active ? '' : ' · skriven'}</span>
            </span>
            <Icon name="edit" className="size-4 shrink-0 text-white/50" />
          </button>
        ))}
      </div>
      {edit && <SponsorEditor org={org} item={edit} isNew={!c?.sponsors.some((s) => s.id === edit.id)} onClose={() => setEdit(null)} />}
    </div>
  );
}

function SponsorEditor({ org, item, isNew, onClose }: { org: Session; item: Sponsor; isNew: boolean; onClose(): void }) {
  const [s, setS] = useState(item);
  const { save, status, busy } = useContentSave(org);
  const set = (k: keyof Sponsor, v: unknown) => setS((x) => ({ ...x, [k]: v }));
  return (
    <Sheet title={isNew ? 'Novi sponzor' : 'Uredi sponzora'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Naziv"><Input id="s-naziv" value={s.name} onChange={(e) => set('name', e.target.value)} maxLength={120} /></Field>
        <ImagePick org={org} value={s.logo_path} onChange={(p) => set('logo_path', p)} label="Logo (najbolje PNG ili SVG s prozirnom pozadinom)" />
        <Field label="Web stranica (nije obavezno)"><Input id="s-web" value={s.url ?? ''} onChange={(e) => set('url', e.target.value.trim() || null)} placeholder="https://" inputMode="url" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vrsta"><SelectBox id="s-vrsta" value={s.tier} onChange={(e) => set('tier', e.target.value)} options={TIER_OPTIONS} /></Field>
          <Field label="Redoslijed"><Input id="s-red" type="number" value={s.sort_order} onChange={(e) => set('sort_order', Number(e.target.value) || 0)} /></Field>
        </div>
        <label className="flex items-center gap-3 text-[14px] font-bold">
          <input type="checkbox" checked={s.is_active} onChange={(e) => set('is_active', e.target.checked)} className="size-5 accent-white" />
          Prikazuje se u aplikaciji
        </label>
        <div className="flex gap-2 pt-1">
          <Button className="flex-1" disabled={busy} onClick={async () => { if (await save([{ type: 'upsert', table: 'sponsors', row: { ...s } }])) onClose(); }}>Spremi</Button>
          {!isNew && <Button variant="danger" disabled={busy} onClick={async () => { if (await save([{ type: 'delete', table: 'sponsors', id: s.id }])) onClose(); }}><Icon name="trash" className="size-4" /></Button>}
        </div>
        <StatusLine status={status} />
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Stranice (O nama, Impresum, Kontakt)

const SETTINGS: { key: string; label: string; area?: boolean; hint?: string }[] = [
  { key: 'about', label: 'O nama', area: true, hint: 'Prazan red = novi odlomak.' },
  { key: 'email', label: 'E-mail za kontakt' },
  { key: 'phone', label: 'Telefon za kontakt' },
  { key: 'instagram', label: 'Instagram (link)' },
  { key: 'website', label: 'Web stranica (link)' },
  { key: 'youtube', label: 'YouTube kanal (link)' },
  { key: 'publisher', label: 'Impresum: izdavač (kratko ime)' },
  { key: 'legal_name', label: 'Impresum: puni naziv (udruga ili tvrtka)' },
  { key: 'oib', label: 'Impresum: OIB' },
  { key: 'address', label: 'Impresum: adresa' },
  { key: 'responsible', label: 'Impresum: odgovorna osoba' },
  { key: 'iban', label: 'Impresum: IBAN (nije obavezno)' },
  { key: 'register', label: 'Impresum: upis u registar (nije obavezno)' },
];

export function PagesTab({ org }: { org: Session }) {
  const c = useContent();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const { save, status, busy } = useContentSave(org);
  useEffect(() => {
    if (c && !form) setForm({ ...c.settings });
  }, [c, form]);
  if (!form) return null;
  const changed = SETTINGS.filter((s) => (form[s.key] ?? '') !== (c?.settings[s.key] ?? ''));
  return (
    <div className="mt-4 space-y-3">
      {SETTINGS.map((s) => (
        <Field key={s.key} label={s.label} hint={s.hint}>
          {s.area
            ? <TextArea id={`p-${s.key}`} value={form[s.key] ?? ''} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} rows={8} />
            : <Input id={`p-${s.key}`} value={form[s.key] ?? ''} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} />}
        </Field>
      ))}
      <div className="sticky bottom-20 rounded-2xl bg-pitch-950/90 p-2 backdrop-blur">
        <Button className="w-full" disabled={busy || !changed.length} onClick={() => void save(changed.map((s) => ({ type: 'upsert', table: 'site_settings', row: { key: s.key, value: (form[s.key] ?? '').trim() } })))}>
          {changed.length ? `Spremi (${changed.length})` : 'Spremljeno'}
        </Button>
        <StatusLine status={status} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Poruke s kontakt forme

export function MessagesTab({ org }: { org: Session }) {
  const [list, setList] = useState<ContactMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { save, busy } = useContentSave(org);
  const load = () => source.messages(org).then(setList).catch((e) => {
    if (e instanceof MutationError && e.status === 401) setOrgSession(null);
    setError(e instanceof Error ? e.message : 'Poruke se ne mogu učitati.');
  });
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (error) return <p className="mt-4 text-[13px] font-bold text-[#ffd0d8]">{error}</p>;
  if (!list) return <p className="mt-4 text-[13px] text-white/60">Učitavam…</p>;
  if (!list.length) return <div className="mt-4"><Empty>Još nema poruka s kontakt forme.</Empty></div>;
  return (
    <div className="mt-4 space-y-2">
      {list.map((m) => (
        <div key={m.id} className={`card p-4 ${m.handled ? 'opacity-60' : ''}`}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-extrabold">{m.name}</div>
              <div className="text-[12px] text-white/65">{new Date(m.created_at).toLocaleString('hr-HR', { timeZone: 'Europe/Zagreb' })}</div>
            </div>
            {!m.handled && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-ink uppercase">Novo</span>}
          </div>
          <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed">{m.message}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-bold">
            <a href={`mailto:${m.email}`} className="underline">{m.email}</a>
            {m.phone && <a href={`tel:${m.phone.replace(/\s/g, '')}`} className="underline">{m.phone}</a>}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" className="flex-1" disabled={busy} onClick={async () => {
              if (await save([{ type: 'upsert', table: 'contact_messages', row: { id: m.id, handled: !m.handled } }])) void load();
            }}>{m.handled ? 'Vrati u nove' : 'Odgovoreno'}</Button>
            <Button variant="danger" disabled={busy} onClick={async () => {
              if (await save([{ type: 'delete', table: 'contact_messages', id: m.id }], 'Obrisano')) void load();
            }}><Icon name="trash" className="size-4" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}
