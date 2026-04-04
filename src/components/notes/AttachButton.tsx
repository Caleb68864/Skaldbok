import { useRef } from 'react';
import { cn } from '../../lib/utils';

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
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 min-h-11 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] text-[13px]",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer opacity-100"
        )}
      >
        <span className="text-base leading-none">📎</span>
        Attach Photo
      </button>
    </>
  );
}
