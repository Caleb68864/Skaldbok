/**
 * The one control that marks a note private, and the one badge that says so.
 *
 * @remarks
 * `Note.visibility` has been honoured by the export boundary for a long time —
 * `utils/export/privacyFilter.ts` derives the exclusion set from it and
 * `bundleSerializer` refuses to deliver a bundle a private id survived. Nothing
 * in the app could set it. Every creation path defaulted it to `'public'`
 * (`storage/noteCreationService.buildNoteRecord`) and no screen offered a
 * toggle, so the promise existed and could not be invoked.
 *
 * Both halves live here rather than in each screen, because a note is reachable
 * from the editor, from the Knowledge Base reader and from two list views, and a
 * note that is private in one of them and not another is worse than no control
 * at all. One component, one write, one vocabulary.
 *
 * **Known consequence, not fixed here.** Marking a note private when another
 * note's body `[[wikilinks]]` it makes the JSON export *refuse* — the chip
 * stores the target's id, `privateResidueIn` finds it in the serialized text and
 * `serializeBundle` fails closed — while the Markdown path ships that note's
 * title regardless. Both are pinned in `privacyBacklinks.test.ts`, which also
 * explains why choosing between them is a policy decision rather than a fix.
 */

import { useCallback, useState } from 'react';
import { updateNote } from '../../storage/repositories/noteRepository';
import { useToast } from '../../context/ToastContext';
import type { Note } from '../../types/note';
import { cn } from '../../lib/utils';

/**
 * The single sentence this feature promises, used by the badge and the switch.
 *
 * @remarks
 * Module-local rather than exported: a second screen wanting these words should
 * render one of these two components, not restate the promise beside its own
 * control. It is also what keeps this file exporting components only, which is
 * what the fast-refresh lint rule is about.
 */
const PRIVACY_DESCRIPTION = 'Private notes are left out of exports and backups.';

/** Props for {@link PrivateBadge}. */
export interface PrivateBadgeProps {
  /** Extra classes for the host list's spacing; the colours are fixed. */
  className?: string;
}

/**
 * The "Private" marker shown wherever a note is listed.
 *
 * @remarks
 * Purely presentational, and deliberately styled unlike the neutral type and
 * tag chips beside it: the question it answers — "will this be in the backup I
 * am about to hand someone?" — has to be answerable by scanning a list, not by
 * opening every note in it.
 */
export function PrivateBadge({ className }: PrivateBadgeProps) {
  return (
    <span
      title={PRIVACY_DESCRIPTION}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold',
        'bg-[var(--color-state-danger,#dc2626)]/10 text-[var(--color-state-danger,#dc2626)]',
        className,
      )}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      Private
    </span>
  );
}

/** Props for {@link NotePrivacyToggle}. */
export interface NotePrivacyToggleProps {
  /** The note row's id — the `notes` table key, never a `kb_nodes` id. */
  noteId: string;
  /** Current stored visibility. Absent means the note predates the field. */
  visibility: Note['visibility'];
  /** Called with the new visibility after it has been written. */
  onChange?: (visibility: NonNullable<Note['visibility']>) => void;
  /** Extra classes for the host screen's layout. */
  className?: string;
}

/**
 * Switch that marks a note private or public, writing through immediately.
 *
 * @remarks
 * **The write is not debounced**, unlike the title and body autosave in
 * `NoteEditorScreen`. Those coalesce keystrokes; this is a single deliberate act
 * with a confidentiality consequence, and an 800 ms window in which the screen
 * says "private" and the database does not is exactly the window in which
 * someone taps Export. It goes through `noteRepository.updateNote`, which also
 * refreshes the note's KB node, so the lists that read the graph stay in step.
 *
 * On failure the switch snaps back to the stored value and says so. Leaving it
 * showing "Private" over a row that is still public would be the one failure
 * mode this feature must not have.
 */
export function NotePrivacyToggle({ noteId, visibility, onChange, className }: NotePrivacyToggleProps) {
  const { showToast } = useToast();
  const [isPrivate, setIsPrivate] = useState(visibility === 'private');
  const [saving, setSaving] = useState(false);

  const toggle = useCallback(async () => {
    if (saving) return;
    const next = isPrivate ? 'public' : 'private';
    setIsPrivate(next === 'private');
    setSaving(true);
    try {
      await updateNote(noteId, { visibility: next });
      onChange?.(next);
    } catch (e) {
      // Snap back: a switch that lies about the stored value is worse than one
      // that refused to move.
      setIsPrivate(next !== 'private');
      console.error('NotePrivacyToggle: failed to write visibility', e);
      showToast('Could not change the privacy of this note.', 'error');
    } finally {
      setSaving(false);
    }
  }, [isPrivate, noteId, onChange, saving, showToast]);

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={isPrivate}
        // Not `disabled`: the switch keeps its value and its focus while the
        // write lands, and a second tap arriving inside that window is ignored
        // rather than queued (see `toggle`). `aria-busy` is what makes that
        // window observable — to a screen reader, and to the tests, which would
        // otherwise have to guess when the swallowed tap stops being swallowed.
        aria-busy={saving}
        aria-label="Private"
        onClick={() => { void toggle(); }}
        className={cn(
          'relative shrink-0 w-11 h-6 rounded-full border-none cursor-pointer transition-colors',
          isPrivate
            ? 'bg-[var(--color-state-danger,#dc2626)]'
            : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)]',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
            isPrivate ? 'translate-x-[22px] left-0' : 'left-0.5',
          )}
        />
      </button>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--color-text)]">Private</div>
        <p className="text-xs text-[var(--color-text-muted)] m-0">{PRIVACY_DESCRIPTION}</p>
      </div>
    </div>
  );
}
