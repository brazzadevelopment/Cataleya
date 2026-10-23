// Web Push bez dodatnih paketa: šifriranje poruke (RFC 8291, aes128gcm)
// i potpis pošiljatelja (VAPID, RFC 8292). Koristi samo Web Crypto, pa
// radi jednako u Supabase Edge Function (Deno) i u testovima (Node).

export interface PushSubscription {
  endpoint: string;
  /** Javni ključ preglednika, base64url (65 bajtova). */
  p256dh: string;
  /** Tajna preglednika, base64url (16 bajtova). */
  auth: string;
}

export interface VapidKeys {
  /** Privatni ključ kao JWK (P-256, s d, x, y). */
  privateJwk: JsonWebKey;
  /** Kontakt pošiljatelja: https adresa ili mailto. */
  subject: string;
}

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', k, data));
}

/** Javni ključ (65 bajtova) iz JWK-a. */
export function rawPublicKey(jwk: JsonWebKey): Uint8Array {
  return concat(new Uint8Array([4]), b64urlDecode(jwk.x!), b64urlDecode(jwk.y!));
}

function publicJwk(raw: Uint8Array): JsonWebKey {
  return { kty: 'EC', crv: 'P-256', x: b64urlEncode(raw.slice(1, 33)), y: b64urlEncode(raw.slice(33, 65)), ext: true };
}

/** Za testove: zadani ključ i sol umjesto nasumičnih. */
export interface EncryptOptions {
  senderJwk?: JsonWebKey;
  salt?: Uint8Array;
}

/** Šifrirano tijelo poruke za jednog primatelja (RFC 8291). */
export async function encryptPayload(payload: Uint8Array, sub: PushSubscription, opts: EncryptOptions = {}): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);

  let senderPrivate: CryptoKey;
  let senderPublic: Uint8Array;
  if (opts.senderJwk) {
    senderPrivate = await subtle.importKey('jwk', opts.senderJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    senderPublic = rawPublicKey(opts.senderJwk);
  } else {
    const pair = (await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    senderPrivate = pair.privateKey;
    senderPublic = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  }
  const uaKey = await subtle.importKey('jwk', publicJwk(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, senderPrivate, 256));

  const one = new Uint8Array([1]);
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, senderPublic, one));
  const salt = opts.salt ?? globalThis.crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), one))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), one))).slice(0, 12);

  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));

  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = senderPublic.length;
  return concat(header, senderPublic, cipher);
}

/** Zaglavlje Authorization s potpisom pošiljatelja (RFC 8292). */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<string> {
  const head = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: keys.subject,
  })));
  const key = await subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`)));
  return `vapid t=${head}.${claims}.${b64urlEncode(sig)}, k=${b64urlEncode(rawPublicKey(keys.privateJwk))}`;
}

/** Pošalje jednu poruku. Vraća HTTP status push servisa (404/410 = pretplata više ne vrijedi). */
export async function sendPush(sub: PushSubscription, message: unknown, keys: VapidKeys, topic?: string): Promise<number> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, keys),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'high',
      ...(topic ? { Topic: topic } : {}),
    },
    body,
  });
  return res.status;
}

/** Pretplate se primaju samo za poznate push servise preglednika. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^jmt\d+\.google\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/,
];

export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}
