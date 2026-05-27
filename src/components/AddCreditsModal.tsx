import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  email: string;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (credits: number) => void;
};

export default function AddCreditsModal({ open, email, loading, error, onCancel, onConfirm }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [credits, setCredits] = useState('');

  useEffect(() => {
    if (open) setCredits('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  const n = Number(credits);
  const valid = Number.isFinite(n) && n > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-lg font-bold text-[var(--app-text)]">
            Add credits
          </h2>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-lg p-1 text-[var(--app-muted)] hover:bg-[var(--app-surface-muted)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-[var(--app-text-secondary)]">
          Add credits to <strong className="text-[var(--app-text)]">{email}</strong>.
        </p>
        <label className="mb-1 mt-4 block text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
          Credits to add
        </label>
        <input
          type="number"
          min={1}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3 text-[var(--app-text)]"
          placeholder="e.g. 100"
        />
        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || !valid}
            onClick={() => onConfirm(n)}
            className="rounded-xl bg-[#0668E1] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0556ba] disabled:opacity-50"
          >
            {loading ? 'Adding…' : 'Add credits'}
          </button>
        </div>
      </div>
    </div>
  );
}
