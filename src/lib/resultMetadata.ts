/** Strip vendor-internal nested blobs from displayed business payloads. */

const NESTED_METADATA_KEYS = new Set(['metadata', 'meta_data', 'meta', 'raw', 'apisource', 'api_source']);

function normalizeKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/_+/g, '_');
}

function isEmptyAfterStrip(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'boolean' || typeof value === 'number') return false;
  if (Array.isArray(value)) return value.length === 0 || value.every(isEmptyAfterStrip);
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

export function isNestedMetadataKey(key: string): boolean {
  const nk = normalizeKey(key);
  return !nk || nk.startsWith('_') || NESTED_METADATA_KEYS.has(nk);
}

export function stripNestedMetadata(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(stripNestedMetadata).filter((x) => !isEmptyAfterStrip(x));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isNestedMetadataKey(k)) continue;
      const cleaned = stripNestedMetadata(v);
      if (!isEmptyAfterStrip(cleaned)) out[k] = cleaned;
    }
    return out;
  }
  return value;
}
