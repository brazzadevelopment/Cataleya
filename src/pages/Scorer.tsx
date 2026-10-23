import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button, Chip, Empty, Icon, LiveBadge, SectionTitle } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { MutationError, type ScorePatch } from '../lib/mutations';
import { dayShort, localDate } from '../lib/time';
import type { Match } from '../lib/types';
import { byTime, fieldName, hasScore, matchPhase, matchTime, sideLabel } from '../lib/view';

/** Popis utakmica na terenu zapisničara (organizator bira teren). */
export function ScorerList({ embedded = false }: { embedded?: boolean }) {
  const { snap, session, setSession } = useTournament();
  const base = `/t/${snap.tournament.slug}`;
  const [field, setField] = useState<string>(session?.fieldId ?? snap.fields[0]?.id ?? '');
  if (!session) return <Navigate to={`${base}/prijava`} replace />;

  const fieldId = session.role === 'field' ? session.fieldId! : field;
  const tz = snap.tournament.timezone;
  const today = localDate(new Date().toISOString(), tz);
  const matches = snap.matches.filter((m) => m.field_id === fieldId).sort(byTime);
  const open = matches.filter((m) => m.status === 'live' || m.status === 'scheduled');
  const done = matches.filter((m) => m.status === 'finished' || m.status === 'cancelled').reverse();

  return (
    <div>
      <div className={`flex items-center gap-2 ${embedded ? 'hidden' : ''}`}>
        <h1 className="heading text-lg">Zapisnik · {fieldName(snap, fieldId)}</h1>
        <Link to={`${base}/upute-zapisnicar`} className="ml-auto text-[12px] font-bold text-gold">Upute</Link>
        <button type="button" onClick={() => setSession(null)} className="inline-flex h-9 items-center gap-1 pl-2 text-[12px] font-bold text-white/55">
          <Icon name="logout" className="size-4" /> Odjava
        </button>
      </div>
      {session.role === 'admin' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {snap.fields.map((f) => <Chip key={f.id} active={f.id === fieldId} onClick={() => setField(f.id)}>{f.name}</Chip>)}
          {!embedded && <Link to={`${base}/admin`} className="ml-auto self-center text-[12px] font-bold text-gold">Uređivanje →</Link>}
        </div>
      )}

      <SectionTitle>Za upis</SectionTitle>
      {open.length ? (
        <div className="space-y-2">{open.map((m) => <ScorerRow key={m.id} m={m} today={today} />)}</div>
      ) : (
        <Empty>Na ovom terenu nema više zakazanih utakmica.</Empty>
      )}

      {done.length > 0 && (
        <>
          <SectionTitle>Završene</SectionTitle>
          <div className="space-y-2">{done.map((m) => <ScorerRow key={m.id} m={m} today={today} />)}</div>
        </>
      )}
    </div>
  );
}

function ScorerRow({ m, today }: { m: Match; today: string }) {
  const { snap } = useTournament();
  const day = m.starts_at ? localDate(m.starts_at, snap.tournament.timezone) : null;
  return (
    <Link to={`/t/${snap.tournament.slug}/zapisnik/${m.id}`} className={`card flex items-center gap-3 px-3.5 py-3 ${m.status === 'live' ? 'bloom-border' : ''}`}>
      <div className="w-14 shrink-0 text-[12px] font-bold leading-tight text-white/65">
        {m.status === 'live' ? <LiveBadge /> : <>{matchTime(snap, m)?.split(' – ')[0] ?? '—'}<br />{day && day !== today ? dayShort(day).split(' ')[0] : ''}</>}
      </div>
      <div className="min-w-0 flex-1 text-[14px] font-bold leading-snug">
        <div className="truncate">{sideLabel(snap, m, 'home').name}</div>
        <div className="truncate">{sideLabel(snap, m, 'away').name}</div>
      </div>
      <div className="text-right text-lg font-black tabular-nums">
        {hasScore(m) ? <>{m.home_score}<br />{m.away_score}</> : <Icon name="edit" className="size-5 text-gold" />}
      </div>
    </Link>
  );
}

/** Upis rezultata jedne utakmice: velike tipke + i −. */
export function ScoreEntry() {
  const { matchId } = useParams();
  const { snap, session, mutate, setSession } = useTournament();
  const base = `/t/${snap.tournament.slug}`;
  const m = snap.matches.find((x) => x.id === matchId);

  const [draft, setDraft] = useState<ScorePatch | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'warn' | 'error' } | null>(null);
  const [showPens, setShowPens] = useState(false);

  useEffect(() => {
    if (m) {
      setDraft({
        home_score: m.home_score, away_score: m.away_score, home_penalties: m.home_penalties, away_penalties: m.away_penalties, status: m.status,
        home_yellow: m.home_yellow ?? 0, away_yellow: m.away_yellow ?? 0, home_red: m.home_red ?? 0, away_red: m.away_red ?? 0,
      });
      if (m.home_penalties != null) setShowPens(true);
    }
    // Samo kod otvaranja; kasnije promjene stižu kroz save().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id]);

  if (!session) return <Navigate to={`${base}/prijava`} replace />;
  if (!m || !draft) return <Empty>Utakmica ne postoji.</Empty>;
  if (session.role === 'field' && m.field_id !== session.fieldId) {
    return <Empty>Ova utakmica nije na tvom terenu.</Empty>;
  }

  async function save(next: ScorePatch) {
    setDraft(next);
    setMsg(null);
    try {
      await mutate([{ type: 'score', matchId: m!.id, patch: next }]);
      setMsg({ text: 'Spremljeno', tone: 'ok' });
    } catch (e) {
      if (e instanceof MutationError && e.status === 0) setMsg({ text: e.message, tone: 'warn' });
      else if (e instanceof MutationError && e.status === 401) {
        setSession(null);
      } else setMsg({ text: e instanceof Error ? e.message : 'Spremanje nije uspjelo.', tone: 'error' });
    }
  }

  const home = sideLabel(snap, m, 'home');
  const away = sideLabel(snap, m, 'away');
  const started = draft.status === 'live' || draft.status === 'finished';
  const level = draft.home_score != null && draft.home_score === draft.away_score;
  const knockout = m.stage !== 'group';
  // Propozicije: neriješeno u drugom dijelu natjecanja odlučuju jedanaesterci.
  const needsPens = knockout && level && (draft.home_penalties == null || draft.home_penalties === draft.away_penalties);

  const card = (side: 'home' | 'away', color: 'yellow' | 'red', delta: number) => {
    const k = `${side}_${color}` as const;
    void save({ ...draft, [k]: Math.max(0, Math.min(29, (draft[k] ?? 0) + delta)) });
  };

  const bump = (side: 'home' | 'away', key: 'score' | 'penalties', delta: number) => {
    const k = `${side}_${key}` as const;
    const other = `${side === 'home' ? 'away' : 'home'}_${key}` as const;
    const value = Math.max(0, Math.min(99, (draft[k] ?? 0) + delta));
    void save({ ...draft, [k]: value, [other]: draft[other] ?? 0, status: draft.status === 'scheduled' ? 'live' : draft.status });
  };

  return (
    <div>
      <Link to={`${base}/zapisnik`} className="mb-2 inline-flex h-9 items-center gap-1 text-[13px] font-bold text-white/60">
        <Icon name="back" className="size-4" /> Sve utakmice
      </Link>
      <div className="text-center">
        <div className="text-[12px] font-extrabold tracking-[0.18em] text-gold uppercase">{matchPhase(snap, m)}</div>
        <div className="mt-1 text-[13px] text-white/60">{[matchTime(snap, m), fieldName(snap, m.field_id)].filter(Boolean).join(' · ')}</div>
        <div className="mt-2">{draft.status === 'live' ? <LiveBadge /> : <span className="text-[12px] font-bold text-white/55 uppercase">{{ scheduled: 'Nije počela', finished: 'Završena', cancelled: 'Otkazana', live: '' }[draft.status]}</span>}</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {(['home', 'away'] as const).map((side) => (
          <div key={side} className="card flex flex-col items-center px-2 pb-3 pt-4">
            <div className="line-clamp-2 min-h-10 text-center text-[15px] font-extrabold leading-tight">{(side === 'home' ? home : away).name}</div>
            <div className="heading my-2 text-[64px] leading-none tabular-nums">{draft[`${side}_score`] ?? 0}</div>
            <button
              type="button"
              onClick={() => bump(side, 'score', 1)}
              disabled={draft.status === 'finished' || draft.status === 'cancelled'}
              aria-label={`Gol za ${(side === 'home' ? home : away).name}`}
              className="grid h-20 w-full place-items-center rounded-2xl bg-gold text-pitch-950 transition active:scale-95 disabled:opacity-30"
            >
              <Icon name="plus" className="size-10" strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={() => bump(side, 'score', -1)}
              disabled={!draft[`${side}_score`] || draft.status === 'finished' || draft.status === 'cancelled'}
              aria-label="Poništi gol"
              className="mt-2 grid h-11 w-full place-items-center rounded-xl bg-white/8 ring-1 ring-white/12 transition active:scale-95 disabled:opacity-30"
            >
              <Icon name="minus" className="size-6" />
            </button>
          </div>
        ))}
      </div>

      {msg && (
        <p className={`mt-3 text-center text-[13px] font-bold ${msg.tone === 'ok' ? 'text-[#7ee2a8]' : msg.tone === 'warn' ? 'text-gold' : 'text-[#ff8197]'}`}>{msg.text}</p>
      )}

      {started && (
        <div className="card mt-4 p-3">
          <div className="mb-2 text-center text-[12px] font-extrabold tracking-wider text-white/60 uppercase">Kartoni</div>
          <div className="grid grid-cols-2 gap-3">
            {(['home', 'away'] as const).map((side) => (
              <div key={side} className="space-y-2">
                {(['yellow', 'red'] as const).map((color) => (
                  <div key={color} className="flex items-center justify-between gap-1">
                    <button type="button" onClick={() => card(side, color, -1)} disabled={!draft[`${side}_${color}`]} className="grid size-10 place-items-center rounded-xl bg-white/8 ring-1 ring-white/12 disabled:opacity-30" aria-label="Makni karton"><Icon name="minus" className="size-4" /></button>
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-block h-5 w-3.5 rounded-[3px] ${color === 'yellow' ? 'bg-[#ffd400]' : 'bg-live'}`} />
                      <span className="w-5 text-center text-lg font-black tabular-nums">{draft[`${side}_${color}`] ?? 0}</span>
                    </span>
                    <button type="button" onClick={() => card(side, color, 1)} className="grid size-10 place-items-center rounded-xl bg-white/8 ring-1 ring-white/12" aria-label={color === 'yellow' ? 'Žuti karton' : 'Crveni karton'}><Icon name="plus" className="size-4" /></button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {started && level && knockout && (
        <div className="card mt-4 p-3">
          {!showPens && !needsPens ? (
            <Button variant="ghost" className="w-full" onClick={() => setShowPens(true)}>Jedanaesterci</Button>
          ) : (
            <>
              <div className="mb-2 text-center text-[12px] font-extrabold tracking-wider text-gold uppercase">Jedanaesterci</div>
              <div className="grid grid-cols-2 gap-3">
                {(['home', 'away'] as const).map((side) => (
                  <div key={side} className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => bump(side, 'penalties', -1)} className="grid size-11 place-items-center rounded-xl bg-white/8 ring-1 ring-white/12" aria-label="Manje"><Icon name="minus" className="size-5" /></button>
                    <span className="heading text-3xl tabular-nums">{draft[`${side}_penalties`] ?? 0}</span>
                    <button type="button" onClick={() => bump(side, 'penalties', 1)} className="grid size-11 place-items-center rounded-xl bg-gold text-pitch-950" aria-label="Više"><Icon name="plus" className="size-5" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => { setShowPens(false); void save({ ...draft, home_penalties: null, away_penalties: null }); }} className="mt-3 w-full text-[12px] font-bold text-white/50">
                Makni jedanaesterce
              </button>
            </>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-2">
        {draft.status === 'scheduled' && (
          <Button onClick={() => save({ ...draft, home_score: draft.home_score ?? 0, away_score: draft.away_score ?? 0, status: 'live' })} className="h-14 text-base">
            Počni utakmicu
          </Button>
        )}
        {draft.status === 'live' && needsPens && (
          <p className="text-center text-[13px] font-bold text-gold">Neriješeno: upiši jedanaesterce, pa završi utakmicu.</p>
        )}
        {draft.status === 'live' && (
          <Button onClick={() => save({ ...draft, status: 'finished' })} disabled={needsPens} className="h-14 text-base">
            <Icon name="check" className="size-5" /> Kraj utakmice
          </Button>
        )}
        {draft.status === 'finished' && (
          <Button variant="ghost" onClick={() => save({ ...draft, status: 'live' })}>Ispravi rezultat</Button>
        )}
      </div>
    </div>
  );
}
