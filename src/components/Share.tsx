import { useState } from 'react';
import { Button, Icon } from './ui';

/** Dijeljenje: izbornik mobitela (WhatsApp, Instagram…), inače WhatsApp i kopiranje linka. */
export function ShareButton({ title, text, url, className = '' }: { title: string; text?: string; url: string; className?: string }) {
  const [msg, setMsg] = useState<string | null>(null);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMsg('Link je kopiran.');
    } catch {
      setMsg(url);
    }
    setTimeout(() => setMsg(null), 2500);
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`${text ?? title} ${url}`)}`;

  return (
    <div className={className}>
      <div className="flex gap-2">
        <Button onClick={share} className="flex-1">
          <Icon name="share" className="size-4" /> Podijeli
        </Button>
        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#25d366] px-4 text-sm font-extrabold text-pitch-950">
          WhatsApp
        </a>
      </div>
      {msg && <p className="mt-2 break-all text-center text-[12px] text-white/70">{msg}</p>}
    </div>
  );
}

export function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}
