// Obavijesti na mobitel u pregledniku: dopuštenje, pretplata kod push
// servisa i javljanje serveru koje momčadi pratimo.

import { source } from '../data/source';

export type PushEvent = 'goal' | 'start' | 'end' | 'card';
export const ALL_EVENTS: PushEvent[] = ['goal', 'start', 'end', 'card'];

export interface PushPrefs {
  enabled: boolean;
  events: PushEvent[];
}

const key = (tid: string) => `turnir.push.${tid}`;

export function readPrefs(tid: string): PushPrefs {
  try {
    const raw = localStorage.getItem(key(tid));
    if (raw) return JSON.parse(raw) as PushPrefs;
  } catch {
    // bez pohrane: obavijesti nisu uključene
  }
  return { enabled: false, events: ALL_EVENTS };
}

function writePrefs(tid: string, p: PushPrefs): void {
  try {
    localStorage.setItem(key(tid), JSON.stringify(p));
  } catch {
    // nema pohrane
  }
}

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Samsungov preglednik („Internet”) na Androidu. */
export function isSamsungBrowser(): boolean {
  return /SamsungBrowser/i.test(navigator.userAgent);
}

/** Preglednik ugrađen u drugu aplikaciju (Facebook, Instagram, Messenger…). */
export function isInAppBrowser(): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|TikTok|Snapchat|; wv\)/i.test(navigator.userAgent);
}

/** Na Androidu treba Chrome; na iPhoneu Safari. Vraća poruku ako je otvoreno u krivom pregledniku. */
export function wrongBrowser(): 'samsung' | 'inapp' | null {
  if (isStandalone()) return null;
  if (isSamsungBrowser()) return 'samsung';
  if (isInAppBrowser()) return 'inapp';
  return null;
}

/** Link koji na Androidu otvara trenutnu stranicu u Chromeu. */
export function chromeIntentUrl(): string {
  const { host, pathname, search } = location;
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * 'ok': može se uključiti; 'install': iPhone, aplikacija prvo mora biti na
 * početnom zaslonu; 'unsupported': preglednik nema obavijesti; 'demo': demo način.
 */
export function pushSupport(): 'ok' | 'install' | 'unsupported' | 'demo' {
  if (!source.push) return 'demo';
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok';
  if (isIos() && !isStandalone()) return 'install';
  return 'unsupported';
}

function keyBytes(b64url: string): Uint8Array {
  const s = atob(b64url.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function register(tid: string, teamIds: string[], events: PushEvent[]): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const appKey = keyBytes(await source.push!.key());
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey as BufferSource });
  }
  await source.push!.subscribe({ tournamentId: tid, subscription: sub.toJSON(), teamIds, events });
}

/** Pita za dopuštenje i uključi obavijesti. Baca grešku s porukom za korisnika. */
export async function enablePush(tid: string, teamIds: string[], events: PushEvent[]): Promise<void> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error('Obavijesti nisu dopuštene. Dopusti ih u postavkama mobitela pa pokušaj ponovno.');
  }
  await register(tid, teamIds, events);
  writePrefs(tid, { enabled: true, events });
}

/** Nakon promjene omiljenih momčadi ili vrsta obavijesti, bez ponovnog pitanja. */
export async function syncPush(tid: string, teamIds: string[], events?: PushEvent[]): Promise<void> {
  const prefs = readPrefs(tid);
  if (!prefs.enabled || pushSupport() !== 'ok' || Notification.permission !== 'granted') return;
  const next = { ...prefs, events: events ?? prefs.events };
  await register(tid, teamIds, next.events);
  writePrefs(tid, next);
}

export async function disablePush(tid: string): Promise<void> {
  writePrefs(tid, { ...readPrefs(tid), enabled: false });
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await source.push?.unsubscribe(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}

// Android/Chrome: gumb „Instaliraj” umjesto traženja po izborniku.
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}
let installEvent: InstallPrompt | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallPrompt;
  });
}

export function canInstall(): boolean {
  return installEvent != null;
}

export async function promptInstall(): Promise<void> {
  const e = installEvent;
  installEvent = null;
  await e?.prompt();
}
