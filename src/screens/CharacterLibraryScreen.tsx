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

export default function CharacterLibraryScreen() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<CharacterRecord | null>(null);
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

  async function handleCreate() {
    try {
      await createCharacter();
      await loadCharacters();
      showToast('Character created', 'success');
    } catch (e) {
      showToast(String(e), 'error');
    }
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
    <div style={{ padding: 'var(--space-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)' }}>Character Library</h1>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import Character</Button>
          <Button variant="primary" onClick={handleCreate}>+ New Character</Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      {characters.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 'var(--space-xl)' }}>
          <p style={{ marginBottom: 'var(--space-md)' }}>No characters yet. Create your first character to get started.</p>
          <Button variant="primary" size="lg" onClick={handleCreate}>Create your first character</Button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {characters.map(char => {
          const isActive = activeCharacter?.id === char.id;
          return (
            <Card
              key={char.id}
              style={{
                border: isActive ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text)', marginBottom: 'var(--space-xs)' }}>
                    {char.name || 'Unnamed Character'}
                    {isActive && <span style={{ marginLeft: 'var(--space-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>(Active)</span>}
                  </h2>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    {[char.metadata.kin, char.metadata.profession].filter(Boolean).join(' · ') || 'No details'}
                  </p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-xs)' }}>
                    Updated: {new Date(char.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
        <p style={{ color: 'var(--color-text)' }}>
          Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
      </Modal>

    </div>
  );
}
