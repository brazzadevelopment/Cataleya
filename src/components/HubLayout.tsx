import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { assetUrl, source } from '../data/source';
import type { Club } from '../lib/types';
import { useOrgSession } from '../data/follow';
import { isNativeApp } from '../lib/native';
import { isStandalone, pushSupport, readPrefs } from '../lib/push';
import { SERIES } from '../lib/series';
import { BrowserWarning } from './BrowserWarning';
import { Icon, TeamBadge } from './ui';

/** Okvir za stranice Cataleya Cupa izvan jednog turnira (početna, vijesti, klubovi, organizacija…). */
export function HubLayout() {
  const org = useOrgSession();
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      {source.mode === 'demo' && (
        <div className="bg-bloom-violet/90 px-4 py-1 text-center text-[11px] font-bold uppercase tracking-wider">
          Demo · podaci su samo na ovom uređaju
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-line bg-pitch-950/85 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <NavLink to="/" className="flex min-w-0 items-center gap-3">
            <img src="/logo.svg" alt="" className="size-11 drop-shadow-[0_0_12px_rgb(255_255_255_/_0.22)]" />
            <div className="min-w-0 leading-none">
              <div className="heading truncate text-[19px]">Cataleya Cup</div>
              <div className="mt-1 truncate text-[11px] font-semibold tracking-[0.18em] text-white/60 uppercase">Službena aplikacija</div>
            </div>
          </NavLink>
          <NavLink
            to={org ? '/organizacija' : '/prijava'}
            aria-label={org ? 'Organizacija' : 'Prijava za organizatore i zapisničare'}
            className={`ml-auto grid size-10 shrink-0 place-items-center rounded-full ring-1 ${org ? 'bg-brand/20 text-brand-soft ring-brand/50' : 'bg-white/8 text-white/75 ring-white/15'}`}
          >
            <Icon name={org ? 'edit' : 'key'} className="size-5" />
          </NavLink>
        </div>
      </header>
      <main className="flex-1 px-4 pb-28 pt-3">
        <Outlet />
      </main>
      <HubNav />
      <Welcome />
    </div>
  );
}

/** Donji izbornik: početna, tri turnira godišnje i sve ostalo. */
function HubNav() {
  const { pathname } = useLocation();
  const items = [
    { to: '/', icon: 'home', label: 'Početna', end: true },
    ...SERIES.map((s) => ({ to: `/turnir/${s.key}`, icon: s.icon, label: s.label, end: false })),
    { to: '/vise', icon: 'grid', label: 'Više', end: false },
  ];
  const moreActive = !['/', ...SERIES.map((s) => `/turnir/${s.key}`)].includes(pathname);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-pitch-950/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition ${(it.to === '/vise' ? moreActive : isActive) ? 'text-brand-soft' : 'text-white/60'}`
            }
          >
            <Icon name={it.icon} className="size-[22px]" />
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

const WELCOME_KEY = 'cataleya.welcome.v1';

function seenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * Samo kod prvog otvaranja: kako dodati aplikaciju na početni zaslon i uključiti
 * obavijesti. Poslije se ne pokazuje (sve je u Više → Obavijesti).
 */
function Welcome() {
  const [open, setOpen] = useState(() => !seenWelcome());
  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // bez pohrane: pokaže se opet idući put
    }
    setOpen(false);
  };
  const installed = isStandalone() || isNativeApp();
  const push = pushSupport();
  const pushOn = readPrefs().enabled;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-label="Dobro došli"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-t-3xl border-t border-line bg-pitch-900 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 text-center"
      >
        <img src="/logo.svg" alt="" className="mx-auto size-16" />
        <h2 className="heading mt-2 text-xl">Dobro došli</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/80">
          Raspored, rezultati uživo, tablice i obavijesti za sve turnire Cataleya Cupa.
        </p>
        <BrowserWarning />
        <ul className="mt-4 space-y-2 text-left text-[14px]">
          {!installed && (
            <li className="card flex items-center gap-3 p-3">
              <Icon name="home" className="size-6 shrink-0 text-brand-soft" />
              <span><b>Dodaj na početni zaslon</b><span className="block text-[12px] text-white/65">Otvara se kao prava aplikacija, jednim dodirom.</span></span>
            </li>
          )}
          {push !== 'unsupported' && !pushOn && (
            <li className="card flex items-center gap-3 p-3">
              <Icon name="bell" className="size-6 shrink-0 text-brand-soft" />
              <span><b>Obavijest za svaki gol</b><span className="block text-[12px] text-white/65">Označi svoj klub zvjezdicom i uključi obavijesti.</span></span>
            </li>
          )}
        </ul>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={close} className="min-h-11 rounded-xl bg-white/10 px-4 text-sm font-extrabold ring-1 ring-white/15">Kasnije</button>
          <Link to="/obavijesti" onClick={close} className="grid min-h-11 place-items-center rounded-xl bg-white px-4 text-sm font-extrabold text-ink">Pokaži kako</Link>
        </div>
      </div>
    </div>
  );
}

export function ClubBadge({ club, name, size = 'size-8' }: { club?: Pick<Club, 'logo_path' | 'name'> | null; name?: string; size?: string }) {
  const logo = assetUrl(club?.logo_path);
  if (logo) return <img src={logo} alt="" className={`${size} shrink-0 rounded-full bg-white object-contain p-0.5`} />;
  return <TeamBadge name={club?.name ?? name ?? '?'} size={size} />;
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-1 mt-2">
      <h1 className="heading text-xl">{children}</h1>
      {sub && <p className="mt-1 text-[13px] text-white/60">{sub}</p>}
    </div>
  );
}
