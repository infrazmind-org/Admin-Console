import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[var(--app-bg)]">
      <header className="sticky top-0 z-50 border-b border-[var(--app-border)] bg-[var(--app-nav)] backdrop-blur-md">
        <div className="flex w-full min-w-0 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="font-display text-base font-bold tracking-tight text-[var(--app-text)]">InfraZMind</p>
            {user && (
              <p className="truncate text-xs text-[var(--app-muted)]">
                {user.email}
                <span className="mx-1.5 text-[var(--app-border)]">·</span>
                <span className="font-medium text-[#0668E1]">{user.role}</span>
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
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:border-[#0668E1]/30 hover:bg-[var(--app-surface-muted)]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
