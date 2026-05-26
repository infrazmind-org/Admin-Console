import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, apiUrl, formatFastApiDetail } from '../lib/api';
import { typeFieldHintForProduct, valuePlaceholderForProduct } from '../lib/productSearchHints';
import { getSearchFormFields, validateSearchForm } from '../lib/multiValueSearchForms';
import { AdminDigitapTestView, showStructuredAdminTestResponse } from '../lib/searchResultFields';
import { isUiPreviewToken } from '../lib/devPreview';

type UserRow = { id: number; email: string; role: string; status: string; credits: number; created_at: string };
type LogRow = {
  id: number;
  user_id: number;
  search_type: string;
  search_value_hash: string;
  status: string;
  credits_used: number;
  product_slug?: string;
  created_at: string;
  email: string;
};
type TxRow = {
  id: number;
  user_id: number;
  plan_id: number;
  amount: number;
  credits_added: number;
  created_at: string;
  email: string;
  plan_name: string;
};
type PlanRow = { id: number; name: string; price: number; credits: number };

type AdminTab = 'users' | 'logs' | 'transactions' | 'plans' | 'apiaccess' | 'apitest' | 'audit';

type EntitlementRow = {
  slug: string;
  name: string;
  default_credits_burn: number;
  enabled_for_user: boolean;
  credits_override: string;
};

type AuditRow = {
  id: number;
  admin_id: number | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

type CatalogPickRow = { slug: string; name: string; allowed_search_types: string[] };

const SEARCH_TYPES = ['Auto', 'Aadhaar', 'PAN', 'Mobile', 'Email', 'Bank', 'Unknown'];

export default function Admin() {
  const { token, user, refreshUser } = useAuth();
  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [tx, setTx] = useState<TxRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditInputs, setCreditInputs] = useState<Record<number, string>>({});
  const [planEdits, setPlanEdits] = useState<Record<number, { name: string; price: string; credits: string }>>({});
  const [apiUserId, setApiUserId] = useState<number | ''>('');
  const [entRows, setEntRows] = useState<EntitlementRow[]>([]);
  const [entLoading, setEntLoading] = useState(false);
  const [entMessage, setEntMessage] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [testSlug, setTestSlug] = useState('unified_lookup');
  const [testType, setTestType] = useState('Auto');
  const [testValue, setTestValue] = useState('');
  const [testMultiValues, setTestMultiValues] = useState<Record<string, string>>({});
  const [testFieldErrors, setTestFieldErrors] = useState<Record<string, string>>({});
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<unknown>(null);
  const [catalogPicklist, setCatalogPicklist] = useState<CatalogPickRow[]>([]);

  const testTypeOptions = useMemo(() => {
    const row = catalogPicklist.find((c) => c.slug === testSlug);
    if (row?.allowed_search_types?.length) return row.allowed_search_types;
    return SEARCH_TYPES;
  }, [catalogPicklist, testSlug]);

  const testFormFields = useMemo(() => getSearchFormFields(testSlug, testType), [testSlug, testType]);

  useEffect(() => {
    setTestMultiValues({});
    setTestFieldErrors({});
  }, [testSlug, testType]);

  const sortedUsers = useMemo(() => {
    const w = (s: string) => (s === 'pending' ? 0 : s === 'active' ? 1 : 2);
    return [...users].sort((a, b) => w(a.status) - w(b.status) || a.id - b.id);
  }, [users]);

  const pendingCount = useMemo(() => users.filter((u) => u.status === 'pending').length, [users]);

  const load = useCallback(async () => {
    if (!token) return;
    if (isUiPreviewToken(token)) {
      setError(null);
      setUsers([]);
      setLogs([]);
      setTx([]);
      setPlans([]);
      setPlanEdits({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [uRes, lRes, tRes, pRes] = await Promise.all([
        apiFetch('/api/admin/users', { token }),
        apiFetch('/api/admin/logs', { token }),
        apiFetch('/api/admin/transactions', { token }),
        apiFetch('/api/admin/plans', { token }),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      else setError('Failed to load users');
      if (lRes.ok) setLogs(await lRes.json());
      if (tRes.ok) setTx(await tRes.json());
      if (pRes.ok) {
        const list: PlanRow[] = await pRes.json();
        setPlans(list);
        const edits: Record<number, { name: string; price: string; credits: string }> = {};
        list.forEach((p) => {
          edits[p.id] = { name: p.name, price: String(p.price), credits: String(p.credits) };
        });
        setPlanEdits(edits);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadEntitlements = useCallback(async () => {
    if (!token || apiUserId === '') return;
    if (isUiPreviewToken(token)) {
      setEntRows([]);
      setEntMessage(null);
      setEntLoading(false);
      return;
    }
    setEntLoading(true);
    setEntMessage(null);
    try {
      const res = await apiFetch(`/api/admin/users/${apiUserId}/api-entitlements`, { token });
      if (!res.ok) {
        setEntMessage('Failed to load API matrix');
        setEntRows([]);
        return;
      }
      const data = (await res.json()) as Record<string, unknown>[];
      setEntRows(
        data.map((r) => ({
          slug: String(r.slug),
          name: String(r.name),
          default_credits_burn: Number(r.default_credits_burn ?? 1),
          enabled_for_user: Boolean(r.enabled_for_user),
          credits_override: r.credits_override != null && r.credits_override !== '' ? String(r.credits_override) : '',
        }))
      );
    } finally {
      setEntLoading(false);
    }
  }, [token, apiUserId]);

  useEffect(() => {
    if (tab === 'apiaccess' && apiUserId !== '') void loadEntitlements();
  }, [tab, apiUserId, loadEntitlements]);

  const loadAudit = useCallback(async () => {
    if (!token) return;
    if (isUiPreviewToken(token)) {
      setAuditRows([]);
      setAuditLoading(false);
      return;
    }
    setAuditLoading(true);
    try {
      const res = await apiFetch('/api/admin/audit', { token });
      if (res.ok) setAuditRows(await res.json());
    } finally {
      setAuditLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (tab === 'audit') void loadAudit();
  }, [tab, loadAudit]);

  useEffect(() => {
    if (tab !== 'apitest') return;
    let cancelled = false;
    void fetch(apiUrl('/api/catalog?phase=all'))
      .then((r) => r.json())
      .then(
        (data: {
          flat?: Array<{ slug: string; name: string; allowed_search_types?: string[] }>;
          grouped?: Record<string, { slug: string; name: string; allowed_search_types?: string[] }[]>;
        }) => {
          if (cancelled) return;
          const flat = Array.isArray(data.flat) ? data.flat : [];
          const rows =
            flat.length > 0
              ? flat
              : [
                  ...(data.grouped?.phase1 || []),
                  ...(data.grouped?.phase2 || []),
                  ...(data.grouped?.demo || []),
                  ...(data.grouped?.excluded || []),
                ];
          setCatalogPicklist(
            rows.map((r) => ({
              slug: r.slug,
              name: r.name,
              allowed_search_types:
                Array.isArray(r.allowed_search_types) && r.allowed_search_types.length
                  ? r.allowed_search_types
                  : SEARCH_TYPES,
            }))
          );
        }
      )
      .catch(() => {
        if (!cancelled) setCatalogPicklist([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (!testTypeOptions.includes(testType)) setTestType(testTypeOptions[0] ?? 'Auto');
  }, [testTypeOptions, testType]);

  const updateTestField = (id: string, val: string) => {
    setTestMultiValues((m) => ({ ...m, [id]: val }));
    setTestFieldErrors((errs) => {
      if (!errs[id]) return errs;
      const next = { ...errs };
      delete next[id];
      return next;
    });
  };

  const runAdminDigitapTest = async () => {
    if (!token || isUiPreviewToken(token)) return;
    setTestError(null);
    setTestResult(null);
    setTestFieldErrors({});

    const fields = testFormFields;
    let valueToSend = testValue.trim();
    if (fields) {
      const vr = validateSearchForm(testSlug, testType, fields, testMultiValues);
      if (vr.ok === false) {
        setTestFieldErrors(vr.fieldErrors);
        setTestError(vr.message);
        return;
      }
      valueToSend = vr.value;
    } else if (!valueToSend) {
      setTestError('Enter a value.');
      return;
    }

    setTestLoading(true);
    try {
      const res = await apiFetch('/api/admin/test-digitap', {
        method: 'POST',
        token,
        body: JSON.stringify({ type: testType, value: valueToSend, productSlug: testSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestError(formatFastApiDetail(data));
        return;
      }
      setTestResult(data);
    } catch {
      setTestError('Network error');
    } finally {
      setTestLoading(false);
    }
  };

  const setStatus = async (id: number, status: string) => {
    if (!token || isUiPreviewToken(token)) return;
    const res = await apiFetch(`/api/admin/users/${id}/status`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await load();
      if (user?.id === id) await refreshUser();
    }
  };

  const addCredits = async (id: number) => {
    if (!token || isUiPreviewToken(token)) return;
    const raw = creditInputs[id];
    const credits = Number(raw);
    if (!Number.isFinite(credits) || credits <= 0) return;
    const res = await apiFetch(`/api/admin/users/${id}/credits`, {
      method: 'POST',
      token,
      body: JSON.stringify({ credits }),
    });
    if (res.ok) {
      setCreditInputs((m) => ({ ...m, [id]: '' }));
      await load();
      if (user?.id === id) await refreshUser();
    }
  };

  const savePlan = async (id: number) => {
    if (!token || isUiPreviewToken(token)) return;
    const e = planEdits[id];
    if (!e) return;
    const price = Number(e.price);
    const credits = Number(e.credits);
    if (!e.name.trim() || !Number.isFinite(price) || !Number.isFinite(credits)) return;
    const res = await apiFetch(`/api/admin/plans/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ name: e.name.trim(), price, credits }),
    });
    if (res.ok) await load();
  };

  const saveEntitlements = async () => {
    if (!token || apiUserId === '' || isUiPreviewToken(token)) return;
    setEntMessage(null);
    const items = entRows.map((r) => ({
      api_slug: r.slug,
      enabled: r.enabled_for_user,
      credits_per_hit: r.credits_override.trim() === '' ? null : parseInt(r.credits_override, 10),
    }));
    for (const i of items) {
      if (i.credits_per_hit !== null && (Number.isNaN(i.credits_per_hit) || i.credits_per_hit < 1)) {
        setEntMessage('Credit overrides must be positive integers or empty for catalog default.');
        return;
      }
    }
    const res = await apiFetch(`/api/admin/users/${apiUserId}/api-entitlements`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      setEntMessage('Saved.');
      await loadEntitlements();
    } else {
      setEntMessage('Save failed');
    }
  };

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'users', label: 'Users' },
    { id: 'logs', label: 'Search logs' },
    { id: 'transactions', label: 'Purchases' },
    { id: 'plans', label: 'Plans' },
    { id: 'apiaccess', label: 'User APIs' },
    { id: 'apitest', label: 'API test (no credits)' },
    { id: 'audit', label: 'Audit log' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00b4d8]/15 text-[#00b4d8]">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--app-text)]">Admin console</h1>
            <p className="text-[var(--app-muted)]">Approvals, credits, plans, and metadata-only visibility.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]"
          >
            Refresh
          </button>
        </div>
      </div>

      {isUiPreviewToken(token) && (
        <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <strong className="font-semibold">Local UI preview</strong> — no backend; data actions are disabled and tables are empty.
          After <strong>Sign out</strong>, reload the page to return here. For a real session, remove{' '}
          <code className="rounded bg-[var(--app-bg)] px-1">VITE_ADMIN_UI_PREVIEW</code> from <code className="rounded bg-[var(--app-bg)] px-1">.env.local</code>, restart{' '}
          <code className="rounded bg-[var(--app-bg)] px-1">npm run dev</code>, and run the API.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-8 flex flex-wrap gap-2 border-b border-[var(--app-border)] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? 'bg-[#00b4d8] text-white shadow-md'
                : 'text-[var(--app-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="mb-4 text-sm text-[var(--app-muted)]">Loading…</p>}

      {tab === 'users' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--app-muted)]">
            Operator accounts with role <code className="rounded bg-[var(--app-bg)] px-1 text-xs">admin</code> are not listed here or in
            User APIs — manage them in Supabase if needed.
          </p>
          {pendingCount > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              <strong className="font-semibold">{pendingCount}</strong> registration{pendingCount === 1 ? '' : 's'} awaiting approval (sorted
              to the top below).
            </div>
          )}
          <div className="overflow-x-auto rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)]">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Credits</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => (
                <tr key={u.id} className="border-t border-[var(--app-border)] text-[var(--app-text-secondary)]">
                  <td className="px-4 py-3 font-medium text-[var(--app-text)]">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">{u.status}</td>
                  <td className="px-4 py-3 font-mono">{u.credits}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
                      {u.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => void setStatus(u.id, 'active')}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void setStatus(u.id, 'blocked')}
                            className="rounded-lg bg-slate-600 px-2 py-1 text-xs font-bold text-white hover:bg-slate-700"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {u.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => void setStatus(u.id, 'blocked')}
                          className="rounded-lg bg-red-600/90 px-2 py-1 text-xs font-bold text-white hover:bg-red-700"
                        >
                          Block
                        </button>
                      )}
                      {u.status === 'blocked' && (
                        <button
                          type="button"
                          onClick={() => void setStatus(u.id, 'active')}
                          className="rounded-lg bg-[#0668E1] px-2 py-1 text-xs font-bold text-white hover:bg-[#0556ba]"
                        >
                          Unblock
                        </button>
                      )}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          placeholder="+credits"
                          value={creditInputs[u.id] ?? ''}
                          onChange={(e) => setCreditInputs((m) => ({ ...m, [u.id]: e.target.value }))}
                          className="w-24 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1 text-xs text-[var(--app-text)]"
                        />
                        <button
                          type="button"
                          onClick={() => void addCredits(u.id)}
                          className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-xs font-semibold text-[var(--app-text)] hover:border-[#0668E1]/40"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="overflow-x-auto rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Hash</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Credits</th>
                <th className="px-4 py-3 font-semibold">Product</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id} className="border-t border-[var(--app-border)] text-[var(--app-text-secondary)]">
                  <td className="px-4 py-2 font-mono text-xs">{row.created_at}</td>
                  <td className="px-4 py-2">{row.email}</td>
                  <td className="px-4 py-2">{row.search_type}</td>
                  <td className="max-w-[180px] truncate px-4 py-2 font-mono text-xs">{row.search_value_hash}</td>
                  <td className="px-4 py-2">{row.status}</td>
                  <td className="px-4 py-2">{row.credits_used}</td>
                  <td className="max-w-[140px] truncate px-4 py-2 font-mono text-xs">{row.product_slug ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="overflow-x-auto rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Credits</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((row) => (
                <tr key={row.id} className="border-t border-[var(--app-border)] text-[var(--app-text-secondary)]">
                  <td className="px-4 py-2 font-mono text-xs">{row.created_at}</td>
                  <td className="px-4 py-2">{row.email}</td>
                  <td className="px-4 py-2">{row.plan_name}</td>
                  <td className="px-4 py-2">₹{row.amount}</td>
                  <td className="px-4 py-2">+{row.credits_added}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'plans' && (
        <div className="space-y-4">
          {plans.map((p) => {
            const e = planEdits[p.id] ?? { name: p.name, price: String(p.price), credits: String(p.credits) };
            return (
              <div
                key={p.id}
                className="flex flex-col gap-4 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 md:flex-row md:items-end"
              >
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">Name</label>
                    <input
                      value={e.name}
                      onChange={(ev) =>
                        setPlanEdits((m) => ({
                          ...m,
                          [p.id]: { ...e, name: ev.target.value },
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-[var(--app-text)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">Price (₹)</label>
                    <input
                      type="number"
                      value={e.price}
                      onChange={(ev) =>
                        setPlanEdits((m) => ({
                          ...m,
                          [p.id]: { ...e, price: ev.target.value },
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-[var(--app-text)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">Credits</label>
                    <input
                      type="number"
                      value={e.credits}
                      onChange={(ev) =>
                        setPlanEdits((m) => ({
                          ...m,
                          [p.id]: { ...e, credits: ev.target.value },
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-[var(--app-text)]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void savePlan(p.id)}
                  className="rounded-xl bg-[#0668E1] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0556ba]"
                >
                  Save
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'apiaccess' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6">
            <h2 className="mb-2 font-display text-lg font-bold text-[var(--app-text)]">Per-user API access & burn</h2>
            <p className="mb-4 text-sm text-[var(--app-muted)]">
              Only APIs with <strong className="text-[var(--app-text)]">Enabled</strong> can be called for that user (except{' '}
              <code className="rounded bg-[var(--app-bg)] px-1">unified_lookup</code>). Empty credit override uses the catalog default burn.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">User</label>
                <select
                  value={apiUserId === '' ? '' : String(apiUserId)}
                  onChange={(e) => setApiUserId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-[var(--app-text)]"
                >
                  <option value="">Select user…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email} (#{u.id})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={apiUserId === ''}
                onClick={() => void loadEntitlements()}
                className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:opacity-40"
              >
                Reload
              </button>
              <button
                type="button"
                disabled={apiUserId === '' || entRows.length === 0}
                onClick={() => void saveEntitlements()}
                className="rounded-xl bg-[#0668E1] px-4 py-2 text-sm font-bold text-white hover:bg-[#0556ba] disabled:opacity-40"
              >
                Save matrix
              </button>
            </div>
            {entMessage && <p className="mt-3 text-sm text-[var(--app-muted)]">{entMessage}</p>}
          </div>
          {entLoading ? (
            <p className="text-sm text-[var(--app-muted)]">Loading…</p>
          ) : entRows.length ? (
            <div className="max-h-[560px] overflow-auto rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">API</th>
                    <th className="px-3 py-2 font-semibold">Default burn</th>
                    <th className="px-3 py-2 font-semibold">Enabled</th>
                    <th className="px-3 py-2 font-semibold">Override credits</th>
                  </tr>
                </thead>
                <tbody>
                  {entRows.map((r) => (
                    <tr key={r.slug} className="border-t border-[var(--app-border)] text-[var(--app-text-secondary)]">
                      <td className="px-3 py-2">
                        <div className="font-medium text-[var(--app-text)]">{r.name}</div>
                        <div className="font-mono text-xs text-[var(--app-muted)]">{r.slug}</div>
                      </td>
                      <td className="px-3 py-2 font-mono">{r.default_credits_burn}</td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={r.enabled_for_user}
                          onChange={(e) =>
                            setEntRows((rows) =>
                              rows.map((x) => (x.slug === r.slug ? { ...x, enabled_for_user: e.target.checked } : x))
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          placeholder={`default ${r.default_credits_burn}`}
                          value={r.credits_override}
                          onChange={(e) =>
                            setEntRows((rows) =>
                              rows.map((x) => (x.slug === r.slug ? { ...x, credits_override: e.target.value } : x))
                            )
                          }
                          className="w-28 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1 text-[var(--app-text)]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : apiUserId !== '' ? (
            <p className="text-sm text-[var(--app-muted)]">No catalog rows returned.</p>
          ) : null}
        </div>
      )}

      {tab === 'apitest' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6">
            <h2 className="mb-2 font-display text-lg font-bold text-[var(--app-text)]">Digitap probe (admin)</h2>
            <p className="mb-4 text-sm text-[var(--app-muted)]">
              Same request shaping as customer search routes, but <strong className="text-[var(--app-text)]">no credits</strong> are debited
              and nothing is written to <code className="rounded bg-[var(--app-bg)] px-1">search_logs</code>. Use for connectivity checks only;
              still subject to vendor IP allowlists and rate limits.
            </p>
            {isUiPreviewToken(token) ? (
              <p className="text-sm text-[var(--app-muted)]">Disabled in local UI preview mode.</p>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-start">
                <div className="min-w-0 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">Product</label>
                    <select
                      value={testSlug}
                      onChange={(e) => setTestSlug(e.target.value)}
                      className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-[var(--app-text)]"
                    >
                      {catalogPicklist.length === 0 ? (
                        <option value="unified_lookup">unified_lookup (catalog not loaded)</option>
                      ) : (
                        catalogPicklist.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">Input type</label>
                    <select
                      value={testType}
                      onChange={(e) => setTestType(e.target.value)}
                      className="mb-1 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-[var(--app-text)]"
                    >
                      {testTypeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const h = typeFieldHintForProduct(testSlug);
                      return h ? <p className="text-xs text-[var(--app-muted)]">{h}</p> : null;
                    })()}
                  </div>
                  <div>
                    {testFormFields ? (
                      <div className="space-y-3">
                        {testFormFields.map((f) => (
                          <div key={f.id}>
                            <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">
                              {f.label}
                              {f.required ? <span className="text-red-500"> *</span> : null}
                            </label>
                            <input
                              type={f.inputType ?? 'text'}
                              autoComplete="off"
                              value={testMultiValues[f.id] ?? ''}
                              onChange={(e) => updateTestField(f.id, e.target.value)}
                              placeholder={f.placeholder}
                              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)]"
                            />
                            {testFieldErrors[f.id] ? (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{testFieldErrors[f.id]}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">Value</label>
                        <textarea
                          value={testValue}
                          onChange={(e) => setTestValue(e.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 font-mono text-sm text-[var(--app-text)]"
                          placeholder={valuePlaceholderForProduct(testSlug)}
                        />
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={testLoading || (!testFormFields && !testValue.trim())}
                    onClick={() => void runAdminDigitapTest()}
                    className="rounded-xl bg-[#00b4d8] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0096b8] disabled:opacity-40"
                  >
                    {testLoading ? 'Calling…' : 'Run test'}
                  </button>
                  {testError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{testError}</p>
                  )}
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">Response</label>
                  {testResult != null && showStructuredAdminTestResponse(testResult) ? (
                    <div className="max-h-[520px] w-full min-w-0 overflow-y-auto overflow-x-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4">
                      <AdminDigitapTestView data={testResult} />
                    </div>
                  ) : (
                    <pre className="max-h-[480px] w-full min-w-0 overflow-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4 font-mono text-xs text-[var(--app-text-secondary)]">
                      {testResult != null ? JSON.stringify(testResult, null, 2) : 'Run a test to see results here.'}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="overflow-x-auto rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
            <h2 className="font-display text-lg font-bold text-[var(--app-text)]">Admin audit trail</h2>
            <button
              type="button"
              onClick={() => void loadAudit()}
              className="text-sm font-semibold text-[#0668E1] hover:underline"
            >
              Refresh
            </button>
          </div>
          {auditLoading ? (
            <p className="p-4 text-sm text-[var(--app-muted)]">Loading…</p>
          ) : (
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-muted)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">Admin</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                  <th className="px-3 py-2 font-semibold">Entity</th>
                  <th className="px-3 py-2 font-semibold">Payload</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--app-border)] align-top text-[var(--app-text-secondary)]">
                    <td className="px-3 py-2 font-mono text-xs">{row.created_at}</td>
                    <td className="px-3 py-2">{row.admin_id ?? '—'}</td>
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2">
                      {row.entity_type} {row.entity_id ? `#${row.entity_id}` : ''}
                    </td>
                    <td className="max-w-md px-3 py-2 font-mono text-xs break-all text-[var(--app-muted)]">
                      {JSON.stringify(row.payload)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
