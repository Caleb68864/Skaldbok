interface EndSessionModalProps {
  sessionTitle: string;
  hasActiveEncounter?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EndSessionModal({ sessionTitle, hasActiveEncounter, busy = false, onConfirm, onCancel }: EndSessionModalProps) {
  return (
    <div
      role="dialog"
      aria-label="End session confirmation"
      onClick={busy ? undefined : onCancel}
      className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-xl w-full max-w-[360px] px-4 py-6"
      >
        <h3 className="text-[var(--color-text)] mb-2">End this session?</h3>
        <p className="text-[var(--color-text-muted)] mb-3">
          {sessionTitle}
        </p>
        {hasActiveEncounter && (
          <p className="text-amber-700 dark:text-amber-300 text-sm mb-4">
            An active encounter will be ended automatically.
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {busy ? 'Saving…' : 'Confirm'}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 min-h-11 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg text-base cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
