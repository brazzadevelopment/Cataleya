import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isNativeApp } from '../lib/native';
import {
  canInstall, chromeIntentUrl, chromeStoreUrl, isChrome, isIos, isMobile, isSamsungBrowser, isStandalone, onInstallChange, promptInstall,
} from '../lib/push';
import { Icon } from './ui';

// Kao u aplikacijama KlubAppa: aplikacija se otvara samo u Chromeu (Android i iPhone)
// i iz njega dodaje na početni zaslon. Mobilne aplikacije iz trgovina ovo ne vide.

const SKIP = 'cataleya.chrome-gate-skip';
const GUIDE = '/obavijesti';

/** Mobitel, ali nije Chrome (Samsung, Safari, Instagram, Facebook…): uputa preko cijelog zaslona. */
export function ChromeGate() {
  const { pathname } = useLocation();
  const [skip, setSkip] = useState(() => {
    try {
      return sessionStorage.getItem(SKIP) === '1';
    } catch {
      return false;
    }
  });
  if (skip || isNativeApp() || isStandalone() || !isMobile() || isChrome() || pathname === GUIDE) return null;
  const where = isSamsungBrowser() ? 'Samsungovom pregledniku' : isIos() ? 'Safariju ili drugom pregledniku' : 'pregledniku koji nije Chrome';
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-pitch-950 px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <img src="/logo.svg" alt="" className="size-24" />
        <h1 className="heading mt-4 text-[24px] leading-tight">Otvori aplikaciju u Chromeu</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/90">
          Aplikaciju si otvorio u <b>{where}</b>. Na početni zaslon dodaje se iz preglednika <b>Chrome</b>, a bez toga ne dobivaš
          obavijesti o golovima i rezultatima.
        </p>
        <a href={chromeIntentUrl()} className="mt-6 block w-full rounded-2xl bg-white py-4 text-[17px] font-extrabold text-ink shadow-lg">
          Otvori u Chromeu
        </a>
        <a href={chromeStoreUrl()} className="mt-3 block w-full rounded-2xl bg-white/12 py-3 font-bold ring-1 ring-white/30">
          Nemam Chrome – preuzmi ga ({isIos() ? 'App Store' : 'Google Play'})
        </a>
        <p className="mt-4 text-[13px] text-white/80">
          Ako se Chrome ne otvori, otvori ga sam i upiši <b className="text-white">{location.host}</b>.
        </p>
        <a href={GUIDE} className="mt-4 text-[14px] font-bold underline">Upute s videom</a>
        <button
          type="button"
          className="mt-8 text-[13px] text-white/65 underline"
          onClick={() => {
            try {
              sessionStorage.setItem(SKIP, '1');
            } catch {
              // bez pohrane: vrijedi dok je stranica otvorena
            }
            setSkip(true);
          }}
        >
          Nastavi ipak u ovom pregledniku
        </button>
      </div>
    </div>
  );
}

/** U Chromeu na mobitelu, dok aplikacija nije na početnom zaslonu: traka na vrhu. */
export function InstallBanner() {
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => onInstallChange(() => tick((n) => n + 1)), []);
  if (isNativeApp() || isStandalone() || !isMobile()) return null;
  const ios = isIos();
  if (!isChrome()) {
    return (
      <div className="bg-live px-4 py-2.5 text-white">
        <div className="flex items-center gap-3">
          <Icon name="info" className="size-6 shrink-0" />
          <span className="flex-1 text-[13px] leading-tight"><b className="block text-[15px]">Otvori aplikaciju u Chromeu</b>Iz Chromea je dodaješ na početni zaslon.</span>
          <a href={chromeIntentUrl()} className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-extrabold text-live">Chrome</a>
        </div>
      </div>
    );
  }
  const oneTap = !ios && canInstall();
  return (
    <div className="bg-live text-white">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
        onClick={async () => {
          if (oneTap) {
            await promptInstall();
            tick((n) => n + 1);
            return;
          }
          setOpen((o) => !o);
        }}
      >
        <Icon name="home" className="size-6 shrink-0" />
        <span className="flex-1 text-[13px] leading-tight">
          <b className="block text-[15px]">Dodaj aplikaciju na početni zaslon!</b>
          {oneTap ? 'Dodirni ovdje i odaberi Instaliraj.' : 'Bez toga ne primaš obavijesti. Dodirni za upute.'}
        </span>
        <span className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-extrabold text-live">{oneTap ? 'Instaliraj' : open ? 'Zatvori' : 'Kako?'}</span>
      </button>
      {open && (
        <div className="px-5 pb-3 text-[13px]">
          <ol className="space-y-1.5">
            {ios ? (
              <>
                <li><b>1.</b> U adresnoj traci Chromea dodirni ikonu <b>Dijeli</b> (kvadrat sa strelicom).</li>
                <li><b>2.</b> Odaberi <b>Dodaj na početni zaslon</b> (pomakni popis prema dolje ako ga ne vidiš).</li>
                <li><b>3.</b> Gore desno dodirni <b>Dodaj</b>.</li>
                <li><b>4.</b> Aplikaciju otvaraj s ikone s cvijetom na zaslonu.</li>
              </>
            ) : (
              <>
                <li><b>1.</b> Gore desno u Chromeu dodirni <b>⋮</b> (tri točkice).</li>
                <li><b>2.</b> Odaberi <b>Dodaj na početni zaslon</b> ili <b>Instaliraj aplikaciju</b>.</li>
                <li><b>3.</b> Potvrdi s <b>Instaliraj</b>.</li>
                <li><b>4.</b> Aplikaciju otvaraj s ikone s cvijetom na zaslonu.</li>
              </>
            )}
          </ol>
          <a href={GUIDE} className="mt-2 inline-block font-bold underline">Upute s videom →</a>
        </div>
      )}
    </div>
  );
}
