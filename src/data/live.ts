// Pravi način: čitanje iz Supabasea, izmjene preko Supabase Edge Function
// (supabase/functions/api), koja provjerava PIN.

import { createClient } from '@supabase/supabase-js';
import { MutationError, type Mutation } from '../lib/mutations';
import type { Category, Club, Match, Session, Snapshot, Team, Tournament } from '../lib/types';
import type { DataSource, LoginResult } from './source';

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

interface Api {
  post<T>(action: 'login' | 'mutate' | 'upload' | 'push-key' | 'subscribe' | 'unsubscribe', body: unknown, token?: string): Promise<T>;
}

function api(url: string, anonKey: string): Api {
  return {
    async post<T>(action: string, body: unknown, token?: string): Promise<T> {
      const res = await fetch(`${url}/functions/v1/api/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          ...(token ? { 'x-turnir-token': token } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
      if (!res.ok) throw new MutationError(data.error ?? `Greška ${res.status}`, res.status);
      return data;
    },
  };
}

function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
}

export function createLiveSource(url: string, anonKey: string): DataSource {
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const { post } = api(url, anonKey);

  let flushing = false;
  async function flush(): Promise<void> {
    if (flushing) return;
    flushing = true;
    try {
      let q = readQueue();
      while (q.length) {
        const [item] = q;
        try {
          await post('mutate', { mutations: item.mutations, tournamentId: item.session.tournamentId || null }, item.session.token);
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
    async listTournaments(everything = false) {
      let q = db.from('tournaments').select('*').order('start_date', { ascending: false });
      if (!everything) q = q.eq('is_published', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as Tournament[];
    },
    async listClubs() {
      const { data, error } = await db.from('clubs').select('*').order('name');
      if (error) throw error;
      return data as Club[];
    },
    async clubHistory(clubId) {
      const [club, teams] = await Promise.all([
        db.from('clubs').select('*').eq('id', clubId).maybeSingle(),
        db.from('teams').select('*').eq('club_id', clubId),
      ]);
      if (club.error) throw club.error;
      if (teams.error) throw teams.error;
      const t = teams.data as Team[];
      const ids = t.map((x) => x.id);
      const tids = [...new Set(t.map((x) => x.tournament_id))];
      const cids = [...new Set(t.map((x) => x.category_id))];
      const [matches, tournaments, categories] = await Promise.all([
        ids.length ? db.from('matches').select('*').or(`home_team_id.in.(${ids}),away_team_id.in.(${ids})`) : { data: [], error: null },
        tids.length ? db.from('tournaments').select('*').in('id', tids).eq('is_published', true) : { data: [], error: null },
        cids.length ? db.from('categories').select('*').in('id', cids) : { data: [], error: null },
      ]);
      for (const r of [matches, tournaments, categories]) if (r.error) throw r.error;
      // Protivnici: njihova imena trebaju za prikaz utakmica.
      const m = matches.data as Match[];
      const other = [...new Set(m.flatMap((x) => [x.home_team_id, x.away_team_id]).filter((x): x is string => !!x && !ids.includes(x)))];
      const opp = other.length ? await db.from('teams').select('*').in('id', other) : { data: [], error: null };
      if (opp.error) throw opp.error;
      const published = new Set((tournaments.data as Tournament[]).map((x) => x.id));
      return {
        club: club.data as Club | null,
        teams: [...t, ...(opp.data as Team[])],
        matches: m.filter((x) => published.has(x.tournament_id)),
        tournaments: tournaments.data as Tournament[],
        categories: categories.data as Category[],
      };
    },
    async hallOfFame() {
      const { data, error } = await db.from('matches').select('*').eq('status', 'finished')
        .or('winner_place.not.is.null,loser_place.not.is.null');
      if (error) throw error;
      const m = data as Match[];
      const teamIds = [...new Set(m.flatMap((x) => [x.home_team_id, x.away_team_id]).filter((x): x is string => !!x))];
      const [teams, tournaments, categories] = await Promise.all([
        teamIds.length ? db.from('teams').select('*').in('id', teamIds) : { data: [], error: null },
        db.from('tournaments').select('*').eq('is_published', true),
        db.from('categories').select('*'),
      ]);
      for (const r of [teams, tournaments, categories]) if (r.error) throw r.error;
      return { matches: m, teams: teams.data as Team[], tournaments: tournaments.data as Tournament[], categories: categories.data as Category[] };
    },
    async liveCounts() {
      const { data, error } = await db.from('matches').select('tournament_id').eq('status', 'live');
      if (error) throw error;
      const out: Record<string, number> = {};
      for (const r of data as { tournament_id: string }[]) out[r.tournament_id] = (out[r.tournament_id] ?? 0) + 1;
      return out;
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
      const clubIds = [...new Set((teams as Team[]).map((t) => t.club_id).filter((x): x is string => !!x))];
      const clubs = clubIds.length ? await db.from('clubs').select('*').in('id', clubIds) : { data: [], error: null };
      if (clubs.error) throw clubs.error;
      return { tournament, categories, fields, teams, groups, groupTeams, matches, clubs: clubs.data } as Snapshot;
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
        return await post<LoginResult>('login', { tournamentId, pin });
      } catch (e) {
        if (e instanceof MutationError && e.status === 401) return null;
        throw e;
      }
    },
    async mutate(session, mutations) {
      try {
        await flush();
        return await post<{ created?: { id: string; slug: string } }>('mutate', { mutations, tournamentId: session.tournamentId || null }, session.token);
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
      const res = await post<{ path: string }>('upload', { name: file.name, type: file.type, data }, session.token);
      return res.path;
    },
    push: {
      key: async () => (await post<{ key: string }>('push-key', {})).key,
      subscribe: async (body) => void (await post('subscribe', body)),
      unsubscribe: async (endpoint) => void (await post('unsubscribe', { endpoint })),
    },
  };
}
