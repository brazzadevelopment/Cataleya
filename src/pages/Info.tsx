import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { absoluteUrl, ShareButton } from '../components/Share';
import { Icon, SectionTitle } from '../components/ui';
import { useTournament } from '../data/TournamentContext';
import { dateSpan } from '../lib/time';
import { FooterLinks } from './Home';

const TIEBREAK_LABEL: Record<string, string> = {
  head_to_head: 'međusobni susret',
  goal_difference: 'gol-razlika',
  goals_for: 'više postignutih golova',
  wins: 'više pobjeda',
  fewer_goals_against: 'manje primljenih golova',
  lot: 'ždrijeb',
};

export function Info() {
  const { snap } = useTournament();
  const t = snap.tournament;
  const url = absoluteUrl(`/t/${t.slug}`);
  const qr = useQr(url);

  return (
    <div>
      <SectionTitle>O turniru</SectionTitle>
      <div className="card space-y-2 p-4 text-[14px] leading-relaxed">
        <p className="font-bold">{t.name}</p>
        <p className="text-white/70">{dateSpan(t.start_date, t.end_date)} · {t.place}{t.venue ? `, ${t.venue}` : ''}</p>
        {t.description && <p className="whitespace-pre-line text-white/80">{t.description}</p>}
        <ul className="pt-1 text-white/70">
          {snap.categories.map((c) => (
            <li key={c.id}>· {c.name}: utakmice traju {c.match_minutes} minuta{c.players_on_field ? `, ${c.players_on_field} igrača` : ''}</li>
          ))}
        </ul>
      </div>

      <SectionTitle>Tereni</SectionTitle>
      <div className="card divide-y divide-line">
        {snap.fields.map((f) => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3">
            <Icon name="pin" className="size-5 text-gold" />
            <span className="flex-1 font-bold">{f.name}</span>
            {f.maps_url && <a href={f.maps_url} target="_blank" rel="noreferrer" className="text-[13px] font-bold text-gold">Otvori kartu</a>}
          </div>
        ))}
      </div>

      <SectionTitle>Pravila</SectionTitle>
      <div className="card space-y-3 p-4 text-[14px] leading-relaxed">
        <p>
          Bodovi: pobjeda {t.points_win}, neriješeno {t.points_draw}, poraz {t.points_loss}.
        </p>
        <p>
          Kod jednakog broja bodova odlučuje redom: {t.tiebreakers.map((k) => TIEBREAK_LABEL[k]).join(' → ')}.
        </p>
        {t.rules ? <p className="whitespace-pre-line text-white/80">{t.rules}</p> : <p className="text-white/50">Ostala pravila organizator će objaviti ovdje.</p>}
      </div>

      <SectionTitle>Podijeli turnir</SectionTitle>
      <div className="card p-4">
        <div className="flex items-center gap-4">
          {qr && <img src={qr} alt="QR kod turnira" className="size-28 rounded-lg bg-white p-1.5" />}
          <p className="text-[13px] leading-relaxed text-white/70">Skeniraj kamerom mobitela i otvori rezultate uživo. Bez prijave i bez instalacije.</p>
        </div>
        <ShareButton className="mt-4" title={t.name} text={`${t.name}: raspored i rezultati uživo`} url={url} />
        <Link to={`/t/${t.slug}/plakat`} className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/8 text-sm font-extrabold ring-1 ring-white/12">
          <Icon name="qr" className="size-4" /> QR plakat za ispis
        </Link>
      </div>

      <FooterLinks />
    </div>
  );
}

export function useQr(text: string, dark = '#061a10'): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 600, errorCorrectionLevel: 'M', color: { dark, light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [text, dark]);
  return src;
}
