import { Link } from 'react-router-dom';
import { activeSponsors, useContent } from '../data/content';
import { assetUrl } from '../data/source';
import type { Sponsor } from '../lib/types';

/** Logo sponzora na bijeloj pločici; s web adresom vodi na njihovu stranicu. */
export function SponsorLogo({ s, className = 'h-14 w-32' }: { s: Sponsor; className?: string }) {
  const logo = assetUrl(s.logo_path);
  const inner = logo
    ? <img src={logo} alt={s.name} className="max-h-full max-w-full object-contain" />
    : <span className="px-2 text-center text-[13px] font-extrabold leading-tight text-[#1f2a24]">{s.name}</span>;
  const cls = `${className} flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-[0_4px_12px_-8px_rgb(0_40_20_/_0.5)]`;
  return s.url
    ? <a href={s.url} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
    : <div className={cls}>{inner}</div>;
}

/** Traka sponzora koja se sama vrti. */
export function SponsorStrip({ title = true }: { title?: boolean }) {
  const content = useContent();
  const list = content ? activeSponsors(content) : [];
  if (!list.length) return null;
  // Dvaput isti niz, da se traka vrti bez prekida.
  const loop = [...list, ...list];
  return (
    <section aria-label="Sponzori" className="-mx-4 mt-4">
      {title && (
        <div className="mb-2 flex items-center px-4">
          <span className="text-[11px] font-extrabold tracking-[0.2em] text-white/70 uppercase">Sponzori</span>
          <Link to="/sponzori" className="ml-auto text-[12px] font-bold text-white/60">Svi →</Link>
        </div>
      )}
      <div className="overflow-hidden motion-reduce:overflow-x-auto">
        <div className="animate-marquee flex w-max gap-3 px-4" style={{ ['--marquee-duration' as string]: `${Math.max(16, list.length * 5)}s` }}>
          {loop.map((s, i) => <SponsorLogo key={`${s.id}-${i}`} s={s} />)}
        </div>
      </div>
    </section>
  );
}
