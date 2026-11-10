import type { Mutation } from '../lib/mutations';
import type { Category, Club, Match, Session, Snapshot, Team, Tournament } from '../lib/types';
import { createDemoSource } from './demo';
import { createLiveSource } from './live';

/** Podaci o klubu kroz sve turnire. */
export interface ClubHistory {
  club: Club | null;
  teams: Team[];
  matches: Match[];
  tournaments: Tournament[];
  categories: Category[];
}

/** Utakmice za plasman (pobjednici) svih turnira. */
export interface HallOfFame {
  matches: Match[];
  teams: Team[];
  tournaments: Tournament[];
  categories: Category[];
}

/** Rezultat prijave: turnir (i njegova adresa) ili organizacija (role 'owner'). */
export type LoginResult = Session & { slug?: string };

export interface DataSource {
  mode: 'demo' | 'live';
  /** Objavljeni turniri; s `all` i skice (za organizaciju). */
  listTournaments(all?: boolean): Promise<Tournament[]>;
  listClubs(): Promise<Club[]>;
  clubHistory(clubId: string): Promise<ClubHistory>;
  hallOfFame(): Promise<HallOfFame>;
  /** Broj utakmica uživo po turniru. */
  liveCounts(): Promise<Record<string, number>>;
  load(slug: string): Promise<Snapshot | null>;
  /** Javlja kad se podaci promijene negdje drugdje (drugi uređaj, druga kartica). */
  subscribe(tournamentId: string, onChange: () => void): () => void;
  /** Bez turnira: PIN organizacije ili PIN bilo kojeg turnira u tijeku. */
  login(tournamentId: string | null, pin: string): Promise<LoginResult | null>;
  /** Vraća što je server stvorio (npr. novi turnir). */
  mutate(session: Session, mutations: Mutation[]): Promise<{ created?: { id: string; slug: string } }>;
  uploadImage(session: Session, file: File): Promise<string>;
  /** Obavijesti na mobitel; samo pravi način (demo ih nema). */
  push?: {
    key(): Promise<string>;
    subscribe(body: unknown): Promise<void>;
    unsubscribe(endpoint: string): Promise<void>;
  };
  /** Samo demo: vraća početne podatke. */
  reset?(): void;
  /** Samo demo: popuni rezultate skupina, da se vide tablice i ždrijeb. */
  fillDemoResults?(): void;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const source: DataSource = url && anonKey ? createLiveSource(url, anonKey) : createDemoSource();

/** Javni URL slike: putanja iz Storagea ili već gotov URL. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|data:|\/)/.test(path)) return path;
  return url ? `${url}/storage/v1/object/public/logos/${path}` : null;
}
