import { useState } from 'react';
import { PageTitle } from '../../components/HubLayout';
import { Empty, Icon } from '../../components/ui';
import { useContent } from '../../data/content';
import { assetUrl } from '../../data/source';
import { Splash } from '../../data/TournamentContext';
import type { GalleryItem } from '../../lib/types';

/** Fotografija preko cijelog zaslona; strelice ili povlačenje za sljedeću. */
export function Lightbox({ list, index, onClose }: { list: GalleryItem[]; index: number; onClose(): void }) {
  const [i, setI] = useState(index);
  const [x0, setX0] = useState<number | null>(null);
  const item = list[i];
  const go = (d: number) => setI((n) => (n + d + list.length) % list.length);
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      onTouchStart={(e) => setX0(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        setX0(null);
      }}
    >
      <div className="flex items-center px-3 py-2 text-[13px] font-bold text-white/70">
        {i + 1} / {list.length}
        <button type="button" onClick={onClose} aria-label="Zatvori" className="ml-auto grid size-10 place-items-center rounded-full bg-white/10 text-white">
          <Icon name="x" className="size-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <img src={assetUrl(item.image_path) ?? ''} alt={item.caption ?? ''} className="max-h-full max-w-full object-contain" />
        {list.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Prethodna" className="absolute left-2 grid size-10 place-items-center rounded-full bg-black/40 text-white"><Icon name="back" className="size-5" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Sljedeća" className="absolute right-2 grid size-10 place-items-center rounded-full bg-black/40 text-white"><Icon name="back" className="size-5 rotate-180" /></button>
          </>
        )}
      </div>
      {item.caption && <p className="px-4 py-3 text-center text-[14px] text-white/85">{item.caption}</p>}
    </div>
  );
}

export function Gallery() {
  const c = useContent();
  const [open, setOpen] = useState<number | null>(null);
  if (!c) return <Splash text="Učitavam…" />;
  const list = c.gallery;
  return (
    <div>
      <PageTitle sub={list.length ? `${list.length} fotografija` : undefined}>Galerija</PageTitle>
      {list.length ? (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {list.map((g, i) => (
            <button key={g.id} type="button" onClick={() => setOpen(i)} className="aspect-square overflow-hidden rounded-lg bg-white/10">
              <img src={assetUrl(g.image_path) ?? ''} alt={g.caption ?? ''} className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3"><Empty>Fotografije s turnira stižu uskoro.</Empty></div>
      )}
      {open !== null && <Lightbox list={list} index={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
