import { useState } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { PartyPicker } from '../../../components/fields/PartyPicker';
import type { ResolvedMember } from '../../../components/fields/PartyPicker';
import { useNoteActions } from '../../notes/useNoteActions';
import { useToast } from '../../../context/ToastContext';
import { cn } from '../../../lib/utils';

/**
 * Props for the {@link QuoteDrawer} component.
 */
export interface QuoteDrawerProps {
  /** Whether the drawer is currently open. */
  open: boolean;
  /** Called when the drawer should be closed. */
  onClose: () => void;
  /** All available party members for the {@link PartyPicker}. */
  members: ResolvedMember[];
  /** IDs of the currently selected party members (the speaker). */
  selectedMembers: string[];
  /** Called when the member selection changes. */
  onSelectMembers: (ids: string[]) => void;
  /** Called after the quote has been logged as a note. */
  onLogged: () => void;
}

/**
 * Drawer for capturing a memorable in-character quote spoken at the table.
 *
 * @remarks
 * The GM selects the speaker via the {@link PartyPicker}, types what was said,
 * and taps "Log Quote". A `quote` note is created with a title formatted as:
 * `'<speaker>: "<quote text>"'` and `typeData.speaker` set to the member display name.
 *
 * The Log Quote button is disabled until a non-empty quote is entered.
 * Closing or logging resets the quote text field.
 *
 * @param props - {@link QuoteDrawerProps}
 *
 * @example
 * ```tsx
 * <QuoteDrawer
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   members={resolvedMembers}
 *   selectedMembers={selectedIds}
 *   onSelectMembers={setSelectedIds}
 *   onLogged={refreshNotes}
 * />
 * ```
 */
export function QuoteDrawer({ open, onClose, members, selectedMembers, onSelectMembers, onLogged }: QuoteDrawerProps) {
  const { createNote } = useNoteActions();
  const { showToast } = useToast();
  const [quoteText, setQuoteText] = useState('');

  /** Returns the display label for the current member selection (speaker). */
  const selectedNames = () => {
    if (selectedMembers.length === 0) return 'Unknown';
    if (selectedMembers.length === members.length && members.length > 1) return 'Party';
    return selectedMembers.map(id => members.find(m => m.id === id)?.name ?? 'Unknown').join(', ');
  };

  /** Resets the quote text field and closes the drawer. */
  const handleClose = () => {
    setQuoteText('');
    onClose();
  };

  /**
   * Creates a `quote` note for the entered text, shows a confirmation toast,
   * resets the field, and calls `onLogged`. No-op when the field is empty.
   */
  const handleLog = async () => {
    if (!quoteText.trim()) return;
    const fullTitle = `${selectedNames()}: "${quoteText.trim()}"`;
    await createNote({
      title: fullTitle,
      type: 'quote',
      body: null,
      pinned: false,
      status: 'active',
      typeData: { speaker: selectedNames() },
    });
    showToast(`Logged: ${fullTitle}`);
    setQuoteText('');
    handleClose();
    onLogged();
  };

  return (
    <Drawer open={open} onClose={handleClose} title="Quick Quote">
      <PartyPicker members={members} selected={selectedMembers} onSelect={onSelectMembers} />
      <p className="text-[var(--color-text-muted)] text-[13px] mb-2">
        Who said it? (selected above)
      </p>
      <input
        type="text"
        placeholder="What did they say?"
        value={quoteText}
        onChange={e => setQuoteText(e.target.value)}
        autoFocus
        className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-3 box-border italic"
      />
      <button
        onClick={handleLog}
        disabled={!quoteText.trim()}
        className={cn(
          'w-full min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer',
          !quoteText.trim() ? 'opacity-60' : 'opacity-100'
        )}
      >
        Log Quote
      </button>
    </Drawer>
  );
}
