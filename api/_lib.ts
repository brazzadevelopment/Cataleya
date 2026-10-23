// Zajedničko za serverske funkcije. Tajne su samo u varijablama okruženja na Vercelu.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '../src/lib/types.js';

export interface TokenData {
  t: string; // tournament id
  r: Role;
  f: string | null; // field id
  p: string; // id PIN-a
  v: string; // kad je PIN postavljen; nakon promjene PIN-a stara prijava ne vrijedi
  exp: number; // ms
}

const SESSION_DAYS = 4;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Nedostaje varijabla okruženja ${name}.`);
  return v;
}

export function admin(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');

export function signToken(data: Omit<TokenData, 'exp'>): string {
  const payload = b64(JSON.stringify({ ...data, exp: Date.now() + SESSION_DAYS * 86400000 }));
  const sig = createHmac('sha256', env('SESSION_SECRET')).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(header: string | undefined): TokenData | null {
  const token = header?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', env('SESSION_SECRET')).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenData;
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

/** Vrijedi li još PIN kojim je osoba ušla (nije promijenjen ni obrisan). */
export async function pinStillValid(db: SupabaseClient, s: TokenData): Promise<boolean> {
  const { data } = await db.from('pins').select('updated_at').eq('id', s.p).eq('tournament_id', s.t).maybeSingle();
  return !!data && new Date((data as { updated_at: string }).updated_at).getTime() === new Date(s.v).getTime();
}

export function fail(res: VercelResponse, status: number, error: string): void {
  res.status(status).json({ error });
}

export function onlyPost(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'POST') {
    fail(res, 405, 'Samo POST.');
    return false;
  }
  return true;
}

export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
