import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { useToast } from '../../context/ToastContext';

/** Line height (px) matched to the ruled-background stripe pitch. */
const LINE_HEIGHT_PX = 32;

/** Props for the {@link WritePad} component. */
export interface WritePadProps {
  /** Current textarea value (controlled). */
  value: string;
  /** Called on every keystroke with the updated text. */
  onChange: (value: string) => void;
  /**
   * Called when the user commits the text (commit button or Ctrl/Cmd+Enter).
   * May throw or return a rejected promise — in that case the text is
   * retained in the textarea and a toast is shown instead of closing.
   */
  onCommit: (value: string) => void | Promise<void>;
  /** Whether the full-screen writing surface is open. */
  open: boolean;
  /** Called to dismiss the writing surface (e.g. Escape / close button). */
  onClose: () => void;
  /** Optional placeholder text for the textarea. */
  placeholder?: string;
  /** Label for the commit button. Defaults to `Commit`. */
  commitLabel?: string;
  /**
   * `fullscreen` (default) covers the viewport — right for expanding a single
   * long-text field, e.g. ship notes.
   *
   * `docked` renders in normal flow so a host screen can keep content visible
   * above it. The session log needs this: a full-screen pad would bury the
   * entry list, hiding the entries the user edits, selects and promotes.
   */
  variant?: 'fullscreen' | 'docked';
  /** Height of the writing area when docked. Ignored when fullscreen. */
  dockedHeight?: string;
}

/**
 * Full-screen ruled writing surface that any text field can expand into.
 *
 * @remarks
 * Uses a plain textarea element rather than an editable div, because
 * Chromium's stylus handwriting recognition only targets editable text
 * fields, not arbitrary editable elements.
 */
export function WritePad({
  value,
  onChange,
  onCommit,
  open,
  onClose,
  placeholder,
  commitLabel = 'Commit',
  variant = 'fullscreen',
  dockedHeight = '14rem',
}: WritePadProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [committing, setCommitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      textareaRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const commit = async () => {
    if (!value.trim()) return;
    // Guard at entry, not just on the button. `committing` disables the button
    // but Ctrl/Cmd+Enter bypasses it entirely, and a stylus can double-fire —
    // two invocations then close over the same `value` and the same edit
    // target, producing either a duplicate entry or two racing writes to one row.
    if (committing) return;
    const textarea = textareaRef.current;
    setCommitting(true);
    try {
      await onCommit(value);
      // Keep focus in the textarea after a successful commit; do not close
      // the S Pen / on-screen keyboard panel.
      textarea?.focus();
    } catch (err) {
      // Retain the text on rejection/throw rather than clearing it.
      showToast(err instanceof Error ? err.message : 'Failed to save note', 'error');
      textarea?.focus();
    } finally {
      setCommitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void commit();
    }
    // A bare Enter falls through and inserts a newline as usual.
  };

  const docked = variant === 'docked';

  return (
    <div
      className={cn(
        'flex flex-col bg-[var(--color-surface,white)]',
        docked
          ? 'w-full shrink-0 border-t border-[var(--color-border,#ddd)]'
          : 'fixed inset-0 z-50',
      )}
      style={docked ? { height: dockedHeight } : undefined}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border,#ddd)] px-4 py-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-3 py-1.5 text-sm text-[var(--color-text-muted,#666)] hover:bg-black/5"
        >
          {docked ? 'Hide' : 'Close'}
        </button>
        <button
          type="button"
          onClick={() => void commit()}
          disabled={committing || !value.trim()}
          className="rounded bg-[var(--color-primary,#2563eb)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {commitLabel}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'flex-1 w-full resize-none border-0 bg-transparent px-4 py-4 font-mono text-base outline-none',
        )}
        style={{
          lineHeight: `${LINE_HEIGHT_PX}px`,
          backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${
            LINE_HEIGHT_PX - 1
          }px, var(--color-border, #ddd) ${LINE_HEIGHT_PX - 1}px, var(--color-border, #ddd) ${LINE_HEIGHT_PX}px)`,
          backgroundAttachment: 'local',
        }}
      />
    </div>
  );
}
