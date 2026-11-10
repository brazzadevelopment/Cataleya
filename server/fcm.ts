// Obavijesti za mobilne aplikacije (App Store i Google Play) preko
// Firebase Cloud Messaginga (FCM HTTP v1). Firebase šalje i na iPhone
// (preko Appleovog APNs ključa upisanog u Firebase). Samo Web Crypto.

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string; // PEM, PKCS#8
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? enc.encode(bytes) : bytes;
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

/** Potpisani JWT kojim Google daje pristupni token (vrijedi sat vremena). */
export async function serviceAccountJwt(sa: ServiceAccount, now = Date.now()): Promise<string> {
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  }));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key) as BufferSource, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${claims}`)));
  return `${head}.${claims}.${b64url(sig)}`;
}

let cached: { token: string; until: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await serviceAccountJwt(sa) }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) throw new Error(`Firebase prijava nije uspjela (${res.status})`);
  cached = { token: data.access_token, until: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

export interface FcmMessage {
  title: string;
  body: string;
  tag: string;
  url: string;
}

/** Tijelo poruke za FCM v1: obavijest, poveznica i grupiranje po utakmici. */
export function fcmPayload(token: string, m: FcmMessage) {
  return {
    message: {
      token,
      notification: { title: m.title, body: m.body },
      data: { url: m.url, tag: m.tag },
      android: { priority: 'HIGH', notification: { tag: m.tag, channel_id: 'utakmice', color: '#019c61' } },
      apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default', 'thread-id': m.tag } } },
    },
  };
}

/** Pošalje jednu obavijest. Vraća 'gone' kad token više ne vrijedi (aplikacija obrisana). */
export async function sendFcm(sa: ServiceAccount, token: string, m: FcmMessage): Promise<'ok' | 'gone' | 'error'> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fcmPayload(token, m)),
  });
  if (res.ok) return 'ok';
  if (res.status === 404) return 'gone';
  const text = await res.text().catch(() => '');
  if (/UNREGISTERED|registration-token-not-registered/.test(text)) return 'gone';
  console.error('fcm', res.status, text.slice(0, 200));
  return 'error';
}
