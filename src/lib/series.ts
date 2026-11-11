// Tri turnira godišnje, svaki ima svoju karticu u donjem izborniku.
import { tournamentStatus } from './hub';
import type { SeriesKey, Tournament } from './types';

export interface SeriesInfo {
  key: SeriesKey;
  /** Naziv kartice. */
  label: string;
  /** Kratki opis (kad i gdje). */
  hint: string;
  icon: string;
}

export const SERIES: SeriesInfo[] = [
  { key: 'indoor', label: 'Indoor', hint: 'Zima · dvorana, Sveti Filip i Jakov', icon: 'snow' },
  { key: 'proljece', label: 'Proljeće', hint: 'Proljeće · Zadar', icon: 'sprout' },
  { key: 'jesen', label: 'Jesen', hint: 'Jesen · Zadar', icon: 'leaf' },
];

export function seriesInfo(key: string | null | undefined): SeriesInfo | undefined {
  return SERIES.find((s) => s.key === key);
}

/**
 * Turnir koji kartica otvara: onaj u tijeku, inače najbliži sljedeći,
 * inače zadnji odigrani.
 */
export function currentEdition(list: Tournament[], key: SeriesKey, day?: string): Tournament | null {
  const mine = list.filter((t) => t.series === key);
  const live = mine.find((t) => tournamentStatus(t, day) === 'live');
  if (live) return live;
  const upcoming = mine.filter((t) => tournamentStatus(t, day) === 'upcoming').sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (upcoming[0]) return upcoming[0];
  const done = mine.sort((a, b) => b.start_date.localeCompare(a.start_date));
  return done[0] ?? null;
}
