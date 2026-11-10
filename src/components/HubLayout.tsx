import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { assetUrl, source } from '../data/source';
import type { Club } from '../lib/types';
import { useOrgSession } from '../data/follow';
import { Icon, TeamBadge } from './ui';

/** Okvir za stranice Cataleya Cupa izvan jednog turnira (početna, klubovi, organizacija). */
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
      <main className="flex-1 px-4 pb-16 pt-3">
        <Outlet />
      </main>
      <footer className="border-t border-line px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-5 text-center text-[12px] text-white/50">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 font-bold">
          <Link to="/klubovi">Klubovi</Link>
          <Link to="/obavijesti">Obavijesti</Link>
          <Link to="/privatnost">Privatnost</Link>
          <Link to="/organizacija">Za organizatore</Link>
        </div>
        <p className="mt-3">Cataleya Cup · međunarodni nogometni turnir za djecu · Zadar</p>
      </footer>
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
