import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Chip, Icon } from '../components/ui';
import { source } from '../data/source';
import { useTournament } from '../data/TournamentContext';
import { ScorerList } from '../pages/Scorer';
import { KnockoutTab } from './KnockoutTab';
import { PinsTab } from './PinsTab';
import { ScheduleTab } from './ScheduleTab';
import { TeamsTab } from './TeamsTab';
import { TournamentTab } from './TournamentTab';

const TABS = [
  ['rezultati', 'Rezultati'],
  ['raspored', 'Raspored'],
  ['nastavak', 'Nastavak'],
  ['momcadi', 'Momčadi'],
  ['turnir', 'Turnir'],
  ['pin', 'Tereni i PIN'],
] as const;

type Tab = (typeof TABS)[number][0];

export function Admin() {
  const { snap, session, setSession } = useTournament();
  const base = `/t/${snap.tournament.slug}`;
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('turnir.admin.tab') as Tab) || 'rezultati');
  if (!session) return <Navigate to={`${base}/prijava`} replace />;
  if (session.role !== 'admin') return <Navigate to={`${base}/zapisnik`} replace />;

  const choose = (t: Tab) => {
    setTab(t);
    try { sessionStorage.setItem('turnir.admin.tab', t); } catch { /* nije bitno */ }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="heading text-lg">Uređivanje</h1>
        <Link to={base} className="ml-auto text-[12px] font-bold text-white/55">Pogled gledatelja</Link>
        <button type="button" onClick={() => setSession(null)} className="inline-flex h-9 items-center gap-1 pl-2 text-[12px] font-bold text-white/55">
          <Icon name="logout" className="size-4" /> Odjava
        </button>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map(([k, l]) => <Chip key={k} active={tab === k} onClick={() => choose(k)}>{l}</Chip>)}
      </div>

      <div className="mt-2">
        {tab === 'rezultati' && <ScorerList embedded />}
        {tab === 'raspored' && <ScheduleTab />}
        {tab === 'nastavak' && <KnockoutTab />}
        {tab === 'momcadi' && <TeamsTab />}
        {tab === 'turnir' && <TournamentTab />}
        {tab === 'pin' && <PinsTab />}
      </div>

      {source.mode === 'demo' && <DemoTools />}
    </div>
  );
}


function DemoTools() {
  const { reload } = useTournament();
  return (
    <div className="card mt-10 border-bloom-violet/40 p-4">
      <h2 className="heading text-sm text-bloom-cyan">Demo</h2>
      <p className="mt-1 text-[12px] text-white/60">Samo za isprobavanje. Podaci su spremljeni samo u ovom pregledniku.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="h-10 rounded-xl bg-white/8 px-3 text-[13px] font-bold ring-1 ring-white/12" onClick={async () => { source.fillDemoResults?.(); await reload(); }}>
          Izmisli rezultate skupina
        </button>
        <button type="button" className="h-10 rounded-xl bg-white/8 px-3 text-[13px] font-bold ring-1 ring-white/12" onClick={async () => { if (confirm('Vratiti početne podatke?')) { source.reset?.(); await reload(); } }}>
          Vrati početno stanje
        </button>
      </div>
    </div>
  );
}
