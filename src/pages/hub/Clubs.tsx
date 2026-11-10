import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClubBadge, PageTitle } from '../../components/HubLayout';
import { NotificationsCard } from '../../components/Notifications';
import { Empty, Icon, SectionTitle } from '../../components/ui';
import { toggleClub, useFollowedClubs } from '../../data/follow';
import { source, type ClubHistory } from '../../data/source';
import { Splash } from '../../data/TournamentContext';
import { clubRecord, resultFor, type Result } from '../../lib/hub';
import { finalRanking } from '../../lib/advancement';
import { dateSpan, dayShort, localDate, localTime } from '../../lib/time';
import type { Club, Match } from '../../lib/types';

function FollowButton({ club, big = false }: { club: Club; big?: boolean }) {
  const followed = useFollowedClubs();
  const on = followed.has(club.id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        toggleClub(club.id);
      }}
      aria-pressed={on}
      aria-label={on ? `Prestani pratiti ${club.name}` : `Prati ${club.name}`}
      className={big
        ? `inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-extrabold ${on ? 'bg-white/10 text-white ring-1 ring-white/20' : 'bg-brand text-white'}`
        : `grid size-10 shrink-0 place-items-center rounded-full ${on ? 'text-gold' : 'text-white/35'}`}
    >
      <Icon name={on ? 'star-fill' : 'star'} className="size-5" />
      {big && (on ? 'Pratiš klub' : 'Prati klub')}
    </button>
  );
}

/** Svi klubovi, s pretragom i zvjezdicom za praćenje. */
export function Clubs() {
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [q, setQ] = useState('');
  const followed = useFollowedClubs();
  useEffect(() => {
    source.listClubs().then(setClubs).catch(() => setClubs([]));
  }, []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (clubs ?? []).filter((c) => !s || c.name.toLowerCase().includes(s) || (c.city ?? '').toLowerCase().includes(s));
  }, [clubs, q]);
  if (!clubs) return <Splash text="Učitavam…" />;
  const mine = shown.filter((c) => followed.has(c.id));
  const rest = shown.filter((c) => !followed.has(c.id));

  return (
    <div>
      <PageTitle sub="Prati svoj klub: vidjet ćeš ga na svakom turniru, u svim godištima, i dobivati obavijesti.">Klubovi</PageTitle>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Traži klub ili mjesto"
        className="mt-3 h-12 w-full rounded-xl bg-white/8 px-4 text-[15px] ring-1 ring-white/15 placeholder:text-white/40"
      />
      {mine.length > 0 && (
        <>
          <SectionTitle>Pratiš</SectionTitle>
          <ClubList clubs={mine} />
          <div className="mt-3"><NotificationsCard /></div>
        </>
      )}
      <SectionTitle>{mine.length ? 'Ostali klubovi' : 'Svi klubovi'}</SectionTitle>
      {rest.length ? <ClubList clubs={rest} /> : <Empty>Nema klubova za „{q}”.</Empty>}
    </div>
  );
}

function ClubList({ clubs }: { clubs: Club[] }) {
  return (
    <div className="card divide-y divide-line">
      {clubs.map((c) => (
        <Link key={c.id} to={`/klub/${c.id}`} className="flex items-center gap-3 py-1.5 pl-3.5 pr-2">
          <ClubBadge club={c} size="size-8" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{c.name}</span>
            {c.city && <span className="block truncate text-[12px] text-white/50">{c.city}</span>}
          </span>
          <FollowButton club={c} />
        </Link>
      ))}
    </div>
  );
}

const RESULT_STYLE: Record<Result, string> = {
  W: 'bg-brand text-white',
  D: 'bg-white/20 text-white',
  L: 'bg-live/80 text-white',
};
const RESULT_LABEL: Record<Result, string> = { W: 'P', D: 'N', L: 'I' };

/** Klub kroz sve turnire: momčadi po turnirima i godištima, rezultati, plasmani. */
export function ClubPage() {
  const { id = '' } = useParams();
  const [h, setH] = useState<ClubHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setH(null);
    source.clubHistory(id).then(setH).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);
  if (error) return <Splash text={error} />;
  if (!h) return <Splash text="Učitavam…" />;
  if (!h.club) return <Empty>Klub ne postoji.</Empty>;

  const club = h.club;
  const own = h.teams.filter((t) => t.club_id === club.id && h.tournaments.some((x) => x.id === t.tournament_id));
  const rec = clubRecord(h.matches, own);
  const name = (tid: string | null) => h.teams.find((t) => t.id === tid)?.name ?? 'Još nije poznato';
  const tournaments = [...h.tournaments].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const trophies = own.flatMap((t) => {
    const places = finalRanking(h.matches.filter((m) => m.category_id === t.category_id)).filter((p) => p.teamId === t.id && p.place <= 3);
    const tour = h.tournaments.find((x) => x.id === t.tournament_id);
    const cat = h.categories.find((c) => c.id === t.category_id);
    return places.map((p) => ({ place: p.place, label: `${tour?.name ?? ''} · ${cat?.name ?? ''}` }));
  });

  return (
    <div>
      <section className="card mt-2 flex flex-col items-center px-5 pb-5 pt-6 text-center">
        <ClubBadge club={club} size="size-20" />
        <h1 className="heading mt-3 text-[24px] leading-tight">{club.name}</h1>
        {club.city && <p className="mt-1 text-[13px] text-white/60">{club.city}</p>}
        <div className="mt-4"><FollowButton club={club} big /></div>
        {rec.played > 0 && (
          <div className="mt-5 grid w-full grid-cols-4 gap-2 text-center">
            {[['Utakmica', rec.played], ['Pobjeda', rec.won], ['Neriješeno', rec.drawn], ['Golova', `${rec.goalsFor}:${rec.goalsAgainst}`]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-white/6 py-2">
                <div className="heading text-lg">{v}</div>
                <div className="text-[10px] font-bold text-white/55 uppercase">{l}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {trophies.length > 0 && (
        <>
          <SectionTitle>Plasmani</SectionTitle>
          <div className="card divide-y divide-line">
            {trophies.sort((a, b) => a.place - b.place).map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
                <Icon name="trophy" className={`size-5 ${t.place === 1 ? 'text-gold' : 'text-white/60'}`} />
                <b>{t.place}. mjesto</b>
                <span className="truncate text-white/65">{t.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {tournaments.map((tour) => {
        const teams = own.filter((t) => t.tournament_id === tour.id);
        return (
          <div key={tour.id}>
            <SectionTitle action={<Link to={`/t/${tour.slug}`} className="text-[12px] font-bold text-white/60">Turnir →</Link>}>{tour.name}</SectionTitle>
            <p className="-mt-1 mb-2 text-[12px] text-white/50">{dateSpan(tour.start_date, tour.end_date)}</p>
            <div className="space-y-3">
              {teams.map((t) => {
                const cat = h.categories.find((c) => c.id === t.category_id);
                const ms = h.matches.filter((m) => m.home_team_id === t.id || m.away_team_id === t.id)
                  .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''));
                return (
                  <div key={t.id} className="card overflow-hidden">
                    <Link to={`/t/${tour.slug}/momcad/${t.id}`} className="flex items-center justify-between border-b border-line px-4 py-2.5">
                      <span className="font-extrabold">{t.name}</span>
                      <span className="text-[12px] font-bold text-brand-soft">{cat?.name}</span>
                    </Link>
                    {ms.length ? ms.map((m) => <MatchLine key={m.id} m={m} teamId={t.id} slug={tour.slug} opponent={name(m.home_team_id === t.id ? m.away_team_id : m.home_team_id)} />)
                      : <p className="px-4 py-3 text-[13px] text-white/50">Raspored još nije objavljen.</p>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {!tournaments.length && <Empty>Klub još nije igrao na objavljenim turnirima.</Empty>}
    </div>
  );
}

function MatchLine({ m, teamId, slug, opponent }: { m: Match; teamId: string; slug: string; opponent: string }) {
  const res = resultFor(m, teamId);
  const home = m.home_team_id === teamId;
  const score = m.home_score != null && m.away_score != null ? (home ? `${m.home_score}:${m.away_score}` : `${m.away_score}:${m.home_score}`) : null;
  const when = m.starts_at ? `${dayShort(localDate(m.starts_at, 'Europe/Zagreb'))} ${localTime(m.starts_at, 'Europe/Zagreb')}` : '';
  return (
    <Link to={`/t/${slug}/utakmica/${m.id}`} className="flex items-center gap-3 border-b border-line px-4 py-2 text-[14px] last:border-0">
      <span className="w-20 shrink-0 text-[12px] text-white/55">{when}</span>
      <span className="min-w-0 flex-1 truncate">{home ? '' : '@ '}{opponent}</span>
      {m.status === 'live' && <span className="text-[11px] font-black text-live">UŽIVO</span>}
      {score && <span className="font-black tabular-nums">{score}</span>}
      {res && <span className={`grid size-6 place-items-center rounded-md text-[11px] font-black ${RESULT_STYLE[res]}`}>{RESULT_LABEL[res]}</span>}
    </Link>
  );
}
