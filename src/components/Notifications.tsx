import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../data/TournamentContext';
import { ALL_EVENTS, disablePush, enablePush, isIos, pushSupport, readPrefs, syncPush, wrongBrowser, type PushEvent } from '../lib/push';
import { BrowserWarning } from './BrowserWarning';
import { Button, Icon } from './ui';

const CHOICES: { label: string; events: PushEvent[] }[] = [
  { label: 'Golovi', events: ['goal'] },
  { label: 'Početak i kraj utakmice', events: ['start', 'end'] },
  { label: 'Kartoni', events: ['card'] },
];

/** Uključivanje i isključivanje obavijesti za omiljene momčadi. */
export function NotificationsCard() {
  const { snap, favorites } = useTournament();
  const tid = snap.tournament.id;
  const guide = `/t/${snap.tournament.slug}/obavijesti`;
  const [prefs, setPrefs] = useState(() => readPrefs(tid));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const support = pushSupport();
  const denied = support === 'ok' && Notification.permission === 'denied';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setPrefs(readPrefs(tid));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Nije uspjelo. Pokušaj ponovno.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (events: PushEvent[]) => {
    const on = events.every((e) => prefs.events.includes(e));
    const next = on ? prefs.events.filter((e) => !events.includes(e)) : [...new Set([...prefs.events, ...events])];
    void run(() => syncPush(tid, [...favorites], next));
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2.5">
        <Icon name={prefs.enabled ? 'bell' : 'bell-off'} className={`size-6 ${prefs.enabled ? 'text-gold' : 'text-white/50'}`} />
        <div className="flex-1">
          <div className="font-extrabold">Obavijesti na mobitel</div>
          <div className="text-[12px] text-white/60">
            {prefs.enabled ? `Uključene za ${favorites.size} ${favorites.size === 1 ? 'momčad' : 'momčadi'}` : 'Gol, početak, kraj i kartoni tvojih momčadi'}
          </div>
        </div>
      </div>

      {wrongBrowser() && <BrowserWarning />}

      {support === 'demo' && <p className="mt-3 text-[13px] text-white/65">U demo načinu obavijesti ne rade.</p>}

      {support === 'install' && (
        <div className="mt-3 text-[13px] leading-relaxed text-white/75">
          Na iPhoneu obavijesti rade samo kad je aplikacija dodana na početni zaslon.
          <Link to={guide} className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-extrabold text-pitch-950">
            Pokaži mi kako (video)
          </Link>
        </div>
      )}

      {support === 'unsupported' && (
        <p className="mt-3 text-[13px] leading-relaxed text-white/65">
          Ovaj preglednik ne podržava obavijesti. {isIos() ? 'Otvori stranicu u Safariju i dodaj je na početni zaslon.' : 'Otvori stranicu u Chromeu.'}{' '}
          <Link to={guide} className="font-bold text-gold">Upute</Link>
        </p>
      )}

      {support === 'ok' && denied && (
        <p className="mt-3 text-[13px] leading-relaxed text-white/75">
          Obavijesti su blokirane na ovom mobitelu. Uključi ih u postavkama: {isIos() ? 'Postavke → Obavijesti → Cataleya Cup' : 'dodirni lokot pokraj adrese → Dopuštenja → Obavijesti'}, pa se vrati ovdje.
        </p>
      )}

      {support === 'ok' && !denied && !prefs.enabled && (
        <div className="mt-3">
          {favorites.size === 0 ? (
            <p className="text-[13px] text-white/70">
              Prvo označi svoju momčad zvjezdicom <Icon name="star" className="inline size-4 -translate-y-px text-gold" />.
            </p>
          ) : (
            <Button className="w-full" disabled={busy} onClick={() => void run(() => enablePush(tid, [...favorites], prefs.events.length ? prefs.events : ALL_EVENTS))}>
              <Icon name="bell" className="size-5" /> {busy ? 'Uključujem…' : 'Uključi obavijesti'}
            </Button>
          )}
          <p className="mt-2 text-[12px] text-white/50">Mobitel će pitati smiješ li slati obavijesti. Dodirni „Dopusti”.</p>
        </div>
      )}

      {support === 'ok' && !denied && prefs.enabled && (
        <div className="mt-3 space-y-2">
          {CHOICES.map((c) => {
            const on = c.events.every((e) => prefs.events.includes(e));
            return (
              <button key={c.label} type="button" disabled={busy} onClick={() => toggle(c.events)}
                className="flex w-full items-center justify-between rounded-xl bg-white/6 px-3 py-2.5 text-left text-[14px] font-semibold">
                {c.label}
                <span className={`relative h-6 w-10 rounded-full transition ${on ? 'bg-gold' : 'bg-white/20'}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
            );
          })}
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void run(() => disablePush(tid))}>
            <Icon name="bell-off" className="size-5" /> Isključi obavijesti
          </Button>
        </div>
      )}

      {msg && <p className="mt-3 text-[13px] text-[#ff8197]">{msg}</p>}
      {support !== 'install' && (
        <Link to={guide} className="mt-3 block text-center text-[12px] font-bold text-gold">Kako to radi i video upute</Link>
      )}
    </div>
  );
}

/** Kratki poziv na početnoj, dok obavijesti nisu uključene. */
export function NotifyBanner() {
  const { snap, favorites } = useTournament();
  const prefs = readPrefs(snap.tournament.id);
  if (prefs.enabled || pushSupport() === 'demo' || pushSupport() === 'unsupported') return null;
  return (
    <Link to={`/t/${snap.tournament.slug}/obavijesti`} className="card mt-4 flex items-center gap-3 px-4 py-3">
      <Icon name="bell" className="size-6 shrink-0 text-gold" />
      <span className="flex-1 text-[14px] leading-snug">
        <b>Obavijest za svaki gol</b>
        <span className="block text-[12px] text-white/60">
          {favorites.size ? 'Uključi obavijesti za svoje momčadi' : 'Označi momčad zvjezdicom i uključi obavijesti'}
        </span>
      </span>
      <Icon name="back" className="size-4 rotate-180 text-white/40" />
    </Link>
  );
}
