import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as characterRepository from '../storage/repositories/characterRepository';
import { useCharacterActions } from '../features/characters/useCharacterActions';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { exportCharacter, importCharacter } from '../utils/importExport';
import type { CharacterRecord } from '../types/character';
import { Card } from '../components/primitives/Card';
import { Button } from '../components/primitives/Button';
import { Modal } from '../components/primitives/Modal';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';

export default function CharacterLibraryScreen() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<CharacterRecord | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pendingSetActiveId, setPendingSetActiveId] = useState<string | null>(null);
  const [pendingSetActiveName, setPendingSetActiveName] = useState<string>('');
  const { character: activeCharacter, setCharacter } = useActiveCharacter();
  const { createCharacter, duplicateCharacter, deleteCharacter } = useCharacterActions();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCharacters = useCallback(async () => {
    const all = await characterRepository.getAll();
    setCharacters(all);
  }, []);

  useEffect(() => {
    loadCharacters().catch(console.error);
  }, [loadCharacters]);

  function handleCreate() {
    setNameInput('');
    setShowNamePrompt(true);
  }

  async function handleCreateConfirm() {
    const trimmed = nameInput.trim();
    if (!trimmed) return; // Guard: should not reach here with save disabled, but safety net
    setShowNamePrompt(false);
    const hadActiveCharacter = activeCharacter !== null;
    try {
      const newChar = await createCharacter(trimmed);
      await loadCharacters();
      if (!hadActiveCharacter) {
        // First character: auto-activate (AC3.1)
        await setCharacter(newChar.id);
        showToast('Character created and set as active', 'success');
      } else {
        // Subsequent character: offer Set Active? via inline banner (AC3.2)
        setPendingSetActiveId(newChar.id);
        setPendingSetActiveName(trimmed);
        showToast('Character created', 'success');
      }
    } catch (e) {
      showToast(String(e), 'error');
    }
  }

  async function handlePendingSetActive() {
    if (!pendingSetActiveId) return;
    await setCharacter(pendingSetActiveId);
    setPendingSetActiveId(null);
    setPendingSetActiveName('');
    showToast('Active character updated', 'success');
  }

  function dismissPendingSetActive() {
    setPendingSetActiveId(null);
    setPendingSetActiveName('');
  }

  function handleCreateCancel() {
    setShowNamePrompt(false);
    setNameInput('');
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicateCharacter(id);
      await loadCharacters();
      showToast('Character duplicated', 'success');
    } catch (e) {
      showToast(String(e), 'error');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteCharacter(deleteTarget.id);
      setDeleteTarget(null);
      await loadCharacters();
      showToast('Character deleted', 'success');
    } catch (e) {
      showToast(String(e), 'error');
    }
  }

  async function handleSetActive(id: string) {
    await setCharacter(id);
    navigate('/sheet');
  }

  function handleExport(char: CharacterRecord) {
    exportCharacter(char);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importCharacter(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (result.success) {
      await loadCharacters();
      if (result.warning) {
        showToast(`Imported. Note: ${result.warning}`, 'warning');
      } else {
        showToast('Character imported successfully', 'success');
      }
    } else {
      showToast(result.error ?? 'Import failed.', 'error');
    }
  }

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)]">Character Library</h1>
        <div className="flex gap-3 flex-wrap">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import Character</Button>
          <Button variant="primary" onClick={handleCreate}>+ New Character</Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Set Active? banner — shown when a second+ character is created (AC3.2, AC3.3) */}
      {pendingSetActiveId && (
        <div
          className="flex items-center justify-between gap-[var(--space-sm)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 mb-[var(--space-md)]"
        >
          <span className="text-[var(--color-text)] text-sm">
            {pendingSetActiveName} created — Set Active?
          </span>
          <div className="flex gap-3 shrink-0">
            <Button size="sm" variant="primary" onClick={handlePendingSetActive}>Set Active</Button>
            <Button size="sm" variant="secondary" onClick={dismissPendingSetActive}>Dismiss</Button>
          </div>
        </div>
      )}

      {characters.length === 0 && (
        <div className="text-center text-[var(--color-text-muted)] mt-[var(--space-xl)]">
          <p className="mb-[var(--space-md)]">No characters yet. Create your first character to get started.</p>
          <Button variant="primary" size="lg" onClick={handleCreate}>Create your first character</Button>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {characters.map(char => {
          const isActive = activeCharacter?.id === char.id;
          return (
            <Card
              key={char.id}
              className={cn(
                'p-5',
                isActive
                  ? 'border-2 border-[var(--color-primary)]'
                  : 'border border-[var(--color-border)]'
              )}
            >
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-1">
                    {char.name || 'Unnamed Character'}
                    {isActive && <span className="ml-2 text-[length:var(--font-size-sm)] text-[var(--color-primary)]">(Active)</span>}
                  </h2>
                  <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
                    {[char.metadata.kin, char.metadata.profession].filter(Boolean).join(' · ') || 'No details'}
                  </p>
                  <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mt-1">
                    Updated: {new Date(char.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {!isActive && (
                    <Button size="sm" variant="primary" onClick={() => handleSetActive(char.id)}>Set Active</Button>
                  )}
                  <Button size="sm" onClick={() => handleExport(char)}>Export</Button>
                  <Button size="sm" onClick={() => handleDuplicate(char.id)}>Duplicate</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(char)}>Delete</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={showNamePrompt}
        onClose={handleCreateCancel}
        title="New Character"
        actions={
          <>
            <Button variant="secondary" onClick={handleCreateCancel}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleCreateConfirm}
              disabled={nameInput.trim().length === 0}
            >
              Create
            </Button>
          </>
        }
      >
        <p className="text-[var(--color-text-muted)] mb-3 text-sm">
          Enter a name for your character.
        </p>
        <input
          type="text"
          placeholder="Character name"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim().length > 0) handleCreateConfirm(); }}
          autoFocus
          className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
        />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Character"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>Delete</Button>
          </>
        }
      >
        <p className="text-[var(--color-text)]">
          Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
      </Modal>

    </div>
  );
}
