import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

export type ApproveCatalogRow = {
  slug: string;
  name: string;
  default_credits_burn: number;
};

export type ApproveEntitlementDraft = {
  slug: string;
  name: string;
  default_credits_burn: number;
  enabled: boolean;
  credits_override: string;
};

type Props = {
  open: boolean;
  email: string;
  catalog: ApproveCatalogRow[];
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (payload: { credits: number; items: { api_slug: string; enabled: boolean; credits_per_hit: number | null }[] }) => void;
};

export default function ApproveUserModal({
  open,
  email,
  catalog,
  loading,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [credits, setCredits] = useState('100');
  const [rows, setRows] = useState<ApproveEntitlementDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    setCredits('100');
    setRows(
      catalog.map((c) => ({
        slug: c.slug,
        name: c.name,
        default_credits_burn: c.default_credits_burn,
        enabled: false,
        credits_override: '',
      }))
    );
  }, [open, catalog]);

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

  const creditN = Number(credits);
  const creditsValid = Number.isFinite(creditN) && creditN > 0;

  const submit = () => {
    if (!creditsValid) return;
    const items = rows.map((r) => ({
      api_slug: r.slug,
      enabled: r.enabled,
      credits_per_hit:
        r.credits_override.trim() === '' ? null : Number(r.credits_override.trim()),
    }));
    for (const i of items) {
      if (i.credits_per_hit !== null && (!Number.isFinite(i.credits_per_hit) || i.credits_per_hit <= 0)) return;
    }
    onConfirm({ credits: creditN, items });
  };

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
        className="relative z-10 flex max-h-[min(90dvh,720px)] w-full max-w-2xl flex-col rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl outline-none"
      >
        <div className="shrink-0 border-b border-[var(--app-border)] px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="font-display text-lg font-bold text-[var(--app-text)]">
              Approve user
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
          <p className="mt-2 text-sm text-[var(--app-text-secondary)]">
            Approve <strong className="text-[var(--app-text)]">{email}</strong>, grant starting credits, and choose API access.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            Starting credits
          </label>
          <input
            type="number"
            min={1}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className="mb-5 w-full max-w-xs rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3 text-[var(--app-text)]"
          />

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            API access &amp; burn rate
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--app-muted)]">Loading catalog…</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-[var(--app-bg-secondary)] text-xs text-[var(--app-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">API</th>
                    <th className="px-3 py-2 font-semibold">Default</th>
                    <th className="px-3 py-2 font-semibold">Enable</th>
                    <th className="px-3 py-2 font-semibold">Burn override</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.slug} className="border-t border-[var(--app-border)]">
                      <td className="px-3 py-2">
                        <div className="font-medium text-[var(--app-text)]">{r.name}</div>
                        <div className="font-mono text-xs text-[var(--app-muted)]">{r.slug}</div>
                      </td>
                      <td className="px-3 py-2 font-mono">{r.default_credits_burn}</td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x) => (x.slug === r.slug ? { ...x, enabled: e.target.checked } : x))
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0.0001}
                          step="any"
                          disabled={!r.enabled}
                          placeholder={`${r.default_credits_burn}`}
                          value={r.credits_override}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x) => (x.slug === r.slug ? { ...x, credits_override: e.target.value } : x))
                            )
                          }
                          className="w-24 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1 text-[var(--app-text)] disabled:opacity-40"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && (
          <p className="shrink-0 px-6 text-sm text-red-300">{error}</p>
        )}

        <div className="shrink-0 flex flex-col-reverse gap-2 border-t border-[var(--app-border)] px-6 py-4 sm:flex-row sm:justify-end">
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
            disabled={loading || !creditsValid || rows.length === 0}
            onClick={submit}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Approving…' : 'Approve user'}
          </button>
        </div>
      </div>
    </div>
  );
}
