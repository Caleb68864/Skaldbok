import { Modal } from '../primitives/Modal';
import type { Encounter } from '../../types/encounter';

interface ReopenEncounterPromptProps {
  encounter: Encounter;
  open: boolean;
  onReopen: () => void;
  onSkip: () => void;
}

/**
 * Prompt shown after a session is resumed when a prior encounter can be
 * reopened. ESC / close is equivalent to Skip — the caller should still show
 * a "Session resumed" toast so the user knows the resume landed.
 */
export function ReopenEncounterPrompt({
  encounter,
  open,
  onReopen,
  onSkip,
}: ReopenEncounterPromptProps) {
  const title = encounter.title ?? 'encounter';
  return (
    <Modal
      open={open}
      onClose={onSkip}
      title="Resume encounter?"
      actions={
        <>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-11 px-4 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg text-base cursor-pointer"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onReopen}
            className="min-h-11 px-4 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer"
          >
            Reopen "{title}"
          </button>
        </>
      }
    >
      <p>
        The most recently active encounter was <strong>"{title}"</strong>.
        Reopen it, or skip and resume without any open encounter.
      </p>
    </Modal>
  );
}
