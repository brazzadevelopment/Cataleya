import { describe, expect, it, vi } from 'vitest';
import { signToken, verifyToken } from './core.js';

const SECRET = 'test-secret';
const data = { t: 't1', r: 'field' as const, f: 'teren-1', p: 'pin1', v: '2026-10-23T10:00:00Z' };

describe('prijava PIN-om (token)', () => {
  it('potpisani token se prihvaća', () => {
    expect(verifyToken(SECRET, signToken(SECRET, data))).toMatchObject(data);
  });

  it('promijenjen ili tuđi token se odbija', () => {
    const token = signToken(SECRET, data);
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...data, r: 'admin', exp: Date.now() + 1e9 })).toString('base64url');
    expect(verifyToken(SECRET, `${forged}.${sig}`)).toBeNull();
    expect(verifyToken(SECRET, `${payload}.${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`)).toBeNull();
    expect(verifyToken('drugi-secret', token)).toBeNull();
    expect(verifyToken(SECRET, null)).toBeNull();
  });

  it('istekli token se odbija', () => {
    const token = signToken(SECRET, data);
    vi.setSystemTime(Date.now() + 5 * 86400000);
    expect(verifyToken(SECRET, token)).toBeNull();
    vi.useRealTimers();
  });
});
