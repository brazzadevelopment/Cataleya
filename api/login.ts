import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, fail, isUuid, onlyPost, signToken } from './_lib.js';

// POST { tournamentId, pin } → { tournamentId, role, fieldId, token }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!onlyPost(req, res)) return;
  const { tournamentId, pin } = (req.body ?? {}) as { tournamentId?: unknown; pin?: unknown };
  if (!isUuid(tournamentId) || typeof pin !== 'string' || !/^[0-9]{4,8}$/.test(pin)) {
    return fail(res, 401, 'PIN nije točan.');
  }
  try {
    const { data, error } = await admin().rpc('check_pin', { p_tournament_id: tournamentId, p_pin: pin });
    if (error) throw error;
    const match = (data as { id: string; role: 'admin' | 'field'; field_id: string | null; updated_at: string }[])[0];
    if (!match) return fail(res, 401, 'PIN nije točan.');
    const token = signToken({ t: tournamentId, r: match.role, f: match.field_id, p: match.id, v: match.updated_at });
    res.status(200).json({ tournamentId, role: match.role, fieldId: match.field_id, token });
  } catch (e) {
    console.error(e);
    fail(res, 500, 'Prijava trenutno ne radi. Pokušaj ponovno.');
  }
}
