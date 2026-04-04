interface EndSessionModalProps {
  sessionTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EndSessionModal({ sessionTitle, onConfirm, onCancel }: EndSessionModalProps) {
  return (
    <div
      role="dialog"
      aria-label="End session confirmation"
      onClick={onCancel}
      className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-xl w-full max-w-[360px] px-4 py-6"
      >
        <h3 className="text-[var(--color-text)] mb-2">End this session?</h3>
        <p className="text-[var(--color-text-muted)] mb-6">
          {sessionTitle}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer"
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="flex-1 min-h-11 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg text-base cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
