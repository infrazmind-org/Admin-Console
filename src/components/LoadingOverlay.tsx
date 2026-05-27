import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingOverlay({ visible, label = 'Loading' }: { visible: boolean; label?: string }) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-8 py-7 shadow-2xl">
        <Loader2 className="h-10 w-10 animate-spin text-[#00b4d8]" aria-hidden />
        <p className="text-sm font-semibold text-[var(--app-text)]">{label}</p>
      </div>
    </div>
  );
}
