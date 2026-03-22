import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Modal({ open, onClose, title, children, actions }: ModalProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 300,
        }}
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-deep)',
          zIndex: 301,
          width: 'min(90vw, 480px)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-md)',
          borderBottom: '1px solid var(--color-border)',
          minHeight: 'var(--touch-target-min)',
        }}>
          <h2 id="modal-title" style={{ fontSize: 'var(--size-xl)', fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-xl)',
              cursor: 'pointer',
              minWidth: 'var(--touch-target-min)',
              minHeight: 'var(--touch-target-min)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: 'var(--space-md)', flex: 1 }}>
          {children}
        </div>
        {actions && (
          <div style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            padding: 'var(--space-md)',
            borderTop: '1px solid var(--color-border)',
            justifyContent: 'flex-end',
          }}>
            {actions}
          </div>
        )}
      </div>
    </>
  );
}
