import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { formatCredits } from '../lib/formatCredits';

type Props = {
  open: boolean;
  email: string;
  currentCredits: number;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (newBalance: number) => void;
};

export default function RemoveCreditsModal({
  open,
  email,
  currentCredits,
  loading,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (open) setTarget('');
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

  const n = Number(target);
  const valid = target.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= currentCredits;
  const removed = valid ? currentCredits - n : null;

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
            Remove credits
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
          Set a new credit balance for <strong className="text-[var(--app-text)]">{email}</strong>.
        </p>
        <p className="mt-2 text-sm text-[var(--app-muted)]">
          Current balance: <span className="font-mono font-semibold text-[var(--app-text)]">{formatCredits(currentCredits)}</span>
        </p>
        <label className="mb-1 mt-4 block text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
          New balance
        </label>
        <input
          type="number"
          min={0}
          max={currentCredits}
          step="any"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3 text-[var(--app-text)]"
          placeholder={`0 – ${formatCredits(currentCredits)}`}
        />
        {removed != null && removed > 0 && (
          <p className="mt-2 text-xs text-[var(--app-muted)]">
            This will remove <span className="font-mono font-semibold text-red-400">{formatCredits(removed)}</span> credits.
          </p>
        )}
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
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Updating…' : 'Remove credits'}
          </button>
        </div>
      </div>
    </div>
  );
}
