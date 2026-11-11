import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/HubLayout';
import { useContent } from '../../data/content';
import { Splash } from '../../data/TournamentContext';
import { SERIES } from '../../lib/series';
import { Icon } from '../../components/ui';
import { Paragraphs } from './common';

export function About() {
  const c = useContent();
  if (!c) return <Splash text="Učitavam…" />;
  return (
    <div>
      <div className="card relative mt-2 overflow-hidden px-5 pb-6 pt-6 text-center">
        <img src="/logo.svg" alt="" className="mx-auto size-20" />
        <h1 className="heading mt-3 text-[26px] leading-none">O nama</h1>
        <p className="mt-2 text-[13px] text-white/70">Međunarodni nogometni turnir za djecu</p>
      </div>
      <Paragraphs text={c.settings.about} className="mt-5" />
      <div className="mt-6 grid grid-cols-3 gap-2">
        {SERIES.map((s) => (
          <Link key={s.key} to={`/turnir/${s.key}`} className="card flex flex-col items-center gap-1 p-3 text-center">
            <Icon name={s.icon} className="size-6 text-brand-soft" />
            <span className="text-[13px] font-extrabold">{s.label}</span>
          </Link>
        ))}
      </div>
      <Link to="/kontakt" className="mt-6 grid min-h-11 place-items-center rounded-xl bg-white px-4 text-sm font-extrabold text-ink">Kontaktirajte nas</Link>
    </div>
  );
}

/** Impresum: tko izdaje aplikaciju (podatke upisuje organizacija). */
export function Impressum() {
  const c = useContent();
  if (!c) return <Splash text="Učitavam…" />;
  const s = c.settings;
  const rows: [string, string | undefined][] = [
    ['Izdavač', s.publisher],
    ['Puni naziv', s.legal_name],
    ['OIB', s.oib],
    ['Adresa', s.address],
    ['Odgovorna osoba', s.responsible],
    ['E-mail', s.email],
    ['Telefon', s.phone],
    ['IBAN', s.iban],
    ['Upis u registar', s.register],
  ];
  return (
    <div>
      <PageTitle>Impresum</PageTitle>
      <dl className="card mt-3 divide-y divide-line">
        {rows.filter(([, v]) => v?.trim()).map(([k, v]) => (
          <div key={k} className="flex gap-3 px-4 py-3 text-[14px]">
            <dt className="w-32 shrink-0 font-bold text-white/65">{k}</dt>
            <dd className="min-w-0 flex-1 break-words font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[13px] leading-relaxed text-white/70">
        Aplikacija prikazuje raspored, rezultate i vijesti turnira Cataleya Cup. Rezultate upisuju zapisničari na terenu;
        u slučaju razlike vrijedi službeni zapisnik organizatora.
      </p>
      <p className="mt-3 text-[13px] text-white/70">
        <Link to="/privatnost" className="font-bold underline">Pravila privatnosti</Link>
      </p>
    </div>
  );
}
