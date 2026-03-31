import { useRef } from 'react';

interface AttachButtonProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function AttachButton({ onFileSelected, disabled }: AttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleButtonClick() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    // Reset so the same file can be re-selected
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          minHeight: '44px',
          padding: '0 12px',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface-raised)',
          color: 'var(--color-text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>📎</span>
        Attach Photo
      </button>
    </>
  );
}
