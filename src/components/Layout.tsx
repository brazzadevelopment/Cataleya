import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTournament } from '../data/TournamentContext';
import { source } from '../data/source';
import { Chip, Emblem, Icon } from './ui';

export function Layout() {
  const { snap, session } = useTournament();
  const base = `/t/${snap.tournament.slug}`;
  const { pathname } = useLocation();
  const staff = pathname.startsWith(`${base}/admin`) || pathname.startsWith(`${base}/zapisnik`);

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      {source.mode === 'demo' && (
        <div className="bg-bloom-violet/90 px-4 py-1 text-center text-[11px] font-bold uppercase tracking-wider">
          Demo · podaci su samo na ovom uređaju
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-line bg-pitch-950/85 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <NavLink to={base} className="flex min-w-0 items-center gap-3">
            <Emblem className="size-11 drop-shadow-[0_0_12px_rgb(164_91_224_/_0.45)]" />
            <div className="min-w-0 leading-none">
              <div className="heading truncate text-[19px]">{snap.tournament.name}</div>
              <div className="mt-1 truncate text-[11px] font-semibold tracking-[0.18em] text-white/60 uppercase">
                {snap.tournament.place}
              </div>
            </div>
          </NavLink>
          {session && (
            <NavLink
              to={session.role === 'admin' ? `${base}/admin` : `${base}/zapisnik`}
              aria-label={session.role === 'admin' ? 'Uređivanje' : 'Zapisnik'}
              className="ml-auto grid size-10 shrink-0 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/40"
            >
              <Icon name={session.role === 'admin' ? 'edit' : 'whistle'} className="size-5" />
            </NavLink>
          )}
        </div>
        {!staff && <CategoryPicker />}
      </header>

      <main className="flex-1 px-4 pb-28 pt-3">
        <Outlet />
      </main>

      {!staff && <BottomNav base={base} />}
    </div>
  );
}

function CategoryPicker() {
  const { snap, categoryId, setCategoryId } = useTournament();
  if (snap.categories.length < 2) {
    const c = snap.categories[0];
    return c ? <div className="mt-2 text-[12px] font-bold tracking-[0.2em] text-gold uppercase">{c.name}</div> : null;
  }
  return (
    <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
      {[...snap.categories].sort((a, b) => a.sort_order - b.sort_order).map((c) => (
        <Chip key={c.id} active={c.id === categoryId} onClick={() => setCategoryId(c.id)}>{c.name}</Chip>
      ))}
    </div>
  );
}

function BottomNav({ base }: { base: string }) {
  const items = [
    { to: base, icon: 'home', label: 'Početna', end: true },
    { to: `${base}/raspored`, icon: 'calendar', label: 'Raspored' },
    { to: `${base}/tablice`, icon: 'table', label: 'Tablice' },
    { to: `${base}/zdrijeb`, icon: 'bracket', label: 'Ždrijeb' },
    { to: `${base}/moje`, icon: 'star', label: 'Moje' },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-pitch-950/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition ${isActive ? 'text-gold' : 'text-white/55'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={isActive && it.icon === 'star' ? 'star-fill' : it.icon} className="size-[22px]" />
                {it.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
