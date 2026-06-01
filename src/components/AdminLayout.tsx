import React from 'react';
import {
  Activity,
  ClipboardList,
  CreditCard,
  FlaskConical,
  KeyRound,
  LayoutGrid,
  Receipt,
  Shield,
  Users,
} from 'lucide-react';

export type AdminTabId =
  | 'users'
  | 'logs'
  | 'billing'
  | 'transactions'
  | 'plans'
  | 'apiaccess'
  | 'apitest'
  | 'audit';

const TAB_META: Record<AdminTabId, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  users: { label: 'Users', icon: Users },
  logs: { label: 'Search logs', icon: Activity },
  billing: { label: 'Billing', icon: Receipt },
  transactions: { label: 'Purchases', icon: CreditCard },
  plans: { label: 'Plans', icon: LayoutGrid },
  apiaccess: { label: 'User APIs', icon: KeyRound },
  apitest: { label: 'API test', icon: FlaskConical },
  audit: { label: 'Audit log', icon: ClipboardList },
};

export default function AdminLayout({
  activeTab,
  onTabChange,
  pendingCount,
  onRefresh,
  children,
}: {
  activeTab: AdminTabId;
  onTabChange: (tab: AdminTabId) => void;
  pendingCount: number;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  const tabs = Object.keys(TAB_META) as AdminTabId[];

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full min-w-0">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-nav)] lg:flex">
        <div className="border-b border-[var(--app-border)] px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0668E1]/15 text-[#0668E1] ring-1 ring-[#0668E1]/25">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-[var(--app-text)]">Admin</p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--app-muted)]">Operations</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {tabs.map((id) => {
            const meta = TAB_META[id];
            const Icon = meta.icon;
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  active
                    ? 'bg-[#0668E1] text-white shadow-md shadow-[#0668E1]/25'
                    : 'text-[var(--app-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" />
                <span className="flex-1 truncate">{meta.label}</span>
                {id === 'users' && pendingCount > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                    }`}
                  >
                    {pendingCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-14 z-40 border-b border-[var(--app-border)] bg-[var(--app-nav)]/95 backdrop-blur-md lg:hidden">
          <div className="flex gap-1 overflow-x-auto px-3 py-2">
            {tabs.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                  activeTab === id ? 'bg-[#0668E1] text-white' : 'text-[var(--app-muted)]'
                }`}
              >
                {TAB_META[id].label}
                {id === 'users' && pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
            ))}
          </div>
        </div>

        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--app-text)] sm:text-3xl">
                  {TAB_META[activeTab].label}
                </h1>
                <p className="mt-1 text-sm text-[var(--app-muted)]">
                  Manage approvals, credits, API access, and operational visibility.
                </p>
              </div>
              <button
                type="button"
                onClick={onRefresh}
                className="shrink-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--app-text)] shadow-sm transition hover:border-[#0668E1]/40 hover:bg-[var(--app-surface-muted)]"
              >
                Refresh data
              </button>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
