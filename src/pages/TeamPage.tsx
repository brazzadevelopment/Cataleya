import { useParams } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { absoluteUrl, ShareButton } from '../components/Share';
import { Empty, SectionTitle, StarButton, TeamBadge } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { computeGroupTable } from '../lib/standings';
import { byTime, involves, teamName } from '../lib/view';
import { BackLink } from './MatchPage';

export function TeamPage() {
  const { id } = useParams();
  const { snap } = useTournament();
  const team = snap.teams.find((t) => t.id === id);
  if (!team) return <Empty>Momčad ne postoji.</Empty>;

  const matches = snap.matches.filter((m) => involves(m, new Set([team.id]))).sort(byTime);
  const gt = snap.groupTeams.find((x) => x.team_id === team.id);
  const group = snap.groups.find((g) => g.id === gt?.group_id);
  const category = snap.categories.find((c) => c.id === team.category_id);
  const row = group
    ? computeGroupTable(
      snap.groupTeams.filter((x) => x.group_id === group.id),
      snap.matches.filter((m) => m.group_id === group.id && m.stage === 'group'),
      snap.tournament,
      (tid) => teamName(snap, tid) ?? tid,
    ).rows.find((r) => r.teamId === team.id)
    : undefined;

  return (
    <div>
      <BackLink />
      <section className="card flex items-center gap-4 p-4">
        <TeamBadge name={team.name} size="size-16" />
        <div className="min-w-0 flex-1">
          <h1 className="heading text-xl leading-tight">{team.name}</h1>
          <p className="mt-1 text-[13px] text-white/60">
            {category?.name}{group ? ` · Skupina ${group.name}` : ''}
          </p>
        </div>
        <StarButton teamId={team.id} className="size-11 [&_svg]:size-7" />
      </section>

      {row && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[['Mjesto', `${row.rank}.`], ['Bodovi', row.points], ['Golovi', `${row.goalsFor}:${row.goalsAgainst}`], ['Utakmice', row.played]].map(([l, v]) => (
            <div key={l} className="card py-2.5">
              <div className="heading text-xl">{v}</div>
              <div className="text-[11px] font-semibold text-white/55">{l}</div>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Utakmice</SectionTitle>
      {matches.length ? <div className="space-y-3">{matches.map((m) => <MatchCard key={m.id} match={m} />)}</div> : <Empty>Nema utakmica.</Empty>}

      <ShareButton className="mt-6" title={team.name} text={`${team.name} na turniru ${snap.tournament.name}`} url={absoluteUrl(`/t/${snap.tournament.slug}/momcad/${team.id}`)} />
    </div>
  );
}
