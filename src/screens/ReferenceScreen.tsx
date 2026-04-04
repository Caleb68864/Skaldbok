import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cn } from '../lib/utils';
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
import { referenceSections, referencePages } from '../data/dragonbaneReference';

/** Map each section ID to its parent page title */
const sectionToPage: Record<string, string> = {};
referencePages.forEach(page => {
  page.sections.forEach(sectionId => {
    sectionToPage[sectionId] = page.title;
  });
});

/** Map section ID to human-readable title */
const sectionTitleMap: Record<string, string> = {};
referenceSections.forEach(s => {
  sectionTitleMap[s.id] = s.title;
});

type ActiveTab = 'reference' | 'notes';

const inputClasses = "w-full p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)] box-border";

export default function ReferenceScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('reference');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePage, setActivePage] = useState<string>(referencePages[0].title);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [activeSubPill, setActiveSubPill] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

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

  // IntersectionObserver for active pill tracking
  useEffect(() => {
    if (activeTab !== 'reference') {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const timeoutId = setTimeout(() => {
      const allSectionIds = referencePages.flatMap(p => p.sections);
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const pageTitle = sectionToPage[entry.target.id];
              if (pageTitle) {
                setActivePage(pageTitle);
                setActiveSubPill(entry.target.id);
              }
            }
          }
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
      );

      allSectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });

      observerRef.current = observer;
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [activeTab, searchQuery]);

  function handleTopPillClick(pageTitle: string) {
    if (expandedCategory === pageTitle) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(pageTitle);
      setActivePage(pageTitle);
      const page = referencePages.find(p => p.title === pageTitle);
      if (page && page.sections.length > 0) {
        document.getElementById(page.sections[0])?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function handleSubPillClick(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    setActiveSubPill(sectionId);
  }

  const expandedPage = referencePages.find(p => p.title === expandedCategory) ?? null;

  return (
    <div className="p-[var(--space-md)]">
      {/* Tab switcher */}
      <div className="flex gap-3 mb-[var(--space-md)]">
        <button
          className={cn(
            "px-[var(--space-md)] py-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer min-h-[var(--touch-target-min)] text-[length:var(--font-size-sm)]",
            activeTab === 'reference'
              ? "font-bold bg-[var(--color-primary)] text-[var(--color-primary-text)]"
              : "font-normal bg-[var(--color-surface-alt)] text-[var(--color-text)]"
          )}
          onClick={() => setActiveTab('reference')}
        >
          📖 Game Reference
        </button>
        <button
          className={cn(
            "px-[var(--space-md)] py-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer min-h-[var(--touch-target-min)] text-[length:var(--font-size-sm)]",
            activeTab === 'notes'
              ? "font-bold bg-[var(--color-primary)] text-[var(--color-primary-text)]"
              : "font-normal bg-[var(--color-surface-alt)] text-[var(--color-text)]"
          )}
          onClick={() => setActiveTab('notes')}
        >
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
            className={cn(inputClasses, "mb-[var(--space-md)]")}
          />
          {filteredSections.length === 0 && (
            <div className="text-center text-[var(--color-text-muted)] mt-[var(--space-xl)]">
              <p>No sections match your search.</p>
            </div>
          )}
          {filteredSections.map(section => (
            <div key={section.id} id={section.id}>
              <SectionPanel title={section.title} subtitle={section.pg ? `p. ${section.pg}` : undefined} collapsible defaultOpen>
                <ReferenceSectionRenderer section={section} />
              </SectionPanel>
            </div>
          ))}
        </div>
      )}

      {/* Two-tier floating pill bar — only visible on reference tab */}
      {activeTab === 'reference' && (
        <div className="fixed bottom-14 left-0 right-0 z-50 flex flex-col items-center gap-1.5 pb-2 pointer-events-none">
          {expandedPage && (
            <nav className="flex gap-1.5 overflow-x-auto px-3 py-1.5 max-w-full pointer-events-auto" aria-label="Jump to sub-section">
              {expandedPage.sections.map(sectionId => (
                <button
                  key={sectionId}
                  className={cn(
                    'px-3 py-1.5 rounded-full border-none cursor-pointer text-xs font-semibold whitespace-nowrap shrink-0 min-h-[36px] transition-colors',
                    activeSubPill === sectionId
                      ? 'bg-accent text-bg'
                      : 'bg-surface-alt/90 text-text-muted backdrop-blur-sm'
                  )}
                  onClick={() => handleSubPillClick(sectionId)}
                  type="button"
                >
                  {sectionTitleMap[sectionId] ?? sectionId}
                </button>
              ))}
            </nav>
          )}
          <nav className="flex gap-2 overflow-x-auto px-3 py-1.5 pointer-events-auto" aria-label="Jump to section">
            {referencePages.map(page => (
              <button
                key={page.title}
                className={cn(
                  'px-4 py-2 rounded-full border border-border cursor-pointer text-sm font-semibold whitespace-nowrap shrink-0 min-h-[44px] transition-colors shadow-md',
                  activePage === page.title
                    ? 'bg-accent text-bg border-accent'
                    : 'bg-surface/95 text-text backdrop-blur-sm',
                  expandedCategory === page.title && 'ring-2 ring-accent'
                )}
                onClick={() => handleTopPillClick(page.title)}
                type="button"
              >
                {page.title}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* My Notes Tab */}
      {activeTab === 'notes' && (
        <div>
          <div className="flex justify-between items-center mb-[var(--space-md)]">
            <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)]">Reference Notes</h1>
            <Button variant="primary" onClick={openNew}>+ Add Note</Button>
          </div>

          {notes.length === 0 && (
            <div className="text-center text-[var(--color-text-muted)] mt-[var(--space-xl)]">
              <p>No reference notes yet. Add your own shorthand notes for quick reference during play.</p>
            </div>
          )}

          <div className="flex flex-col gap-[var(--space-md)]">
            {notes.map(note => (
              <Card key={note.id} onClick={() => openEdit(note)} className="cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-[length:var(--font-size-md)] text-[var(--color-text)] mb-[var(--space-xs)]">{note.title || '(Untitled)'}</h2>
                    <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] whitespace-pre-wrap max-h-20 overflow-hidden">
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
        <div className="flex flex-col gap-[var(--space-md)]">
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              className={cn(inputClasses, "resize-y font-[family-name:inherit]")}
            />
          </div>
          <div className="flex gap-3 justify-end">
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
        <p className="text-[var(--color-text)]">Delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.</p>
      </Modal>

      <Modal open={error !== null} onClose={() => setError(null)} title="Error">
        <p className="text-[var(--color-danger)]">{error}</p>
      </Modal>
    </div>
  );
}
