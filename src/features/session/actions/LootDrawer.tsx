import { useState } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { PartyPicker } from '../../../components/fields/PartyPicker';
import type { ResolvedMember } from '../../../components/fields/PartyPicker';
import { useNoteActions } from '../../notes/useNoteActions';
import { useToast } from '../../../context/ToastContext';

export interface LootDrawerProps {
  open: boolean;
  onClose: () => void;
  members: ResolvedMember[];
  selectedMembers: string[];
  onSelectMembers: (ids: string[]) => void;
  onLogged: () => void;
}

export function LootDrawer({ open, onClose, members, selectedMembers, onSelectMembers, onLogged }: LootDrawerProps) {
  const { createNote } = useNoteActions();
  const { showToast } = useToast();
  const [lootName, setLootName] = useState('');

  const selectedNames = () => {
    if (selectedMembers.length === 0) return 'Unknown';
    if (selectedMembers.length === members.length && members.length > 1) return 'Party';
    return selectedMembers.map(id => members.find(m => m.id === id)?.name ?? 'Unknown').join(', ');
  };

  const handleClose = () => {
    setLootName('');
    onClose();
  };

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
        style={{
          width: '100%',
          padding: '10px 12px',
          minHeight: '44px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          fontSize: '16px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />
      <button
        onClick={handleLog}
        disabled={!lootName.trim()}
        style={{
          width: '100%',
          minHeight: '44px',
          background: 'var(--color-accent)',
          color: 'var(--color-on-accent, #fff)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          opacity: !lootName.trim() ? 0.6 : 1,
        }}
      >
        Log Loot
      </button>
    </Drawer>
  );
}
