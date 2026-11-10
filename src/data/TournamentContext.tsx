import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Mutation } from '../lib/mutations';
import type { Session, Snapshot } from '../lib/types';
import { syncPush } from '../lib/push';
import { setClubFollowed, setOrgSession, useFollowedClubs, useOrgSession } from './follow';
import { source } from './source';

interface Ctx {
  snap: Snapshot;
  categoryId: string;
  setCategoryId(id: string): void;
  /** Momčadi koje pratimo: momčadi praćenih klubova i pojedine momčadi bez kluba. */
  favorites: Set<string>;
  /** Zvjezdica: prati klub momčadi (na svim turnirima); momčad bez kluba prati se sama. */
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
  const [teamFavs, setTeamFavs] = useState<Set<string>>(() => new Set(readJson<string[]>(`turnir.fav.${tid}`, [])));
  const [ownSession, setSess] = useState<Session | null>(() => readJson<Session | null>(`turnir.session.${tid}`, null));
  const org = useOrgSession();
  const clubs = useFollowedClubs();
  // Organizacija je u svakom turniru kao organizator turnira.
  const session: Session | null = ownSession ?? (org ? { ...org, tournamentId: tid, role: 'owner' } : null);

  const validCat = cats.some((c) => c.id === categoryId) ? categoryId : cats[0]?.id ?? '';
  const clubOf = useMemo(() => new Map(snap.teams.map((t) => [t.id, t.club_id ?? null])), [snap.teams]);

  // Starije verzije pamtile su momčadi; momčad s klubom postaje praćeni klub.
  useEffect(() => {
    const moved = [...teamFavs].filter((id) => clubOf.get(id));
    if (!moved.length) return;
    for (const id of moved) setClubFollowed(clubOf.get(id)!, true);
    const rest = [...teamFavs].filter((id) => !clubOf.get(id));
    setTeamFavs(new Set(rest));
    writeJson(`turnir.fav.${tid}`, rest);
  }, [teamFavs, clubOf, tid]);

  const favorites = useMemo(
    () => new Set(snap.teams.filter((t) => teamFavs.has(t.id) || (t.club_id && clubs.has(t.club_id))).map((t) => t.id)),
    [snap.teams, teamFavs, clubs],
  );

  // Server mora znati koje klubove i momčadi pratimo, ako su obavijesti uključene.
  useEffect(() => {
    syncPush({ clubIds: [...clubs], teamIds: [...teamFavs] }).catch(() => undefined);
  }, [clubs, teamFavs]);

  const value: Ctx = {
    snap,
    categoryId: validCat,
    setCategoryId: (id) => {
      setCat(id);
      writeJson(`turnir.cat.${tid}`, id);
    },
    favorites,
    toggleFavorite: (teamId) => {
      const club = clubOf.get(teamId);
      if (club) {
        setClubFollowed(club, !clubs.has(club));
        return;
      }
      setTeamFavs((prev) => {
        const next = new Set(prev);
        if (next.has(teamId)) next.delete(teamId);
        else next.add(teamId);
        writeJson(`turnir.fav.${tid}`, [...next]);
        return next;
      });
    },
    session,
    setSession: (s) => {
      // Odjava organizacije vrijedi za sve turnire.
      if (!s && !ownSession && org) {
        setOrgSession(null);
        return;
      }
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

/** Isto kao useTournament, ali vraća null izvan turnira (npr. na početnoj Cataleya Cupa). */
export function useOptionalTournament(): Ctx | null {
  return useContext(TournamentCtx);
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
        <img src="/logo.svg" alt="" className="mx-auto mb-4 size-20 animate-pulse" />
        <p className="text-white/80">{text}</p>
      </div>
    </div>
  );
}
