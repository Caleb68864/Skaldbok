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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: 360,
          padding: '24px 16px',
        }}
      >
        <h3 style={{ color: 'var(--color-text)', marginBottom: '8px' }}>End this session?</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
          {sessionTitle}
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              minHeight: '44px',
              background: 'var(--color-accent)',
              color: 'var(--color-on-accent, #fff)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              minHeight: '44px',
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
