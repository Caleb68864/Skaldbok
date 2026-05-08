import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import * as referenceNoteRepository from '../storage/repositories/referenceNoteRepository';
import * as referenceSectionRepository from '../storage/repositories/referenceSectionRepository';
import type { ReferenceNote } from '../storage/db/client';
import type { ReferenceGroup, ReferenceImportBundle, ReferenceSection, ReferenceSectionType } from '../types/reference';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { Card } from '../components/primitives/Card';
import { Button } from '../components/primitives/Button';
import { Drawer } from '../components/primitives/Drawer';
import { Modal } from '../components/primitives/Modal';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { ReferenceSectionRenderer } from '../components/fields/ReferenceSectionRenderer';

type ActiveTab = 'reference' | 'notes';

const inputClasses = "w-full p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)] box-border";

function emptySection(): ReferenceSection {
  const now = nowISO();
  return {
    id: generateId(),
    title: '',
    category: 'General',
    order: 0,
    type: 'rules_text',
    paragraphs: [''],
    createdAt: now,
    updatedAt: now,
  };
}

function emptyGroup(order: number): ReferenceGroup {
  const now = nowISO();
  return {
    id: generateId(),
    title: 'New Card',
    order,
    createdAt: now,
    updatedAt: now,
  };
}

function sectionToEditorBody(section: ReferenceSection): string {
  if (section.type === 'table') {
    return JSON.stringify({ columns: section.columns ?? [], rows: section.rows ?? [] }, null, 2);
  }
  if (section.type === 'key_value_list') {
    return JSON.stringify(section.items ?? [], null, 2);
  }
  return (section.paragraphs ?? []).join('\n\n');
}

function parseEditorBody(section: ReferenceSection, body: string): ReferenceSection {
  if (section.type === 'table') {
    const parsed = JSON.parse(body || '{"columns":[],"rows":[]}') as Pick<ReferenceSection, 'columns' | 'rows'>;
    return { ...section, columns: parsed.columns ?? [], rows: parsed.rows ?? [], items: undefined, paragraphs: undefined };
  }
  if (section.type === 'key_value_list') {
    const parsed = JSON.parse(body || '[]') as ReferenceSection['items'];
    return { ...section, items: parsed ?? [], columns: undefined, rows: undefined, paragraphs: undefined };
  }
  return {
    ...section,
    paragraphs: body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean),
    columns: undefined,
    rows: undefined,
    items: undefined,
  };
}

export default function ReferenceScreen() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('reference');
  const [searchQuery, setSearchQuery] = useState('');

  const [sections, setSections] = useState<ReferenceSection[]>([]);
  const [groups, setGroups] = useState<ReferenceGroup[]>([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [sectionDrawerOpen, setSectionDrawerOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<ReferenceSection | null>(null);
  const [sectionBody, setSectionBody] = useState('');
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<ReferenceSection | null>(null);
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ReferenceGroup | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<ReferenceGroup | null>(null);

  const [notes, setNotes] = useState<ReferenceNote[]>([]);
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ReferenceNote | null>(null);
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<ReferenceNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadSections = useCallback(async () => {
    const loadedSections = await referenceSectionRepository.getAll();
    const loadedGroups = await referenceSectionRepository.ensureGroupsForSections(loadedSections);
    setSections(loadedSections);
    setGroups(loadedGroups);
  }, []);

  const loadNotes = useCallback(async () => {
    setNotes(await referenceNoteRepository.getAll());
  }, []);

  useEffect(() => { loadSections().catch(console.error); }, [loadSections]);
  useEffect(() => { loadNotes().catch(console.error); }, [loadNotes]);

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(section => {
      const haystack = [
        section.title,
        section.category,
        section.pg ?? '',
        ...(section.paragraphs ?? []),
        ...(section.items ?? []).flatMap(item => [item.label, item.description]),
        ...(section.rows ?? []).flatMap(row => Object.values(row)),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [searchQuery, sections]);

  const visibleGroups = useMemo(() => {
    const knownTitles = new Set(groups.map(group => group.title));
    const orphanGroups = Array.from(new Set(sections.map(section => section.category || 'General')))
      .filter(title => !knownTitles.has(title))
      .map((title, index): ReferenceGroup => ({
        id: `orphan-${title}`,
        title,
        order: groups.length + index,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }));
    return [...groups, ...orphanGroups].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }, [groups, sections]);

  function openNewSection() {
    const section = emptySection();
    const targetGroup = visibleGroups[0];
    section.category = targetGroup?.title ?? 'General';
    section.order = sections.filter(s => s.category === section.category).length;
    setEditingSection(section);
    setSectionBody(sectionToEditorBody(section));
    setSectionDrawerOpen(true);
  }

  function openNewGroup() {
    setEditingGroup(emptyGroup(groups.length));
    setGroupDrawerOpen(true);
  }

  function openEditGroup(group: ReferenceGroup) {
    setEditingGroup(group);
    setGroupDrawerOpen(true);
  }

  async function handleGroupSave() {
    if (!editingGroup) return;
    const previous = groups.find(group => group.id === editingGroup.id);
    const next = { ...editingGroup, title: editingGroup.title.trim() || 'Untitled Card', updatedAt: nowISO() };
    try {
      if (previous && previous.title !== next.title) {
        const updatedSections = sections.map(section =>
          section.category === previous.title ? { ...section, category: next.title, updatedAt: nowISO() } : section
        );
        await referenceSectionRepository.saveLayout(
          groups.map(group => group.id === next.id ? next : group),
          updatedSections,
        );
      } else {
        await referenceSectionRepository.saveGroup(next);
      }
      setGroupDrawerOpen(false);
      setEditingGroup(null);
      await loadSections();
    } catch (e) {
      setError(`Could not save reference card. ${String(e)}`);
    }
  }

  async function handleGroupDeleteConfirm() {
    if (!deleteGroupTarget) return;
    if (sections.some(section => section.category === deleteGroupTarget.title)) {
      setError('Move or delete the sections in this card before deleting it.');
      setDeleteGroupTarget(null);
      return;
    }
    await referenceSectionRepository.removeGroup(deleteGroupTarget.id);
    setDeleteGroupTarget(null);
    await loadSections();
  }

  function openEditSection(section: ReferenceSection) {
    setEditingSection(section);
    setSectionBody(sectionToEditorBody(section));
    setSectionDrawerOpen(true);
  }

  async function handleSectionSave() {
    if (!editingSection) return;
    try {
      const now = nowISO();
      const parsed = parseEditorBody({ ...editingSection, updatedAt: now }, sectionBody);
      await referenceSectionRepository.save(parsed);
      setSectionDrawerOpen(false);
      setEditingSection(null);
      await loadSections();
    } catch (e) {
      setError(`Could not save reference section. ${String(e)}`);
    }
  }

  async function handleSectionDeleteConfirm() {
    if (!deleteSectionTarget) return;
    await referenceSectionRepository.remove(deleteSectionTarget.id);
    setDeleteSectionTarget(null);
    await loadSections();
  }

  async function persistLayout(nextGroups: ReferenceGroup[], nextSections: ReferenceSection[]) {
    setGroups(nextGroups.map((group, index) => ({ ...group, order: index })));
    setSections(nextSections);
    await referenceSectionRepository.saveLayout(nextGroups, nextSections);
  }

  async function moveGroup(activeGroupId: string, targetGroupId: string) {
    if (activeGroupId === targetGroupId) return;
    const current = [...groups].sort((a, b) => a.order - b.order);
    const from = current.findIndex(group => group.id === activeGroupId);
    const to = current.findIndex(group => group.id === targetGroupId);
    if (from < 0 || to < 0) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await persistLayout(next, sections);
  }

  async function moveSection(sectionId: string, targetCategory: string, targetSectionId?: string) {
    const moving = sections.find(section => section.id === sectionId);
    if (!moving) return;

    const withoutMoving = sections.filter(section => section.id !== sectionId);
    const targetSections = withoutMoving
      .filter(section => section.category === targetCategory)
      .sort((a, b) => a.order - b.order);
    const targetIndex = targetSectionId
      ? Math.max(0, targetSections.findIndex(section => section.id === targetSectionId))
      : targetSections.length;
    const moved = { ...moving, category: targetCategory };
    targetSections.splice(targetIndex < 0 ? targetSections.length : targetIndex, 0, moved);

    const reorderedTarget = targetSections.map((section, index) => ({ ...section, order: index }));
    const otherSections = withoutMoving.filter(section => section.category !== targetCategory);
    const normalizedOthers = visibleGroups.flatMap(group =>
      otherSections
        .filter(section => section.category === group.title)
        .sort((a, b) => a.order - b.order)
        .map((section, index) => ({ ...section, order: index }))
    );
    await persistLayout(groups, [...normalizedOthers, ...reorderedTarget]);
  }

  async function handleImportFile(file: File) {
    try {
      const bundle = JSON.parse(await file.text()) as ReferenceImportBundle;
      const count = await referenceSectionRepository.importBundle(bundle);
      await loadSections();
      setError(`Imported ${count} reference section${count === 1 ? '' : 's'}.`);
    } catch (e) {
      setError(`Could not import reference JSON. ${String(e)}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function openNewNote() {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteDrawerOpen(true);
  }

  function openEditNote(note: ReferenceNote) {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteDrawerOpen(true);
  }

  async function handleNoteSave() {
    const now = nowISO();
    const note: ReferenceNote = editingNote
      ? { ...editingNote, title: noteTitle, content: noteContent, updatedAt: now }
      : { id: generateId(), title: noteTitle, content: noteContent, createdAt: now, updatedAt: now };
    try {
      await referenceNoteRepository.save(note);
      setNoteDrawerOpen(false);
      await loadNotes();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleNoteDeleteConfirm() {
    if (!deleteNoteTarget) return;
    await referenceNoteRepository.remove(deleteNoteTarget.id);
    setDeleteNoteTarget(null);
    await loadNotes();
  }

  return (
    <div className="p-[var(--space-md)]">
      <div className="flex items-center gap-3 mb-[var(--space-md)] flex-wrap">
        <button onClick={() => navigate(-1)} className="min-h-11 min-w-11 flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--color-text)] shrink-0" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <button
          className={cn("px-[var(--space-md)] py-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer min-h-[var(--touch-target-min)] text-[length:var(--font-size-sm)]", activeTab === 'reference' ? "font-bold bg-[var(--color-primary)] text-[var(--color-primary-text)]" : "font-normal bg-[var(--color-surface-alt)] text-[var(--color-text)]")}
          onClick={() => setActiveTab('reference')}
        >
          Game Reference
        </button>
        <button
          className={cn("px-[var(--space-md)] py-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer min-h-[var(--touch-target-min)] text-[length:var(--font-size-sm)]", activeTab === 'notes' ? "font-bold bg-[var(--color-primary)] text-[var(--color-primary-text)]" : "font-normal bg-[var(--color-surface-alt)] text-[var(--color-text)]")}
          onClick={() => setActiveTab('notes')}
        >
          My Notes
        </button>
      </div>

      {activeTab === 'reference' && (
        <div className="flex flex-col gap-[var(--space-md)]">
          <div className="flex gap-3 flex-wrap items-center">
            <input
              placeholder="Search reference..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={cn(inputClasses, "flex-1 min-w-[220px]")}
            />
            <Button variant="secondary" onClick={() => setReorderMode(prev => !prev)}>
              {reorderMode ? 'Done Reordering' : 'Reorder'}
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import JSON</Button>
            <Button variant="secondary" onClick={openNewGroup}>Add Card</Button>
            <Button variant="primary" onClick={openNewSection}>Add Section</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file).catch(console.error);
              }}
            />
          </div>

          {sections.length === 0 && (
            <Card>
              <p className="text-[var(--color-text)]">
                No game reference is bundled with this app. Import your own local JSON or add sections manually.
              </p>
              <p className="mt-2 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                Local archived reference exports live outside git under local-references on this machine.
              </p>
            </Card>
          )}

          {visibleGroups.map(group => {
            const categorySections = filteredSections
              .filter(section => section.category === group.title)
              .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
            if (categorySections.length === 0 && searchQuery.trim()) return null;
            return (
              <Card
                key={group.id}
                className={cn(
                  "flex flex-col gap-[var(--space-sm)]",
                  draggingGroupId === group.id && "opacity-60",
                  reorderMode && "border-dashed"
                )}
                draggable={reorderMode && !group.id.startsWith('orphan-')}
                onDragStart={event => {
                  setDraggingGroupId(group.id);
                  event.dataTransfer.setData('text/reference-group-id', group.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={event => {
                  if (!reorderMode) return;
                  event.preventDefault();
                }}
                onDrop={event => {
                  event.preventDefault();
                  const droppedGroupId = event.dataTransfer.getData('text/reference-group-id');
                  const droppedSectionId = event.dataTransfer.getData('text/reference-section-id');
                  if (droppedGroupId) moveGroup(droppedGroupId, group.id).catch(console.error);
                  if (droppedSectionId) moveSection(droppedSectionId, group.title).catch(console.error);
                  setDraggingGroupId(null);
                  setDraggingSectionId(null);
                }}
                onDragEnd={() => setDraggingGroupId(null)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {reorderMode && !group.id.startsWith('orphan-') && (
                      <span className="text-[var(--color-text-muted)] cursor-grab select-none" aria-hidden="true">|||</span>
                    )}
                    <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] m-0 truncate">{group.title}</h2>
                    <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{categorySections.length}</span>
                  </div>
                  <div className="flex gap-2">
                    {!group.id.startsWith('orphan-') && <Button size="sm" variant="secondary" onClick={() => openEditGroup(group)}>Edit Card</Button>}
                    {!group.id.startsWith('orphan-') && <Button size="sm" variant="danger" onClick={() => setDeleteGroupTarget(group)}>Delete</Button>}
                  </div>
                </div>
                <div
                  className={cn("flex flex-col gap-[var(--space-sm)] min-h-[44px]", reorderMode && "rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] p-2")}
                  onDragOver={event => {
                    if (!reorderMode) return;
                    event.preventDefault();
                  }}
                  onDrop={event => {
                    event.preventDefault();
                    const droppedSectionId = event.dataTransfer.getData('text/reference-section-id');
                    if (droppedSectionId) moveSection(droppedSectionId, group.title).catch(console.error);
                    setDraggingSectionId(null);
                  }}
                >
                  {categorySections.length === 0 && (
                    <p className="text-[var(--color-text-muted)] text-sm m-0">Drop sections here.</p>
                  )}
                  {categorySections.map(section => (
                    <div
                      key={section.id}
                      id={section.id}
                      draggable={reorderMode}
                      className={cn(reorderMode && "cursor-grab", draggingSectionId === section.id && "opacity-60")}
                      onDragStart={event => {
                        setDraggingSectionId(section.id);
                        event.dataTransfer.setData('text/reference-section-id', section.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={event => {
                        if (!reorderMode) return;
                        event.preventDefault();
                      }}
                      onDrop={event => {
                        event.preventDefault();
                        const droppedSectionId = event.dataTransfer.getData('text/reference-section-id');
                        if (droppedSectionId) moveSection(droppedSectionId, group.title, section.id).catch(console.error);
                        setDraggingSectionId(null);
                      }}
                      onDragEnd={() => setDraggingSectionId(null)}
                    >
                      <SectionPanel title={section.title || '(Untitled)'} subtitle={section.pg ? `p. ${section.pg}` : undefined} collapsible defaultOpen>
                        <div className="flex justify-between gap-3 mb-[var(--space-sm)]">
                          {reorderMode ? (
                            <span className="text-xs text-[var(--color-text-muted)]">Drag to reorder or move cards.</span>
                          ) : <span />}
                          <div className="flex gap-3">
                            <Button size="sm" variant="secondary" onClick={() => openEditSection(section)}>Edit</Button>
                            <Button size="sm" variant="danger" onClick={() => setDeleteSectionTarget(section)}>Delete</Button>
                          </div>
                        </div>
                        <ReferenceSectionRenderer section={section} />
                      </SectionPanel>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'notes' && (
        <div>
          <div className="flex justify-between items-center mb-[var(--space-md)]">
            <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)]">Reference Notes</h1>
            <Button variant="primary" onClick={openNewNote}>Add Note</Button>
          </div>
          {notes.length === 0 && (
            <div className="text-center text-[var(--color-text-muted)] mt-[var(--space-xl)]">
              <p>No reference notes yet. Add your own shorthand notes for quick reference during play.</p>
            </div>
          )}
          <div className="flex flex-col gap-[var(--space-md)]">
            {notes.map(note => (
              <Card key={note.id} onClick={() => openEditNote(note)} className="cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-[length:var(--font-size-md)] text-[var(--color-text)] mb-[var(--space-xs)]">{note.title || '(Untitled)'}</h2>
                    <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] whitespace-pre-wrap max-h-20 overflow-hidden">
                      {note.content}
                    </p>
                  </div>
                  <Button size="sm" variant="danger" onClick={e => { e.stopPropagation(); setDeleteNoteTarget(note); }}>Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Drawer open={sectionDrawerOpen} onClose={() => setSectionDrawerOpen(false)} title={editingSection?.id ? 'Reference Section' : 'New Section'}>
        {editingSection && (
          <div className="flex flex-col gap-[var(--space-md)]">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                Title
                <input className={inputClasses} value={editingSection.title} onChange={e => setEditingSection({ ...editingSection, title: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                Category
                <select className={inputClasses} value={editingSection.category} onChange={e => setEditingSection({ ...editingSection, category: e.target.value })}>
                  {visibleGroups.map(group => <option key={group.id} value={group.title}>{group.title}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                Type
                <select className={inputClasses} value={editingSection.type} onChange={e => {
                  const type = e.target.value as ReferenceSectionType;
                  const next = { ...editingSection, type };
                  setEditingSection(next);
                  setSectionBody(sectionToEditorBody(next));
                }}>
                  <option value="rules_text">Text</option>
                  <option value="key_value_list">Key/value list</option>
                  <option value="table">Table</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                Page / Source
                <input className={inputClasses} value={editingSection.pg ?? ''} onChange={e => setEditingSection({ ...editingSection, pg: e.target.value || undefined })} />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
              Content
              <textarea
                className={cn(inputClasses, "resize-y font-mono text-[length:var(--font-size-sm)]")}
                rows={12}
                value={sectionBody}
                onChange={e => setSectionBody(e.target.value)}
              />
            </label>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setSectionDrawerOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSectionSave}>Save</Button>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer open={groupDrawerOpen} onClose={() => setGroupDrawerOpen(false)} title={editingGroup?.id ? 'Reference Card' : 'New Card'}>
        {editingGroup && (
          <div className="flex flex-col gap-[var(--space-md)]">
            <label className="flex flex-col gap-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
              Card Name
              <input className={inputClasses} value={editingGroup.title} onChange={e => setEditingGroup({ ...editingGroup, title: e.target.value })} />
            </label>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setGroupDrawerOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleGroupSave}>Save</Button>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer open={noteDrawerOpen} onClose={() => setNoteDrawerOpen(false)} title={editingNote ? 'Edit Note' : 'New Note'}>
        <div className="flex flex-col gap-[var(--space-md)]">
          <label className="flex flex-col gap-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Title
            <input aria-label="Title" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Content
            <textarea aria-label="Content" value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={8} className={cn(inputClasses, "resize-y font-[family-name:inherit]")} />
          </label>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setNoteDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleNoteSave}>Save</Button>
          </div>
        </div>
      </Drawer>

      <Modal open={deleteSectionTarget !== null} onClose={() => setDeleteSectionTarget(null)} title="Delete Section"
        actions={<>
          <Button variant="secondary" onClick={() => setDeleteSectionTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleSectionDeleteConfirm}>Delete</Button>
        </>}>
        <p className="text-[var(--color-text)]">Delete <strong>{deleteSectionTarget?.title}</strong>? This cannot be undone.</p>
      </Modal>

      <Modal open={deleteGroupTarget !== null} onClose={() => setDeleteGroupTarget(null)} title="Delete Card"
        actions={<>
          <Button variant="secondary" onClick={() => setDeleteGroupTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleGroupDeleteConfirm}>Delete</Button>
        </>}>
        <p className="text-[var(--color-text)]">Delete <strong>{deleteGroupTarget?.title}</strong>? Empty cards only can be deleted.</p>
      </Modal>

      <Modal open={deleteNoteTarget !== null} onClose={() => setDeleteNoteTarget(null)} title="Delete Note"
        actions={<>
          <Button variant="secondary" onClick={() => setDeleteNoteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleNoteDeleteConfirm}>Delete</Button>
        </>}>
        <p className="text-[var(--color-text)]">Delete <strong>{deleteNoteTarget?.title}</strong>? This cannot be undone.</p>
      </Modal>

      <Modal open={error !== null} onClose={() => setError(null)} title="Reference">
        <p className={cn("text-[var(--color-text)]", error?.startsWith('Could') && "text-[var(--color-danger)]")}>{error}</p>
      </Modal>
    </div>
  );
}
