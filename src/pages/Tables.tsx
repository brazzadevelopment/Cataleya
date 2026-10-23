import { Link } from 'react-router-dom';
import { Empty, SectionTitle } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { parseSource } from '../lib/advancement';
import { computeGroupTable } from '../lib/standings';
import { teamName } from '../lib/view';

export function Tables() {
  const { snap, categoryId, favorites } = useTournament();
  const groups = snap.groups.filter((g) => g.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const base = `/t/${snap.tournament.slug}`;

  // Mjesta koja vode dalje, iz pravila koja je upisao organizator (npr. '1A', '2B').
  const advancing = new Set(
    snap.matches
      .filter((m) => m.category_id === categoryId)
      .flatMap((m) => [m.home_source, m.away_source])
      .map(parseSource)
      .filter((s) => s?.kind === 'group')
      .map((s) => s!.kind === 'group' && `${s!.position}${s!.group}`),
  );

  if (!groups.length) return <Empty>Skupine još nisu upisane.</Empty>;

  return (
    <div>
      {groups.map((g) => {
        const table = computeGroupTable(
          snap.groupTeams.filter((gt) => gt.group_id === g.id),
          snap.matches.filter((m) => m.group_id === g.id && m.stage === 'group'),
          snap.tournament,
          (id) => teamName(snap, id) ?? id,
        );
        return (
          <section key={g.id}>
            <SectionTitle>Skupina {g.name}</SectionTitle>
            <div className="card overflow-hidden">
              <table className="w-full text-[13px] tabular-nums">
                <thead className="text-[11px] font-bold text-white/50 uppercase">
                  <tr className="border-b border-line">
                    <th className="w-9 py-2 pl-3 text-left">#</th>
                    <th className="py-2 text-left">Momčad</th>
                    <th className="w-6 text-center">U</th>
                    <th className="w-6 text-center">P</th>
                    <th className="w-6 text-center">N</th>
                    <th className="w-6 text-center">I</th>
                    <th className="w-9 text-center">GR</th>
                    <th className="w-8 pr-3 text-right">B</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r, i) => {
                    const goesOn = advancing.has(`${r.rank}${g.name}`) && !r.needsLot;
                    return (
                      <tr key={r.teamId} className={`border-b border-line last:border-0 ${favorites.has(r.teamId) ? 'bg-gold/8' : ''}`}>
                        <td className="py-2.5 pl-3">
                          <span className={`grid size-6 place-items-center rounded-md text-[12px] font-extrabold ${goesOn ? 'bg-gold text-pitch-950' : 'text-white/60'}`}>
                            {table.rows.some((x) => x.played) ? r.rank : i + 1}
                          </span>
                        </td>
                        <td className="py-2 pr-1">
                          <Link to={`${base}/momcad/${r.teamId}`} className="flex items-center gap-1">
                            <span className="text-[13.5px] leading-tight font-bold">{teamName(snap, r.teamId)}</span>
                            {r.needsLot && table.complete && <span className="shrink-0 text-gold" title="Potreban ždrijeb">*</span>}
                          </Link>
                        </td>
                        <td className="text-center text-white/70">{r.played}</td>
                        <td className="text-center text-white/70">{r.won}</td>
                        <td className="text-center text-white/70">{r.drawn}</td>
                        <td className="text-center text-white/70">{r.lost}</td>
                        <td className="text-center text-white/70">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                        <td className="pr-3 text-right text-[15px] font-black">{r.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {table.complete && table.needsLot && (
              <p className="mt-2 text-[12px] text-gold">* Momčadi su potpuno izjednačene. Redoslijed određuje organizator ždrijebom.</p>
            )}
          </section>
        );
      })}
      <p className="mt-6 text-[12px] leading-relaxed text-white/50">
        U utakmice, P pobjede, N neriješeno, I izgubljene, GR gol-razlika, B bodovi
        ({snap.tournament.points_win} / {snap.tournament.points_draw} / {snap.tournament.points_loss}).
        Žuto označena mjesta vode u sljedeću fazu.
      </p>
    </div>
  );
}
