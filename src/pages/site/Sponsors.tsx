import { PageTitle } from '../../components/HubLayout';
import { SponsorLogo } from '../../components/SponsorStrip';
import { Empty, SectionTitle } from '../../components/ui';
import { activeSponsors, useContent } from '../../data/content';
import { Splash } from '../../data/TournamentContext';

const TIERS = [
  { key: 'glavni', title: 'Glavni sponzor', size: 'h-28 w-full' },
  { key: 'zlatni', title: 'Zlatni sponzori', size: 'h-20 w-full' },
  { key: 'partner', title: 'Partneri', size: 'h-16 w-full' },
] as const;

export function Sponsors() {
  const c = useContent();
  if (!c) return <Splash text="Učitavam…" />;
  const list = activeSponsors(c);
  return (
    <div>
      <PageTitle sub="Hvala svima koji podržavaju dječji nogomet.">Sponzori</PageTitle>
      {!list.length && <div className="mt-3"><Empty>Sponzori će uskoro biti ovdje.</Empty></div>}
      {TIERS.map((t) => {
        const items = list.filter((s) => s.tier === t.key);
        if (!items.length) return null;
        return (
          <section key={t.key}>
            <SectionTitle>{items.length === 1 && t.key !== 'glavni' ? t.title.replace(/i$/, '') : t.title}</SectionTitle>
            <div className={`grid gap-3 ${t.key === 'glavni' ? 'grid-cols-1' : t.key === 'zlatni' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {items.map((s) => <SponsorLogo key={s.id} s={s} className={t.size} />)}
            </div>
          </section>
        );
      })}
      <p className="mt-6 text-center text-[13px] text-white/70">Želite podržati Cataleya Cup? <a href="/kontakt" className="font-bold underline">Javite nam se.</a></p>
    </div>
  );
}
