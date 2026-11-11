import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClubBadge, PageTitle } from '../../components/HubLayout';
import { SponsorStrip } from '../../components/SponsorStrip';
import { Empty, Icon, LiveBadge, SectionTitle } from '../../components/ui';
import { publishedNews, useContent } from '../../data/content';
import { useFollowedClubs } from '../../data/follow';
import { assetUrl, source, type HallOfFame } from '../../data/source';
import { Splash } from '../../data/TournamentContext';
import { daysUntil, groupTournaments, podiums, tournamentStatus } from '../../lib/hub';
import { currentEdition, SERIES } from '../../lib/series';
import { dateSpan } from '../../lib/time';
import type { Club, Tournament } from '../../lib/types';
import { Lightbox } from '../site/Gallery';
import { NewsCard } from '../site/News';
import { VideoPlayer } from '../site/Videos';

/**
 * Početna Cataleya Cupa: sponzori, turnir u tijeku ili sljedeći, prijenos uživo,
 * tri turnira godišnje, vijesti, galerija, moji klubovi.
 */
export function HubHome() {
  const [list, setList] = useState<Tournament[] | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [live, setLive] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<number | null>(null);
  const followed = useFollowedClubs();
  const content = useContent();

  useEffect(() => {
    source.listTournaments().then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    source.listClubs().then(setClubs).catch(() => undefined);
    source.liveCounts().then(setLive).catch(() => undefined);
  }, []);

  if (error) return <Splash text={error} />;
  if (!list) return <Splash text="Učitavam…" />;

  const g = groupTournaments(list);
  const hero = g.live[0] ?? g.upcoming[0] ?? null;
  const mine = clubs.filter((c) => followed.has(c.id));
  const news = content ? publishedNews(content).slice(0, 3) : [];
  const liveVideo = content?.videos.find((v) => v.is_live);
  const lastVideo = content?.videos.filter((v) => !v.is_live).sort((a, b) => b.published_at.localeCompare(a.published_at))[0];
  const photos = content?.gallery.slice(0, 10) ?? [];

  return (
    <div>
      {hero ? <Hero t={hero} liveCount={live[hero.id] ?? 0} /> : <Intro />}

      <SponsorStrip />

      {liveVideo && (
        <>
          <SectionTitle>Prijenos uživo</SectionTitle>
          <VideoPlayer v={liveVideo} />
        </>
      )}

      <SectionTitle>Turniri</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {SERIES.map((s) => {
          const t = currentEdition(list, s.key);
          const st = t ? tournamentStatus(t) : null;
          return (
            <Link key={s.key} to={`/turnir/${s.key}`} className="card flex flex-col items-center px-2 pb-3 pt-3.5 text-center">
              <Icon name={s.icon} className="size-7 text-brand-soft" />
              <span className="mt-1.5 text-[14px] font-extrabold leading-tight">{s.label}</span>
              <span className="mt-1 text-[11px] leading-tight text-white/70">
                {t ? dateSpan(t.start_date, t.end_date) : 'Uskoro'}
              </span>
              {st === 'live' && <span className="mt-1.5"><LiveBadge /></span>}
            </Link>
          );
        })}
      </div>

      {news.length > 0 && (
        <>
          <SectionTitle action={<Link to="/vijesti" className="text-[12px] font-bold text-white/65">Sve →</Link>}>Vijesti</SectionTitle>
          <div className="space-y-3">
            {news.map((n, i) => <NewsCard key={n.id} n={n} big={i === 0} />)}
          </div>
        </>
      )}

      {!liveVideo && lastVideo && (
        <>
          <SectionTitle action={<Link to="/video" className="text-[12px] font-bold text-white/65">Sve →</Link>}>Video</SectionTitle>
          <VideoPlayer v={lastVideo} />
        </>
      )}

      {photos.length > 0 && (
        <>
          <SectionTitle action={<Link to="/galerija" className="text-[12px] font-bold text-white/65">Sve →</Link>}>Galerija</SectionTitle>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {photos.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setPhoto(i)} className="h-32 w-44 shrink-0 overflow-hidden rounded-xl bg-white/10">
                <img src={assetUrl(p.image_path) ?? ''} alt={p.caption ?? ''} className="size-full object-cover" />
              </button>
            ))}
          </div>
          {photo !== null && <Lightbox list={photos} index={photo} onClose={() => setPhoto(null)} />}
        </>
      )}

      <SectionTitle action={<Link to="/klubovi" className="text-[12px] font-bold text-white/65">Svi klubovi →</Link>}>Moji klubovi</SectionTitle>
      {mine.length ? (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {mine.map((c) => (
            <Link key={c.id} to={`/klub/${c.id}`} className="flex shrink-0 items-center gap-2 rounded-full bg-white/12 py-1.5 pl-1.5 pr-4 ring-1 ring-white/20">
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
            <span className="block text-[12px] text-white/65">Rezultati i obavijesti na svakom Cataleya Cupu, za sva godišta.</span>
          </span>
          <Icon name="back" className="size-4 rotate-180 text-white/45" />
        </Link>
      )}

      {g.done.length > 0 && (
        <>
          <SectionTitle action={<Link to="/pobjednici" className="text-[12px] font-bold text-white/65">Pobjednici →</Link>}>Završeni turniri</SectionTitle>
          <div className="space-y-3">
            {g.done.slice(0, 4).map((t) => <TournamentRow key={t.id} t={t} live={live[t.id]} />)}
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
      <p className="relative mt-3 text-sm text-white/75">Međunarodni nogometni turnir za djecu. Raspored, rezultati uživo, tablice i ždrijeb.</p>
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
        <p className="mt-2 text-sm text-white/75">{dateSpan(t.start_date, t.end_date)}{t.place ? ` · ${t.place}` : ''}</p>
        {status === 'live' ? (
          <div className="mt-4 flex items-center justify-center gap-2">
            {liveCount > 0 ? <><LiveBadge /><span className="text-[13px] font-bold">{liveCount} {liveCount === 1 ? 'utakmica' : 'utakmica'} uživo</span></> : <span className="text-[13px] text-white/75">Otvori raspored i rezultate →</span>}
          </div>
        ) : (
          <div className="mt-4 inline-flex items-baseline gap-2 rounded-2xl bg-white/12 px-4 py-2 ring-1 ring-white/20">
            <span className="heading text-3xl text-brand-soft">{days}</span>
            <span className="text-[13px] font-bold text-white/85">{days === 1 ? 'dan' : 'dana'} do početka</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function TournamentRow({ t, live }: { t: Tournament; live?: number }) {
  return (
    <Link to={`/t/${t.slug}`} className="card flex items-center gap-3 p-3.5">
      <img src={assetUrl(t.logo_path) ?? '/logo.svg'} alt="" className="size-12 shrink-0 rounded-xl object-contain" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-extrabold">{t.name}</div>
        <div className="mt-0.5 truncate text-[12px] text-white/65">{dateSpan(t.start_date, t.end_date)}{t.place ? ` · ${t.place}` : ''}</div>
      </div>
      {live ? <LiveBadge /> : <Icon name="back" className="size-4 shrink-0 rotate-180 text-white/45" />}
    </Link>
  );
}

/** Pobjednici svih turnira (prva tri mjesta po godištu). */
export function Winners() {
  const [fame, setFame] = useState<HallOfFame | null>(null);
  useEffect(() => {
    source.hallOfFame().then(setFame).catch(() => setFame({ matches: [], teams: [], tournaments: [], categories: [] }));
  }, []);
  if (!fame) return <Splash text="Učitavam…" />;
  const list = podiums(fame);
  const teamName = (id: string) => fame.teams.find((t) => t.id === id)?.name ?? '';
  return (
    <div>
      <PageTitle>Pobjednici</PageTitle>
      <div className="mt-3 space-y-3">
        {list.length ? list.map((p) => (
          <Link key={p.category.id} to={`/t/${p.tournament.slug}/poredak`} className="card block p-4">
            <div className="text-[12px] font-bold text-white/65">{p.tournament.name} · {p.category.name}</div>
            {p.places.map((x) => (
              <div key={x.place} className="mt-1.5 flex items-center gap-2 text-[14px]">
                <span className={`heading w-6 ${x.place === 1 ? 'text-gold' : 'text-white/65'}`}>{x.place}.</span>
                <span className="font-bold">{teamName(x.teamId)}</span>
                {x.place === 1 && <Icon name="trophy" className="ml-auto size-5 text-gold" />}
              </div>
            ))}
          </Link>
        )) : <Empty>Pobjednici će biti ovdje nakon prvih finala.</Empty>}
      </div>
    </div>
  );
}
