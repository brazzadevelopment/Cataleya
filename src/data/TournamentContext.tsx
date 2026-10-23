import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Mutation } from '../lib/mutations';
import type { Session, Snapshot } from '../lib/types';
import { source } from './source';

interface Ctx {
  snap: Snapshot;
  categoryId: string;
  setCategoryId(id: string): void;
  favorites: Set<string>;
  toggleFavorite(teamId: string): void;
  session: Session | null;
  setSession(s: Session | null): void;
  mutate(mutations: Mutation[]): Promise<void>;
  reload(): Promise<void>;
}

const TournamentCtx = createContext<Ctx | null>(null);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // pohrana nije dostupna; radi bez pamćenja
  }
}

export function TournamentProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSnap(await source.load(slug));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tid = snap?.tournament.id;
  useEffect(() => {
    if (!tid) return;
    return source.subscribe(tid, () => void reload());
  }, [tid, reload]);

  if (snap === undefined) return <Splash text={error ?? 'Učitavam…'} />;
  if (snap === null) return <Splash text="Turnir ne postoji." />;
  return <Loaded snap={snap} reload={reload}>{children}</Loaded>;
}

function Loaded({ snap, reload, children }: { snap: Snapshot; reload: () => Promise<void>; children: ReactNode }) {
  const tid = snap.tournament.id;
  const cats = useMemo(() => [...snap.categories].sort((a, b) => a.sort_order - b.sort_order), [snap.categories]);

  const [categoryId, setCat] = useState<string>(() => readJson(`turnir.cat.${tid}`, cats[0]?.id ?? ''));
  const [favorites, setFav] = useState<Set<string>>(() => new Set(readJson<string[]>(`turnir.fav.${tid}`, [])));
  const [session, setSess] = useState<Session | null>(() => readJson<Session | null>(`turnir.session.${tid}`, null));

  const validCat = cats.some((c) => c.id === categoryId) ? categoryId : cats[0]?.id ?? '';

  const value: Ctx = {
    snap,
    categoryId: validCat,
    setCategoryId: (id) => {
      setCat(id);
      writeJson(`turnir.cat.${tid}`, id);
    },
    favorites,
    toggleFavorite: (teamId) => {
      setFav((prev) => {
        const next = new Set(prev);
        if (next.has(teamId)) next.delete(teamId);
        else next.add(teamId);
        writeJson(`turnir.fav.${tid}`, [...next]);
        return next;
      });
    },
    session,
    setSession: (s) => {
      setSess(s);
      writeJson(`turnir.session.${tid}`, s);
    },
    mutate: async (mutations) => {
      if (!session) throw new Error('Nisi prijavljen.');
      try {
        await source.mutate(session, mutations);
      } finally {
        await reload();
      }
    },
    reload,
  };

  return <TournamentCtx.Provider value={value}>{children}</TournamentCtx.Provider>;
}

export function useTournament(): Ctx {
  const ctx = useContext(TournamentCtx);
  if (!ctx) throw new Error('useTournament izvan TournamentProvidera');
  return ctx;
}

export function Splash({ text }: { text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-pitch-950 p-8 text-center">
      <div>
        <img src="/emblem.svg" alt="" className="mx-auto mb-4 size-20 animate-pulse" />
        <p className="text-white/80">{text}</p>
      </div>
    </div>
  );
}
