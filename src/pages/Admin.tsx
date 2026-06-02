import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AdminLayout, { type AdminTabId } from '../components/AdminLayout';
import { AdminAlert, AdminCard, StatusBadge } from '../components/admin/AdminUi';
import { apiFetch, apiUrl, formatFastApiDetail } from '../lib/api';
import { typeFieldHintForProduct, valuePlaceholderForProduct } from '../lib/productSearchHints';
import { getSearchFormFields, validateSearchForm } from '../lib/multiValueSearchForms';
import { AdminDigitapTestView, showStructuredAdminTestResponse } from '../lib/searchResultFields';
import { isUiPreviewToken } from '../lib/devPreview';
import ConfirmModal from '../components/ConfirmModal';
import LoadingOverlay from '../components/LoadingOverlay';
import ApproveUserModal, { type ApproveCatalogRow } from '../components/ApproveUserModal';
import AddCreditsModal from '../components/AddCreditsModal';
import {
  apiErrorKindLabel,
  apiErrorSourceLabel,
  formatAuditAction,
  formatAuditDetail,
  formatIstDateTime,
  logOutcomeLabel,
} from '../lib/adminFormat';
import {
  formatIstRangeLabel,
  istMonthStartYmd,
  istTodayYmd,
  istYmdDaysAgo,
} from '../lib/istDates';

function deleteUserErrorMessage(res: Response, data: unknown): string {
  const detail = formatFastApiDetail(data);
  if (res.status === 404 && detail === 'Not Found') {
    return 'Delete is not available on the API server yet. Deploy the latest api/ service to Render, then try again.';
  }
  if (res.status === 404 && detail === 'User not found') {
    return 'This account is no longer in the database. Refresh the user list.';
  }
  return detail;
}

type UserRow = { id: number; email: string; role: string; status: string; credits: number; created_at: string };
type LogRow = {
  id: number;
  user_id: number;
  search_type: string;
  search_value?: string | null;
  search_value_hash: string;
  status: string;
  credits_used: number;
  product_slug?: string;
  product_name?: string;
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

type AdminTab = AdminTabId;

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
  entity_email?: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type ApiErrorRow = {
  id: number;
  user_id: number;
  email: string;
  product_slug: string;
  product_name?: string;
  search_type: string;
  search_value?: string | null;
  error_source: string;
  error_kind: string;
  http_status?: number | null;
  result_code?: string | null;
  message?: string | null;
  digitap_path?: string | null;
  detail_json?: Record<string, unknown>;
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
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [approveTarget, setApproveTarget] = useState<UserRow | null>(null);
  const [approveModalError, setApproveModalError] = useState<string | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<number | null>(null);
  const [approveCatalog, setApproveCatalog] = useState<ApproveCatalogRow[]>([]);
  const [creditsTarget, setCreditsTarget] = useState<UserRow | null>(null);
  const [creditsModalError, setCreditsModalError] = useState<string | null>(null);
  const [addingCreditsUserId, setAddingCreditsUserId] = useState<number | null>(null);
  const [logFilterUserId, setLogFilterUserId] = useState<number | ''>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [billingFrom, setBillingFrom] = useState(() => istYmdDaysAgo(30));
  const [billingTo, setBillingTo] = useState(() => istTodayYmd());
  const [billingLogs, setBillingLogs] = useState<LogRow[]>([]);
  const [billingLogsLoading, setBillingLogsLoading] = useState(false);
  const [billingRates, setBillingRates] = useState<Record<string, string>>({});
  const [apiErrors, setApiErrors] = useState<ApiErrorRow[]>([]);
  const [apiErrorsLoading, setApiErrorsLoading] = useState(false);
  const [apiErrorSourceFilter, setApiErrorSourceFilter] = useState<'' | 'vendor' | 'system'>('');
  const [apiErrorFrom, setApiErrorFrom] = useState(() => istYmdDaysAgo(30));
  const [apiErrorTo, setApiErrorTo] = useState(() => istTodayYmd());
  const [expandedApiErrorId, setExpandedApiErrorId] = useState<number | null>(null);
  const [planEdits, setPlanEdits] = useState<Record<number, { name: string; price: string; credits: string }>>({});
  const [apiUserId, setApiUserId] = useState<number | ''>('');
  const [entRows, setEntRows] = useState<EntitlementRow[]>([]);
  const [entLoading, setEntLoading] = useState(false);
  const [entMessage, setEntMessage] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [testSlug, setTestSlug] = useState('');
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

  const billingRows = useMemo(() => {
    const map = new Map<
      string,
      { slug: string; name: string; total: number; success: number; error: number }
    >();
    for (const row of billingLogs) {
      const slug = (row.product_slug || 'unknown').trim() || 'unknown';
      const cur = map.get(slug) ?? {
        slug,
        name: row.product_name || slug,
        total: 0,
        success: 0,
        error: 0,
      };
      cur.total += 1;
      if (logOutcomeLabel(row.status) === 'Success') cur.success += 1;
      else cur.error += 1;
      map.set(slug, cur);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [billingLogs]);

  const billingTotal = useMemo(() => {
    return billingRows.reduce((sum, row) => {
      const rate = Number(billingRates[row.slug] ?? '');
      if (!Number.isFinite(rate) || rate < 0) return sum;
      return sum + row.success * rate;
    }, 0);
  }, [billingRows, billingRates]);

  const loadLogs = useCallback(async () => {
    if (!token) return;
    if (isUiPreviewToken(token)) {
      setLogs([]);
      setLogsLoading(false);
      return;
    }
    setLogsLoading(true);
    try {
      const qs = logFilterUserId === '' ? '?limit=500' : `?limit=500&user_id=${logFilterUserId}`;
      const res = await apiFetch(`/api/admin/logs${qs}`, { token });
      if (res.ok) setLogs(await res.json());
    } finally {
      setLogsLoading(false);
    }
  }, [token, logFilterUserId]);

  const loadBillingLogs = useCallback(async () => {
    if (!token) return;
    if (isUiPreviewToken(token)) {
      setBillingLogs([]);
      setBillingLogsLoading(false);
      return;
    }
    if (billingFrom && billingTo && billingFrom > billingTo) {
      setError('Billing date range: start date must be on or before end date.');
      return;
    }
    setBillingLogsLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '2000' });
      if (billingFrom) qs.set('from', billingFrom);
      if (billingTo) qs.set('to', billingTo);
      if (logFilterUserId !== '') qs.set('user_id', String(logFilterUserId));
      const res = await apiFetch(`/api/admin/logs?${qs}`, { token });
      if (res.ok) setBillingLogs(await res.json());
    } finally {
      setBillingLogsLoading(false);
    }
  }, [token, billingFrom, billingTo, logFilterUserId]);

  const loadApiErrors = useCallback(async () => {
    if (!token) return;
    if (isUiPreviewToken(token)) {
      setApiErrors([]);
      setApiErrorsLoading(false);
      return;
    }
    if (apiErrorFrom && apiErrorTo && apiErrorFrom > apiErrorTo) {
      setError('API error date range: start date must be on or before end date.');
      return;
    }
    setApiErrorsLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '500' });
      if (apiErrorFrom) qs.set('from', apiErrorFrom);
      if (apiErrorTo) qs.set('to', apiErrorTo);
      if (logFilterUserId !== '') qs.set('user_id', String(logFilterUserId));
      if (apiErrorSourceFilter) qs.set('error_source', apiErrorSourceFilter);
      const res = await apiFetch(`/api/admin/api-errors?${qs}`, { token });
      if (res.ok) setApiErrors(await res.json());
    } finally {
      setApiErrorsLoading(false);
    }
  }, [token, apiErrorFrom, apiErrorTo, logFilterUserId, apiErrorSourceFilter]);

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
      const [uRes, tRes, pRes] = await Promise.all([
        apiFetch('/api/admin/users', { token }),
        apiFetch('/api/admin/transactions', { token }),
        apiFetch('/api/admin/plans', { token }),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      else setError('Failed to load users');
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

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (tab === 'billing') void loadBillingLogs();
  }, [tab, loadBillingLogs]);

  useEffect(() => {
    if (tab === 'apierrors') void loadApiErrors();
  }, [tab, loadApiErrors]);

  useEffect(() => {
    if (!token || isUiPreviewToken(token)) return;
    let cancelled = false;
    void fetch(apiUrl('/api/catalog?phase=all'))
      .then((r) => r.json())
      .then(
        (data: {
          flat?: Array<{ slug: string; name: string; default_credits_burn?: number }>;
          grouped?: Record<string, { slug: string; name: string; default_credits_burn?: number }[]>;
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
                ];
          setApproveCatalog(
            rows
              .filter((r) => r.slug !== 'unified_lookup')
              .map((r) => ({
                slug: r.slug,
                name: r.name,
                default_credits_burn: Number(r.default_credits_burn ?? 1),
              }))
          );
        }
      )
      .catch(() => {
        if (!cancelled) setApproveCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
          const list = rows
            .filter((r) => r.slug !== 'unified_lookup')
            .map((r) => ({
              slug: r.slug,
              name: r.name,
              allowed_search_types:
                Array.isArray(r.allowed_search_types) && r.allowed_search_types.length
                  ? r.allowed_search_types
                  : SEARCH_TYPES,
            }));
          setCatalogPicklist(list);
          if (list.length > 0) {
            setTestSlug((prev) => (prev && list.some((x) => x.slug === prev) ? prev : list[0]!.slug));
          }
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

  const confirmApproveUser = async (payload: {
    credits: number;
    items: { api_slug: string; enabled: boolean; credits_per_hit: number | null }[];
  }) => {
    const u = approveTarget;
    if (!u || !token || isUiPreviewToken(token)) return;
    setApproveModalError(null);
    setApprovingUserId(u.id);
    try {
      const res = await apiFetch(`/api/admin/users/${u.id}/approve`, {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApproveModalError(formatFastApiDetail(data));
        return;
      }
      setApproveTarget(null);
      await load();
      await loadLogs();
    } catch {
      setApproveModalError('Network error');
    } finally {
      setApprovingUserId(null);
    }
  };

  const confirmAddCredits = async (credits: number) => {
    const u = creditsTarget;
    if (!u || !token || isUiPreviewToken(token)) return;
    setCreditsModalError(null);
    setAddingCreditsUserId(u.id);
    try {
      const res = await apiFetch(`/api/admin/users/${u.id}/credits`, {
        method: 'POST',
        token,
        body: JSON.stringify({ credits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreditsModalError(formatFastApiDetail(data));
        return;
      }
      setCreditsTarget(null);
      await load();
      if (user?.id === u.id) await refreshUser();
    } catch {
      setCreditsModalError('Network error');
    } finally {
      setAddingCreditsUserId(null);
    }
  };

  const openApiAccess = (u: UserRow) => {
    setApiUserId(u.id);
    setTab('apiaccess');
  };

  const confirmDeleteUser = async () => {
    const u = deleteTarget;
    if (!u || !token || isUiPreviewToken(token)) return;
    setDeleteModalError(null);
    setDeletingUserId(u.id);
    try {
      const res = await apiFetch(`/api/admin/users/${u.id}/delete`, { method: 'POST', token });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteModalError(deleteUserErrorMessage(res, data));
        return;
      }
      if (apiUserId === u.id) setApiUserId('');
      setDeleteTarget(null);
      await load();
    } catch {
      setDeleteModalError('Network error. Check your connection and try again.');
    } finally {
      setDeletingUserId(null);
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

  const overlayBusy =
    loading ||
    logsLoading ||
    apiErrorsLoading ||
    entLoading ||
    auditLoading ||
    deletingUserId !== null ||
    approvingUserId !== null ||
    addingCreditsUserId !== null;

  return (
    <>
    <LoadingOverlay visible={overlayBusy} />
    <ApproveUserModal
      open={approveTarget !== null}
      email={approveTarget?.email ?? ''}
      catalog={approveCatalog}
      loading={approvingUserId !== null}
      error={approveModalError}
      onCancel={() => {
        if (approvingUserId !== null) return;
        setApproveTarget(null);
        setApproveModalError(null);
      }}
      onConfirm={(p) => void confirmApproveUser(p)}
    />
    <AddCreditsModal
      open={creditsTarget !== null}
      email={creditsTarget?.email ?? ''}
      loading={addingCreditsUserId !== null}
      error={creditsModalError}
      onCancel={() => {
        if (addingCreditsUserId !== null) return;
        setCreditsTarget(null);
        setCreditsModalError(null);
      }}
      onConfirm={(c) => void confirmAddCredits(c)}
    />
    <ConfirmModal
      open={deleteTarget !== null}
      title="Delete account?"
      confirmLabel="Delete permanently"
      cancelLabel="Keep account"
      loading={deletingUserId !== null}
      error={deleteModalError}
      onCancel={() => {
        if (deletingUserId !== null) return;
        setDeleteTarget(null);
        setDeleteModalError(null);
      }}
      onConfirm={() => void confirmDeleteUser()}
    >
      {deleteTarget && (
        <>
          <p>
            You are about to delete <strong className="text-[var(--app-text)]">{deleteTarget.email}</strong>.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Search history, purchases, and API entitlements are removed</li>
            <li>Pending registration OTP data for this email is cleared</li>
            <li>This cannot be undone</li>
          </ul>
        </>
      )}
    </ConfirmModal>
    <AdminLayout
      activeTab={tab}
      onTabChange={setTab}
      pendingCount={pendingCount}
      onRefresh={() => {
        void load();
        if (tab === 'logs') void loadLogs();
        if (tab === 'billing') void loadBillingLogs();
        if (tab === 'apierrors') void loadApiErrors();
      }}
    >
      {isUiPreviewToken(token) && (
        <div className="mb-6">
        <AdminAlert variant="warn">
          <strong className="font-semibold">Local UI preview</strong> — no backend; data actions are disabled and tables are empty.
          After <strong>Sign out</strong>, reload the page to return here. For a real session, remove{' '}
          <code className="rounded bg-[var(--app-bg)] px-1">VITE_ADMIN_UI_PREVIEW</code> from <code className="rounded bg-[var(--app-bg)] px-1">.env.local</code>, restart{' '}
          <code className="rounded bg-[var(--app-bg)] px-1">npm run dev</code>, and run the API.
        </AdminAlert>
        </div>
      )}

      {error && (
        <div className="mb-6">
          <AdminAlert variant="error">{error}</AdminAlert>
        </div>
      )}

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
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 font-mono">{u.credits}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
                      {u.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setApproveModalError(null);
                              setApproveTarget(u);
                            }}
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
                      {u.status === 'blocked' && (
                        <button
                          type="button"
                          onClick={() => void setStatus(u.id, 'active')}
                          className="rounded-lg bg-[#0668E1] px-2 py-1 text-xs font-bold text-white hover:bg-[#0556ba]"
                        >
                          Unblock
                        </button>
                      )}
                      {u.status === 'active' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setCreditsModalError(null);
                              setCreditsTarget(u);
                            }}
                            className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-xs font-semibold text-[var(--app-text)] hover:border-[#0668E1]/40"
                          >
                            Add credits
                          </button>
                          <button
                            type="button"
                            onClick={() => openApiAccess(u)}
                            className="rounded-lg border border-[#00b4d8]/40 px-2 py-1 text-xs font-semibold text-[#00b4d8] hover:bg-[#00b4d8]/10"
                          >
                            API access
                          </button>
                          <button
                            type="button"
                            disabled={deletingUserId === u.id}
                            onClick={() => {
                              setDeleteModalError(null);
                              setDeleteTarget(u);
                            }}
                            className="rounded-lg border border-red-500/40 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            Delete account
                          </button>
                        </>
                      )}
                      {u.status === 'blocked' && (
                        <button
                          type="button"
                          disabled={deletingUserId === u.id}
                          onClick={() => {
                            setDeleteModalError(null);
                            setDeleteTarget(u);
                          }}
                          className="rounded-lg border border-red-500/40 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Delete account
                        </button>
                      )}
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">Filter by user</label>
              <select
                value={logFilterUserId === '' ? '' : String(logFilterUserId)}
                onChange={(e) => setLogFilterUserId(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)]"
              >
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void loadLogs()}
              className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]"
            >
              Apply filter
            </button>
            <p className="text-xs text-[var(--app-muted)]">Times shown in IST · up to 500 rows</p>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">When (IST)</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Input</th>
                  <th className="px-4 py-3 font-semibold">Outcome</th>
                  <th className="px-4 py-3 font-semibold">Credits charged</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => {
                  const outcome = logOutcomeLabel(row.status);
                  return (
                    <tr key={row.id} className="border-t border-[var(--app-border)] text-[var(--app-text-secondary)]">
                      <td className="whitespace-nowrap px-4 py-2 text-xs">{formatIstDateTime(row.created_at)}</td>
                      <td className="px-4 py-2">{row.email}</td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-[var(--app-text)]">{row.product_name ?? row.product_slug ?? '—'}</div>
                        {row.product_slug && (
                          <div className="font-mono text-xs text-[var(--app-muted)]">{row.product_slug}</div>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-2 font-mono text-xs" title={row.search_value || undefined}>
                        {row.search_value?.trim() || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            outcome === 'Success'
                              ? 'rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300'
                              : 'rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300'
                          }
                        >
                          {outcome}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono">{row.credits_used}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'apierrors' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--app-muted)]">
            Failures from customer dashboard searches: <strong className="text-[var(--app-text)]">Vendor (Digitap)</strong>{' '}
            rows include the exact <code className="rounded bg-[var(--app-bg)] px-1">digitap_response</code> JSON when Digitap
            returned HTTP (including 504). <strong className="text-[var(--app-text)]">System</strong> is billing/RPC on our
            side only — not product timeouts.
          </p>
          <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">From (IST)</label>
              <input
                type="date"
                value={apiErrorFrom}
                onChange={(e) => setApiErrorFrom(e.target.value)}
                className="admin-input max-w-[11rem]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">To (IST)</label>
              <input
                type="date"
                value={apiErrorTo}
                onChange={(e) => setApiErrorTo(e.target.value)}
                className="admin-input max-w-[11rem]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">User</label>
              <select
                value={logFilterUserId === '' ? '' : String(logFilterUserId)}
                onChange={(e) => setLogFilterUserId(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)]"
              >
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">Source</label>
              <select
                value={apiErrorSourceFilter}
                onChange={(e) => setApiErrorSourceFilter(e.target.value as '' | 'vendor' | 'system')}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)]"
              >
                <option value="">All</option>
                <option value="vendor">Vendor (Digitap)</option>
                <option value="system">System</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => void loadApiErrors()}
              className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]"
            >
              Apply filters
            </button>
            <p className="text-xs text-[var(--app-muted)]">
              {apiErrorsLoading
                ? 'Loading…'
                : `${formatIstRangeLabel(apiErrorFrom, apiErrorTo)} · ${apiErrors.length} row(s)`}
            </p>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">When (IST)</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Input</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">HTTP</th>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Message</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {apiErrors.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-[var(--app-muted)]">
                      {apiErrorsLoading ? 'Loading API errors…' : 'No API errors in this range.'}
                    </td>
                  </tr>
                ) : (
                  apiErrors.map((row) => {
                    const isVendor = row.error_source === 'vendor';
                    const expanded = expandedApiErrorId === row.id;
                    return (
                      <React.Fragment key={row.id}>
                        <tr className="border-t border-[var(--app-border)] text-[var(--app-text-secondary)]">
                          <td className="whitespace-nowrap px-4 py-2 text-xs">{formatIstDateTime(row.created_at)}</td>
                          <td className="px-4 py-2">{row.email}</td>
                          <td className="px-4 py-2">
                            <div className="font-medium text-[var(--app-text)]">{row.product_name ?? row.product_slug}</div>
                            {row.digitap_path && (
                              <div className="font-mono text-[10px] text-[var(--app-muted)]">{row.digitap_path}</div>
                            )}
                          </td>
                          <td
                            className="max-w-[160px] truncate px-4 py-2 font-mono text-xs"
                            title={row.search_value || undefined}
                          >
                            {row.search_value?.trim() || '—'}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={
                                isVendor
                                  ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200'
                                  : 'rounded-md bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-300'
                              }
                            >
                              {apiErrorSourceLabel(row.error_source)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs">{apiErrorKindLabel(row.error_kind)}</td>
                          <td className="px-4 py-2 font-mono text-xs">{row.http_status ?? '—'}</td>
                          <td className="px-4 py-2 font-mono text-xs">{row.result_code ?? '—'}</td>
                          <td className="max-w-[200px] truncate px-4 py-2 text-xs" title={row.message || undefined}>
                            {row.message?.trim() || '—'}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => setExpandedApiErrorId(expanded ? null : row.id)}
                              className="text-xs font-semibold text-[#0668E1] hover:underline"
                            >
                              {expanded ? 'Hide' : 'View'}
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-t border-[var(--app-border)] bg-[var(--app-bg)]">
                            <td colSpan={10} className="px-4 py-3">
                              {row.detail_json &&
                              typeof row.detail_json === 'object' &&
                              'digitap_response' in row.detail_json ? (
                                <>
                                  <p className="mb-2 text-xs font-semibold uppercase text-[var(--app-muted)]">
                                    Digitap response
                                  </p>
                                  <pre className="mb-3 max-h-64 overflow-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3 font-mono text-[11px] text-[var(--app-text-secondary)]">
                                    {JSON.stringify(
                                      (row.detail_json as { digitap_response: unknown }).digitap_response,
                                      null,
                                      2
                                    )}
                                  </pre>
                                </>
                              ) : null}
                              <p className="mb-2 text-xs font-semibold uppercase text-[var(--app-muted)]">Full detail</p>
                              <pre className="max-h-64 overflow-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3 font-mono text-[11px] text-[var(--app-text-secondary)]">
                                {JSON.stringify(row.detail_json ?? {}, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'billing' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--app-muted)]">
            Call counts are loaded for the selected date range (IST). Optionally filter by user (same control as Search
            logs). Enter a per-success amount for each API; line total = success count × amount.
          </p>
          <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">From (IST)</label>
              <input
                type="date"
                value={billingFrom}
                onChange={(e) => setBillingFrom(e.target.value)}
                className="admin-input max-w-[11rem]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">To (IST)</label>
              <input
                type="date"
                value={billingTo}
                onChange={(e) => setBillingTo(e.target.value)}
                className="admin-input max-w-[11rem]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { label: '7 days', from: istYmdDaysAgo(6), to: istTodayYmd() },
                  { label: '10 days', from: istYmdDaysAgo(9), to: istTodayYmd() },
                  { label: '30 days', from: istYmdDaysAgo(29), to: istTodayYmd() },
                  { label: 'This month', from: istMonthStartYmd(), to: istTodayYmd() },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setBillingFrom(preset.from);
                    setBillingTo(preset.to);
                  }}
                  className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--app-text-secondary)] transition hover:border-[#0668E1]/40 hover:text-[var(--app-text)]"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setBillingFrom('');
                  setBillingTo('');
                }}
                className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--app-text-secondary)] transition hover:border-[#0668E1]/40 hover:text-[var(--app-text)]"
              >
                All time
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">User</label>
              <select
                value={logFilterUserId === '' ? '' : String(logFilterUserId)}
                onChange={(e) => setLogFilterUserId(e.target.value === '' ? '' : Number(e.target.value))}
                className="admin-input min-w-[12rem]"
              >
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => void loadBillingLogs()} className="admin-btn-primary">
              Apply range
            </button>
            <p className="w-full text-xs text-[var(--app-muted)]">
              {billingLogsLoading
                ? 'Loading…'
                : `${formatIstRangeLabel(billingFrom, billingTo)} · ${billingLogs.length} log row(s) loaded`}
            </p>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">API</th>
                  <th className="px-4 py-3 font-semibold">Total calls</th>
                  <th className="px-4 py-3 font-semibold">Success</th>
                  <th className="px-4 py-3 font-semibold">Error</th>
                  <th className="px-4 py-3 font-semibold">Amount per success (₹)</th>
                  <th className="px-4 py-3 font-semibold">Line total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {billingRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[var(--app-muted)]">
                      {billingLogsLoading
                        ? 'Loading billing data…'
                        : 'No API calls in this range. Adjust dates and click Apply range.'}
                    </td>
                  </tr>
                ) : (
                  billingRows.map((row) => {
                    const rate = Number(billingRates[row.slug] ?? '');
                    const lineTotal = Number.isFinite(rate) && rate >= 0 ? row.success * rate : null;
                    return (
                      <tr key={row.slug} className="border-t border-[var(--app-border)]">
                        <td className="px-4 py-2">
                          <div className="font-medium text-[var(--app-text)]">{row.name}</div>
                          <div className="font-mono text-xs text-[var(--app-muted)]">{row.slug}</div>
                        </td>
                        <td className="px-4 py-2 font-mono">{row.total}</td>
                        <td className="px-4 py-2 font-mono text-emerald-600 dark:text-emerald-300">{row.success}</td>
                        <td className="px-4 py-2 font-mono text-red-600 dark:text-red-300">{row.error}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={billingRates[row.slug] ?? ''}
                            onChange={(e) =>
                              setBillingRates((m) => ({ ...m, [row.slug]: e.target.value }))
                            }
                            className="w-28 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1 text-[var(--app-text)]"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-2 font-mono font-semibold text-[var(--app-text)]">
                          {lineTotal != null ? lineTotal.toFixed(2) : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {billingRows.length > 0 && (
                <tfoot className="border-t border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-semibold text-[var(--app-text)]">
                      Grand total
                    </td>
                    <td className="px-4 py-3 font-mono text-lg font-bold text-[#00b4d8]">
                      ₹{billingTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
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
                  <td className="px-4 py-2 text-xs">{formatIstDateTime(row.created_at)}</td>
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
              Only APIs with <strong className="text-[var(--app-text)]">Enabled</strong> can be called for that user. Empty credit
              override uses the catalog default burn.
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
          {entRows.length ? (
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
          <AdminCard
            title="Digitap probe (admin)"
            description="Same request shaping as customer search routes, but no credits are debited and nothing is written to search_logs. Use for connectivity checks only."
          >
            {isUiPreviewToken(token) ? (
              <p className="text-sm text-[var(--app-muted)]">Disabled in local UI preview mode.</p>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,20rem)_1fr] xl:items-start">
                <div className="min-w-0 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-[var(--app-muted)]">Product</label>
                    <select
                      value={testSlug}
                      onChange={(e) => setTestSlug(e.target.value)}
                      className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-[var(--app-text)]"
                    >
                      {catalogPicklist.length === 0 ? (
                        <option value="">Select a product…</option>
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
                    className="admin-btn-primary w-full"
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
                    <div className="max-h-[min(70vh,720px)] w-full min-w-0 overflow-y-auto overflow-x-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-4 sm:p-5">
                      <AdminDigitapTestView data={testResult as Record<string, unknown>} />
                    </div>
                  ) : (
                    <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)]/40 p-8 text-center text-sm text-[var(--app-muted)]">
                      {testResult != null ? (
                        <pre className="max-h-[480px] w-full overflow-auto text-left font-mono text-xs text-[var(--app-text-secondary)]">
                          {JSON.stringify(testResult, null, 2)}
                        </pre>
                      ) : (
                        'Run a test to see structured results here.'
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </AdminCard>
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
          {!auditLoading && (
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-muted)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">When (IST)</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                  <th className="px-3 py-2 font-semibold">User</th>
                  <th className="px-3 py-2 font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--app-border)] align-top text-[var(--app-text-secondary)]">
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{formatIstDateTime(row.created_at)}</td>
                    <td className="px-3 py-2 text-[var(--app-text)]">
                      {formatAuditAction(row.action, row.payload ?? {})}
                    </td>
                    <td className="px-3 py-2">
                      {row.entity_type === 'user'
                        ? row.entity_email || (row.entity_id ? `User #${row.entity_id}` : '—')
                        : row.entity_type === 'plan'
                          ? `Plan #${row.entity_id ?? '—'}`
                          : `${row.entity_type} ${row.entity_id ?? ''}`.trim()}
                    </td>
                    <td className="max-w-lg px-3 py-2 text-xs leading-relaxed text-[var(--app-muted)]">
                      {formatAuditDetail(row.action, row.payload ?? {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </AdminLayout>
    </>
  );
}
