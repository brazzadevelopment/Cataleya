import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrowserWarning } from '../../components/BrowserWarning';
import { ClubBadge } from '../../components/HubLayout';
import { NotifyBanner } from '../../components/Notifications';
import { Empty, Icon, LiveBadge, SectionTitle } from '../../components/ui';
import { useFollowedClubs } from '../../data/follow';
import { assetUrl, source, type HallOfFame } from '../../data/source';
import { Splash } from '../../data/TournamentContext';
import { daysUntil, groupTournaments, podiums, tournamentStatus } from '../../lib/hub';
import { dateSpan } from '../../lib/time';
import type { Club, Tournament } from '../../lib/types';

/** Početna Cataleya Cupa: turnir u tijeku ili sljedeći, moji klubovi, svi turniri, pobjednici. */
export function HubHome() {
  const [list, setList] = useState<Tournament[] | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [live, setLive] = useState<Record<string, number>>({});
  const [fame, setFame] = useState<HallOfFame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const followed = useFollowedClubs();

  useEffect(() => {
    source.listTournaments().then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    source.listClubs().then(setClubs).catch(() => undefined);
    source.liveCounts().then(setLive).catch(() => undefined);
    source.hallOfFame().then(setFame).catch(() => undefined);
  }, []);

  if (error) return <Splash text={error} />;
  if (!list) return <Splash text="Učitavam…" />;

  const g = groupTournaments(list);
  const hero = g.live[0] ?? g.upcoming[0] ?? null;
  const mine = clubs.filter((c) => followed.has(c.id));
  const fameList = fame ? podiums(fame).slice(0, 8) : [];
  const teamName = (id: string) => fame?.teams.find((t) => t.id === id)?.name ?? '';

  return (
    <div>
      <BrowserWarning />
      {hero ? <Hero t={hero} liveCount={live[hero.id] ?? 0} /> : <Intro />}
      <NotifyBanner />

      <SectionTitle action={<Link to="/klubovi" className="text-[12px] font-bold text-white/60">Svi klubovi →</Link>}>Moji klubovi</SectionTitle>
      {mine.length ? (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {mine.map((c) => (
            <Link key={c.id} to={`/klub/${c.id}`} className="flex shrink-0 items-center gap-2 rounded-full bg-brand/15 py-1.5 pl-1.5 pr-4 ring-1 ring-brand/40">
              <ClubBadge club={c} size="size-8" />
              <span className="text-[14px] font-bold">{c.name}</span>
            </Link>
          ))}
        </div>
      ) : (
        <Link to="/klubovi" className="card flex items-center gap-3 p-4">
          <Icon name="star" className="size-6 shrink-0 text-gold" />
          <span className="flex-1 text-[14px] leading-snug">
            <b>Prati svoj klub</b>
            <span className="block text-[12px] text-white/60">Rezultati i obavijesti na svakom Cataleya Cupu, za sva godišta.</span>
          </span>
          <Icon name="back" className="size-4 rotate-180 text-white/40" />
        </Link>
      )}

      {g.live.length > 0 && <TournamentSection title="U tijeku" list={g.live} live={live} />}
      {g.upcoming.length > 0 && <TournamentSection title="Uskoro" list={g.upcoming} live={live} />}
      {g.done.length > 0 && <TournamentSection title="Završeni turniri" list={g.done} live={live} />}
      {!list.length && <Empty>Još nema objavljenih turnira.</Empty>}

      {fameList.length > 0 && (
        <>
          <SectionTitle>Pobjednici</SectionTitle>
          <div className="space-y-3">
            {fameList.map((p) => (
              <Link key={p.category.id} to={`/t/${p.tournament.slug}/poredak`} className="card block p-4">
                <div className="text-[12px] font-bold text-white/55">{p.tournament.name} · {p.category.name}</div>
                {p.places.map((x) => (
                  <div key={x.place} className="mt-1.5 flex items-center gap-2 text-[14px]">
                    <span className={`heading w-6 ${x.place === 1 ? 'text-gold' : 'text-white/60'}`}>{x.place}.</span>
                    <span className="font-bold">{teamName(x.teamId)}</span>
                    {x.place === 1 && <Icon name="trophy" className="ml-auto size-5 text-gold" />}
                  </div>
                ))}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Intro() {
  return (
    <section className="card relative overflow-hidden px-5 pb-6 pt-7 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(255_255_255_/_0.22),transparent_70%)]" />
      <img src="/logo.svg" alt="" className="relative mx-auto size-24 drop-shadow-[0_0_24px_rgb(255_255_255_/_0.22)]" />
      <h1 className="heading relative mt-3 text-[28px] leading-none">Cataleya Cup</h1>
      <p className="relative mt-3 text-sm text-white/70">Međunarodni nogometni turnir za djecu. Raspored, rezultati uživo, tablice i ždrijeb.</p>
    </section>
  );
}

function Hero({ t, liveCount }: { t: Tournament; liveCount: number }) {
  const status = tournamentStatus(t);
  const days = daysUntil(t.start_date);
  return (
    <Link to={`/t/${t.slug}`} className="card relative block overflow-hidden px-5 pb-6 pt-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(255_255_255_/_0.22),transparent_70%)]" />
      <div className="relative">
        <div className="text-[12px] font-extrabold tracking-[0.22em] text-brand-soft uppercase">
          {status === 'live' ? 'Turnir je u tijeku' : 'Sljedeći turnir'}
        </div>
        <img src={assetUrl(t.logo_path) ?? '/logo.svg'} alt="" className="mx-auto mt-3 size-20 object-contain drop-shadow-[0_0_24px_rgb(255_255_255_/_0.22)]" />
        <h1 className="heading mt-3 text-[26px] leading-tight">{t.name}</h1>
        <p className="mt-2 text-sm text-white/70">{dateSpan(t.start_date, t.end_date)}{t.place ? ` · ${t.place}` : ''}</p>
        {status === 'live' ? (
          <div className="mt-4 flex items-center justify-center gap-2">
            {liveCount > 0 ? <><LiveBadge /><span className="text-[13px] font-bold">{liveCount} {liveCount === 1 ? 'utakmica' : 'utakmica'} uživo</span></> : <span className="text-[13px] text-white/70">Otvori raspored i rezultate →</span>}
          </div>
        ) : (
          <div className="mt-4 inline-flex items-baseline gap-2 rounded-2xl bg-brand/15 px-4 py-2 ring-1 ring-brand/40">
            <span className="heading text-3xl text-brand-soft">{days}</span>
            <span className="text-[13px] font-bold text-white/80">{days === 1 ? 'dan' : 'dana'} do početka</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function TournamentSection({ title, list, live }: { title: string; list: Tournament[]; live: Record<string, number> }) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-3">
        {list.map((t) => (
          <Link key={t.id} to={`/t/${t.slug}`} className="card flex items-center gap-3 p-3.5">
            <img src={assetUrl(t.logo_path) ?? '/logo.svg'} alt="" className="size-12 shrink-0 rounded-xl object-contain" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-extrabold">{t.name}</div>
              <div className="mt-0.5 truncate text-[12px] text-white/60">{dateSpan(t.start_date, t.end_date)}{t.place ? ` · ${t.place}` : ''}</div>
            </div>
            {live[t.id] ? <LiveBadge /> : <Icon name="back" className="size-4 shrink-0 rotate-180 text-white/40" />}
          </Link>
        ))}
      </div>
    </>
  );
}
