import { Link } from 'react-router-dom';
import { useTournament } from '../data/TournamentContext';
import type { Match } from '../lib/types';
import { matchOutcome } from '../lib/advancement';
import { fieldName, hasScore, matchPhase, matchTime, sideLabel, type SideLabel } from '../lib/view';
import { LiveBadge, StarButton, TeamBadge } from './ui';

export function MatchCard({ match: m, showPhase = true }: { match: Match; showPhase?: boolean }) {
  const { snap, favorites } = useTournament();
  const home = sideLabel(snap, m, 'home');
  const away = sideLabel(snap, m, 'away');
  const time = matchTime(snap, m);
  const field = fieldName(snap, m.field_id);
  const scored = hasScore(m);
  const outcome = matchOutcome(m);
  const live = m.status === 'live';
  const fav = (m.home_team_id && favorites.has(m.home_team_id)) || (m.away_team_id && favorites.has(m.away_team_id));

  return (
    <Link
      to={`/t/${snap.tournament.slug}/utakmica/${m.id}`}
      className={`card block overflow-hidden transition active:scale-[0.99] ${live ? 'bloom-border' : ''} ${fav && !live ? 'ring-1 ring-gold/50' : ''}`}
    >
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2 text-[12px] font-semibold text-white/65">
        {live ? <LiveBadge /> : <span className="font-extrabold text-white/90 tabular-nums">{time ?? 'Termin nije poznat'}</span>}
        {live && time && <span className="tabular-nums">{time}</span>}
        {field && <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-white/80">{field}</span>}
        {showPhase && <span className="ml-auto truncate text-gold/90">{matchPhase(snap, m)}</span>}
        {m.status === 'cancelled' && <span className="ml-auto text-live">Otkazano</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-3.5 py-2.5">
        <TeamRow label={home} teamId={m.home_team_id} winner={outcome?.winner === m.home_team_id} />
        <Score value={m.home_score} pen={m.home_penalties} show={scored} strong={outcome?.winner === m.home_team_id} live={live} />
        <TeamRow label={away} teamId={m.away_team_id} winner={outcome?.winner === m.away_team_id} />
        <Score value={m.away_score} pen={m.away_penalties} show={scored} strong={outcome?.winner === m.away_team_id} live={live} />
      </div>
    </Link>
  );
}

function TeamRow({ label, teamId, winner }: { label: SideLabel; teamId: string | null; winner: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-1">
      {label.known ? <TeamBadge name={label.name} size="size-7" /> : <span className="size-7 shrink-0 rounded-full border border-dashed border-white/25" />}
      <span className={`min-w-0 truncate text-[15px] ${label.known ? 'font-bold' : 'font-semibold italic text-white/55'} ${winner ? 'text-white' : ''}`}>
        {label.name}
        {label.provisional && (
          <span className="block truncate text-[13px] font-bold not-italic text-white/80">
            {label.provisional} <span className="font-semibold text-white/45">· trenutno, nije konačno</span>
          </span>
        )}
      </span>
      {teamId && <StarButton teamId={teamId} className="-my-1 ml-auto size-8" />}
    </div>
  );
}

function Score({ value, pen, show, strong, live }: { value: number | null; pen: number | null; show: boolean; strong: boolean; live: boolean }) {
  if (!show) return <span className="w-8 text-center text-white/25">–</span>;
  return (
    <span className="flex w-8 items-baseline justify-end gap-1 tabular-nums">
      {pen != null && <span className="text-[11px] font-bold text-white/50">({pen})</span>}
      <span className={`text-xl font-black ${live ? 'text-white' : strong ? 'text-gold' : 'text-white/85'}`}>{value}</span>
    </span>
  );
}
