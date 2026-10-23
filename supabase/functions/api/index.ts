// Supabase Edge Function: /functions/v1/api/{login|mutate|upload|subscribe|unsubscribe}
// SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY Supabase daje sam.
// Tajna za potpisivanje prijave je u tablici app_secrets (vidi schema.sql).
// Obavijesti: ključ za potpis (VAPID) server napravi sam pri prvoj upotrebi
// i spremi u app_secrets ('vapid'); javni dio daje na /push-key.
// core.js nastaje iz server/core.ts naredbom `npm run build:edge`.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { login, mutate, notify, rawPublicKey, b64urlEncode, subscribe, unsubscribe, upload, type VapidKeys } from './core.js';

interface Reply {
  status: number;
  body: unknown;
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

let secret: string | null = null;
async function sessionSecret(): Promise<string> {
  if (secret) return secret;
  const { data, error } = await db.from('app_secrets').select('value').eq('name', 'session').single();
  if (error || !data) throw new Error('Nedostaje tajna za prijavu (app_secrets).');
  secret = data.value as string;
  return secret;
}

const VAPID_SUBJECT = 'https://cataleya-seven.vercel.app';
let vapid: VapidKeys | null = null;
async function vapidKeys(): Promise<VapidKeys> {
  if (vapid) return vapid;
  const read = () => db.from('app_secrets').select('value').eq('name', 'vapid').maybeSingle();
  let { data } = await read();
  if (!data) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const { kty, crv, d, x, y } = await crypto.subtle.exportKey('jwk', pair.privateKey);
    // Ako dva zahtjeva krenu istodobno, ostaje prvi ključ.
    await db.from('app_secrets').upsert({ name: 'vapid', value: JSON.stringify({ kty, crv, d, x, y }) }, { onConflict: 'name', ignoreDuplicates: true });
    ({ data } = await read());
  }
  vapid = { privateJwk: JSON.parse(data!.value as string), subject: VAPID_SUBJECT };
  return vapid;
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

/** Obavijesti se šalju nakon odgovora, da zapisničar ne čeka. */
function later(p: Promise<unknown>): void {
  const done = p.catch((e) => console.error('notify', e));
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(done);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-turnir-token, apikey, authorization, x-client-info',
};

function json(r: Reply): Response {
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ status: 405, body: { error: 'Samo POST.' } });
  const action = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return json({ status: 400, body: { error: 'Neispravan zahtjev.' } });
  }
  try {
    const s = await sessionSecret();
    const token = req.headers.get('x-turnir-token');
    if (action === 'login') return json(await login(db, s, body));
    if (action === 'mutate') {
      const r = await mutate(db, s, token, body);
      if (r.changes?.length) later(vapidKeys().then((k) => notify(db, k, r.changes![0].before.tournament_id, r.changes!)));
      return json(r);
    }
    if (action === 'push-key') return json({ status: 200, body: { key: b64urlEncode(rawPublicKey((await vapidKeys()).privateJwk)) } });
    if (action === 'subscribe') return json(await subscribe(db, body));
    if (action === 'unsubscribe') return json(await unsubscribe(db, body));
    if (action === 'upload') return json(await upload(db, s, token, body));
    return json({ status: 404, body: { error: 'Nepoznata radnja.' } });
  } catch (e) {
    console.error(e);
    return json({ status: 500, body: { error: 'Greška na serveru. Pokušaj ponovno.' } });
  }
});
