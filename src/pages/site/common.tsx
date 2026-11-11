import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui';

/** Tekst s praznim redom između odlomaka. */
export function Paragraphs({ text, className = '' }: { text: string | null | undefined; className?: string }) {
  if (!text?.trim()) return null;
  return (
    <div className={`space-y-3 text-[15px] leading-relaxed text-white/85 ${className}`}>
      {text.trim().split(/\n\s*\n/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">{p}</p>
      ))}
    </div>
  );
}

/** Datum vijesti, npr. „10. studenoga 2026.” */
export function newsDate(iso: string): string {
  return new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zagreb' }).format(new Date(iso));
}

/** Redak popisa s ikonom (Više, kontakti). */
export function RowLink({ to, href, icon, title, sub }: { to?: string; href?: string; icon: string; title: ReactNode; sub?: ReactNode }) {
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/12 text-brand-soft"><Icon name={icon} className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        {sub && <span className="block truncate text-[12px] text-white/65">{sub}</span>}
      </span>
      <Icon name={href ? 'external' : 'back'} className={`size-4 shrink-0 text-white/45 ${href ? '' : 'rotate-180'}`} />
    </>
  );
  const cls = 'flex items-center gap-3 px-4 py-3';
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{body}</a>;
  return <Link to={to ?? '/'} className={cls}>{body}</Link>;
}
