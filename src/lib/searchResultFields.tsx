import React, { useMemo, useState } from 'react';
import { AdminFieldValue } from './adminFieldDisplay';
import { AdminResultView, envelopeChips, extractBusinessPayload } from './adminResultView';
import { resultFieldLabel } from './resultFieldLabels';

export { resultFieldLabel } from './resultFieldLabels';

const KEY_ORDER = [
  'status',
  'apiSource',
  'message',
  'detail',
  'productSlug',
  'searchType',
  'searchValue',
  'http_response_code',
  'client_ref_num',
  'result_code',
  'providerRef',
  'request_id',
  'url',
  'expires_on',
  'expires',
  'creditsRemaining',
  'result',
];

/** Flatten top-level keys for simple CSV-style consumers (nested values as JSON strings). */
export function normalizedEntries(data: Record<string, unknown>): { key: string; label: string; value: string }[] {
  const keys = Object.keys(data).filter((k) => k !== 'raw' && !k.startsWith('_'));
  const rest = keys.filter((k) => !KEY_ORDER.includes(k)).sort((a, b) => a.localeCompare(b));
  const ordered = [...KEY_ORDER.filter((k) => keys.includes(k)), ...rest];
  return ordered.map((key) => {
    const v = data[key];
    let str: string;
    if (v === null || v === undefined) str = '';
    else if (typeof v === 'object') {
      try {
        str = JSON.stringify(v);
      } catch {
        str = String(v);
      }
    } else str = String(v);
    return { key, label: resultFieldLabel(key), value: str };
  });
}

function ArrayOfObjectsTable({ rows }: { rows: Record<string, unknown>[] }) {
  const keys = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) Object.keys(r).forEach((k) => s.add(k));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--app-border)]">
      <table className="w-max min-w-full table-auto border-collapse text-left text-xs">
        <thead className="bg-[var(--app-bg-secondary)] text-[var(--app-muted)]">
          <tr>
            <th className="border-b border-[var(--app-border)] px-2 py-2 font-semibold">#</th>
            {keys.map((k) => (
              <th key={k} className="border-b border-[var(--app-border)] px-2 py-2 font-semibold">
                {resultFieldLabel(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--app-border)] last:border-0">
              <td className="whitespace-nowrap px-2 py-2 align-top text-[var(--app-muted)]">{i + 1}</td>
              {keys.map((k) => (
                <td key={k} className="min-w-[8rem] max-w-md px-2 py-2 align-top break-words">
                  <ValueBlock fieldKey={k} value={row[k]} depth={1} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NestedFields({ data, depth }: { data: Record<string, unknown>; depth: number }) {
  const keys = useMemo(
    () => Object.keys(data).sort((a, b) => a.localeCompare(b)),
    [data]
  );
  if (keys.length === 0) {
    return <span className="text-[var(--app-muted)]">Empty</span>;
  }
  return (
    <div className={`w-full min-w-0 max-w-full ${depth > 0 ? 'border-l-2 border-[var(--app-border)] pl-3' : ''}`}>
      <dl className="space-y-3">
        {keys.map((key) => (
          <div key={key} className="min-w-0 max-w-full">
            <dt className="break-words text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              {resultFieldLabel(key)}
            </dt>
            <dd className="mt-1 min-w-0 max-w-full">
              <ValueBlock fieldKey={key} value={data[key]} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ValueBlock({ value, depth = 0, fieldKey }: { value: unknown; depth?: number; fieldKey?: string }) {
  if (value === null || value === undefined) {
    return <span className="text-[var(--app-muted)]">—</span>;
  }
  if (typeof value === 'boolean') {
    return <span>{value ? 'Yes' : 'No'}</span>;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const s = String(value);
    if (s === '') return <span className="text-[var(--app-muted)]">—</span>;
    if (typeof value === 'string') {
      const linked = <AdminFieldValue fieldKey={fieldKey} value={value} />;
      if (linked) return linked;
    }
    return (
      <span className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-[var(--app-text)]">
        {s}
      </span>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-[var(--app-muted)]">Empty list</span>;
    }
    const allObjects = value.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x));
    if (allObjects) {
      return <ArrayOfObjectsTable rows={value as Record<string, unknown>[]} />;
    }
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm marker:text-[var(--app-muted)]">
        {value.map((item, i) => (
          <li key={i} className="pl-1">
            <ValueBlock value={item} depth={depth + 1} />
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === 'object') {
    return <NestedFields data={value as Record<string, unknown>} depth={depth} />;
  }
  return <span>{String(value)}</span>;
}

function formatJsonBlock(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** True when the admin Digitap test API returned its standard envelope (or raw vendor JSON). */
export function showStructuredAdminTestResponse(data: unknown): data is Record<string, unknown> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return false;
  const o = data as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(o, 'normalized')) return true;
  if (Object.prototype.hasOwnProperty.call(o, 'rawUpstream')) return true;
  if (Object.prototype.hasOwnProperty.call(o, 'rawUpstreamPreview')) return true;
  if (Object.prototype.hasOwnProperty.call(o, 'digitapResponse')) return true;
  if (Object.prototype.hasOwnProperty.call(o, 'digitapRequest')) return true;
  if (Object.prototype.hasOwnProperty.call(o, 'upstreamFailed')) return true;
  if (Object.prototype.hasOwnProperty.call(o, 'productSlug')) return true;
  if (Object.prototype.hasOwnProperty.call(o, 'result')) {
    return (
      Object.prototype.hasOwnProperty.call(o, 'result_code') ||
      Object.prototype.hasOwnProperty.call(o, 'http_response_code')
    );
  }
  return false;
}

export function SearchResultKeyValue({ data }: { data: Record<string, unknown> }) {
  const keys = useMemo(() => {
    const all = Object.keys(data).filter((k) => k !== 'raw' && !k.startsWith('_'));
    const rest = all.filter((k) => !KEY_ORDER.includes(k)).sort((a, b) => a.localeCompare(b));
    return [...KEY_ORDER.filter((k) => all.includes(k)), ...rest];
  }, [data]);

  if (!keys.length) {
    return <p className="text-sm text-[var(--app-muted)]">No fields to display.</p>;
  }

  return (
    <dl className="space-y-4">
      {keys.map((key) => (
        <div key={key} className="min-w-0 max-w-full">
          <dt className="break-words text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
            {resultFieldLabel(key)}
          </dt>
          <dd className="mt-1 min-w-0 max-w-full">
            <ValueBlock fieldKey={key} value={data[key]} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminDigitapTestView({ data }: { data: Record<string, unknown> }) {
  const upstreamFailed = data.upstreamFailed === true;
  const norm = data.normalized;
  const rawObj = data.rawUpstream;
  const rawPreview = data.rawUpstreamPreview;
  const digitapOnly = data.digitapResponse;
  const digitapRequest =
    data.digitapRequest != null && typeof data.digitapRequest === 'object'
      ? (data.digitapRequest as Record<string, unknown>)
      : data.requestEcho != null && typeof data.requestEcho === 'object'
        ? (data.requestEcho as Record<string, unknown>)
        : null;
  const httpStatus = data.httpStatus;

  const [showRaw, setShowRaw] = useState(upstreamFailed);
  const [showRequest, setShowRequest] = useState(!upstreamFailed);

  const parsedVendor = useMemo((): Record<string, unknown> | null => {
    if (rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj)) {
      return rawObj as Record<string, unknown>;
    }
    if (typeof rawPreview !== 'string' || !rawPreview.trim()) return null;
    try {
      const p = JSON.parse(rawPreview) as unknown;
      return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }, [rawObj, rawPreview]);

  const digitapFailureJson = useMemo(() => {
    if (digitapOnly != null) return digitapOnly;
    if (parsedVendor?.digitap_response != null) return parsedVendor.digitap_response;
    if (upstreamFailed && parsedVendor) {
      const { status: _s, http_status: _h, detail: _d, transport_error: _t, digitap_response: _dr, ...rest } =
        parsedVendor;
      if (Object.keys(rest).length > 0) return rest;
    }
    return upstreamFailed ? parsedVendor : null;
  }, [digitapOnly, parsedVendor, upstreamFailed]);

  /** Prefer API `normalized`; merge in `result` from raw JSON if normalized was flattened; else show parsed vendor body. */
  const displayBody = useMemo((): Record<string, unknown> | null => {
    if (norm && typeof norm === 'object' && !Array.isArray(norm)) {
      const n = { ...(norm as Record<string, unknown>) };
      const r = n.result;
      const hasRichResult =
        'result' in n &&
        r != null &&
        (Array.isArray(r)
          ? r.length > 0
          : typeof r === 'object' && Object.keys(r as Record<string, unknown>).length > 0);
      if (!hasRichResult && parsedVendor && 'result' in parsedVendor) {
        n.result = parsedVendor.result;
      }
      if (!hasRichResult && parsedVendor && !('http_response_code' in n) && 'http_response_code' in parsedVendor) {
        n.http_response_code = parsedVendor.http_response_code;
      }
      if (!hasRichResult && parsedVendor && !('client_ref_num' in n) && 'client_ref_num' in parsedVendor) {
        n.client_ref_num = parsedVendor.client_ref_num;
      }
      return n;
    }
    if (parsedVendor && ('result' in parsedVendor || 'result_code' in parsedVendor)) {
      return parsedVendor;
    }
    return null;
  }, [norm, parsedVendor]);

  const hasRequestMeta =
    data.productSlug != null || data.searchType != null || data.searchValue != null || data.creditsCharged != null;

  const rawForDisplay =
    rawObj != null
      ? formatJsonBlock(rawObj)
      : typeof rawPreview === 'string'
        ? rawPreview
        : '';

  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      {upstreamFailed ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-red-400">Digitap call failed</h3>
            {httpStatus != null ? (
              <p className="mt-1 text-xs text-red-300/90">
                HTTP status: <span className="font-mono">{String(httpStatus)}</span>
              </p>
            ) : null}
            {typeof data.detail === 'string' && data.detail ? (
              <p className="mt-1 text-xs text-red-300/90">{data.detail}</p>
            ) : null}
          </div>
          {digitapRequest ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-300/80">
                Outbound request (what we sent)
              </p>
              {typeof digitapRequest.productName === 'string' || typeof digitapRequest.productSlug === 'string' ? (
                <p className="mb-2 text-xs text-red-200/90">
                  Product:{' '}
                  <span className="font-mono">
                    {String(digitapRequest.productName ?? digitapRequest.productSlug)}
                  </span>
                  {typeof digitapRequest.productSlug === 'string' &&
                  digitapRequest.productName &&
                  digitapRequest.productSlug !== digitapRequest.productName ? (
                    <span className="text-red-300/70"> ({String(digitapRequest.productSlug)})</span>
                  ) : null}
                </p>
              ) : null}
              {typeof digitapRequest.url === 'string' && digitapRequest.url ? (
                <p className="mb-2 break-all text-xs text-red-200/90">
                  <span className="font-semibold">{String(digitapRequest.method ?? 'POST')}</span>{' '}
                  <span className="font-mono">{digitapRequest.url}</span>
                </p>
              ) : typeof digitapRequest.path === 'string' ? (
                <p className="mb-2 break-all text-xs text-red-200/90">
                  Path: <span className="font-mono">{digitapRequest.path}</span>
                  {digitapRequest.baseUrl ? (
                    <>
                      {' '}
                      (base <span className="font-mono">{String(digitapRequest.baseUrl)}</span>)
                    </>
                  ) : null}
                </p>
              ) : null}
              {typeof digitapRequest.catalogDigitapPath === 'string' ? (
                <p className="mb-2 text-xs text-red-300/80">
                  Catalog path: <span className="font-mono">{digitapRequest.catalogDigitapPath}</span>
                </p>
              ) : null}
              <pre className="max-h-[280px] overflow-auto rounded-lg border border-red-500/30 bg-[var(--app-bg)] p-3 font-mono text-[11px] text-[var(--app-text-secondary)]">
                {formatJsonBlock({
                  method: digitapRequest.method ?? 'POST',
                  url: digitapRequest.url,
                  headers: digitapRequest.requestHeaders,
                  body: digitapRequest.requestBody,
                })}
              </pre>
            </div>
          ) : null}
          {digitapFailureJson != null ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-300/80">
                Digitap response JSON
              </p>
              <pre className="max-h-[360px] overflow-auto rounded-lg border border-red-500/30 bg-[var(--app-bg)] p-3 font-mono text-[11px] text-[var(--app-text-secondary)]">
                {formatJsonBlock(digitapFailureJson)}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-red-300/80">No JSON body from Digitap — see full upstream below.</p>
          )}
        </div>
      ) : null}
      {hasRequestMeta ? (
        <div className="glass-card min-w-0 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">Test input</h3>
          <SearchResultKeyValue
            data={{
              productSlug: data.productSlug,
              searchType: data.searchType,
              searchValue: data.searchValue,
              creditsCharged: data.creditsCharged,
            }}
          />
        </div>
      ) : null}

      {displayBody && envelopeChips(displayBody).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {envelopeChips(displayBody).map((chip) => (
            <span
              key={chip.label}
              className="inline-flex flex-col rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1.5"
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-muted)]">{chip.label}</span>
              <span className="font-mono text-xs font-semibold text-[var(--app-text)]">{chip.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="glass-card min-w-0 p-4 sm:p-5">
        <h3 className="mb-4 font-display text-sm font-bold text-[var(--app-text)]">Result data</h3>
        {(() => {
          const business = extractBusinessPayload(displayBody);
          if (business) {
            return <AdminResultView data={business} />;
          }
          if (displayBody && Object.keys(displayBody).length > 0) {
            return <SearchResultKeyValue data={displayBody} />;
          }
          return <p className="text-sm text-[var(--app-muted)]">Nothing to parse — open raw upstream below.</p>;
        })()}
      </div>
      {digitapRequest && !upstreamFailed ? (
        <div>
          <button
            type="button"
            onClick={() => setShowRequest((s) => !s)}
            className="text-xs font-semibold text-[#0668E1] hover:underline"
          >
            {showRequest ? 'Hide' : 'Show'} outbound Digitap request
          </button>
          {showRequest ? (
            <pre className="mt-2 max-h-[280px] overflow-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-3 font-mono text-[11px] text-[var(--app-text-secondary)]">
              {formatJsonBlock(digitapRequest)}
            </pre>
          ) : null}
        </div>
      ) : null}
      {(rawForDisplay.length > 0 || data.note) ? (
        <div>
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="text-xs font-semibold text-[#0668E1] hover:underline"
          >
            {showRaw ? 'Hide' : 'Show'} full upstream envelope (debug)
          </button>
          {showRaw && (
            <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-3 font-mono text-[11px] text-[var(--app-text-secondary)]">
              {data.note ? `Note: ${String(data.note)}\n\n` : ''}
              {rawForDisplay}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
