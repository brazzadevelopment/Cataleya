import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Emblem } from '../components/ui';
import { source } from '../data/source';
import { useTournament } from '../data/TournamentContext';
import { DEMO_PINS } from '../data/seed';

export function Login() {
  const { snap, session, setSession } = useTournament();
  const nav = useNavigate();
  const base = `/t/${snap.tournament.slug}`;
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await source.login(snap.tournament.id, pin);
      if (!s) {
        setError('PIN nije točan.');
        setPin('');
        return;
      }
      setSession(s);
      nav(s.role === 'admin' ? `${base}/admin` : `${base}/zapisnik`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prijava nije uspjela.');
    } finally {
      setBusy(false);
    }
  }

  if (session) {
    return (
      <div className="pt-10 text-center">
        <p className="text-white/70">Već si prijavljen kao {session.role === 'admin' ? 'organizator' : `zapisničar (${snap.fields.find((f) => f.id === session.fieldId)?.name})`}.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => nav(session.role === 'admin' ? `${base}/admin` : `${base}/zapisnik`)}>Nastavi</Button>
          <Button variant="ghost" onClick={() => setSession(null)}>Odjava</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xs pt-8 text-center">
      <Emblem className="mx-auto size-16" />
      <h1 className="heading mt-4 text-xl">Prijava</h1>
      <p className="mt-2 text-[13px] text-white/60">Za organizatora i zapisničare terena. Gledatelji ne trebaju prijavu.</p>
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="PIN"
        aria-label="PIN"
        className="mt-6 h-16 w-full rounded-2xl bg-white/8 text-center text-3xl font-black tracking-[0.5em] ring-1 ring-white/15 placeholder:tracking-normal placeholder:text-white/30"
      />
      {error && <p className="mt-3 text-sm font-bold text-[#ff8197]">{error}</p>}
      <Button type="submit" disabled={pin.length < 4 || busy} className="mt-4 w-full">{busy ? 'Provjeravam…' : 'Uđi'}</Button>
      {source.mode === 'demo' && (
        <p className="mt-6 text-[12px] leading-relaxed text-white/45">
          Demo PIN-ovi: organizator 9000
          {snap.fields.map((f) => <span key={f.id}> · {f.name} {DEMO_PINS.fields[f.id]}</span>)}
        </p>
      )}
    </form>
  );
}
