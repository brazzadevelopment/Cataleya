// Mobilne aplikacije (App Store i Google Play) iz iste web aplikacije.
// Upute: STORE.md.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'hr.cataleyacup.app',
  appName: 'Cataleya Cup',
  webDir: 'dist',
  backgroundColor: '#459967',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
  plugins: {
    FirebaseMessaging: { presentationOptions: ['alert', 'sound'] },
  },
};

export default config;
