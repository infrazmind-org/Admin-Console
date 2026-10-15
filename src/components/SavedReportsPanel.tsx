import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch, formatFastApiDetail } from '../lib/api';
import { AdminResultView } from '../lib/adminResultView';
import { CibilReportView, isCibilSummary } from '../lib/cibilReportView';

type SavedReportRow = {
  id: number;
  product_name: string;
  search_value: string | null;
  has_file: boolean;
  content_type: string | null;
  file_size_bytes: number | null;
  archive_error: string | null;
  created_at: string;
};

type SavedReportDetail = {
  id: number;
  result: Record<string, unknown>;
  file_url: string | null;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function SavedReportBody({ result }: { result: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false);
  const { fullReport, ...rest } = result;
  const summary = rest.result;
  return (
    <div className="space-y-3">
      {isCibilSummary(summary) ? <CibilReportView data={summary} /> : <AdminResultView data={rest} />}
      {fullReport ? (
        <div>
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="text-xs font-semibold text-[var(--app-muted)] hover:text-[var(--app-text)]"
          >
            {showRaw ? 'Hide full vendor response' : 'Show full vendor response'}
          </button>
          {showRaw ? (
            <pre className="mt-2 max-h-[480px] overflow-auto rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-3 font-mono text-[11px] text-[var(--app-text-secondary)]">
              {JSON.stringify(fullReport, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function SavedReportsPanel({ token, userId }: { token: string; userId: number }) {
  const [rows, setRows] = useState<SavedReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SavedReportDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const res = await apiFetch(`/api/admin/reports?user_id=${userId}`, { token });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(formatFastApiDetail(data));
        return;
      }
      setRows(Array.isArray(data) ? (data as SavedReportRow[]) : []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: number) => {
    if (detail?.id === id) {
      setDetail(null);
      return;
    }
    setDetailLoadingId(id);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/reports/${id}`, { token });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatFastApiDetail(data));
        return;
      }
      setDetail(data as SavedReportDetail);
    } catch {
      setError('Network error');
    } finally {
      setDetailLoadingId(null);
    }
  };

  return (
    <div className="mt-6 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-[var(--app-text)]">Saved reports</h3>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-muted)] disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      {rows.length === 0 && !loading ? (
        <p className="text-sm text-[var(--app-muted)]">No saved reports for this user.</p>
      ) : (
        <ul className="divide-y divide-[var(--app-border)]">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--app-text)]">{r.product_name}</p>
                  <p className="text-xs text-[var(--app-muted)]">
                    {formatWhen(r.created_at)}
                    {r.search_value ? <span className="ml-2 font-mono">{r.search_value}</span> : null}
                  </p>
                  {!r.has_file && r.archive_error ? (
                    <p className="mt-1 text-xs text-amber-400">File not archived: {r.archive_error}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {r.has_file ? (
                    <span className="text-xs text-[var(--app-muted)]">{formatSize(r.file_size_bytes)}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void openDetail(r.id)}
                    disabled={detailLoadingId === r.id}
                    className="rounded-lg border border-[#0668E1]/40 px-2 py-1 text-xs font-semibold text-[#0668E1] hover:bg-[#0668E1]/10 disabled:opacity-50"
                  >
                    {detailLoadingId === r.id ? 'Loading…' : detail?.id === r.id ? 'Hide' : 'View'}
                  </button>
                </div>
              </div>
              {detail?.id === r.id ? (
                <div className="mt-3 space-y-3">
                  {detail.file_url ? (
                    <a
                      href={detail.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-semibold text-[#0668E1] hover:underline"
                    >
                      Open saved report file
                    </a>
                  ) : (
                    <p className="text-xs text-[var(--app-muted)]">No report file stored.</p>
                  )}
                  <SavedReportBody result={detail.result} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
