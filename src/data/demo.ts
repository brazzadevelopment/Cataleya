// Demo način: podaci u localStorage, bez Supabasea.
// PIN-ovi: organizacija 9999, glavni 9000, tereni redom 1001, 1002, … (vidi seed.ts).

import { applyToSnapshot, authorize, MutationError, type Mutation } from '../lib/mutations';
import type { Session, Snapshot } from '../lib/types';
import { DEMO_PINS, demoSnapshot } from './seed';
import type { DataSource } from './source';

const KEY = 'turnir.demo.v3';
export const DEMO_ORG_PIN = '9999';
const PINS_KEY = 'turnir.demo.pins.v2';

interface Pins {
  admin: string;
  fields: Record<string, string>;
}

function read<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // privatni prozor ili blokirana pohrana: radi s početnim podacima
  }
  return fallback();
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // nije kritično u demu
  }
}

export function createDemoSource(): DataSource {
  let snap: Snapshot = read(KEY, demoSnapshot);
  let pins: Pins = read(PINS_KEY, () => structuredClone(DEMO_PINS));
  const listeners = new Set<() => void>();

  const save = () => {
    write(KEY, snap);
    listeners.forEach((l) => l());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) {
        snap = read(KEY, demoSnapshot);
        listeners.forEach((l) => l());
      }
    });
  }

  return {
    mode: 'demo',
    async listTournaments() {
      return [snap.tournament];
    },
    async listClubs() {
      return [...snap.clubs].sort((a, b) => a.name.localeCompare(b.name, 'hr'));
    },
    async clubHistory(clubId) {
      const teams = snap.teams.filter((t) => t.club_id === clubId);
      const ids = new Set(teams.map((t) => t.id));
      const matches = snap.matches.filter((m) => ids.has(m.home_team_id ?? '') || ids.has(m.away_team_id ?? ''));
      return { club: snap.clubs.find((c) => c.id === clubId) ?? null, teams: snap.teams, matches, tournaments: [snap.tournament], categories: snap.categories };
    },
    async hallOfFame() {
      const matches = snap.matches.filter((m) => m.status === 'finished' && (m.winner_place != null || m.loser_place != null));
      return { matches, teams: snap.teams, tournaments: [snap.tournament], categories: snap.categories };
    },
    async liveCounts() {
      return { [snap.tournament.id]: snap.matches.filter((m) => m.status === 'live').length };
    },
    async load(slug) {
      return slug === snap.tournament.slug ? structuredClone(snap) : null;
    },
    subscribe(_id, onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    async login(_tournamentId, pin) {
      const tournamentId = snap.tournament.id;
      const slug = snap.tournament.slug;
      if (pin === DEMO_ORG_PIN) return { tournamentId: '', role: 'owner', fieldId: null, token: 'demo' };
      if (pin === pins.admin) return { tournamentId, slug, role: 'admin', fieldId: null, token: 'demo' };
      const field = Object.entries(pins.fields).find(([, p]) => p === pin);
      if (field && !snap.tournament.closed_at) return { tournamentId, slug, role: 'field', fieldId: field[0], token: 'demo' };
      return null;
    },
    async mutate(session: Session, mutations: Mutation[]) {
      let next = snap;
      for (const raw of mutations) {
        const match = raw.type === 'score' ? next.matches.find((m) => m.id === raw.matchId) : null;
        const m = authorize(raw, session, match);
        if (m.type === 'setPin') {
          const taken = [pins.admin, ...Object.values(pins.fields)];
          const own = m.fieldId ? pins.fields[m.fieldId] : pins.admin;
          if (taken.includes(m.pin) && own !== m.pin) throw new MutationError('Taj PIN već koristi netko drugi u ovom turniru.');
          if (m.fieldId) pins.fields[m.fieldId] = m.pin;
          else pins.admin = m.pin;
          write(PINS_KEY, pins);
          continue;
        }
        if (m.type === 'setOrgPin') continue;
        next = applyToSnapshot(next, m);
      }
      snap = next;
      save();
      return {};
    },
    async uploadImage(_session, file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new MutationError('Slika se nije mogla učitati.'));
        reader.readAsDataURL(file);
      });
    },
    reset() {
      snap = demoSnapshot();
      pins = structuredClone(DEMO_PINS);
      write(PINS_KEY, pins);
      save();
    },
    fillDemoResults() {
      // Nasumični rezultati za sve utakmice skupina, samo za pregled.
      let next = snap;
      for (const m of next.matches.filter((x) => x.stage === 'group')) {
        const g = () => Math.floor(Math.random() * 4);
        next = applyToSnapshot(next, {
          type: 'score', matchId: m.id,
          patch: { home_score: g(), away_score: g(), home_penalties: null, away_penalties: null, status: 'finished' },
        });
      }
      snap = next;
      save();
    },
  };
}
