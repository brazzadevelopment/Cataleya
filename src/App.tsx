import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Admin } from './admin/Admin';
import { Layout } from './components/Layout';
import { Splash, TournamentProvider } from './data/TournamentContext';
import { source } from './data/source';
import type { Tournament } from './lib/types';
import { dateSpan } from './lib/time';
import { Bracket, FinalStandings } from './pages/Bracket';
import { HelpParents, HelpScorekeeper } from './pages/Help';
import { Home } from './pages/Home';
import { Info } from './pages/Info';
import { Login } from './pages/Login';
import { MatchPage } from './pages/MatchPage';
import { Mine } from './pages/Mine';
import { Poster } from './pages/Poster';
import { Schedule } from './pages/Schedule';
import { ScoreEntry, ScorerList } from './pages/Scorer';
import { Tables } from './pages/Tables';
import { TeamPage } from './pages/TeamPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TournamentList />} />
        <Route path="/t/:slug/*" element={<TournamentRoutes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function TournamentRoutes() {
  const { slug = '' } = useParams();
  return (
    <TournamentProvider slug={slug}>
      <Routes>
        <Route path="plakat" element={<Poster />} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="raspored" element={<Schedule />} />
          <Route path="tablice" element={<Tables />} />
          <Route path="zdrijeb" element={<Bracket />} />
          <Route path="poredak" element={<FinalStandings />} />
          <Route path="moje" element={<Mine />} />
          <Route path="utakmica/:id" element={<MatchPage />} />
          <Route path="momcad/:id" element={<TeamPage />} />
          <Route path="info" element={<Info />} />
          <Route path="upute" element={<HelpParents />} />
          <Route path="upute-zapisnicar" element={<HelpScorekeeper />} />
          <Route path="prijava" element={<Login />} />
          <Route path="zapisnik" element={<ScorerList />} />
          <Route path="zapisnik/:matchId" element={<ScoreEntry />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Route>
      </Routes>
    </TournamentProvider>
  );
}

/** Popis turnira; ako postoji samo jedan, odmah ga otvara. */
function TournamentList() {
  const [list, setList] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    source.listTournaments().then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  if (error) return <Splash text={error} />;
  if (!list) return <Splash text="Učitavam…" />;
  if (list.length === 1) return <Navigate to={`/t/${list[0].slug}`} replace />;
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <img src="/emblem.svg" alt="" className="mx-auto size-16" />
      <h1 className="heading mt-4 text-center text-2xl">Turniri</h1>
      <div className="mt-6 space-y-3">
        {list.map((t) => (
          <Link key={t.id} to={`/t/${t.slug}`} className="card block p-4">
            <div className="heading text-lg">{t.name}</div>
            <div className="mt-1 text-[13px] text-white/60">{dateSpan(t.start_date, t.end_date)} · {t.place}</div>
          </Link>
        ))}
        {!list.length && <p className="text-center text-white/60">Još nema objavljenih turnira.</p>}
      </div>
    </div>
  );
}
