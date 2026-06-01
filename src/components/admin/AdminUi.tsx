import React from 'react';

export function AdminCard({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass-card overflow-hidden ${className}`}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-3 border-b border-[var(--app-border)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-lg font-bold tracking-tight text-[var(--app-text)]">{title}</h2>
            ) : null}
            {description ? <p className="mt-1 text-sm leading-relaxed text-[var(--app-muted)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      <div className={title || description || actions ? 'p-5' : 'p-5'}>{children}</div>
    </section>
  );
}

export function AdminTableWrap({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-[var(--app-border)] ${className}`}>
      {children}
    </div>
  );
}

export function AdminTable({ children, minWidth = '720px' }: { children: React.ReactNode; minWidth?: string }) {
  return (
    <table className="w-full text-left text-sm" style={{ minWidth }}>
      {children}
    </table>
  );
}

export function AdminThead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-xs uppercase tracking-wide text-[var(--app-muted)]">
      {children}
    </thead>
  );
}

export function AdminTh({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

export function AdminTr({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={`border-t border-[var(--app-border)] text-[var(--app-text-secondary)] transition hover:bg-[var(--app-surface-muted)]/40 ${className}`}>
      {children}
    </tr>
  );
}

export function AdminTd({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  let cls = 'bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/25';
  if (s === 'active' || s === 'success') cls = 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-emerald-500/30';
  if (s === 'pending') cls = 'bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-amber-500/30';
  if (s === 'blocked' || s === 'error' || s === 'failed' || s === 'denied')
    cls = 'bg-red-500/15 text-red-800 dark:text-red-300 ring-red-500/30';
  if (s === 'not found' || s === 'notfound') cls = 'bg-slate-500/15 text-slate-600 dark:text-slate-400 ring-slate-500/25';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${cls}`}>
      {status}
    </span>
  );
}

export function AdminAlert({
  variant = 'info',
  children,
}: {
  variant?: 'info' | 'warn' | 'error' | 'success';
  children: React.ReactNode;
}) {
  const map = {
    info: 'border-[#0668E1]/30 bg-[#0668E1]/8 text-[var(--app-text-secondary)]',
    warn: 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100',
    error: 'border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-300',
    success: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
  };
  return <div className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${map[variant]}`}>{children}</div>;
}

export function AdminEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)]/50 px-6 py-12 text-center text-sm text-[var(--app-muted)]">
      {children}
    </div>
  );
}
