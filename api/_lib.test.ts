import { beforeAll, describe, expect, it, vi } from 'vitest';
import { signToken, verifyToken } from './_lib.js';

beforeAll(() => {
  process.env.SESSION_SECRET = 'test-secret';
});

const data = { t: 't1', r: 'field' as const, f: 'teren-1', p: 'pin1', v: '2026-10-23T10:00:00Z' };

describe('prijava PIN-om (token)', () => {
  it('potpisani token se prihvaća', () => {
    expect(verifyToken(`Bearer ${signToken(data)}`)).toMatchObject(data);
  });

  it('promijenjen token se odbija', () => {
    const [payload, sig] = signToken(data).split('.');
    const forged = Buffer.from(JSON.stringify({ ...data, r: 'admin', exp: Date.now() + 1e9 })).toString('base64url');
    expect(verifyToken(`Bearer ${forged}.${sig}`)).toBeNull();
    expect(verifyToken(`Bearer ${payload}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`)).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
  });

  it('istekli token se odbija', () => {
    const token = signToken(data);
    vi.setSystemTime(Date.now() + 5 * 86400000);
    expect(verifyToken(`Bearer ${token}`)).toBeNull();
    vi.useRealTimers();
  });
});
