import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Field, Input, TextArea } from '../../admin/kit';
import { PageTitle } from '../../components/HubLayout';
import { Icon } from '../../components/ui';
import { useContent } from '../../data/content';
import { source, type ContactForm } from '../../data/source';
import { RowLink } from './common';

const EMPTY: ContactForm = { name: '', email: '', phone: '', message: '', consent: false, website: '' };

export function Contact() {
  const c = useContent();
  const s = c?.settings ?? {};
  const [form, setForm] = useState<ContactForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof ContactForm, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await source.sendContact(form);
      setSent(true);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poruka nije poslana. Pokušaj ponovno.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageTitle sub="Prijava kluba, pitanje o turniru ili sponzorstvu.">Kontakt</PageTitle>

      {(s.email || s.phone || s.instagram || s.website || s.youtube) && (
        <div className="card mt-3 divide-y divide-line">
          {s.email && <RowLink href={`mailto:${s.email}`} icon="mail" title={s.email} sub="E-mail" />}
          {s.phone && <RowLink href={`tel:${s.phone.replace(/\s/g, '')}`} icon="phone" title={s.phone} sub="Telefon" />}
          {s.instagram && <RowLink href={s.instagram} icon="image" title="Instagram" sub={s.instagram.replace(/^https?:\/\/(www\.)?/, '')} />}
          {s.youtube && <RowLink href={s.youtube} icon="play" title="YouTube" sub={s.youtube.replace(/^https?:\/\/(www\.)?/, '')} />}
          {s.website && <RowLink href={s.website} icon="external" title="Web stranica" sub={s.website.replace(/^https?:\/\/(www\.)?/, '')} />}
        </div>
      )}

      {sent ? (
        <div className="card mt-5 p-5 text-center">
          <Icon name="check" className="mx-auto size-10 text-brand-soft" />
          <div className="mt-2 font-extrabold">Poruka je poslana</div>
          <p className="mt-1 text-[13px] text-white/70">Odgovorit ćemo na e-mail koji ste upisali.</p>
          <button type="button" onClick={() => setSent(false)} className="mt-4 text-[13px] font-bold underline">Pošalji novu poruku</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <h2 className="heading text-[15px] text-brand-soft">Pošaljite poruku</h2>
          <Field label="Ime i prezime">
            <Input id="kontakt-ime" value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" required maxLength={120} />
          </Field>
          <Field label="E-mail">
            <Input id="kontakt-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" required maxLength={200} />
          </Field>
          <Field label="Telefon (nije obavezno)">
            <Input id="kontakt-tel" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" maxLength={40} />
          </Field>
          <Field label="Poruka">
            <TextArea id="kontakt-poruka" value={form.message} onChange={(e) => set('message', e.target.value)} required rows={5} maxLength={4000} />
          </Field>
          {/* Zamka za robote: ljudi ovo polje ne vide. */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden value={form.website} onChange={(e) => set('website', e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
          <label className="flex items-start gap-3 text-[13px] leading-relaxed text-white/80">
            <input id="kontakt-privola" type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-white" />
            <span>Pristajem da organizator spremi moje ime, e-mail i telefon samo radi odgovora na ovu poruku. <Link to="/privatnost" className="font-bold underline">Privatnost</Link></span>
          </label>
          {error && <p className="text-[13px] font-bold text-[#ffd0d8]">{error}</p>}
          <button type="submit" disabled={busy || !form.consent} className="min-h-12 w-full rounded-xl bg-white px-4 text-sm font-extrabold text-ink disabled:opacity-50">
            {busy ? 'Šaljem…' : 'Pošalji poruku'}
          </button>
        </form>
      )}
    </div>
  );
}
