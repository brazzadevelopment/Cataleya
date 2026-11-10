import { describe, expect, it } from 'vitest';
import { fcmPayload, serviceAccountJwt } from './fcm';
import { checkSubscribe } from './notify';

function pem(der: ArrayBuffer): string {
  const b = Buffer.from(der).toString('base64').match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN PRIVATE KEY-----\n${b}\n-----END PRIVATE KEY-----\n`;
}

describe('obavijesti za mobilne aplikacije (Firebase)', () => {
  it('potpisuje JWT servisnog računa ispravnim RS256 potpisom', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const sa = { project_id: 'cataleya', client_email: 'push@cataleya.iam.gserviceaccount.com', private_key: pem(await crypto.subtle.exportKey('pkcs8', pair.privateKey)) };
    const jwt = await serviceAccountJwt(sa, 1_000_000_000_000);
    const [h, c, sig] = jwt.split('.');
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(claims).toMatchObject({ iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: 1_000_000_000, exp: 1_000_003_600 });
    expect(claims.scope).toContain('firebase.messaging');
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, Buffer.from(sig, 'base64url'), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });

  it('poruka ima obavijest, poveznicu i grupiranje po utakmici', () => {
    const p = fcmPayload('tok', { title: '⚽ Gol!', body: 'A 1:0 B', tag: 'm1', url: '/t/x/utakmica/m1' });
    expect(p.message.token).toBe('tok');
    expect(p.message.notification).toEqual({ title: '⚽ Gol!', body: 'A 1:0 B' });
    expect(p.message.data).toEqual({ url: '/t/x/utakmica/m1', tag: 'm1' });
    expect(p.message.android.notification.tag).toBe('m1');
  });

  it('prima pretplatu iz aplikacije (Firebase token)', () => {
    const base = { teamIds: [], clubIds: ['22932050-a898-99b2-bccb-6a14c141e40f'], events: ['goal'] };
    expect(checkSubscribe({ ...base, fcmToken: 'dQw4w9WgXcQ:APA91bH-abcdefghijklmnop' })).toBeNull();
    expect(checkSubscribe({ ...base, fcmToken: 'kratko' })).not.toBeNull();
    expect(checkSubscribe({ ...base, fcmToken: 'ima razmak u sebi i jos teksta' })).not.toBeNull();
  });
});
