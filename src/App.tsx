import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Admin } from './admin/Admin';
import { HubLayout } from './components/HubLayout';
import { Layout } from './components/Layout';
import { TournamentProvider } from './data/TournamentContext';
import { Bracket, FinalStandings } from './pages/Bracket';
import { HelpParents, HelpScorekeeper } from './pages/Help';
import { Home } from './pages/Home';
import { Info } from './pages/Info';
import { Login } from './pages/Login';
import { MatchPage } from './pages/MatchPage';
import { NotifyGuide } from './pages/NotifyGuide';
import { Mine } from './pages/Mine';
import { Poster } from './pages/Poster';
import { Schedule } from './pages/Schedule';
import { ScoreEntry, ScorerList } from './pages/Scorer';
import { Tables } from './pages/Tables';
import { TeamPage } from './pages/TeamPage';
import { ClubPage, Clubs } from './pages/hub/Clubs';
import { HubHome, Winners } from './pages/hub/HubHome';
import { About, Impressum } from './pages/site/About';
import { Contact } from './pages/site/Contact';
import { Gallery } from './pages/site/Gallery';
import { More } from './pages/site/More';
import { NewsList, NewsPage } from './pages/site/News';
import { SeriesTab } from './pages/site/Series';
import { Sponsors } from './pages/site/Sponsors';
import { Videos } from './pages/site/Videos';
import { GlobalLogin, Organizacija } from './pages/hub/Organizacija';
import { Privacy } from './pages/hub/Privacy';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<HubLayout />}>
          <Route path="/" element={<HubHome />} />
          <Route path="/klubovi" element={<Clubs />} />
          <Route path="/klub/:id" element={<ClubPage />} />
          <Route path="/prijava" element={<GlobalLogin />} />
          <Route path="/organizacija" element={<Organizacija />} />
          <Route path="/obavijesti" element={<NotifyGuide />} />
          <Route path="/privatnost" element={<Privacy />} />
          <Route path="/turnir/:key" element={<SeriesTab />} />
          <Route path="/vise" element={<More />} />
          <Route path="/vijesti" element={<NewsList />} />
          <Route path="/vijesti/:id" element={<NewsPage />} />
          <Route path="/galerija" element={<Gallery />} />
          <Route path="/video" element={<Videos />} />
          <Route path="/sponzori" element={<Sponsors />} />
          <Route path="/o-nama" element={<About />} />
          <Route path="/impresum" element={<Impressum />} />
          <Route path="/kontakt" element={<Contact />} />
          <Route path="/pobjednici" element={<Winners />} />
        </Route>
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
          <Route path="obavijesti" element={<NotifyGuide />} />
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
