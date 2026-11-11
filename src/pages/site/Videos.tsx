import { useState } from 'react';
import { PageTitle } from '../../components/HubLayout';
import { Empty, Icon, LiveBadge } from '../../components/ui';
import { useContent } from '../../data/content';
import { Splash } from '../../data/TournamentContext';
import type { Video } from '../../lib/types';
import { newsDate } from './common';

/**
 * YouTube video: prvo samo slika, a tek na dodir se učita YouTube
 * (bez kolačića dok gledatelj sam ne pokrene video).
 */
export function VideoPlayer({ v }: { v: Video }) {
  const [play, setPlay] = useState(false);
  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-video bg-black">
        {play ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?autoplay=1&playsinline=1&rel=0`}
            title={v.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <button type="button" onClick={() => setPlay(true)} className="absolute inset-0" aria-label={`Pokreni: ${v.title}`}>
            <img src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`} alt="" className="size-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/25">
              <span className="grid size-16 place-items-center rounded-full bg-[#ff0033] text-white shadow-lg">
                <Icon name="play" className="size-9" />
              </span>
            </span>
            {v.is_live && <span className="absolute left-3 top-3"><LiveBadge /></span>}
          </button>
        )}
      </div>
      <div className="flex items-start gap-2 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="font-extrabold leading-snug">{v.title}</div>
          <div className="mt-0.5 text-[12px] text-white/60">{v.is_live ? 'Prijenos uživo' : newsDate(v.published_at)}</div>
        </div>
        <a href={`https://www.youtube.com/watch?v=${v.youtube_id}`} target="_blank" rel="noreferrer" className="shrink-0 text-[12px] font-bold text-white/65">YouTube ↗</a>
      </div>
    </div>
  );
}

export function Videos() {
  const c = useContent();
  if (!c) return <Splash text="Učitavam…" />;
  const list = [...c.videos].sort((a, b) => Number(b.is_live) - Number(a.is_live) || b.published_at.localeCompare(a.published_at));
  return (
    <div>
      <PageTitle sub="Prijenosi uživo i snimke utakmica">Video</PageTitle>
      <div className="mt-3 space-y-4">
        {list.length ? list.map((v) => <VideoPlayer key={v.id} v={v} />) : <Empty>Prijenosi i snimke utakmica bit će ovdje.</Empty>}
      </div>
    </div>
  );
}
