import { useState, useEffect, useCallback } from 'react';
import * as referenceNoteRepository from '../storage/repositories/referenceNoteRepository';
import type { ReferenceNote } from '../storage/db/client';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { Card } from '../components/primitives/Card';
import { Button } from '../components/primitives/Button';
import { Drawer } from '../components/primitives/Drawer';
import { Modal } from '../components/primitives/Modal';

export default function ReferenceScreen() {
  const [notes, setNotes] = useState<ReferenceNote[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ReferenceNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReferenceNote | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    const all = await referenceNoteRepository.getAll();
    setNotes(all);
  }, []);

  useEffect(() => { loadNotes().catch(console.error); }, [loadNotes]);

  function openNew() {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setDrawerOpen(true);
  }

  function openEdit(note: ReferenceNote) {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setDrawerOpen(true);
  }

  async function handleSave() {
    const now = nowISO();
    const note: ReferenceNote = editingNote
      ? { ...editingNote, title, content, updatedAt: now }
      : { id: generateId(), title, content, createdAt: now, updatedAt: now };
    try {
      await referenceNoteRepository.save(note);
      setDrawerOpen(false);
      await loadNotes();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await referenceNoteRepository.remove(deleteTarget.id);
    setDeleteTarget(null);
    await loadNotes();
  }

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)' }}>Reference Notes</h1>
        <Button variant="primary" onClick={openNew}>+ Add Note</Button>
      </div>

      {notes.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 'var(--space-xl)' }}>
          <p>No reference notes yet. Add your own shorthand notes for quick reference during play.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {notes.map(note => (
          <Card key={note.id} onClick={() => openEdit(note)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text)', marginBottom: 'var(--space-xs)' }}>{note.title || '(Untitled)'}</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden' }}>
                  {note.content}
                </p>
              </div>
              <Button size="sm" variant="danger" onClick={e => { e.stopPropagation(); setDeleteTarget(note); }}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editingNote ? 'Edit Note' : 'New Note'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ width: '100%', padding: 'var(--space-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: 'var(--font-size-md)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              style={{ width: '100%', padding: 'var(--space-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: 'var(--font-size-md)', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>Save</Button>
          </div>
        </div>
      </Drawer>

      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Delete Note"
        actions={<>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteConfirm}>Delete</Button>
        </>}>
        <p style={{ color: 'var(--color-text)' }}>Delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.</p>
      </Modal>

      <Modal open={error !== null} onClose={() => setError(null)} title="Error">
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
      </Modal>
    </div>
  );
}
