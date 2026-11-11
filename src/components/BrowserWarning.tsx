import { chromeIntentUrl, wrongBrowser } from '../lib/push';
import { Icon } from './ui';

/** Upozorenje kad je stranica otvorena u pregledniku koji ne može dodati aplikaciju ni slati obavijesti. */
export function BrowserWarning() {
  const kind = wrongBrowser();
  if (!kind) return null;
  return (
    <div className="card mt-4 border border-[#ff8197]/50 p-4">
      <div className="flex items-center gap-2 font-extrabold text-[#ff8197]">
        <Icon name="info" className="size-5" />
        {kind === 'samsung' ? 'Otvoreno u Samsungovom pregledniku' : kind === 'inapp' ? 'Otvoreno unutar druge aplikacije' : 'Otvoreno u pregledniku koji nije Chrome'}
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-white/80">
        Ovdje se aplikacija ne može dodati na početni zaslon i obavijesti ne rade. Otvori je u Chromeu.
      </p>
      <a href={chromeIntentUrl()} className="mt-3 flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-ink">
        Otvori u Chromeu
      </a>
    </div>
  );
}
