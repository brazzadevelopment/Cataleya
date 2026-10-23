// Ne uređuj: nastaje iz server/core.ts (npm run build:edge).

// server/core.ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

// src/lib/standings.ts
var emptyTotals = () => ({
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points: 0,
  cards: 0
});
function isCounted(m) {
  return m.status === "finished" && m.home_team_id != null && m.away_team_id != null && m.home_score != null && m.away_score != null;
}
function totalsFor(teamIds, matches, s) {
  const ids = new Set(teamIds);
  const out = new Map(teamIds.map((id) => [id, emptyTotals()]));
  for (const m of matches) {
    if (!isCounted(m) || !ids.has(m.home_team_id) || !ids.has(m.away_team_id)) continue;
    const h = out.get(m.home_team_id);
    const a = out.get(m.away_team_id);
    h.played++;
    a.played++;
    h.cards += (m.home_yellow ?? 0) + (m.home_red ?? 0);
    a.cards += (m.away_yellow ?? 0) + (m.away_red ?? 0);
    h.goalsFor += m.home_score;
    h.goalsAgainst += m.away_score;
    a.goalsFor += m.away_score;
    a.goalsAgainst += m.home_score;
    if (m.home_score > m.away_score) {
      h.won++;
      a.lost++;
      h.points += s.points_win;
      a.points += s.points_loss;
    } else if (m.home_score < m.away_score) {
      a.won++;
      h.lost++;
      a.points += s.points_win;
      h.points += s.points_loss;
    } else {
      h.drawn++;
      a.drawn++;
      h.points += s.points_draw;
      a.points += s.points_draw;
    }
  }
  return out;
}
function breakTie(tied, criteria, overall, matches, lot, s) {
  if (tied.length < 2 || criteria.length === 0) return [tied];
  const [criterion, ...rest] = criteria;
  let key;
  switch (criterion) {
    case "head_to_head": {
      const h2h = totalsFor(tied, matches, s);
      key = (id) => h2h.get(id).points;
      break;
    }
    case "goal_difference":
      key = (id) => overall.get(id).goalsFor - overall.get(id).goalsAgainst;
      break;
    case "goals_for":
      key = (id) => overall.get(id).goalsFor;
      break;
    case "wins":
      key = (id) => overall.get(id).won;
      break;
    case "fewer_goals_against":
      key = (id) => -overall.get(id).goalsAgainst;
      break;
    case "fewer_cards":
      key = (id) => -overall.get(id).cards;
      break;
    case "lot":
      if (tied.some((id) => lot.get(id) == null)) return breakTie(tied, rest, overall, matches, lot, s);
      key = (id) => -lot.get(id);
      break;
  }
  const buckets = /* @__PURE__ */ new Map();
  for (const id of tied) {
    const k = key(id) ?? 0;
    buckets.set(k, [...buckets.get(k) ?? [], id]);
  }
  const ordered = [...buckets.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);
  if (ordered.length === 1) return breakTie(tied, rest, overall, matches, lot, s);
  return ordered.flatMap((ids) => breakTie(ids, rest, overall, matches, lot, s));
}
function computeGroupTable(groupTeams, groupMatches, settings, displayName = (id) => id) {
  const teamIds = groupTeams.map((gt) => gt.team_id);
  const lot = new Map(groupTeams.map((gt) => [gt.team_id, gt.lot_rank]));
  const overall = totalsFor(teamIds, groupMatches, settings);
  const byPoints = /* @__PURE__ */ new Map();
  for (const id of teamIds) {
    const p = overall.get(id).points;
    byPoints.set(p, [...byPoints.get(p) ?? [], id]);
  }
  const blocks = [...byPoints.entries()].sort((a, b) => b[0] - a[0]).flatMap(([, ids]) => breakTie(ids, settings.tiebreakers, overall, groupMatches, lot, settings));
  const rows = [];
  let position = 1;
  for (const block of blocks) {
    const sorted = [...block].sort((a, b) => displayName(a).localeCompare(displayName(b), "hr"));
    for (const id of sorted) {
      const t = overall.get(id);
      rows.push({
        teamId: id,
        ...t,
        goalDiff: t.goalsFor - t.goalsAgainst,
        rank: position,
        needsLot: block.length > 1
      });
    }
    position += block.length;
  }
  const relevant = groupMatches.filter((m) => m.status !== "cancelled");
  const complete = relevant.length > 0 && relevant.every((m) => m.status === "finished");
  return { rows, complete, needsLot: rows.some((r) => r.needsLot) };
}
function teamAtPosition(table, position) {
  if (!table.complete) return null;
  const atRank = table.rows.filter((r) => r.rank === position);
  return atRank.length === 1 ? atRank[0].teamId : null;
}
function rankAcrossGroups(tables, position, settings) {
  const rows = [];
  let complete = tables.length > 0;
  for (const { groupName, table } of tables) {
    const atRank = table.rows.filter((r) => r.rank === position);
    if (!table.complete || atRank.length !== 1) complete = false;
    if (atRank.length === 1) rows.push({ ...atRank[0], groupName });
  }
  const keys = [(r) => r.points];
  for (const c of settings.tiebreakers) {
    if (c === "goal_difference") keys.push((r) => r.goalDiff);
    else if (c === "goals_for") keys.push((r) => r.goalsFor);
    else if (c === "wins") keys.push((r) => r.won);
    else if (c === "fewer_goals_against") keys.push((r) => -r.goalsAgainst);
    else if (c === "fewer_cards") keys.push((r) => -r.cards);
  }
  const cmp = (a, b) => {
    for (const k of keys) if (k(a) !== k(b)) return k(b) - k(a);
    return 0;
  };
  rows.sort((a, b) => cmp(a, b) || a.groupName.localeCompare(b.groupName));
  const ranked = [];
  rows.forEach((r, i) => {
    const prev = ranked[i - 1];
    ranked.push({ ...r, crossRank: prev && cmp(prev, r) === 0 ? prev.crossRank : i + 1 });
  });
  return { rows: ranked, complete };
}
function nthAcrossGroups(cross, nth) {
  if (!cross.complete) return null;
  const at = cross.rows.filter((r) => r.crossRank === nth);
  return at.length === 1 ? at[0].teamId : null;
}

// src/lib/advancement.ts
function parseSource(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const g = /^([1-9][0-9]?)\s*\.?\s*([A-Z]{1,2})$/.exec(s.toUpperCase());
  if (g) return { kind: "group", position: Number(g[1]), group: g[2] };
  const b = /^([1-9])\s*#\s*([1-9][0-9]?)$/.exec(s);
  if (b) return { kind: "best", position: Number(b[1]), nth: Number(b[2]) };
  const wl = /^([WL]):(\S{1,12})$/.exec(s);
  if (wl) return { kind: wl[1] === "W" ? "winner" : "loser", code: wl[2] };
  return null;
}
function matchOutcome(m) {
  if (m.status !== "finished" || !m.home_team_id || !m.away_team_id) return null;
  if (m.home_score == null || m.away_score == null) return null;
  let homeWins;
  if (m.home_score !== m.away_score) {
    homeWins = m.home_score > m.away_score;
  } else if (m.home_penalties != null && m.away_penalties != null && m.home_penalties !== m.away_penalties) {
    homeWins = m.home_penalties > m.away_penalties;
  } else {
    return null;
  }
  return homeWins ? { winner: m.home_team_id, loser: m.away_team_id } : { winner: m.away_team_id, loser: m.home_team_id };
}
function groupTables(data) {
  const tables = /* @__PURE__ */ new Map();
  for (const g of data.groups) {
    tables.set(
      g.name,
      computeGroupTable(
        data.groupTeams.filter((gt) => gt.group_id === g.id),
        data.matches.filter((m) => m.group_id === g.id && m.stage === "group"),
        data.settings
      )
    );
  }
  return tables;
}
function resolve(src, tables, byCode, settings) {
  if (!src) return null;
  if (src.kind === "group") {
    const table = tables.get(src.group);
    return table ? teamAtPosition(table, src.position) : null;
  }
  if (src.kind === "best") {
    const cross = rankAcrossGroups([...tables].map(([groupName, table]) => ({ groupName, table })), src.position, settings);
    return nthAcrossGroups(cross, src.nth);
  }
  const m = byCode.get(src.code);
  const outcome = m ? matchOutcome(m) : null;
  if (!outcome) return null;
  return src.kind === "winner" ? outcome.winner : outcome.loser;
}
function computeAdvancement(data) {
  const tables = groupTables(data);
  const current = new Map(data.matches.map((m) => [m.id, { ...m }]));
  const changed = /* @__PURE__ */ new Set();
  for (let pass = 0; pass < 10; pass++) {
    const byCode = new Map([...current.values()].filter((m) => m.code).map((m) => [m.code, m]));
    let any = false;
    for (const m of current.values()) {
      if (m.teams_locked || m.status !== "scheduled") continue;
      if (!m.home_source && !m.away_source) continue;
      const home = m.home_source ? resolve(parseSource(m.home_source), tables, byCode, data.settings) : m.home_team_id;
      const away = m.away_source ? resolve(parseSource(m.away_source), tables, byCode, data.settings) : m.away_team_id;
      if (home !== m.home_team_id || away !== m.away_team_id) {
        m.home_team_id = home;
        m.away_team_id = away;
        changed.add(m.id);
        any = true;
      }
    }
    if (!any) break;
  }
  return [...changed].map((id) => {
    const m = current.get(id);
    return { id, home_team_id: m.home_team_id, away_team_id: m.away_team_id };
  });
}

// src/lib/mutations.ts
var EDITABLE = {
  tournaments: [
    "name",
    "place",
    "venue",
    "start_date",
    "end_date",
    "logo_path",
    "cover_path",
    "color_primary",
    "color_secondary",
    "description",
    "rules",
    "points_win",
    "points_draw",
    "points_loss",
    "tiebreakers",
    "scorers_enabled",
    "is_published"
  ],
  categories: ["id", "name", "birth_year", "match_minutes", "players_on_field", "sort_order"],
  fields: ["id", "name", "venue", "maps_url", "sort_order"],
  teams: ["id", "category_id", "name", "short_name", "logo_path"],
  groups: ["id", "category_id", "name", "sort_order"],
  group_teams: ["category_id", "group_id", "team_id", "lot_rank"],
  matches: [
    "id",
    "category_id",
    "stage",
    "group_id",
    "code",
    "label",
    "home_team_id",
    "away_team_id",
    "home_source",
    "away_source",
    "field_id",
    "starts_at",
    "duration_minutes",
    "home_score",
    "away_score",
    "home_penalties",
    "away_penalties",
    "status",
    "home_yellow",
    "away_yellow",
    "home_red",
    "away_red",
    "bracket",
    "winner_place",
    "loser_place",
    "teams_locked"
  ]
};
var MutationError = class extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
};
function validScore(n) {
  return n === null || Number.isInteger(n) && n >= 0 && n < 100;
}
function validateScorePatch(p) {
  if (![p.home_score, p.away_score, p.home_penalties, p.away_penalties].every(validScore)) {
    throw new MutationError("Rezultat mora biti cijeli broj od 0 do 99.");
  }
  if (p.home_score === null !== (p.away_score === null)) throw new MutationError("Upi\u0161i golove za obje mom\u010Dadi.");
  if (p.home_penalties === null !== (p.away_penalties === null)) throw new MutationError("Upi\u0161i jedanaesterce za obje mom\u010Dadi.");
  if (p.status === "finished" && p.home_score === null) throw new MutationError("Zavr\u0161ena utakmica mora imati rezultat.");
  if (!["scheduled", "live", "finished", "cancelled"].includes(p.status)) throw new MutationError("Nepoznat status.");
  for (const c of [p.home_yellow, p.away_yellow, p.home_red, p.away_red]) {
    if (c !== void 0 && !(Number.isInteger(c) && c >= 0 && c < 30)) throw new MutationError("Broj kartona nije ispravan.");
  }
}
function authorize(m, actor, match) {
  if (m.type === "score") {
    if (!match) throw new MutationError("Utakmica ne postoji.", 404);
    if (actor.role === "field" && match.field_id !== actor.fieldId) {
      throw new MutationError("Ova utakmica nije na tvom terenu.", 403);
    }
    validateScorePatch(m.patch);
    const { home_score, away_score, home_penalties, away_penalties, status, home_yellow, away_yellow, home_red, away_red } = m.patch;
    const cards = Object.fromEntries(Object.entries({ home_yellow, away_yellow, home_red, away_red }).filter(([, v]) => v !== void 0));
    return { type: "score", matchId: m.matchId, patch: { home_score, away_score, home_penalties, away_penalties, status, ...cards } };
  }
  if (actor.role !== "admin") throw new MutationError("Za ovo treba glavni PIN.", 403);
  if (m.type === "setPin") {
    if (!/^[0-9]{4,8}$/.test(m.pin)) throw new MutationError("PIN mora imati 4 do 8 znamenki.");
    return m;
  }
  if (!(m.table in EDITABLE)) throw new MutationError("Nepoznata tablica.");
  if (m.type === "delete") {
    if (m.table === "tournaments") throw new MutationError("Turnir se ne bri\u0161e iz aplikacije.", 403);
    return m;
  }
  const allowed = EDITABLE[m.table];
  const row = {};
  for (const [k, v] of Object.entries(m.row)) if (allowed.includes(k)) row[k] = v;
  if (m.table === "matches" && row.status === "finished" && row.home_score == null) {
    throw new MutationError("Zavr\u0161ena utakmica mora imati rezultat.");
  }
  return { ...m, row };
}

// server/push.ts
var subtle = globalThis.crypto.subtle;
var enc = new TextEncoder();
function b64urlEncode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}
async function hmac(key, data) {
  const k = await subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", k, data));
}
function rawPublicKey(jwk) {
  return concat(new Uint8Array([4]), b64urlDecode(jwk.x), b64urlDecode(jwk.y));
}
function publicJwk(raw) {
  return { kty: "EC", crv: "P-256", x: b64urlEncode(raw.slice(1, 33)), y: b64urlEncode(raw.slice(33, 65)), ext: true };
}
async function encryptPayload(payload, sub, opts = {}) {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);
  let senderPrivate;
  let senderPublic;
  if (opts.senderJwk) {
    senderPrivate = await subtle.importKey("jwk", opts.senderJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    senderPublic = rawPublicKey(opts.senderJwk);
  } else {
    const pair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    senderPrivate = pair.privateKey;
    senderPublic = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  }
  const uaKey = await subtle.importKey("jwk", publicJwk(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: uaKey }, senderPrivate, 256));
  const one = new Uint8Array([1]);
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, senderPublic, one));
  const salt = opts.salt ?? globalThis.crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), one))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), one))).slice(0, 12);
  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = senderPublic.length;
  return concat(header, senderPublic, cipher);
}
async function vapidAuthorization(endpoint, keys, now = Date.now()) {
  const head = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1e3) + 12 * 3600,
    sub: keys.subject
  })));
  const key = await subtle.importKey("jwk", keys.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${claims}`)));
  return `vapid t=${head}.${claims}.${b64urlEncode(sig)}, k=${b64urlEncode(rawPublicKey(keys.privateJwk))}`;
}
async function sendPush(sub, message, keys, topic) {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, keys),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
      Urgency: "high",
      ...topic ? { Topic: topic } : {}
    },
    body
  });
  return res.status;
}
var PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^jmt\d+\.google\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/
];
function isPushEndpoint(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length > 1e3) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

// server/notify.ts
var PUSH_EVENTS = ["goal", "start", "end", "card"];
function scoreLine(m, home, away) {
  const pens = m.home_penalties != null && m.away_penalties != null ? ` (jedanaesterci ${m.home_penalties}:${m.away_penalties})` : "";
  return `${home} ${m.home_score ?? 0}:${m.away_score ?? 0} ${away}${pens}`;
}
function matchNotes(c, name, where = "") {
  const { before: b, after: a } = c;
  if (!a.home_team_id || !a.away_team_id) return [];
  const home = name(a.home_team_id);
  const away = name(a.away_team_id);
  const teams = [a.home_team_id, a.away_team_id];
  const tail = where ? ` \xB7 ${where}` : "";
  const note = (event, title, body) => ({ event, matchId: a.id, teams, title, body });
  const out = [];
  if (b.status === "scheduled" && a.status === "live") {
    out.push(note("start", "\u25B6\uFE0F Po\u010Dela je utakmica", `${home} \u2013 ${away}${tail}`));
  }
  if (a.status === "live") {
    if ((a.home_score ?? 0) > (b.home_score ?? 0)) out.push(note("goal", `\u26BD Gol! ${home}`, scoreLine(a, home, away)));
    if ((a.away_score ?? 0) > (b.away_score ?? 0)) out.push(note("goal", `\u26BD Gol! ${away}`, scoreLine(a, home, away)));
  }
  if (b.status !== "finished" && a.status === "finished") {
    out.push(note("end", "\u{1F3C1} Kraj utakmice", scoreLine(a, home, away) + tail));
  }
  const cards = [
    ["home_yellow", "\u{1F7E8} \u017Duti karton", home],
    ["away_yellow", "\u{1F7E8} \u017Duti karton", away],
    ["home_red", "\u{1F7E5} Crveni karton", home],
    ["away_red", "\u{1F7E5} Crveni karton", away]
  ];
  for (const [k, title, team] of cards) {
    if ((a[k] ?? 0) > (b[k] ?? 0)) out.push(note("card", `${title}: ${team}`, `${home} \u2013 ${away}${tail}`));
  }
  return out;
}
async function notify(db, keys, tournamentId, changes) {
  if (!changes.length) return;
  const ids = [...new Set(changes.flatMap((c) => [c.after.home_team_id, c.after.away_team_id]).filter((x) => !!x))];
  if (!ids.length) return;
  const [teams, fields, cats, tour, subs] = await Promise.all([
    db.from("teams").select("id, name").in("id", ids),
    db.from("fields").select("id, name").eq("tournament_id", tournamentId),
    db.from("categories").select("id, name").eq("tournament_id", tournamentId),
    db.from("tournaments").select("slug").eq("id", tournamentId).single(),
    db.from("push_subscriptions").select("endpoint, p256dh, auth, team_ids, events").eq("tournament_id", tournamentId).overlaps("team_ids", ids)
  ]);
  if (subs.error) throw subs.error;
  const names = new Map((teams.data ?? []).map((t) => [t.id, t.name]));
  const fieldName = new Map((fields.data ?? []).map((f) => [f.id, f.name]));
  const catName = new Map((cats.data ?? []).map((c) => [c.id, c.name]));
  const slug = tour.data?.slug ?? "";
  const notes = changes.flatMap((c) => {
    const where = [catName.get(c.after.category_id) && `${catName.get(c.after.category_id)} godi\u0161te`, c.after.field_id && fieldName.get(c.after.field_id)].filter(Boolean).join(" \xB7 ");
    return matchNotes(c, (id) => names.get(id) ?? "?", where);
  });
  const gone = /* @__PURE__ */ new Set();
  const sends = [];
  for (const s of subs.data ?? []) {
    if (!isPushEndpoint(s.endpoint)) continue;
    for (const n of notes) {
      if (!s.events.includes(n.event) || !n.teams.some((t) => s.team_ids.includes(t))) continue;
      const message = { title: n.title, body: n.body, tag: n.matchId, url: `/t/${slug}/utakmica/${n.matchId}` };
      sends.push(
        sendPush(s, message, keys, n.matchId.replace(/-/g, "")).then((status) => {
          if (status === 404 || status === 410) gone.add(s.endpoint);
          else if (status >= 400) console.error("push", status, new URL(s.endpoint).host);
        }).catch((e) => console.error("push", e))
      );
    }
  }
  await Promise.all(sends);
  if (gone.size) await db.from("push_subscriptions").delete().in("endpoint", [...gone]);
}
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var B64URL = /^[A-Za-z0-9_-]+$/;
function checkSubscribe(body) {
  const b = body;
  if (!b || typeof b.tournamentId !== "string" || !UUID.test(b.tournamentId)) return "Nepoznat turnir.";
  const s = b.subscription;
  if (!s || !isPushEndpoint(s.endpoint)) return "Ovaj preglednik ne podr\u017Eava obavijesti.";
  const { p256dh, auth } = s.keys ?? {};
  if (typeof p256dh !== "string" || !B64URL.test(p256dh) || p256dh.length !== 87) return "Neispravna pretplata.";
  if (typeof auth !== "string" || !B64URL.test(auth) || auth.length !== 22) return "Neispravna pretplata.";
  if (!Array.isArray(b.teamIds) || b.teamIds.length > 60 || !b.teamIds.every((t) => typeof t === "string" && UUID.test(t))) return "Neispravan popis mom\u010Dadi.";
  if (!Array.isArray(b.events) || !b.events.every((e) => PUSH_EVENTS.includes(e))) return "Neispravan popis obavijesti.";
  return null;
}

// server/core.ts
var SESSION_DAYS = 4;
var fail = (status, error) => ({ status, body: { error } });
var b64 = (s) => Buffer.from(s).toString("base64url");
function signToken(secret, data) {
  const payload = b64(JSON.stringify({ ...data, exp: Date.now() + SESSION_DAYS * 864e5 }));
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function verifyToken(secret, token) {
  const raw = token?.replace(/^Bearer\s+/i, "");
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}
async function pinStillValid(db, s) {
  const { data } = await db.from("pins").select("updated_at").eq("id", s.p).eq("tournament_id", s.t).maybeSingle();
  return !!data && new Date(data.updated_at).getTime() === new Date(s.v).getTime();
}
var isUuid = (s) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
async function login(db, secret, body) {
  const { tournamentId, pin } = body ?? {};
  if (!isUuid(tournamentId) || typeof pin !== "string" || !/^[0-9]{4,8}$/.test(pin)) {
    return fail(401, "PIN nije to\u010Dan.");
  }
  const { data, error } = await db.rpc("check_pin", { p_tournament_id: tournamentId, p_pin: pin });
  if (error) {
    console.error(error);
    return fail(500, "Prijava trenutno ne radi. Poku\u0161aj ponovno.");
  }
  const match = data[0];
  if (!match) return fail(401, "PIN nije to\u010Dan.");
  const token = signToken(secret, { t: tournamentId, r: match.role, f: match.field_id, p: match.id, v: match.updated_at });
  return { status: 200, body: { tournamentId, role: match.role, fieldId: match.field_id, token } };
}
async function mutate(db, secret, token, body) {
  const session = verifyToken(secret, token);
  if (!session) return fail(401, "Prijava je istekla. Upi\u0161i PIN ponovno.");
  const mutations = body?.mutations;
  if (!Array.isArray(mutations) || mutations.length === 0 || mutations.length > 300) {
    return fail(400, "Neispravan zahtjev.");
  }
  if (!await pinStillValid(db, session)) return fail(401, "PIN je promijenjen. Upi\u0161i novi PIN.");
  const categories = /* @__PURE__ */ new Set();
  const changes = [];
  try {
    for (const raw of mutations) {
      for (const c of await apply(db, session, raw, changes)) categories.add(c);
    }
    for (const c of categories) await advance(db, session.t, c);
    return { status: 200, body: { ok: true }, changes };
  } catch (e) {
    if (e instanceof MutationError) return fail(e.status, e.message);
    console.error(e);
    const msg = e?.message ?? "";
    if (/duplicate key|already exists|23505/.test(msg)) return fail(409, "Ve\u0107 postoji zapis s istim nazivom ili oznakom.");
    return fail(500, "Spremanje nije uspjelo. Poku\u0161aj ponovno.");
  }
}
var TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
var MAX_UPLOAD = 3 * 1024 * 1024;
async function upload(db, secret, token, body) {
  const s = verifyToken(secret, token);
  if (!s) return fail(401, "Prijava je istekla. Upi\u0161i PIN ponovno.");
  if (s.r !== "admin") return fail(403, "Za ovo treba glavni PIN.");
  const { type, data } = body ?? {};
  const ext = type ? TYPES[type] : void 0;
  const base64 = typeof data === "string" ? data.replace(/^data:[^;]+;base64,/, "") : "";
  if (!ext || !base64) return fail(400, "Slika mora biti PNG, JPG, WEBP ili SVG.");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_UPLOAD) return fail(400, "Slika je ve\u0107a od 3 MB.");
  if (!await pinStillValid(db, s)) return fail(401, "PIN je promijenjen. Upi\u0161i novi PIN.");
  const path = `${s.t}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from("logos").upload(path, bytes, { contentType: type, upsert: false });
  if (error) {
    console.error(error);
    return fail(500, "Slika nije spremljena.");
  }
  return { status: 200, body: { path } };
}
async function subscribe(db, body) {
  const err = checkSubscribe(body);
  if (err) return fail(400, err);
  const b = body;
  const { error } = await db.from("push_subscriptions").upsert({
    endpoint: b.subscription.endpoint,
    tournament_id: b.tournamentId,
    p256dh: b.subscription.keys.p256dh,
    auth: b.subscription.keys.auth,
    team_ids: b.teamIds,
    events: b.events
  }, { onConflict: "endpoint" });
  if (error) {
    console.error(error);
    return fail(500, "Obavijesti nisu uklju\u010Dene. Poku\u0161aj ponovno.");
  }
  return { status: 200, body: { ok: true } };
}
async function unsubscribe(db, body) {
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 1e3) return fail(400, "Neispravan zahtjev.");
  const { error } = await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    console.error(error);
    return fail(500, "Obavijesti nisu isklju\u010Dene. Poku\u0161aj ponovno.");
  }
  return { status: 200, body: { ok: true } };
}
var KEY = { group_teams: "team_id" };
async function apply(db, s, raw, changes) {
  const actor = { role: s.r, fieldId: s.f };
  if (raw.type === "score") {
    const { data: match } = await db.from("matches").select("*").eq("id", raw.matchId).eq("tournament_id", s.t).maybeSingle();
    const m2 = authorize(raw, actor, match);
    if (m2.type !== "score") return [];
    const { error: error2 } = await db.from("matches").update(m2.patch).eq("id", m2.matchId).eq("tournament_id", s.t);
    if (error2) throw error2;
    const before = match;
    changes.push({ before, after: { ...before, ...m2.patch } });
    return [before.category_id];
  }
  const m = authorize(raw, actor);
  if (m.type === "setPin") {
    if (m.fieldId) await ensureOwn(db, "fields", "id", m.fieldId, s.t);
    const { error: error2 } = await db.rpc("set_pin", { p_tournament_id: s.t, p_field_id: m.fieldId, p_pin: m.pin });
    if (error2) throw new MutationError(error2.message.includes("ve\u0107 koristi") ? "Taj PIN ve\u0107 koristi netko drugi u ovom turniru." : "PIN nije spremljen.");
    return [];
  }
  if (m.type === "delete") {
    const key2 = KEY[m.table] ?? "id";
    const { data: before } = await db.from(m.table).select("category_id").eq(key2, m.id).eq("tournament_id", s.t).maybeSingle();
    const { error: error2 } = await db.from(m.table).delete().eq(key2, m.id).eq("tournament_id", s.t);
    if (error2) throw error2;
    const cat2 = before?.category_id;
    return cat2 && (m.table === "matches" || m.table === "group_teams" || m.table === "teams") ? [cat2] : [];
  }
  if (m.type !== "upsert") return [];
  if (m.table === "tournaments") {
    const { error: error2 } = await db.from("tournaments").update(m.row).eq("id", s.t);
    if (error2) throw error2;
    const { data } = await db.from("categories").select("id").eq("tournament_id", s.t);
    return (data ?? []).map((c) => c.id);
  }
  const key = KEY[m.table] ?? "id";
  const id = m.row[key];
  if (typeof id !== "string") throw new MutationError("Nedostaje oznaka zapisa.");
  const { data: existing } = await db.from(m.table).select(m.table === "matches" ? "*" : "tournament_id").eq(key, id).maybeSingle();
  if (existing && existing.tournament_id !== s.t) throw new MutationError("Nema\u0161 ovlasti za taj zapis.", 403);
  const row = { ...m.row, tournament_id: s.t };
  const { error } = await db.from(m.table).upsert(row, { onConflict: m.table === "group_teams" ? "group_id,team_id" : "id" });
  if (error) throw error;
  if (m.table === "matches" && existing) {
    const before = existing;
    changes.push({ before, after: { ...before, ...row } });
  }
  const cat = row.category_id;
  if (m.table === "matches" || m.table === "group_teams") {
    if (cat) return [cat];
    const { data } = await db.from(m.table).select("category_id").eq(key, id).maybeSingle();
    return data ? [data.category_id] : [];
  }
  return [];
}
async function ensureOwn(db, table, key, id, tournamentId) {
  const { data } = await db.from(table).select("tournament_id").eq(key, id).maybeSingle();
  if (!data || data.tournament_id !== tournamentId) {
    throw new MutationError("Nema\u0161 ovlasti za taj zapis.", 403);
  }
}
async function advance(db, tournamentId, categoryId) {
  const [t, g, gt, m] = await Promise.all([
    db.from("tournaments").select("*").eq("id", tournamentId).single(),
    db.from("groups").select("*").eq("category_id", categoryId),
    db.from("group_teams").select("*").eq("category_id", categoryId),
    db.from("matches").select("*").eq("category_id", categoryId)
  ]);
  for (const r of [t, g, gt, m]) if (r.error) throw r.error;
  const updates = computeAdvancement({
    groups: g.data,
    groupTeams: gt.data,
    matches: m.data,
    settings: t.data
  });
  for (const u of updates) {
    const { error } = await db.from("matches").update({ home_team_id: u.home_team_id, away_team_id: u.away_team_id }).eq("id", u.id).eq("tournament_id", tournamentId);
    if (error) throw error;
  }
}
export {
  b64urlEncode,
  login,
  mutate,
  notify,
  rawPublicKey,
  signToken,
  subscribe,
  unsubscribe,
  upload,
  verifyToken
};
