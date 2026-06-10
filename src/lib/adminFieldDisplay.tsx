import React from 'react';

function normalizeFieldKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/_+/g, '_');
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function reportLinkLabel(fieldKey: string): string {
  const nk = normalizeFieldKey(fieldKey);
  if (nk === 'report' || nk === 'report_url') return 'Open skip tracing report (PDF)';
  if (nk === 'url') return 'Open link';
  return 'Open report';
}

/** Admin-only: render report / URL fields as anchors, not raw strings. */
export function AdminFieldValue({
  fieldKey,
  value,
  className = 'text-sm font-medium leading-snug text-[var(--app-text)]',
}: {
  fieldKey?: string;
  value: unknown;
  className?: string;
}) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return <span className="text-[var(--app-muted)]">—</span>;
    }
    const nk = fieldKey ? normalizeFieldKey(fieldKey) : '';
    const asLink =
      isHttpUrl(trimmed) &&
      (nk === 'report' || nk === 'report_url' || nk === 'url' || trimmed.toLowerCase().includes('.pdf'));
    if (asLink) {
      return (
        <a
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm font-semibold text-[#0668E1] hover:underline"
        >
          {reportLinkLabel(nk || 'report')}
        </a>
      );
    }
    return <span className={`whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed ${className}`}>{trimmed}</span>;
  }
  return null;
}
