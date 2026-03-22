import { useState } from 'react';

interface DerivedFieldDisplayProps {
  label: string;
  computedValue: number | string;
  override: number | null;
  onOverride: (value: number) => void;
  onReset: () => void;
  editable: boolean;
}

export function DerivedFieldDisplay({ label, computedValue, override, onOverride, onReset, editable }: DerivedFieldDisplayProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const isOverridden = override !== null;
  const effectiveValue = isOverridden ? override : computedValue;

  function handleStartEdit() {
    if (!editable) return;
    setEditValue(String(effectiveValue));
    setEditing(true);
  }

  function handleCommit() {
    const parsed = Number(editValue);
    if (!isNaN(parsed)) {
      onOverride(parsed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCommit();
    if (e.key === 'Escape') setEditing(false);
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-sm)',
      padding: 'var(--space-sm) 0',
    }}>
      <span style={{
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'bold',
        minWidth: '120px',
      }}>
        {label}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        {editing ? (
          <input
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              width: '64px',
              height: '36px',
              textAlign: 'center',
              fontSize: 'var(--font-size-md)',
              border: '1px solid var(--color-primary)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface-alt)',
              color: 'var(--color-text)',
            }}
          />
        ) : (
          <span
            onClick={handleStartEdit}
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 'bold',
              color: isOverridden ? 'var(--color-primary)' : 'var(--color-text)',
              cursor: editable ? 'pointer' : 'default',
              minWidth: '48px',
              textAlign: 'center',
              padding: 'var(--space-xs) var(--space-sm)',
              borderRadius: 'var(--radius-sm)',
              border: editable ? '1px dashed var(--color-border)' : '1px solid transparent',
            }}
          >
            {effectiveValue}
          </span>
        )}

        {isOverridden && (
          <span style={{
            fontSize: 'var(--font-size-xs, 10px)',
            color: 'var(--color-primary)',
            fontStyle: 'italic',
          }}>
            (overridden)
          </span>
        )}

        {isOverridden && editable && (
          <button
            onClick={onReset}
            style={{
              fontSize: 'var(--font-size-xs, 10px)',
              color: 'var(--color-text-muted)',
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              cursor: 'pointer',
              minHeight: '28px',
              minWidth: '44px',
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
