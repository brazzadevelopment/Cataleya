import { describe, expect, it } from 'vitest';
import { b64urlDecode, b64urlEncode, encryptPayload, isPushEndpoint, rawPublicKey, vapidAuthorization } from './push';

// Primjer iz RFC 8291, dodatak A.
const rfc = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

function jwkFrom(privateD: string, publicRaw: string): JsonWebKey {
  const p = b64urlDecode(publicRaw);
  return { kty: 'EC', crv: 'P-256', d: privateD, x: b64urlEncode(p.slice(1, 33)), y: b64urlEncode(p.slice(33)) };
}

describe('web push', () => {
  it('šifrira poruku točno kao primjer iz RFC 8291', async () => {
    const body = await encryptPayload(
      b64urlDecode(rfc.plaintext),
      { endpoint: 'https://fcm.googleapis.com/x', p256dh: rfc.uaPublic, auth: rfc.auth },
      { senderJwk: jwkFrom(rfc.asPrivate, rfc.asPublic), salt: b64urlDecode(rfc.salt) },
    );
    expect(b64urlEncode(body)).toBe(rfc.body);
  });

  it('potpisuje pošiljatelja (VAPID) ispravnim ES256 potpisom', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', { privateJwk, subject: 'https://primjer.hr' }, 1_000_000_000_000);
    const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(b64urlEncode(rawPublicKey(privateJwk)));
    const [h, c, sig] = jwt.split('.');
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)));
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_000_000_000 + 12 * 3600, sub: 'https://primjer.hr' });
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, b64urlDecode(sig), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });

  it('prima samo adrese poznatih push servisa', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/QO')).toBe(true);
    expect(isPushEndpoint('https://jmt17.google.com/fcm/send/abc')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(isPushEndpoint('https://evil.example.com/x')).toBe(false);
    expect(isPushEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false);
  });
});
