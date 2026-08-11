import { useState } from 'react';
import type { StoryBeat } from '../../types/character';
import { useModalBehaviour } from '../../hooks/useModalBehaviour';
import { WritePad } from '../notes/WritePad';
import { Button } from '../primitives/Button';

/** Props for {@link StoryBeatModal}. */
export interface StoryBeatModalProps {
  beat: StoryBeat;
  /** False in play mode: the story is read-only at the table. */
  editable: boolean;
  /** Persists the edited body. Called on save and on closing the writing pad. */
  onSave: (body: string) => void;
  onClose: () => void;
}

const textareaClass =
  'w-full min-h-[180px] p-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

/**
 * The full story behind a Story Bank row.
 *
 * @remarks
 * The row carries a cue and a title, because a list you scan at the table has to
 * stay scannable — an anecdote long enough to be worth keeping would bury every
 * other cue in the panel. So the anecdote lives here, one tap away.
 *
 * Read-only in play mode, like the rest of the build. The writing pad is offered
 * for the same reason the ship notes offer it: this is long-form text somebody
 * may want to write by hand on a tablet.
 */
export function StoryBeatModal({ beat, editable, onSave, onClose }: StoryBeatModalProps) {
  const [draft, setDraft] = useState(beat.body ?? '');
  const [padOpen, setPadOpen] = useState(false);
  const dialogRef = useModalBehaviour<HTMLDivElement>(onClose);

  /** Persists only when the text actually changed, so opening and closing is not an edit. */
  function commit() {
    if (draft !== (beat.body ?? '')) onSave(draft);
    onClose();
  }

  return (
    <div
      onClick={commit}
      className="fixed inset-0 bg-black/50 z-[300] flex items-end sm:items-center justify-center"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={beat.text}
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl w-full max-w-[520px] max-h-[85vh] overflow-y-auto px-4 pt-5 pb-6 flex flex-col gap-[var(--space-sm)]"
      >
        <div>
          {beat.cue && (
            <span className="mr-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-[length:var(--font-size-sm)] font-semibold text-[var(--color-accent)]">
              {beat.cue}
            </span>
          )}
          <h3 className="inline text-[var(--color-text)]">{beat.text}</h3>
        </div>

        {editable ? (
          <>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setPadOpen(true)}>
                Expand
              </Button>
            </div>
            <textarea
              className={textareaClass}
              value={draft}
              aria-label="Story"
              placeholder="The anecdote itself — what happened, who was there, how it ended."
              onChange={e => setDraft(e.target.value)}
            />
          </>
        ) : (
          <p className="whitespace-pre-wrap text-[var(--color-text)]">
            {beat.body?.trim()
              ? beat.body
              : 'Nothing written yet. Switch to Edit Mode to add the story.'}
          </p>
        )}

        <div className="flex justify-end gap-[var(--space-sm)]">
          <Button onClick={commit}>{editable ? 'Save' : 'Close'}</Button>
        </div>
      </div>

      {editable && (
        <WritePad
          open={padOpen}
          value={draft}
          onChange={setDraft}
          onCommit={value => {
            setDraft(value);
            setPadOpen(false);
          }}
          onClose={() => {
            // Closing must not bin what was written: the draft is local until
            // the modal commits, so keep it rather than reverting.
            setPadOpen(false);
          }}
          placeholder="The anecdote itself…"
          commitLabel="Done"
        />
      )}
    </div>
  );
}
