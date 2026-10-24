import { chromeIntentUrl, isIos, wrongBrowser } from '../lib/push';
import { Icon } from './ui';

/** Upozorenje kad je stranica otvorena u pregledniku koji ne može dodati aplikaciju ni slati obavijesti. */
export function BrowserWarning() {
  const kind = wrongBrowser();
  if (!kind) return null;
  const ios = isIos();
  return (
    <div className="card mt-4 border border-[#ff8197]/50 p-4">
      <div className="flex items-center gap-2 font-extrabold text-[#ff8197]">
        <Icon name="info" className="size-5" />
        {kind === 'samsung' ? 'Otvoreno u Samsungovom pregledniku' : 'Otvoreno unutar druge aplikacije'}
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-white/80">
        {kind === 'samsung'
          ? 'U Samsungovom pregledniku („Internet”) aplikacija se ne može dodati na početni zaslon i obavijesti ne rade. Otvori je u Chromeu.'
          : `Ovdje se aplikacija ne može dodati na početni zaslon i obavijesti ne rade. Otvori je u ${ios ? 'Safariju' : 'Chromeu'}.`}
      </p>
      {ios ? (
        <p className="mt-2 text-[13px] text-white/65">Dodirni ⋯ ili ikonu kompasa i odaberi „Otvori u Safariju”.</p>
      ) : (
        <a href={chromeIntentUrl()} className="mt-3 flex items-center justify-center rounded-xl bg-gold px-4 py-3 text-sm font-extrabold text-pitch-950">
          Otvori u Chromeu
        </a>
      )}
    </div>
  );
}
