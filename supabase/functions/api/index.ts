// Supabase Edge Function: /functions/v1/api/{login|mutate|upload}
// SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY Supabase daje sam.
// Tajna za potpisivanje prijave je u tablici app_secrets (vidi schema.sql).
// core.js nastaje iz server/core.ts naredbom `npm run build:edge`.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { login, mutate, upload } from './core.js';

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
    if (action === 'mutate') return json(await mutate(db, s, token, body));
    if (action === 'upload') return json(await upload(db, s, token, body));
    return json({ status: 404, body: { error: 'Nepoznata radnja.' } });
  } catch (e) {
    console.error(e);
    return json({ status: 500, body: { error: 'Greška na serveru. Pokušaj ponovno.' } });
  }
});
