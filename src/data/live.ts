// Pravi način: čitanje iz Supabasea, izmjene preko serverskih funkcija (api/).

import { createClient } from '@supabase/supabase-js';
import { MutationError, type Mutation } from '../lib/mutations';
import type { Session, Snapshot, Tournament } from '../lib/types';
import type { DataSource } from './source';

const QUEUE_KEY = 'turnir.queue.v1';

interface Queued {
  session: Session;
  mutations: Mutation[];
}

function readQueue(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Queued[];
  } catch {
    return [];
  }
}

function writeQueue(q: Queued[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    // bez pohrane nema reda čekanja
  }
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new MutationError(data.error ?? `Greška ${res.status}`, res.status);
  return data;
}

function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
}

export function createLiveSource(url: string, anonKey: string): DataSource {
  const db = createClient(url, anonKey, { auth: { persistSession: false } });

  let flushing = false;
  async function flush(): Promise<void> {
    if (flushing) return;
    flushing = true;
    try {
      let q = readQueue();
      while (q.length) {
        const [item] = q;
        try {
          await post('/api/mutate', { mutations: item.mutations }, item.session.token);
        } catch (e) {
          if (isNetworkError(e)) break;
          // Server je odbio izmjenu (npr. istekla prijava): ne pokušava ponovno.
        }
        q = readQueue().slice(1);
        writeQueue(q);
      }
    } finally {
      flushing = false;
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void flush());
    setInterval(() => void flush(), 20000);
    void flush();
  }

  async function all<T>(table: string, tournamentId: string): Promise<T[]> {
    const { data, error } = await db.from(table).select('*').eq('tournament_id', tournamentId);
    if (error) throw error;
    return data as T[];
  }

  return {
    mode: 'live',
    async listTournaments() {
      const { data, error } = await db.from('tournaments').select('*').eq('is_published', true).order('start_date', { ascending: false });
      if (error) throw error;
      return data as Tournament[];
    },
    async load(slug) {
      const { data: tournament, error } = await db.from('tournaments').select('*').eq('slug', slug).maybeSingle();
      if (error) throw error;
      if (!tournament) return null;
      const id = (tournament as Tournament).id;
      const [categories, fields, teams, groups, groupTeams, matches] = await Promise.all([
        all('categories', id), all('fields', id), all('teams', id),
        all('groups', id), all('group_teams', id), all('matches', id),
      ]);
      return { tournament, categories, fields, teams, groups, groupTeams, matches } as Snapshot;
    },
    subscribe(tournamentId, onChange) {
      const channel = db
        .channel(`t-${tournamentId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` }, onChange)
        .subscribe();
      const onVisible = () => document.visibilityState === 'visible' && onChange();
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        void db.removeChannel(channel);
        document.removeEventListener('visibilitychange', onVisible);
      };
    },
    async login(tournamentId, pin) {
      try {
        return await post<Session>('/api/login', { tournamentId, pin });
      } catch (e) {
        if (e instanceof MutationError && e.status === 401) return null;
        throw e;
      }
    },
    async mutate(session, mutations) {
      try {
        await flush();
        await post('/api/mutate', { mutations }, session.token);
      } catch (e) {
        // Rezultati se ne smiju izgubiti zbog slabog signala na terenu.
        if (isNetworkError(e) && mutations.every((m) => m.type === 'score')) {
          writeQueue([...readQueue(), { session, mutations }]);
          throw new MutationError('Nema signala. Rezultat je spremljen na mobitelu i poslat će se sam.', 0);
        }
        throw e;
      }
    },
    async uploadImage(session, file) {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new MutationError('Slika se nije mogla učitati.'));
        reader.readAsDataURL(file);
      });
      const res = await post<{ path: string }>('/api/upload', { name: file.name, type: file.type, data }, session.token);
      return res.path;
    },
  };
}
