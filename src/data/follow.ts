// Što korisnik prati i tko je prijavljen kao organizacija. Vrijedi za sve
// turnire, pa je izvan TournamentContexta. Sve je samo na ovom uređaju.

import { useSyncExternalStore } from 'react';
import type { Session } from '../lib/types';

const CLUBS_KEY = 'cataleya.clubs';
const ORG_KEY = 'cataleya.org';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // bez pohrane radi do zatvaranja aplikacije
  }
}

let clubs = new Set<string>(read<string[]>(CLUBS_KEY, []));
let org: Session | null = read<Session | null>(ORG_KEY, null);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CLUBS_KEY) clubs = new Set(read<string[]>(CLUBS_KEY, []));
    else if (e.key === ORG_KEY) org = read<Session | null>(ORG_KEY, null);
    else return;
    emit();
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function followedClubs(): Set<string> {
  return clubs;
}

export function setClubFollowed(clubId: string, on: boolean): void {
  if (clubs.has(clubId) === on) return;
  clubs = new Set(clubs);
  if (on) clubs.add(clubId);
  else clubs.delete(clubId);
  write(CLUBS_KEY, [...clubs]);
  emit();
}

export function toggleClub(clubId: string): void {
  setClubFollowed(clubId, !clubs.has(clubId));
}

export function useFollowedClubs(): Set<string> {
  return useSyncExternalStore(subscribe, () => clubs, () => clubs);
}

/** Prijava organizacije (PIN organizacije): vrijedi za sve turnire. */
export function orgSession(): Session | null {
  return org;
}

export function setOrgSession(s: Session | null): void {
  org = s;
  write(ORG_KEY, s);
  emit();
}

export function useOrgSession(): Session | null {
  return useSyncExternalStore(subscribe, () => org, () => org);
}
