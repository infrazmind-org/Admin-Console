import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <header className="sticky top-0 z-50 border-b border-[var(--app-border)] bg-[var(--app-nav)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="font-display text-sm font-bold tracking-tight text-[var(--app-text)]">InfraZMind Admin</p>
            {user && (
              <p className="truncate text-xs text-[var(--app-muted)]">
                {user.email} · {user.role}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
