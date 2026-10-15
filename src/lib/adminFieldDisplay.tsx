import React from 'react';
import { imageSrcForField } from './imageField';

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

const LINK_KEYS = new Set(['report', 'report_url', 'url', 'html_link', 'html_url']);

function reportLinkLabel(fieldKey: string, url: string): string {
  if (fieldKey === 'url') return 'Open link';
  if (fieldKey === 'report' || fieldKey === 'report_url') return 'Open skip tracing report (PDF)';
  return url.toLowerCase().includes('.pdf') ? 'Open report (PDF)' : 'Open report';
}

/** Admin-only: render report / URL fields as anchors and photo fields as images, not raw strings. */
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
    const imgSrc = fieldKey ? imageSrcForField(fieldKey, trimmed) : null;
    if (imgSrc) {
      return (
        <img
          src={imgSrc}
          alt={fieldKey}
          className="h-40 w-32 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] object-cover"
        />
      );
    }
    const nk = fieldKey ? normalizeFieldKey(fieldKey) : '';
    const asLink = isHttpUrl(trimmed) && (LINK_KEYS.has(nk) || trimmed.toLowerCase().includes('.pdf'));
    if (asLink) {
      return (
        <a
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm font-semibold text-[#0668E1] hover:underline"
        >
          {reportLinkLabel(nk, trimmed)}
        </a>
      );
    }
    return <span className={`whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed ${className}`}>{trimmed}</span>;
  }
  return null;
}
