import { Link } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { Emblem, Empty, Icon, SectionTitle, StarButton, TeamBadge } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { finalRanking } from '../lib/advancement';
import { dateSpan } from '../lib/time';
import { byTime, involves, matchPhase, matchTime, teamName } from '../lib/view';

export function Home() {
  const { snap, categoryId, favorites } = useTournament();
  const t = snap.tournament;
  const base = `/t/${t.slug}`;
  const matches = snap.matches.filter((m) => m.category_id === categoryId).sort(byTime);
  const live = matches.filter((m) => m.status === 'live');
  const scheduled = matches.filter((m) => m.status === 'scheduled' && m.starts_at);
  const soon = Date.now() - 30 * 60000;
  const upcoming = (scheduled.some((m) => new Date(m.starts_at!).getTime() >= soon)
    ? scheduled.filter((m) => new Date(m.starts_at!).getTime() >= soon)
    : scheduled).slice(0, 4);
  const favTeams = snap.teams.filter((tm) => favorites.has(tm.id) && tm.category_id === categoryId);
  const podium = finalRanking(matches).filter((p) => p.place <= 3);
  const venues = [...new Set(matches.map((m) => snap.fields.find((f) => f.id === m.field_id)?.venue).filter(Boolean))] as string[];

  return (
    <div>
      <section className="card relative mb-2 overflow-hidden px-5 pb-5 pt-6 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(164_91_224_/_0.28),transparent_70%)]" />
        <Emblem className="relative mx-auto size-24 drop-shadow-[0_0_24px_rgb(164_91_224_/_0.55)]" />
        <h1 className="heading relative mt-3 text-[30px] leading-none">{t.name}</h1>
        <p className="relative mt-2 text-[13px] font-bold tracking-[0.22em] text-gold uppercase">
          {categoryTitle(snap.categories.find((c) => c.id === categoryId))}
        </p>
        <p className="relative mt-3 text-sm text-white/70">
          {dateSpan(t.start_date, t.end_date)} · {t.place}
          {t.venue ? ` · ${t.venue}` : ''}
        </p>
        {venues.length > 0 && <p className="relative mt-1 text-[12px] text-white/50">{venues.join(' · ')}</p>}
      </section>

      {podium.length > 0 && (
        <>
          <SectionTitle>Pobjednici</SectionTitle>
          <div className="card divide-y divide-line">
            {podium.map((p) => (
              <div key={p.place} className="flex items-center gap-3 px-4 py-3">
                <span className={`heading w-8 text-2xl ${p.place === 1 ? 'text-gold' : 'text-white/70'}`}>{p.place}.</span>
                <span className="font-bold">{teamName(snap, p.teamId)}</span>
                {p.place === 1 && <Icon name="trophy" className="ml-auto size-6 text-gold" />}
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Uživo sada</SectionTitle>
      {live.length ? (
        <div className="space-y-3">{live.map((m) => <MatchCard key={m.id} match={m} />)}</div>
      ) : (
        <Empty>Trenutno se ne igra nijedna utakmica.</Empty>
      )}

      <SectionTitle action={<Link to={`${base}/raspored`} className="text-[12px] font-bold text-white/60">Sve →</Link>}>
        Sljedeće utakmice
      </SectionTitle>
      {upcoming.length ? (
        <div className="space-y-3">{upcoming.map((m) => <MatchCard key={m.id} match={m} />)}</div>
      ) : (
        <Empty>Nema zakazanih utakmica.</Empty>
      )}

      <SectionTitle action={<Link to={`${base}/moje`} className="text-[12px] font-bold text-white/60">Utakmice →</Link>}>
        Moje momčadi
      </SectionTitle>
      {favTeams.length ? (
        <div className="card divide-y divide-line">
          {favTeams.map((tm) => {
            const next = matches.find((m) => m.status !== 'finished' && m.status !== 'cancelled' && involves(m, new Set([tm.id])));
            return (
              <Link key={tm.id} to={`${base}/momcad/${tm.id}`} className="flex items-center gap-3 px-3.5 py-3">
                <TeamBadge name={tm.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{tm.name}</div>
                  <div className="truncate text-[12px] text-white/60">
                    {next ? `Sljedeća: ${matchTime(snap, next) ?? matchPhase(snap, next)}` : 'Nema više zakazanih utakmica'}
                  </div>
                </div>
                <StarButton teamId={tm.id} />
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty>
          Dodirni <Icon name="star" className="inline size-4 -translate-y-px text-gold" /> uz momčad i ovdje ćeš vidjeti njezine utakmice.
        </Empty>
      )}

      <FooterLinks />
    </div>
  );
}

/** '2016. godište' ili naziv kategorije kakav jest. */
export function categoryTitle(c: { name: string; birth_year: number | null } | undefined): string {
  if (!c) return '';
  return c.birth_year && /^\d{4}\.?$/.test(c.name.trim()) ? `${c.name} godište` : c.name;
}

export function FooterLinks() {
  const { snap, session } = useTournament();
  const base = `/t/${snap.tournament.slug}`;
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] font-semibold text-white/45">
      <Link to={`${base}/upute`}>Kako koristiti</Link>
      <Link to={`${base}/info`}>O turniru</Link>
      <Link to={`${base}/poredak`}>Konačni poredak</Link>
      {!session && <Link to={`${base}/prijava`}>Prijava</Link>}
    </div>
  );
}
