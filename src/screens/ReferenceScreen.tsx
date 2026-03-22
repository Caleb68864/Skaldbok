import { useState, useEffect, useCallback, useMemo } from 'react';
import * as referenceNoteRepository from '../storage/repositories/referenceNoteRepository';
import type { ReferenceNote } from '../storage/db/client';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { Card } from '../components/primitives/Card';
import { Button } from '../components/primitives/Button';
import { Drawer } from '../components/primitives/Drawer';
import { Modal } from '../components/primitives/Modal';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { ReferenceSectionRenderer } from '../components/fields/ReferenceSectionRenderer';
import { referenceSections } from '../data/dragonbaneReference';

type ActiveTab = 'reference' | 'notes';

export default function ReferenceScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('reference');
  const [searchQuery, setSearchQuery] = useState('');

  // Notes state
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

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return referenceSections;
    const q = searchQuery.toLowerCase();
    return referenceSections.filter(section => {
      if (section.title.toLowerCase().includes(q)) return true;
      if (section.rows?.some(row => Object.values(row).some(v => v.toLowerCase().includes(q)))) return true;
      if (section.items?.some(item => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))) return true;
      if (section.paragraphs?.some(p => p.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [searchQuery]);

  const tabBtnStyle = (tab: ActiveTab) => ({
    padding: 'var(--space-sm) var(--space-md)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontWeight: activeTab === tab ? 'bold' : 'normal',
    backgroundColor: activeTab === tab ? 'var(--color-primary)' : 'var(--color-surface-alt)',
    color: activeTab === tab ? 'var(--color-primary-text)' : 'var(--color-text)',
    minHeight: 'var(--touch-target-min)',
    fontSize: 'var(--font-size-sm)',
  } as React.CSSProperties);

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        <button style={tabBtnStyle('reference')} onClick={() => setActiveTab('reference')}>
          📖 Game Reference
        </button>
        <button style={tabBtnStyle('notes')} onClick={() => setActiveTab('notes')}>
          📝 My Notes
        </button>
      </div>

      {/* Game Reference Tab */}
      {activeTab === 'reference' && (
        <div>
          <input
            placeholder="Search reference..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--space-sm)',
              marginBottom: 'var(--space-md)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface-alt)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-md)',
              boxSizing: 'border-box',
            }}
          />
          {filteredSections.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 'var(--space-xl)' }}>
              <p>No sections match your search.</p>
            </div>
          )}
          {filteredSections.map(section => (
            <SectionPanel key={section.id} title={section.title} collapsible defaultOpen>
              <ReferenceSectionRenderer section={section} />
            </SectionPanel>
          ))}
        </div>
      )}

      {/* My Notes Tab */}
      {activeTab === 'notes' && (
        <div>
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
        </div>
      )}

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
