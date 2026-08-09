import { useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useSessionLog } from '../session/useSessionLog';
import { useCampaignContext } from '../campaign/CampaignContext';

/**
 * A note composer docked to the bottom of the Play screen.
 *
 * @remarks
 * Capturing a note mid-session used to mean leaving the Play tab for the
 * session log and then coming back — except "Characters" returns you to the
 * *sheet*, not to Play, so every note cost two navigations and a re-orientation
 * while the table waited.
 *
 * This stays on Play. Collapsed it is a single line; focused it is an input
 * with the play screen still visible behind and above it, which is the whole
 * point — you are usually writing *about* something you can see.
 *
 * Deliberately not a dashboard card: a card scrolls away with the rest of the
 * layout, and the one thing this must never do is require scrolling to find.
 *
 * Renders nothing without an active session — there is nowhere for the note to
 * go, and an input that silently discards is worse than no input.
 */
export function QuickLogBar() {
  const { logToSession } = useSessionLog();
  const { activeSession } = useCampaignContext();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!activeSession) return null;

  async function commit() {
    const title = text.trim();
    if (title === '' || saving) return;
    setSaving(true);
    try {
      // `'log'`, not `'generic'`: `listLogEntriesBySession` filters on
      // `type === 'log'`, so a generic note was saved and then never listed by
      // the session log at all. `'log'` is documented as exactly this — a
      // freeform entry captured during play.
      //
      // Body as well as title, because both surfaces read the body rather than
      // the title: the log renders `docToText(entry.body)`, and the timeline
      // derives a log item's label from it. Without one the entry arrived as a
      // row holding nothing but a timestamp.
      await logToSession(title, 'log', {}, { body: title });
      setText('');
      // Confirm without stealing focus: the next note usually follows straight
      // after, and a toast that moves focus would cost a tap to get back.
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1500);
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-20 -mx-[var(--space-xs)] md:-mx-[var(--space-sm)] mt-[var(--space-sm)] border-t border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-sm)] py-[var(--space-xs)] shadow-[var(--shadow-medium)]">
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); window.setTimeout(() => inputRef.current?.focus(), 0); }}
          className="flex w-full items-center gap-[var(--space-sm)] min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-transparent px-[var(--space-sm)] text-left text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] cursor-pointer"
        >
          <span aria-hidden="true">✎</span>
          <span>Log a note…</span>
          {justSaved && <span className="ml-auto text-[var(--color-success)] font-semibold">Saved</span>}
        </button>
      ) : (
        <div className="flex items-center gap-[var(--space-sm)]">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); void commit(); }
              // Escape closes without discarding silently: the text survives in
              // state, so reopening restores what was half-typed.
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="What happened?"
            aria-label="Log a session note"
            className="flex-1 min-w-0 min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
          />
          <button
            type="button"
            onClick={() => void commit()}
            disabled={text.trim() === '' || saving}
            className={cn(
              'shrink-0 min-h-[var(--touch-target-min)] px-[var(--space-md)] rounded-[var(--radius-sm)] border-none font-semibold',
              text.trim() === '' || saving
                ? 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] opacity-50 cursor-default'
                : 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] cursor-pointer',
            )}
          >
            {saving ? '…' : 'Log'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close the note composer"
            className="shrink-0 min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] rounded border-none bg-transparent text-[var(--color-text-muted)] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
