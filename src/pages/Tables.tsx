import { Link } from 'react-router-dom';
import { Empty, SectionTitle } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { parseSource } from '../lib/advancement';
import { computeGroupTable, rankAcrossGroups } from '../lib/standings';
import { teamName } from '../lib/view';

export function Tables() {
  const { snap, categoryId, favorites } = useTournament();
  const groups = snap.groups.filter((g) => g.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const base = `/t/${snap.tournament.slug}`;

  // Mjesta koja vode dalje, iz pravila koja je upisao organizator:
  // '1A' → turnir u koji ide 1. iz A; '2#6' → turnir u koji ide 6. najbolji drugi.
  const advancing = new Map<string, string>();
  const bestPositions = new Set<number>();
  for (const m of snap.matches.filter((x) => x.category_id === categoryId)) {
    for (const raw of [m.home_source, m.away_source]) {
      const src = parseSource(raw);
      if (src?.kind === 'group') advancing.set(`${src.position}${src.group}`, m.bracket ?? '');
      if (src?.kind === 'best') {
        advancing.set(`${src.position}#${src.nth}`, m.bracket ?? '');
        bestPositions.add(src.position);
      }
    }
  }
  const tables = groups.map((g) => ({
    g,
    table: computeGroupTable(
      snap.groupTeams.filter((gt) => gt.group_id === g.id),
      snap.matches.filter((m) => m.group_id === g.id && m.stage === 'group'),
      snap.tournament,
      (id) => teamName(snap, id) ?? id,
    ),
  }));

  if (!groups.length) return <Empty>Skupine još nisu upisane.</Empty>;

  return (
    <div>
      {tables.map(({ g, table }) => {
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
                    const goesTo = !r.needsLot ? advancing.get(`${r.rank}${g.name}`) : undefined;
                    return (
                      <tr key={r.teamId} className={`border-b border-line last:border-0 ${favorites.has(r.teamId) ? 'bg-gold/8' : ''}`}>
                        <td className="py-2.5 pl-3">
                          <span className={`grid size-6 place-items-center rounded-md text-[12px] font-extrabold ${bracketBadge(goesTo)}`}>
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
      {[...bestPositions].sort().map((pos) => (
        <CrossSection key={pos} position={pos} tables={tables.map(({ g, table }) => ({ groupName: g.name, table }))} advancing={advancing} />
      ))}

      <p className="mt-6 text-[12px] leading-relaxed text-white/50">
        U utakmice, P pobjede, N neriješeno, I izgubljene, GR gol-razlika, B bodovi
        ({snap.tournament.points_win} / {snap.tournament.points_draw} / {snap.tournament.points_loss}).
        {hasB(advancing) ? 'Žuto označena mjesta vode u A turnir, tirkizno u B turnir.' : 'Žuto označena mjesta vode u sljedeću fazu.'}
      </p>
    </div>
  );
}

const PLACED_PLURAL = ['', 'Prvoplasirani', 'Drugoplasirani', 'Trećeplasirani', 'Četvrtoplasirani'];

function bracketBadge(bracket: string | undefined): string {
  if (bracket === undefined) return 'text-white/60';
  if (bracket === 'B') return 'bg-bloom-cyan text-pitch-950';
  return 'bg-gold text-pitch-950';
}

function hasB(advancing: Map<string, string>): boolean {
  return [...advancing.values()].includes('B');
}

/** Poredak momčadi s istog mjesta iz svih skupina, npr. tko su najbolji drugoplasirani. */
function CrossSection({ position, tables, advancing }: {
  position: number;
  tables: Parameters<typeof rankAcrossGroups>[0];
  advancing: Map<string, string>;
}) {
  const { snap, favorites } = useTournament();
  const cross = rankAcrossGroups(tables, position, snap.tournament);
  const base = `/t/${snap.tournament.slug}`;
  if (!cross.rows.length) return null;
  return (
    <section>
      <SectionTitle>{PLACED_PLURAL[position] ?? `${position}. mjesto`}</SectionTitle>
      <div className="card overflow-hidden">
        <table className="w-full text-[13px] tabular-nums">
          <thead className="text-[11px] font-bold text-white/50 uppercase">
            <tr className="border-b border-line">
              <th className="w-9 py-2 pl-3 text-left">#</th>
              <th className="py-2 text-left">Momčad</th>
              <th className="w-8 text-center">Sk.</th>
              <th className="w-9 text-center">GR</th>
              <th className="w-8 text-center">G</th>
              <th className="w-8 pr-3 text-right">B</th>
            </tr>
          </thead>
          <tbody>
            {cross.rows.map((r) => {
              const tie = cross.rows.filter((x) => x.crossRank === r.crossRank).length > 1;
              const goesTo = cross.complete && !tie ? advancing.get(`${position}#${r.crossRank}`) : undefined;
              return (
                <tr key={r.teamId} className={`border-b border-line last:border-0 ${favorites.has(r.teamId) ? 'bg-gold/8' : ''}`}>
                  <td className="py-2 pl-3">
                    <span className={`grid size-6 place-items-center rounded-md text-[12px] font-extrabold ${bracketBadge(goesTo)}`}>{r.crossRank}</span>
                  </td>
                  <td className="py-2 pr-1">
                    <Link to={`${base}/momcad/${r.teamId}`} className="text-[13.5px] leading-tight font-bold">{teamName(snap, r.teamId)}</Link>
                    {tie && cross.complete && <span className="text-gold"> *</span>}
                  </td>
                  <td className="text-center text-white/70">{r.groupName}</td>
                  <td className="text-center text-white/70">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                  <td className="text-center text-white/70">{r.goalsFor}</td>
                  <td className="pr-3 text-right text-[15px] font-black">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-white/50">
        {cross.complete ? 'Konačno.' : 'Privremeno, dok se ne odigraju sve skupine.'} Uspoređuju se bodovi, gol-razlika, postignuti i primljeni golovi te kartoni.
      </p>
    </section>
  );
}
