import { Link } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { Empty, Icon, SectionTitle, StarButton, TeamBadge } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { byTime, involves } from '../lib/view';

export function Mine() {
  const { snap, favorites } = useTournament();
  const base = `/t/${snap.tournament.slug}`;
  const favTeams = snap.teams.filter((t) => favorites.has(t.id));
  const mine = snap.matches.filter((m) => involves(m, favorites)).sort(byTime);
  const played = mine.filter((m) => m.status === 'finished').reverse();
  const coming = mine.filter((m) => m.status === 'scheduled' || m.status === 'live');

  return (
    <div>
      {favTeams.length === 0 ? (
        <>
          <SectionTitle>Moje utakmice</SectionTitle>
          <Empty>
            Još nisi označio nijednu momčad. Odaberi momčad ispod ili dodirni{' '}
            <Icon name="star" className="inline size-4 -translate-y-px text-gold" /> uz njezino ime bilo gdje u aplikaciji.
          </Empty>
          <PickTeams />
        </>
      ) : (
        <>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {favTeams.map((t) => (
              <Link key={t.id} to={`${base}/momcad/${t.id}`} className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold/12 py-1 pl-1.5 pr-1 ring-1 ring-gold/35">
                <TeamBadge name={t.name} size="size-7" />
                <span className="text-[13px] font-bold">{t.name}</span>
                <StarButton teamId={t.id} className="size-7 [&_svg]:size-4" />
              </Link>
            ))}
          </div>

          <SectionTitle>Sljedeće</SectionTitle>
          {coming.length ? <div className="space-y-3">{coming.map((m) => <MatchCard key={m.id} match={m} />)}</div> : <Empty>Nema više zakazanih utakmica.</Empty>}

          <SectionTitle>Odigrane</SectionTitle>
          {played.length ? <div className="space-y-3">{played.map((m) => <MatchCard key={m.id} match={m} />)}</div> : <Empty>Još nema odigranih utakmica.</Empty>}

          <SectionTitle>Dodaj momčad</SectionTitle>
          <PickTeams />
        </>
      )}
    </div>
  );
}

function PickTeams() {
  const { snap, categoryId, favorites } = useTournament();
  const teams = snap.teams.filter((t) => t.category_id === categoryId && !favorites.has(t.id)).sort((a, b) => a.name.localeCompare(b.name, 'hr'));
  if (!teams.length) return null;
  return (
    <div className="card mt-3 divide-y divide-line">
      {teams.map((t) => (
        <div key={t.id} className="flex items-center gap-3 py-1.5 pl-3.5 pr-2">
          <TeamBadge name={t.name} size="size-7" />
          <span className="flex-1 text-[14px] font-semibold">{t.name}</span>
          <StarButton teamId={t.id} />
        </div>
      ))}
    </div>
  );
}
