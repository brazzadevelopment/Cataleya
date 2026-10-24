import type { ReactNode, SVGProps } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../data/TournamentContext';
import { assetUrl } from '../data/source';
import { initials } from '../lib/view';

export function Emblem({ className = 'size-10' }: { className?: string }) {
  const { snap } = useTournament();
  return <img src={assetUrl(snap.tournament.logo_path) ?? '/emblem.svg'} alt="" className={`${className} object-contain`} />;
}

/** Naslov odjeljka kao na plakatu: žuti tekst i crta. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center gap-3 first:mt-2">
      <h2 className="heading shrink-0 text-[15px] text-gold">{children}</h2>
      <span className="h-0.5 flex-1 rounded bg-gold/70" />
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="card px-4 py-6 text-center text-sm text-white/60">{children}</p>;
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-live px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
      <span className="size-1.5 rounded-full bg-white animate-live" />
      Uživo
    </span>
  );
}

export function TeamBadge({ name, size = 'size-8' }: { name: string; size?: string }) {
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-extrabold text-white/80 ring-1 ring-white/15`}>
      {initials(name)}
    </span>
  );
}

export function StarButton({ teamId, className = '' }: { teamId: string; className?: string }) {
  const { favorites, toggleFavorite } = useTournament();
  const on = favorites.has(teamId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(teamId);
      }}
      aria-pressed={on}
      aria-label={on ? 'Makni iz mojih momčadi' : 'Dodaj u moje momčadi'}
      className={`grid size-9 shrink-0 place-items-center rounded-full transition active:scale-90 ${on ? 'text-gold' : 'text-white/35 hover:text-white/70'} ${className}`}
    >
      <Icon name={on ? 'star-fill' : 'star'} className="size-5" />
    </button>
  );
}

export function Button({
  children, variant = 'primary', className = '', ...rest
}: { variant?: 'primary' | 'ghost' | 'danger' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: 'bg-gold text-pitch-950 hover:bg-gold-soft',
    ghost: 'bg-white/8 text-white hover:bg-white/14 ring-1 ring-white/12',
    danger: 'bg-live/15 text-[#ff8197] ring-1 ring-live/40 hover:bg-live/25',
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold transition active:scale-[0.98] disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({ active, children, onClick, to }: { active?: boolean; children: ReactNode; onClick?: () => void; to?: string }) {
  const cls = `inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-bold transition ${
    active ? 'bg-gold text-pitch-950' : 'bg-white/8 text-white/80 ring-1 ring-white/12 hover:bg-white/14'
  }`;
  return to ? <Link to={to} className={cls}>{children}</Link> : <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14h18M9 9v11" /></>,
  bracket: <path d="M3 5h5v6H3M3 13h5v6H3M8 8h4v8H8M12 12h5M17 9h4v6h-4z" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  'star-fill': <path fill="currentColor" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  back: <path d="M15 5 8 12l7 7" />,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6v4H9z" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2" /></>,
  whistle: <><circle cx="9" cy="14" r="5" /><path d="M12 10.5 21 6v4l-6.5 2.5M9 14h.01" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12 5 5L20 7" />,
  logout: <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  map: <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></>,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />,
  'bell-off': <path d="M6 16V11a6 6 0 0 1 9-5.2M18 11v5l2 2H8M10 21h4M3 3l18 18" />,
};

export function Icon({ name, ...props }: { name: keyof typeof PATHS | string } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {PATHS[name]}
    </svg>
  );
}
