import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, fail, onlyPost, pinStillValid, verifyToken } from './_lib.js';

const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
const MAX = 3 * 1024 * 1024;

// POST { type, data: 'data:image/png;base64,…' } → { path } (samo glavni PIN)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!onlyPost(req, res)) return;
  const s = verifyToken(req.headers.authorization);
  if (!s) return fail(res, 401, 'Prijava je istekla. Upiši PIN ponovno.');
  if (s.r !== 'admin') return fail(res, 403, 'Za ovo treba glavni PIN.');

  const { type, data } = (req.body ?? {}) as { type?: string; data?: string };
  const ext = type ? TYPES[type] : undefined;
  const base64 = typeof data === 'string' ? data.replace(/^data:[^;]+;base64,/, '') : '';
  if (!ext || !base64) return fail(res, 400, 'Slika mora biti PNG, JPG, WEBP ili SVG.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX) return fail(res, 400, 'Slika je veća od 3 MB.');

  const db = admin();
  if (!(await pinStillValid(db, s))) return fail(res, 401, 'PIN je promijenjen. Upiši novi PIN.');
  const path = `${s.t}/${randomUUID()}.${ext}`;
  const { error } = await db.storage.from('logos').upload(path, bytes, { contentType: type, upsert: false });
  if (error) {
    console.error(error);
    return fail(res, 500, 'Slika nije spremljena.');
  }
  res.status(200).json({ path });
}

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };
