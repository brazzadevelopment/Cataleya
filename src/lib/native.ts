// Mobilna aplikacija (Capacitor): obavijesti preko Firebasea (i na iPhoneu
// Firebase token, ne Appleov), umjesto web pusha.
// U pregledniku se ništa od ovoga ne učitava.

import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

const TOKEN_KEY = 'cataleya.fcm';

export function savedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Dopuštenje i Firebase token uređaja (i na iPhoneu). Baca grešku s porukom za korisnika. */
export async function nativeToken(ask: boolean): Promise<string | null> {
  const { FirebaseMessaging, Importance } = await import('@capacitor-firebase/messaging');
  let perm = await FirebaseMessaging.checkPermissions();
  if (perm.receive !== 'granted' && ask) perm = await FirebaseMessaging.requestPermissions();
  if (perm.receive !== 'granted') {
    if (ask) throw new Error('Obavijesti nisu dopuštene. Dopusti ih u postavkama mobitela pa pokušaj ponovno.');
    return null;
  }
  if (Capacitor.getPlatform() === 'android') {
    await FirebaseMessaging.createChannel({ id: 'utakmice', name: 'Utakmice', description: 'Golovi, početak i kraj utakmica, kartoni', importance: Importance.High });
  }
  const { token } = await FirebaseMessaging.getToken();
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // bez pohrane
  }
  return token;
}

export async function forgetNativeToken(): Promise<string | null> {
  const token = savedToken();
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // bez pohrane
  }
  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
  await FirebaseMessaging.deleteToken().catch(() => undefined);
  return token;
}

/** Dodir na obavijest otvara utakmicu. */
export function listenForTaps(): void {
  if (!isNativeApp()) return;
  void import('@capacitor-firebase/messaging').then(({ FirebaseMessaging }) =>
    FirebaseMessaging.addListener('notificationActionPerformed', (a) => {
      const url = (a.notification.data as { url?: string } | undefined)?.url;
      if (url && url.startsWith('/')) window.location.assign(url);
    }),
  );
}
