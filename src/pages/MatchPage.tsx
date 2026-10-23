import { Link, useParams } from 'react-router-dom';
import { absoluteUrl, ShareButton } from '../components/Share';
import { Empty, Icon, LiveBadge, StarButton, TeamBadge } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { matchOutcome } from '../lib/advancement';
import { dayLabel } from '../lib/time';
import { hasScore, matchDay, matchPhase, matchTime, sideLabel, type SideLabel } from '../lib/view';

export function MatchPage() {
  const { id } = useParams();
  const { snap, session } = useTournament();
  const m = snap.matches.find((x) => x.id === id);
  const base = `/t/${snap.tournament.slug}`;
  if (!m) return <Empty>Utakmica ne postoji.</Empty>;

  const home = sideLabel(snap, m, 'home');
  const away = sideLabel(snap, m, 'away');
  const field = snap.fields.find((f) => f.id === m.field_id);
  const day = matchDay(snap, m);
  const o = matchOutcome(m);
  const canEdit = session && (session.role === 'admin' || session.fieldId === m.field_id);
  const statusText = { scheduled: 'Zakazano', live: '', finished: 'Kraj', cancelled: 'Otkazano' }[m.status];

  return (
    <div>
      <BackLink />
      <section className={`card relative overflow-hidden px-4 pb-5 pt-4 text-center ${m.status === 'live' ? 'bloom-border' : ''}`}>
        <div className="text-[12px] font-extrabold tracking-[0.18em] text-gold uppercase">{matchPhase(snap, m)}</div>
        <div className="mt-1 text-[13px] text-white/65">
          {day ? `${dayLabel(day)} · ${matchTime(snap, m)}` : 'Termin još nije poznat'}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <Side label={home} teamId={m.home_team_id} winner={o?.winner === m.home_team_id} />
          <div className="pt-2">
            {hasScore(m) ? (
              <div className="heading text-[44px] leading-none tabular-nums">
                {m.home_score}<span className="mx-1 text-white/40">:</span>{m.away_score}
              </div>
            ) : (
              <div className="heading pt-2 text-2xl text-white/35">vs</div>
            )}
            {m.home_penalties != null && (
              <div className="mt-1 text-[12px] font-bold text-white/70">jedanaesterci {m.home_penalties}:{m.away_penalties}</div>
            )}
            <div className="mt-2">{m.status === 'live' ? <LiveBadge /> : <span className="text-[12px] font-bold text-white/55 uppercase">{statusText}</span>}</div>
          </div>
          <Side label={away} teamId={m.away_team_id} winner={o?.winner === m.away_team_id} />
        </div>
      </section>

      <div className="card mt-3 divide-y divide-line text-[14px]">
        <Row icon="pin" label="Teren">
          {field ? (
            field.maps_url ? <a href={field.maps_url} target="_blank" rel="noreferrer" className="font-bold text-gold underline-offset-2 hover:underline">{field.name} · karta</a> : <b>{field.name}</b>
          ) : 'Još nije određen'}
        </Row>
        <Row icon="info" label="Mjesto"><b>{field?.venue ?? snap.tournament.place}</b></Row>
        {(m.home_yellow + m.home_red + m.away_yellow + m.away_red > 0) && (
          <Row icon="edit" label="Kartoni">
            <span className="font-bold">{cardText(m.home_yellow, m.home_red)} : {cardText(m.away_yellow, m.away_red)}</span>
          </Row>
        )}
      </div>

      <ShareButton
        className="mt-4"
        title={`${home.name} – ${away.name}`}
        text={`${snap.tournament.name}: ${home.name} – ${away.name}${hasScore(m) ? ` ${m.home_score}:${m.away_score}` : ''}`}
        url={absoluteUrl(`${base}/utakmica/${m.id}`)}
      />

      {canEdit && (
        <Link to={`${base}/zapisnik/${m.id}`} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/8 text-sm font-extrabold ring-1 ring-white/12">
          <Icon name="whistle" className="size-4" /> Upiši rezultat
        </Link>
      )}
    </div>
  );
}

function Side({ label, teamId, winner }: { label: SideLabel; teamId: string | null; winner: boolean }) {
  const { snap } = useTournament();
  const inner = (
    <div className="flex flex-col items-center gap-2">
      {label.known ? <TeamBadge name={label.name} size="size-14" /> : <span className="size-14 rounded-full border-2 border-dashed border-white/25" />}
      <span className={`text-[14px] leading-tight ${label.known ? 'font-extrabold' : 'italic text-white/55'} ${winner ? 'text-gold' : ''}`}>{label.name}</span>
      {label.provisional && (
        <span className="text-[13px] font-bold leading-tight">
          {label.provisional}
          <span className="block text-[11px] font-semibold text-white/45">trenutno, nije konačno</span>
        </span>
      )}
    </div>
  );
  return (
    <div className="flex flex-col items-center">
      {teamId ? <Link to={`/t/${snap.tournament.slug}/momcad/${teamId}`}>{inner}</Link> : inner}
      {teamId && <StarButton teamId={teamId} />}
    </div>
  );
}

function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon name={icon} className="size-5 text-white/45" />
      <span className="w-16 text-white/55">{label}</span>
      <span className="min-w-0 flex-1 text-right">{children}</span>
    </div>
  );
}

export function BackLink() {
  return (
    <button type="button" onClick={() => history.back()} className="mb-2 inline-flex h-9 items-center gap-1 text-[13px] font-bold text-white/60">
      <Icon name="back" className="size-4" /> Natrag
    </button>
  );
}

function cardText(yellow: number, red: number): string {
  const parts = [yellow ? `${yellow} ž` : '', red ? `${red} c` : ''].filter(Boolean);
  return parts.join(' ') || '0';
}
