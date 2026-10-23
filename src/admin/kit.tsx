import { useState, type ReactNode } from 'react';
import { useTournament } from '../data/TournamentContext';
import { MutationError, type Mutation } from '../lib/mutations';
import { Icon } from '../components/ui';

/** Spremanje s porukom o uspjehu ili grešci. */
export function useSave() {
  const { mutate, setSession } = useTournament();
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(mutations: Mutation[], okText = 'Spremljeno'): Promise<boolean> {
    setBusy(true);
    setStatus(null);
    try {
      await mutate(mutations);
      setStatus({ text: okText, ok: true });
      setTimeout(() => setStatus((s) => (s?.ok ? null : s)), 2000);
      return true;
    } catch (e) {
      if (e instanceof MutationError && e.status === 401) setSession(null);
      setStatus({ text: e instanceof Error ? e.message : 'Spremanje nije uspjelo.', ok: false });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { save, status, busy };
}

export function Status({ status }: { status: { text: string; ok: boolean } | null }) {
  if (!status) return null;
  return <p className={`text-[13px] font-bold ${status.ok ? 'text-[#7ee2a8]' : 'text-[#ff8197]'}`}>{status.text}</p>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-white/60">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-white/45">{hint}</span>}
    </label>
  );
}

const inputCls = 'h-11 w-full min-w-0 rounded-xl bg-white/8 px-3 text-[14px] font-semibold text-white ring-1 ring-white/12 placeholder:text-white/30';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} h-auto min-h-24 py-2.5 leading-relaxed ${props.className ?? ''}`} />;
}

export function SelectBox({ options, ...props }: { options: [string, string][] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputCls} ${props.className ?? ''}`}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

/** Donji list (sheet) za uređivanje na mobitelu. */
export function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-line bg-pitch-900 px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center">
          <h2 className="heading text-base">{title}</h2>
          <button type="button" onClick={onClose} className="ml-auto grid size-9 place-items-center rounded-full bg-white/8" aria-label="Zatvori">
            <Icon name="x" className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function newId(): string {
  return crypto.randomUUID();
}
