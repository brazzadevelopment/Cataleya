// Obavijesti na mobitel za omiljene momčadi: što se u utakmici promijenilo
// (gol, početak, kraj, karton) i slanje svima koji prate te momčadi.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Match } from '../src/lib/types.js';
import { isPushEndpoint, sendPush, type VapidKeys } from './push.js';

export const PUSH_EVENTS = ['goal', 'start', 'end', 'card'] as const;
export type PushEvent = (typeof PUSH_EVENTS)[number];

export interface MatchChange {
  before: Match;
  after: Match;
}

export interface Note {
  event: PushEvent;
  matchId: string;
  teams: string[];
  title: string;
  body: string;
}

type Score = Pick<Match, 'home_score' | 'away_score' | 'home_penalties' | 'away_penalties'>;

function scoreLine(m: Score, home: string, away: string): string {
  const pens = m.home_penalties != null && m.away_penalties != null ? ` (jedanaesterci ${m.home_penalties}:${m.away_penalties})` : '';
  return `${home} ${m.home_score ?? 0}:${m.away_score ?? 0} ${away}${pens}`;
}

/** Obavijesti za jednu izmjenu utakmice. Ispravci (manje golova) se ne javljaju. */
export function matchNotes(c: MatchChange, name: (id: string) => string, where = ''): Note[] {
  const { before: b, after: a } = c;
  if (!a.home_team_id || !a.away_team_id) return [];
  const home = name(a.home_team_id);
  const away = name(a.away_team_id);
  const teams = [a.home_team_id, a.away_team_id];
  const tail = where ? ` · ${where}` : '';
  const note = (event: PushEvent, title: string, body: string): Note => ({ event, matchId: a.id, teams, title, body });
  const out: Note[] = [];

  if (b.status === 'scheduled' && a.status === 'live') {
    out.push(note('start', '▶️ Počela je utakmica', `${home} – ${away}${tail}`));
  }
  if (a.status === 'live') {
    if ((a.home_score ?? 0) > (b.home_score ?? 0)) out.push(note('goal', `⚽ Gol! ${home}`, scoreLine(a, home, away)));
    if ((a.away_score ?? 0) > (b.away_score ?? 0)) out.push(note('goal', `⚽ Gol! ${away}`, scoreLine(a, home, away)));
  }
  if (b.status !== 'finished' && a.status === 'finished') {
    out.push(note('end', '🏁 Kraj utakmice', scoreLine(a, home, away) + tail));
  }
  const cards: [keyof Match, string, string][] = [
    ['home_yellow', '🟨 Žuti karton', home],
    ['away_yellow', '🟨 Žuti karton', away],
    ['home_red', '🟥 Crveni karton', home],
    ['away_red', '🟥 Crveni karton', away],
  ];
  for (const [k, title, team] of cards) {
    if (((a[k] as number) ?? 0) > ((b[k] as number) ?? 0)) out.push(note('card', `${title}: ${team}`, `${home} – ${away}${tail}`));
  }
  return out;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  team_ids: string[];
  events: string[];
}

/** Pošalji obavijesti za izmjene; neispravne pretplate obriši. */
export async function notify(db: SupabaseClient, keys: VapidKeys, tournamentId: string, changes: MatchChange[]): Promise<void> {
  if (!changes.length) return;
  const ids = [...new Set(changes.flatMap((c) => [c.after.home_team_id, c.after.away_team_id]).filter((x): x is string => !!x))];
  if (!ids.length) return;

  const [teams, fields, cats, tour, subs] = await Promise.all([
    db.from('teams').select('id, name').in('id', ids),
    db.from('fields').select('id, name').eq('tournament_id', tournamentId),
    db.from('categories').select('id, name').eq('tournament_id', tournamentId),
    db.from('tournaments').select('slug').eq('id', tournamentId).single(),
    db.from('push_subscriptions').select('endpoint, p256dh, auth, team_ids, events').eq('tournament_id', tournamentId).overlaps('team_ids', ids),
  ]);
  if (subs.error) throw subs.error;
  const names = new Map((teams.data ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  const fieldName = new Map((fields.data ?? []).map((f: { id: string; name: string }) => [f.id, f.name]));
  const catName = new Map((cats.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
  const slug = (tour.data as { slug?: string } | null)?.slug ?? '';

  const notes = changes.flatMap((c) => {
    const where = [catName.get(c.after.category_id) && `${catName.get(c.after.category_id)} godište`, c.after.field_id && fieldName.get(c.after.field_id)]
      .filter(Boolean).join(' · ');
    return matchNotes(c, (id) => names.get(id) ?? '?', where);
  });

  const gone = new Set<string>();
  const sends: Promise<void>[] = [];
  for (const s of (subs.data ?? []) as SubRow[]) {
    if (!isPushEndpoint(s.endpoint)) continue;
    for (const n of notes) {
      if (!s.events.includes(n.event) || !n.teams.some((t) => s.team_ids.includes(t))) continue;
      const message = { title: n.title, body: n.body, tag: n.matchId, url: `/t/${slug}/utakmica/${n.matchId}` };
      sends.push(
        sendPush(s, message, keys, n.matchId.replace(/-/g, ''))
          .then((status) => {
            if (status === 404 || status === 410) gone.add(s.endpoint);
            else if (status >= 400) console.error('push', status, new URL(s.endpoint).host);
          })
          .catch((e) => console.error('push', e)),
      );
    }
  }
  await Promise.all(sends);
  if (gone.size) await db.from('push_subscriptions').delete().in('endpoint', [...gone]);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const B64URL = /^[A-Za-z0-9_-]+$/;

export interface SubscribeBody {
  tournamentId: string;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  teamIds: string[];
  events: PushEvent[];
}

/** Provjera pretplate iz preglednika. Vraća poruku greške ili null. */
export function checkSubscribe(body: unknown): string | null {
  const b = body as Partial<SubscribeBody> | null;
  if (!b || typeof b.tournamentId !== 'string' || !UUID.test(b.tournamentId)) return 'Nepoznat turnir.';
  const s = b.subscription;
  if (!s || !isPushEndpoint(s.endpoint)) return 'Ovaj preglednik ne podržava obavijesti.';
  const { p256dh, auth } = s.keys ?? ({} as { p256dh?: string; auth?: string });
  if (typeof p256dh !== 'string' || !B64URL.test(p256dh) || p256dh.length !== 87) return 'Neispravna pretplata.';
  if (typeof auth !== 'string' || !B64URL.test(auth) || auth.length !== 22) return 'Neispravna pretplata.';
  if (!Array.isArray(b.teamIds) || b.teamIds.length > 60 || !b.teamIds.every((t) => typeof t === 'string' && UUID.test(t))) return 'Neispravan popis momčadi.';
  if (!Array.isArray(b.events) || !b.events.every((e) => (PUSH_EVENTS as readonly string[]).includes(e))) return 'Neispravan popis obavijesti.';
  return null;
}
