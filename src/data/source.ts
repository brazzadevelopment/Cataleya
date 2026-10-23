import type { Mutation } from '../lib/mutations';
import type { Session, Snapshot, Tournament } from '../lib/types';
import { createDemoSource } from './demo';
import { createLiveSource } from './live';

export interface DataSource {
  mode: 'demo' | 'live';
  listTournaments(): Promise<Tournament[]>;
  load(slug: string): Promise<Snapshot | null>;
  /** Javlja kad se podaci promijene negdje drugdje (drugi uređaj, druga kartica). */
  subscribe(tournamentId: string, onChange: () => void): () => void;
  login(tournamentId: string, pin: string): Promise<Session | null>;
  mutate(session: Session, mutations: Mutation[]): Promise<void>;
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
