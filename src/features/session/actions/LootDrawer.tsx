import { useState } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { PartyPicker } from '../../../components/fields/PartyPicker';
import type { ResolvedMember } from '../../../components/fields/PartyPicker';
import { useNoteActions } from '../../notes/useNoteActions';
import { useToast } from '../../../context/ToastContext';
import { cn } from '../../../lib/utils';

/**
 * Props for the {@link LootDrawer} component.
 */
export interface LootDrawerProps {
  /** Whether the drawer is currently open. */
  open: boolean;
  /** Called when the drawer should be closed. */
  onClose: () => void;
  /** All available party members for the {@link PartyPicker}. */
  members: ResolvedMember[];
  /** IDs of the currently selected party members. */
  selectedMembers: string[];
  /** Called when the member selection changes. */
  onSelectMembers: (ids: string[]) => void;
  /** Called after the loot item has been logged as a note. */
  onLogged: () => void;
}

/**
 * Drawer for quickly logging a loot item found by party members.
 *
 * @remarks
 * The GM selects which party members found the item, types the item name, and
 * taps "Log Loot". A `loot` note is created with a title in the format:
 * `"<members>: Loot: <item name>"` and `typeData.holder` set to the member display name.
 *
 * The Log Loot button is disabled until a non-empty item name is entered.
 * Closing or logging resets the item name field.
 *
 * @param props - {@link LootDrawerProps}
 *
 * @example
 * ```tsx
 * <LootDrawer
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   members={resolvedMembers}
 *   selectedMembers={selectedIds}
 *   onSelectMembers={setSelectedIds}
 *   onLogged={refreshNotes}
 * />
 * ```
 */
export function LootDrawer({ open, onClose, members, selectedMembers, onSelectMembers, onLogged }: LootDrawerProps) {
  const { createNote } = useNoteActions();
  const { showToast } = useToast();
  const [lootName, setLootName] = useState('');

  /** Returns the display label for the current member selection. */
  const selectedNames = () => {
    if (selectedMembers.length === 0) return 'Unknown';
    if (selectedMembers.length === members.length && members.length > 1) return 'Party';
    return selectedMembers.map(id => members.find(m => m.id === id)?.name ?? 'Unknown').join(', ');
  };

  /** Resets the loot name field and closes the drawer. */
  const handleClose = () => {
    setLootName('');
    onClose();
  };

  /**
   * Creates a `loot` note for the entered item name, shows a confirmation toast,
   * resets the field, and calls `onLogged`. No-op when the field is empty.
   */
  const handleLog = async () => {
    if (!lootName.trim()) return;
    const fullTitle = `${selectedNames()}: Loot: ${lootName.trim()}`;
    await createNote({
      title: fullTitle,
      type: 'loot',
      body: null,
      pinned: false,
      status: 'active',
      typeData: { holder: selectedNames() },
    });
    showToast(`Logged: ${fullTitle}`);
    setLootName('');
    handleClose();
    onLogged();
  };

  return (
    <Drawer open={open} onClose={handleClose} title="Loot Found">
      <PartyPicker members={members} selected={selectedMembers} onSelect={onSelectMembers} />
      <input
        type="text"
        placeholder="What did you find?"
        value={lootName}
        onChange={e => setLootName(e.target.value)}
        autoFocus
        className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-3 box-border"
      />
      <button
        onClick={handleLog}
        disabled={!lootName.trim()}
        className={cn(
          'w-full min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer',
          !lootName.trim() ? 'opacity-60' : 'opacity-100'
        )}
      >
        Log Loot
      </button>
    </Drawer>
  );
}
