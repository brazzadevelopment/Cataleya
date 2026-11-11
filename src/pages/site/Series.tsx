import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { PageTitle } from '../../components/HubLayout';
import { Empty } from '../../components/ui';
import { source } from '../../data/source';
import { Splash } from '../../data/TournamentContext';
import { currentEdition, seriesInfo } from '../../lib/series';
import type { Tournament } from '../../lib/types';

/** Kartica Indoor / Proljeće / Jesen: otvara turnir u tijeku, sljedeći ili zadnji. */
export function SeriesTab() {
  const { key = '' } = useParams();
  const info = seriesInfo(key);
  const [list, setList] = useState<Tournament[] | null>(null);
  useEffect(() => {
    source.listTournaments().then(setList).catch(() => setList([]));
  }, []);
  if (!info) return <Navigate to="/" replace />;
  if (!list) return <Splash text="Učitavam…" />;
  const t = currentEdition(list, info.key);
  if (t) return <Navigate to={`/t/${t.slug}`} replace />;
  return (
    <div>
      <PageTitle sub={info.hint}>Cataleya {info.label}</PageTitle>
      <div className="mt-4"><Empty>Datumi turnira bit će objavljeni uskoro.</Empty></div>
    </div>
  );
}
