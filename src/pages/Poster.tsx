import { useState } from 'react';
import { Link } from 'react-router-dom';
import { absoluteUrl } from '../components/Share';
import { Button } from '../components/ui';
import { assetUrl } from '../data/source';
import { useTournament } from '../data/TournamentContext';
import { dateSpan } from '../lib/time';
import { useQr } from './Info';

/** Plakat s QR kodom za ispis (A4 ili A5). U pregledniku: Ispiši → Spremi kao PDF. */
export function Poster() {
  const { snap } = useTournament();
  const t = snap.tournament;
  const url = absoluteUrl(`/t/${t.slug}`);
  const qr = useQr(url);
  const [size, setSize] = useState<'A4' | 'A5'>('A4');

  return (
    <div className="min-h-dvh bg-neutral-200 py-6 print:bg-white print:p-0">
      <style>{`@page { size: ${size} portrait; margin: 0; }`}</style>
      <div className="mx-auto mb-4 flex max-w-md flex-wrap items-center justify-center gap-2 px-4 print:hidden">
        <Link to={`/t/${t.slug}/info`} className="mr-auto text-sm font-bold text-neutral-700">← Natrag</Link>
        {(['A4', 'A5'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSize(s)} className={`h-10 rounded-lg px-4 text-sm font-bold ${size === s ? 'bg-pitch-800 text-white' : 'bg-white text-neutral-700'}`}>{s}</button>
        ))}
        <Button onClick={() => window.print()}>Ispiši / PDF</Button>
      </div>

      <div
        className="poster mx-auto flex flex-col items-center overflow-hidden bg-pitch-900 text-center text-white shadow-xl print:shadow-none"
        style={{
          width: size === 'A4' ? '210mm' : '148mm',
          height: size === 'A4' ? '297mm' : '210mm',
          maxWidth: '100%',
          padding: size === 'A4' ? '18mm 16mm' : '12mm 11mm',
          backgroundImage: 'radial-gradient(90% 50% at 50% 0%, rgb(31 106 67), transparent 70%), repeating-linear-gradient(115deg, rgb(255 255 255 / 0.03) 0 14px, transparent 14px 28px)',
          printColorAdjust: 'exact',
          WebkitPrintColorAdjust: 'exact',
          fontSize: size === 'A4' ? '16px' : '11.3px',
        }}
      >
        <img src={assetUrl(t.logo_path) ?? '/emblem.svg'} alt="" style={{ width: '9em', height: '9em' }} className="object-contain" />
        <h1 className="heading mt-[0.6em] text-[3.4em] leading-[0.95]">{t.name}</h1>
        <p className="mt-[0.5em] text-[1.2em] font-bold tracking-[0.25em] text-gold uppercase">
          {snap.categories.map((c) => c.name).join(' · ')}
        </p>
        <p className="mt-[0.4em] text-[1.1em] text-white/80">{dateSpan(t.start_date, t.end_date)} · {t.place}</p>

        <div className="mt-auto flex flex-col items-center">
          <p className="heading text-[2em] text-gold">Rezultati uživo</p>
          <p className="mt-[0.3em] text-[1.1em] text-white/80">Raspored · tablice · ždrijeb</p>
          <div className="mt-[1em] rounded-[1.2em] bg-white p-[0.8em]">
            {qr && <img src={qr} alt="" style={{ width: '15em', height: '15em' }} />}
          </div>
          <p className="mt-[0.8em] text-[1.1em] font-bold">Skeniraj kamerom mobitela</p>
          <p className="mt-[0.2em] text-[0.95em] text-white/60">{url.replace(/^https?:\/\//, '')}</p>
        </div>
      </div>
    </div>
  );
}
