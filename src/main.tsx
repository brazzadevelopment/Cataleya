import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { isNativeApp, listenForTaps } from './lib/native';
import './index.css';

// U mobilnoj aplikaciji je sve već na uređaju, a obavijesti idu preko Firebasea.
if (isNativeApp()) listenForTaps();
else registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
