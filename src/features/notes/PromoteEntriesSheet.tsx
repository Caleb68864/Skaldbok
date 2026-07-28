/**
 * Bottom-sheet for promoting a selection of session-log entries (`type: 'log'`
 * notes) into a new typed note, appending them into an existing note, or
 * tagging them in place. Source log entries are never deleted — each gains a
 * `promoted_into` entity link to the target note so lineage is always
 * recoverable.
 */

import { useEffect, useMemo, useState } from 'react';
import { db } from '../../storage/db/client';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { extractText } from '../../utils/prosemirror';
import { formatLocalDateTime } from '../../utils/dates';
import { textToDoc, docToText } from './textToDoc.js';
import { SuggestedLinksPanel } from './SuggestedLinksPanel';
import { useNoteSearch } from './useNoteSearch';
import { scanForLinks, buildLinkScanDictionary, type LinkScanSuggestion } from './linkScanner.js';
import { TagPicker } from '../../components/notes/TagPicker';
import { useCampaignContext } from '../campaign/CampaignContext';
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';
import * as noteRepository from '../../storage/repositories/noteRepository';
import type { Note, NoteType } from '../../types/note';
import { cn } from '../../lib/utils';

/**
 * Selectable note types when promoting to a *new* note. Mirrors
 * `SELECTABLE_NOTE_TYPES` in `QuickNoteAction.tsx` — system-only types
 * (`npc`, `combat`, `skill-check`) are excluded here too.
 */
const SELECTABLE_NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'generic', label: 'Note' },
  { value: 'location', label: 'Location' },
  { value: 'loot', label: 'Loot' },
  { value: 'rumor', label: 'Rumor' },
  { value: 'quote', label: 'Quote' },
  { value: 'recap', label: 'Recap' },
];

type PromoteMode = 'new' | 'existing' | 'tag';

export interface PromoteEntriesSheetProps {
  /** The selected session-log entries (`type: 'log'` notes) to promote. */
  entries: Note[];
  /** Active campaign id, used for note search/dictionary scoping. */
  campaignId: string;
  /** Called when the sheet should be dismissed without further action. */
  onClose: () => void;
  /** Called after a promote/tag action completes successfully. */
  onDone?: () => void;
}

/** Concatenates entry bodies in `createdAt` order, retaining each entry's timestamp. */
function buildConcatenatedText(entries: Note[]): string {
  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return sorted
    .map(entry => `[${formatLocalDateTime(entry.createdAt)}]\n${extractText(entry.body)}`)
    .join('\n\n');
}

/**
 * Concatenates entry bodies in `createdAt` order, WITHOUT the bracketed
 * timestamp prefix. This is scan input only — used to feed {@link scanForLinks}
 * so timestamp fragments (e.g. "PM", "Entry") never surface as link/missing-
 * record candidates. The promoted/appended note body still uses
 * {@link buildConcatenatedText}, which keeps the timestamps.
 */
function buildScanText(entries: Note[]): string {
  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return sorted.map(entry => extractText(entry.body)).join('\n\n');
}

/** First ~60 characters of the earliest selected entry's text, used as a title prefill. */
function buildTitlePrefill(entries: Note[]): string {
  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const earliest = sorted[0];
  if (!earliest) return '';
  const text = extractText(earliest.body).trim().replace(/\s+/g, ' ');
  return text.slice(0, 60);
}

/** Creates a brand-new note from the selection and links every entry to it, all in one transaction. */
async function createNoteAndPromote(
  entries: Note[],
  data: { campaignId: string; sessionId?: string; title: string; type: NoteType; tags?: string[]; bodyText: string },
): Promise<string> {
  const now = nowISO();
  const noteId = generateId();
  const body = textToDoc(data.bodyText);

  await db.transaction('rw', [db.notes, db.entityLinks], async () => {
    await db.notes.add({
      id: noteId,
      campaignId: data.campaignId,
      sessionId: data.sessionId,
      title: data.title,
      body,
      type: data.type,
      typeData: {},
      status: 'active',
      pinned: false,
      tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    } as Note);

    for (const entry of entries) {
      await db.entityLinks.add({
        id: generateId(),
        fromEntityId: entry.id,
        fromEntityType: 'note',
        toEntityId: noteId,
        toEntityType: 'note',
        relationshipType: 'promoted_into',
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  return noteId;
}

/** Appends the selection under a `---` divider on an existing note's body, leaving its title unchanged. */
async function appendEntriesToExistingNote(entries: Note[], targetNoteId: string, appendedText: string): Promise<void> {
  const now = nowISO();

  await db.transaction('rw', [db.notes, db.entityLinks], async () => {
    const existing = await db.notes.get(targetNoteId);
    if (!existing) throw new Error(`PromoteEntriesSheet: target note ${targetNoteId} not found`);

    const existingText = extractText((existing as Note).body);
    const combinedText = existingText ? `${existingText}\n\n---\n\n${appendedText}` : appendedText;

    await db.notes.update(targetNoteId, {
      body: textToDoc(combinedText),
      updatedAt: now,
    });

    for (const entry of entries) {
      await db.entityLinks.add({
        id: generateId(),
        fromEntityId: entry.id,
        fromEntityType: 'note',
        toEntityId: targetNoteId,
        toEntityType: 'note',
        relationshipType: 'promoted_into',
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  });
}

/** Applies tags to every selected entry without promoting (no `promoted_into` link created). */
async function tagEntries(entries: Note[], tags: string[]): Promise<void> {
  const now = nowISO();
  for (const entry of entries) {
    const existingTags = entry.tags ?? [];
    const merged = Array.from(new Set([...existingTags, ...tags]));
    await db.notes.update(entry.id, { tags: merged, updatedAt: now });
  }
}

/**
 * Promote-entries sheet: given a selection of log entries, lets the user
 * promote them into a new typed note, append them onto an existing note, or
 * simply tag them — the source entries are never deleted.
 */
export function PromoteEntriesSheet({ entries, campaignId, onClose, onDone }: PromoteEntriesSheetProps) {
  const [mode, setMode] = useState<PromoteMode>('new');
  const [saving, setSaving] = useState(false);

  // --- New note mode state ---
  const [newTitle, setNewTitle] = useState(() => buildTitlePrefill(entries));
  const [newType, setNewType] = useState<NoteType>('generic');
  const [newTags, setNewTags] = useState<string[]>([]);

  // --- Add-to-existing mode state ---
  const { search, rebuildIndex } = useNoteSearch();
  const [existingQuery, setExistingQuery] = useState('');
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [campaignNotes, setCampaignNotes] = useState<Note[]>([]);

  // --- Tag mode state ---
  const [tagOnlyTags, setTagOnlyTags] = useState<string[]>([]);

  const { activeParty } = useCampaignContext();

  // --- Link scanner dictionary + suggestions, scoped to the selected entries ---
  const [suggestions, setSuggestions] = useState<LinkScanSuggestion[]>([]);
  const previewText = useMemo(() => buildConcatenatedText(entries), [entries]);
  // Separate, timestamp-free text handed to the link scanner only — the
  // promoted/appended body text (previewText/approvedText) is unaffected.
  const scanText = useMemo(() => buildScanText(entries), [entries]);
  // Tracks the running text after any approved suggestions have been applied,
  // so the promoted/appended note body carries the resolved `[[link]]`s
  // rather than the raw pre-scan text.
  const [approvedText, setApprovedText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const notes = await noteRepository.getNotesByCampaign(campaignId);
      if (cancelled) return;
      setCampaignNotes(notes);
      rebuildIndex(notes);

      const templates = await creatureTemplateRepository.listByCampaign(campaignId);
      if (cancelled) return;
      const dictionary = buildLinkScanDictionary({
        partyMembers: (activeParty?.members ?? [])
          .filter(m => m.linkedCharacterId)
          .map(m => ({ characterId: m.linkedCharacterId as string, characterName: m.name ?? '' })),
        creatureTemplates: templates.map(t => ({ id: t.id, name: t.name, category: t.category })),
        notes: notes.map(n => ({ id: n.id, title: n.title })),
      });
      setSuggestions(scanForLinks({ text: scanText, dictionary }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, scanText]);

  const existingResults = existingQuery.trim()
    ? search(existingQuery, { filter: r => r.type !== 'log' })
    : [];

  const handlePromoteNew = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await createNoteAndPromote(entries, {
        campaignId,
        sessionId: entries[0]?.sessionId,
        title: newTitle.trim() || 'Untitled',
        type: newType,
        tags: newTags,
        bodyText: approvedText ?? previewText,
      });
      onDone?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleAddToExisting = async () => {
    if (saving || !selectedExistingId) return;
    setSaving(true);
    try {
      await appendEntriesToExistingNote(entries, selectedExistingId, approvedText ?? previewText);
      onDone?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleTagOnly = async () => {
    if (saving || tagOnlyTags.length === 0) return;
    setSaving(true);
    try {
      await tagEntries(entries, tagOnlyTags);
      onDone?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Promote entries"
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-t-2xl w-full max-w-[560px] px-4 pt-6 pb-8 max-h-[85vh] overflow-y-auto"
      >
        <h3 className="text-[var(--color-text)] mb-3">
          Promote {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </h3>

        <div className="flex gap-2 mb-4">
          {(['new', 'existing', 'tag'] as PromoteMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'min-h-9 px-3 rounded-full border text-xs font-semibold cursor-pointer',
                mode === m
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] border-[var(--color-border)]',
              )}
            >
              {m === 'new' ? 'New note' : m === 'existing' ? 'Add to existing' : 'Tag only'}
            </button>
          ))}
        </div>

        {mode === 'new' && (
          <div className="flex flex-col gap-3 mb-4">
            <input
              type="text"
              placeholder="Note title"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
            />
            <div className="flex flex-wrap gap-1.5">
              {SELECTABLE_NOTE_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNewType(t.value)}
                  className={cn(
                    'min-h-9 px-3 rounded-full border text-xs font-semibold cursor-pointer',
                    newType === t.value
                      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-[var(--color-accent)]'
                      : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] border-[var(--color-border)]',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <TagPicker
              selected={newTags}
              onToggle={tag => setNewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
            />
            <button
              type="button"
              onClick={handlePromoteNew}
              disabled={saving}
              className="min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer disabled:opacity-60"
            >
              Create note
            </button>
          </div>
        )}

        {mode === 'existing' && (
          <div className="flex flex-col gap-3 mb-4">
            <input
              type="text"
              placeholder="Search notes..."
              value={existingQuery}
              onChange={e => setExistingQuery(e.target.value)}
              className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
            />
            <ul className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {(existingQuery.trim() ? existingResults : campaignNotes.filter(n => n.type !== 'log')).map(result => {
                const id = 'id' in result ? (result.id as string) : (result as { id: string }).id;
                const note = campaignNotes.find(n => n.id === id);
                if (!note) return null;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setSelectedExistingId(id)}
                      className={cn(
                        'w-full text-left min-h-11 px-3 py-2 rounded-lg border text-sm cursor-pointer',
                        selectedExistingId === id
                          ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-[var(--color-accent)]'
                          : 'bg-[var(--color-surface-raised)] text-[var(--color-text)] border-[var(--color-border)]',
                      )}
                    >
                      {note.title || '(untitled)'}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={handleAddToExisting}
              disabled={saving || !selectedExistingId}
              className="min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer disabled:opacity-60"
            >
              Append to note
            </button>
          </div>
        )}

        {mode === 'tag' && (
          <div className="flex flex-col gap-3 mb-4">
            <TagPicker
              selected={tagOnlyTags}
              onToggle={tag => setTagOnlyTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
            />
            <button
              type="button"
              onClick={handleTagOnly}
              disabled={saving || tagOnlyTags.length === 0}
              className="min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer disabled:opacity-60"
            >
              Apply tags
            </button>
          </div>
        )}

        <SuggestedLinksPanel
          suggestions={suggestions}
          body={previewText}
          // Scopes dismissals to this campaign. Without it the panel falls back
          // to a shared bucket and dismissing a suggestion in one campaign
          // suppresses it in every other one.
          campaignId={campaignId}
          onApprove={(_, updatedBody) => setApprovedText(docToText(updatedBody))}
        />

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 min-h-11 px-4 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg text-base cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
