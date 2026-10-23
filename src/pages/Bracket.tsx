import { Link } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { Empty, Icon, LiveBadge, SectionTitle, TeamBadge } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { finalRanking, matchOutcome } from '../lib/advancement';
import type { Match, MatchStage } from '../lib/types';
import { byTime, fieldName, matchTime, sideLabel, STAGE_LABEL, teamName } from '../lib/view';

const ROUNDS: MatchStage[] = ['round_of_16', 'quarterfinal', 'semifinal', 'final'];
const SLOT = 92; // visina jednog mjesta u prvom stupcu (px)

export function Bracket() {
  const { snap, categoryId } = useTournament();
  const ko = snap.matches.filter((m) => m.category_id === categoryId && m.stage !== 'group').sort(byTime);
  if (!ko.length) {
    return <Empty>Utakmice nastavka još nisu upisane. Organizator ih dodaje kad bude poznat raspored.</Empty>;
  }
  const brackets = [...new Set(ko.map((m) => m.bracket ?? ''))].sort();
  return (
    <div>
      {brackets.map((b) => (
        <BracketSection key={b || 'none'} title={b ? `${b} turnir` : 'Ždrijeb'} matches={ko.filter((m) => (m.bracket ?? '') === b)} />
      ))}
    </div>
  );
}

function BracketSection({ title, matches: ko }: { title: string; matches: Match[] }) {
  const byCode = (a: Match, b: Match) => (a.code ?? '').localeCompare(b.code ?? '', 'hr', { numeric: true });
  const columns = ROUNDS.map((stage) => ({ stage, matches: ko.filter((m) => m.stage === stage).sort(byCode) })).filter((c) => c.matches.length);
  const third = ko.filter((m) => m.stage === 'third_place');
  const placement = ko.filter((m) => m.stage === 'placement');
  const height = Math.max(1, ...columns.map((c) => c.matches.length)) * SLOT;

  return (
    <section>
      {columns.length > 0 && (
        <>
          <SectionTitle>{title}</SectionTitle>
          <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2">
            <div className="flex gap-0" style={{ minHeight: height + 28 }}>
              {columns.map((col, ci) => (
                <div key={col.stage} className={`flex shrink-0 flex-col ${columns.length === 1 ? "w-full" : "w-[196px]"}`}>
                  <div className="mb-2 h-5 text-center text-[11px] font-extrabold tracking-wider text-gold uppercase">
                    {STAGE_LABEL[col.stage]}
                  </div>
                  <div className="flex flex-1 flex-col justify-around" style={{ height }}>
                    {col.matches.map((m) => (
                      <div key={m.id} className="relative flex items-center">
                        {ci > 0 && <span className="absolute -left-3 top-1/2 h-px w-3 bg-gold/40" />}
                        <BracketNode match={m} />
                        {ci < columns.length - 1 && <span className="absolute -right-3 top-1/2 h-px w-3 bg-gold/40" />}
                      </div>
                    ))}
                  </div>
                </div>
              )).flatMap((el, i) => (i === 0 ? [el] : [<div key={`gap-${i}`} className="w-6 shrink-0" />, el]))}
            </div>
          </div>
          {columns.length > 1 && <p className="mt-1 text-[11px] text-white/45">Povuci vodoravno za sljedeće krugove.</p>}
        </>
      )}

      {third.length > 0 && (
        <>
          <SectionTitle>{title} · za 3. mjesto</SectionTitle>
          <div className="space-y-3">{third.map((m) => <MatchCard key={m.id} match={m} showPhase={false} />)}</div>
        </>
      )}

      {placement.length > 0 && (
        <>
          <SectionTitle>{title} · za plasman</SectionTitle>
          <div className="space-y-3">{placement.map((m) => <MatchCard key={m.id} match={m} />)}</div>
        </>
      )}
    </section>
  );
}

function BracketNode({ match: m }: { match: Match }) {
  const { snap } = useTournament();
  const o = matchOutcome(m);
  const time = matchTime(snap, m);
  const field = fieldName(snap, m.field_id);
  const sides = (['home', 'away'] as const).map((side) => {
    const id = side === 'home' ? m.home_team_id : m.away_team_id;
    return {
      side, id, label: sideLabel(snap, m, side),
      score: side === 'home' ? m.home_score : m.away_score,
      pen: side === 'home' ? m.home_penalties : m.away_penalties,
      won: !!o && o.winner === id,
      lost: !!o && o.loser === id,
    };
  });
  return (
    <Link to={`/t/${snap.tournament.slug}/utakmica/${m.id}`} className={`card block w-full overflow-hidden ${m.status === 'live' ? 'bloom-border' : ''}`}>
      <div className="flex items-center justify-between gap-1 px-2.5 pt-1.5 text-[10px] font-bold text-white/55">
        <span className="text-gold/90">{m.code}</span>
        {m.status === 'live' ? <LiveBadge /> : <span className="truncate">{[time?.split(' – ')[0], field].filter(Boolean).join(' · ')}</span>}
      </div>
      {sides.map((s) => (
        <div key={s.side} className={`flex items-center gap-1.5 px-2.5 py-1 ${s.lost ? 'opacity-50' : ''}`}>
          <span className={`min-w-0 flex-1 truncate text-[13px] ${s.label.known ? 'font-bold' : 'italic text-white/55'} ${s.won ? 'text-gold' : ''}`}>
            {s.label.name}
          </span>
          {s.pen != null && <span className="text-[10px] text-white/50">({s.pen})</span>}
          <span className="w-4 text-right text-[14px] font-black tabular-nums">{s.score ?? ''}</span>
        </div>
      ))}
    </Link>
  );
}

export function FinalStandings() {
  const { snap, categoryId } = useTournament();
  const places = finalRanking(snap.matches.filter((m) => m.category_id === categoryId));
  return (
    <div>
      <SectionTitle>Konačni poredak</SectionTitle>
      {places.length === 0 ? (
        <Empty>Poredak će se pojaviti kad se odigraju utakmice za plasman.</Empty>
      ) : (
        <>
          <Podium places={places.filter((p) => p.place <= 3).map((p) => ({ place: p.place, name: teamName(snap, p.teamId) ?? '' }))} />
          <div className="card mt-4 divide-y divide-line">
            {places.map((p) => (
              <div key={`${p.place}-${p.teamId}`} className="flex items-center gap-3 px-4 py-3">
                <span className={`heading w-9 text-lg ${p.place <= 3 ? 'text-gold' : 'text-white/60'}`}>{p.place}.</span>
                <TeamBadge name={teamName(snap, p.teamId) ?? '?'} />
                <span className="font-bold">{teamName(snap, p.teamId)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Podium({ places }: { places: { place: number; name: string }[] }) {
  if (!places.length) return null;
  const order = [2, 1, 3];
  const heights: Record<number, string> = { 1: 'h-28', 2: 'h-20', 3: 'h-14' };
  return (
    <div className="grid grid-cols-3 items-end gap-2 pt-4">
      {order.map((pl) => {
        const p = places.find((x) => x.place === pl);
        return (
          <div key={pl} className="flex flex-col items-center text-center">
            {pl === 1 && <Icon name="trophy" className="mb-1 size-8 text-gold" />}
            <span className="mb-2 line-clamp-2 min-h-8 text-[12px] font-bold leading-tight">{p?.name ?? ''}</span>
            <div className={`${heights[pl]} heading grid w-full place-items-center rounded-t-xl text-2xl ${pl === 1 ? 'bg-gold text-pitch-950' : 'bg-white/12'}`}>
              {pl}.
            </div>
          </div>
        );
      })}
    </div>
  );
}
