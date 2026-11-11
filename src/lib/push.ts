// Obavijesti na mobitel u pregledniku: dopuštenje, pretplata kod push
// servisa i javljanje serveru koje momčadi pratimo.

import { source } from '../data/source';
import { forgetNativeToken, isNativeApp, nativeToken } from './native';

export type PushEvent = 'goal' | 'start' | 'end' | 'card';
export const ALL_EVENTS: PushEvent[] = ['goal', 'start', 'end', 'card'];

export interface PushPrefs {
  enabled: boolean;
  events: PushEvent[];
}

// Postavke vrijede za sve turnire (prati se klub, ne jedan turnir).
const KEY = 'cataleya.push';

export function readPrefs(): PushPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as PushPrefs;
    // Starije verzije pamtile su postavke po turniru.
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('turnir.push.')) return JSON.parse(localStorage.getItem(k)!) as PushPrefs;
    }
  } catch {
    // bez pohrane: obavijesti nisu uključene
  }
  return { enabled: false, events: ALL_EVENTS };
}

function writePrefs(p: PushPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // nema pohrane
  }
}

/** Što pratimo: klubovi (svi turniri) i pojedine momčadi bez kluba. */
export interface Follows {
  clubIds: string[];
  teamIds: string[];
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

export function isMobile(): boolean {
  return isIos() || /android/i.test(navigator.userAgent);
}

/** Pravi Chrome (Android ili iPhone), ne Samsung, Safari, Instagram, Facebook… */
export function isChrome(): boolean {
  const ua = navigator.userAgent;
  if (isIos()) return /CriOS/.test(ua) && !isInAppBrowser();
  return /Chrome\/\d/.test(ua) && !/SamsungBrowser|EdgA|OPR|OPT\/|Firefox|YaBrowser|MiuiBrowser|HuaweiBrowser|UCBrowser|VivoBrowser|HeyTap|; wv\)|FBAN|FBAV|Instagram|Line\//.test(ua);
}

/**
 * Aplikacija se otvara samo u Chromeu (Android i iPhone), kao i aplikacije KlubAppa.
 * Vraća vrstu krivog preglednika na mobitelu, ili null.
 */
export function wrongBrowser(): 'samsung' | 'inapp' | 'other' | null {
  if (isStandalone() || isNativeApp() || !isMobile() || isChrome()) return null;
  if (isSamsungBrowser()) return 'samsung';
  if (isInAppBrowser()) return 'inapp';
  return 'other';
}

export const CHROME_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.android.chrome';
export const CHROME_APPSTORE_URL = 'https://apps.apple.com/app/google-chrome/id535886823';
export function chromeStoreUrl(): string {
  return isIos() ? CHROME_APPSTORE_URL : CHROME_PLAY_URL;
}

/** Link koji otvara trenutnu stranicu u Chromeu (Android: bez Chromea vodi na Google Play). */
export function chromeIntentUrl(): string {
  const { host, pathname, search } = location;
  return isIos()
    ? `googlechromes://${host}${pathname}${search}`
    : `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(CHROME_PLAY_URL)};end`;
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
  if (isNativeApp()) return 'ok';
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok';
  if (isIos() && !isStandalone()) return 'install';
  return 'unsupported';
}

function keyBytes(b64url: string): Uint8Array {
  const s = atob(b64url.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function register(f: Follows, events: PushEvent[], ask = false): Promise<void> {
  if (isNativeApp()) {
    const fcmToken = await nativeToken(ask);
    if (fcmToken) await source.push!.subscribe({ tournamentId: null, fcmToken, teamIds: f.teamIds, clubIds: f.clubIds, events });
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const appKey = keyBytes(await source.push!.key());
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey as BufferSource });
  }
  await source.push!.subscribe({ tournamentId: null, subscription: sub.toJSON(), teamIds: f.teamIds, clubIds: f.clubIds, events });
}

/** Pita za dopuštenje i uključi obavijesti. Baca grešku s porukom za korisnika. */
export async function enablePush(f: Follows, events: PushEvent[]): Promise<void> {
  if (!isNativeApp()) {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      throw new Error('Obavijesti nisu dopuštene. Dopusti ih u postavkama mobitela pa pokušaj ponovno.');
    }
  }
  await register(f, events, true);
  writePrefs({ enabled: true, events });
}

/** Nakon promjene praćenih klubova ili vrsta obavijesti, bez ponovnog pitanja. */
export async function syncPush(f: Follows, events?: PushEvent[]): Promise<void> {
  const prefs = readPrefs();
  if (!prefs.enabled || pushSupport() !== 'ok') return;
  if (!isNativeApp() && Notification.permission !== 'granted') return;
  const next = { ...prefs, events: events ?? prefs.events };
  await register(f, next.events);
  writePrefs(next);
}

export async function disablePush(): Promise<void> {
  writePrefs({ ...readPrefs(), enabled: false });
  if (isNativeApp()) {
    const token = await forgetNativeToken();
    if (token) await source.push?.unsubscribe(`fcm:${token}`).catch(() => undefined);
    return;
  }
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
const installListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallPrompt;
    installListeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    installListeners.forEach((l) => l());
  });
}

/** Javi kad Chrome ponudi instalaciju ili kad je aplikacija instalirana. */
export function onInstallChange(l: () => void): () => void {
  installListeners.add(l);
  return () => void installListeners.delete(l);
}

export function canInstall(): boolean {
  return installEvent != null;
}

export async function promptInstall(): Promise<void> {
  const e = installEvent;
  installEvent = null;
  await e?.prompt();
}
