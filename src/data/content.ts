// Vijesti, galerija, video, sponzori i tekstovi stranica: učitaju se jednom
// i dijele među stranicama; nakon izmjene u Organizaciji učitaju se ponovno.
import { useEffect, useState } from 'react';
import type { SiteContent } from '../lib/types';
import { source } from './source';

const EMPTY: SiteContent = { news: [], gallery: [], videos: [], sponsors: [], settings: {} };
const CACHE_KEY = 'cataleya.content.v1';

let current: SiteContent | null = readCache();
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function readCache(): SiteContent | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as SiteContent) : null;
  } catch {
    return null;
  }
}

export function reloadContent(): Promise<void> {
  loading = source.content()
    .then((c) => {
      current = c;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(c));
      } catch {
        // bez pohrane: učita se svaki put
      }
    })
    .catch(() => {
      current ??= EMPTY;
    })
    .finally(() => listeners.forEach((l) => l()));
  return loading;
}

/** Sadržaj (zadnji poznati odmah, svježi čim stigne). */
export function useContent(): SiteContent | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    if (!loading) void reloadContent();
    return () => void listeners.delete(l);
  }, []);
  return current;
}

/** Objavljene vijesti, najnovije prve. */
export function publishedNews(c: SiteContent, now = new Date()) {
  return c.news.filter((n) => n.is_published && new Date(n.published_at) <= now);
}

export function activeSponsors(c: SiteContent) {
  const order = { glavni: 0, zlatni: 1, partner: 2 } as const;
  return c.sponsors.filter((s) => s.is_active).sort((a, b) => order[a.tier] - order[b.tier] || a.sort_order - b.sort_order);
}
