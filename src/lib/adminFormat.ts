const IST = 'Asia/Kolkata';

export function formatIstDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function logOutcomeLabel(status: string): 'Success' | 'Error' {
  const s = (status || '').trim();
  return s === 'Success' ? 'Success' : 'Error';
}

const API_ERROR_KIND_LABELS: Record<string, string> = {
  http_error: 'Digitap HTTP error',
  transport_error: 'Network / timeout',
  auth_error: 'Digitap auth failed',
  upstream_error: 'Digitap upstream error',
  vendor_result_code: 'Digitap result code',
  vendor_message: 'Digitap error message',
  billing_failed: 'Billing failed (our system)',
};

export function apiErrorSourceLabel(source: string): string {
  return source === 'vendor' ? 'Vendor (Digitap)' : source === 'system' ? 'System (InfrazMind)' : source || '—';
}

export function apiErrorKindLabel(kind: string): string {
  return API_ERROR_KIND_LABELS[kind] || kind.replace(/_/g, ' ');
}

type AuditPayload = Record<string, unknown>;

export function formatAuditAction(action: string, payload: AuditPayload): string {
  switch (action) {
    case 'user.approved':
      return 'Approved user registration';
    case 'user.status': {
      const st = String(payload.status ?? '');
      const prev = String(payload.previous ?? '');
      if (prev === 'pending' && st === 'active') return 'Approved user (status only)';
      if (st === 'blocked') return 'Blocked user';
      if (st === 'active' && prev === 'blocked') return 'Unblocked user';
      return `Changed user status to ${st}`;
    }
    case 'user.credits_add':
      return `Added ${payload.added ?? '?'} credits`;
    case 'user.delete':
      return 'Deleted user account';
    case 'user.api_entitlements':
      return 'Updated API access and burn rates';
    case 'plan.update':
      return 'Updated subscription plan';
    default:
      return action.replace(/\./g, ' · ');
  }
}

export function formatAuditDetail(action: string, payload: AuditPayload): string {
  switch (action) {
    case 'user.approved': {
      const parts: string[] = [];
      if (payload.credits_added != null) parts.push(`Credits added: ${payload.credits_added}`);
      if (payload.new_credits != null) parts.push(`New balance: ${payload.new_credits}`);
      const enabled = payload.enabled_apis;
      if (Array.isArray(enabled) && enabled.length) {
        parts.push(`APIs enabled: ${enabled.join(', ')}`);
      }
      const overrides = payload.credit_overrides as Record<string, number> | undefined;
      if (overrides && Object.keys(overrides).length) {
        const o = Object.entries(overrides)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
        parts.push(`Burn overrides: ${o}`);
      }
      return parts.join(' · ') || '—';
    }
    case 'user.credits_add':
      return `Added ${payload.added ?? '?'} credits (balance: ${payload.new_credits ?? '?'})`;
    case 'user.status':
      return `Status: ${payload.previous ?? '?'} → ${payload.status ?? '?'}`;
    case 'user.delete':
      return `Email: ${payload.email ?? '?'}`;
    case 'user.api_entitlements': {
      const parts: string[] = [];
      const enabled = payload.enabled;
      if (Array.isArray(enabled) && enabled.length) parts.push(`Enabled: ${enabled.join(', ')}`);
      const disabled = payload.disabled;
      if (Array.isArray(disabled) && disabled.length) parts.push(`Disabled: ${disabled.join(', ')}`);
      const overrides = payload.overrides as Record<string, number> | undefined;
      if (overrides && Object.keys(overrides).length) {
        parts.push(
          `Overrides: ${Object.entries(overrides)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ')}`
        );
      }
      return parts.join(' · ') || '—';
    }
    case 'plan.update':
      return `Plan "${payload.name ?? '?'}" — ₹${payload.price ?? '?'}, ${payload.credits ?? '?'} credits`;
    default:
      return JSON.stringify(payload);
  }
}
