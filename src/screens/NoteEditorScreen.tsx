import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TiptapNoteEditor } from '../components/notes/TiptapNoteEditor';
import { TagPicker } from '../components/notes/TagPicker';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { getNoteById, updateNote } from '../storage/repositories/noteRepository';
import { useNoteActions } from '../features/notes/useNoteActions';
import { NOTE_TYPES } from '../types/note';
import type { Note, NoteType } from '../types/note';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { useToast } from '../context/ToastContext';
import { useAppState } from '../context/AppStateContext';
import { cn } from '../lib/utils';
import { registerFlush } from '../features/persistence/autosaveFlush';

/**
 * Full-screen note editor — creates or edits a single {@link Note} for the active campaign.
 *
 * @remarks
 * **Route parameters:**
 * - `/note/new` — creates a blank note and immediately redirects to
 *   `/note/:id/edit` (replace navigation) so the browser Back button works
 *   correctly.
 * - `/note/:id/edit` — loads the existing note identified by `:id`.
 *
 * **Autosave behaviour:**
 * - Every field change (title, body, tags, type) schedules a debounced save
 *   with an 800 ms delay via `scheduleAutosave`.
 * - The pending save timer is flushed on component unmount.
 * - A "Saving…" / "Saved" indicator is shown in the header.
 *
 * **Fields:**
 * - **Title** — plain text input at the top of the editor.
 * - **Note type** — pill-button selector for all {@link NOTE_TYPES} except
 *   system-generated types (`'skill-check'`, `'recap'`).
 * - **Body** — rich-text editor powered by {@link TiptapNoteEditor}.
 * - **Tags** — tag picker using campaign-scoped custom tags via
 *   {@link TagPicker}; new tags are persisted to {@link AppSettings.customTags}.
 *
 * **Error handling:**
 * - If the note ID is not found, a toast is shown and the user is navigated
 *   back to `/session`.
 * - If there is no active campaign when creating a new note, the user is
 *   redirected to `/session`.
 *
 * @returns The note editor UI, or a loading indicator while the note is being
 *   fetched or created.
 */
export default function NoteEditorScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isHydrated, activeCampaign, activeSession } = useCampaignContext();
  const { showToast } = useToast();
  const { settings, updateSettings } = useAppState();
  const { createNote } = useNoteActions();
  const campaignId = activeCampaign?.id ?? null;
  const customTags = campaignId ? (settings.customTags?.[campaignId] ?? []) : [];
  const handleCreateTag = (tag: string) => {
    if (!campaignId) return;
    const existing = settings.customTags?.[campaignId] ?? [];
    if (existing.includes(tag)) return;
    updateSettings({ customTags: { ...settings.customTags, [campaignId]: [...existing, tag] } });
  };
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<unknown>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [noteType, setNoteType] = useState<NoteType>('generic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds unsaved field updates between keystrokes. Debounce timer AND the
  // flush-bus-registered flush read from this ref so the latest state always
  // lands, even if a lifecycle operation fires mid-debounce.
  const pendingUpdatesRef = useRef<Partial<Note>>({});
  // Mirror of `note` state for the flush closure (register-once-on-mount needs
  // a stable ref, not closed-over state).
  const noteRef = useRef<Note | null>(null);
  const isNewNote = !id || id === 'new';

  // Load or create note
  useEffect(() => {
    let mounted = true;
    if (isNewNote) {
      if (!isHydrated) {
        return () => { mounted = false; };
      }
      if (!activeCampaign) {
        navigate('/session');
        return;
      }
      // Create new note immediately, then redirect to its edit route
      const now = nowISO();
      const newNote: Note = {
        id: generateId(),
        campaignId: activeCampaign.id,
        sessionId: activeSession?.id,
        title: 'New Note',
        body: null,
        type: 'generic',
        typeData: {},
        status: 'active',
        pinned: false,
        scope: 'campaign',
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      };
      createNote({
        title: newNote.title,
        body: newNote.body,
        type: newNote.type,
        typeData: newNote.typeData,
        status: newNote.status,
        pinned: newNote.pinned,
        scope: newNote.scope,
      }).then(created => {
        if (mounted && created) {
          navigate(`/note/${created.id}/edit`, { replace: true });
        }
      }).catch(() => {
        if (mounted) navigate('/session');
      });
      return;
    }

    getNoteById(id).then(loaded => {
      if (!mounted) return;
      if (!loaded) {
        showToast('Note not found');
        navigate('/session');
        return;
      }
      setNote(loaded);
      setTitle(loaded.title);
      setBody(loaded.body);
      setTags(loaded.tags ?? []);
      setNoteType((loaded.type as NoteType) ?? 'generic');
      setLoading(false);
    }).catch(() => {
      if (mounted) {
        navigate('/session');
      }
    });
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaign, id, isHydrated]);

  const scheduleAutosave = useCallback(() => {
    if (!note) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const pending = pendingUpdatesRef.current;
      if (!pending || Object.keys(pending).length === 0) return;
      setSaving(true);
      try {
        await updateNote(note.id, pending);
        pendingUpdatesRef.current = {};
      } catch (e) {
        console.error('NoteEditorScreen: autosave failed', e);
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [note]);

  // Keep noteRef in sync with note state so the flush closure (registered
  // once on mount) always operates on the latest note.
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  // Register with the flush bus on mount, AND flush on unmount. Reads current
  // state via refs so the empty-dep registration stays stable.
  useEffect(() => {
    const flush = async () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const currentNote = noteRef.current;
      const pending = pendingUpdatesRef.current;
      if (currentNote && pending && Object.keys(pending).length > 0) {
        try {
          await updateNote(currentNote.id, pending);
          pendingUpdatesRef.current = {};
        } catch (e) {
          console.error('NoteEditorScreen: flush failed', e);
        }
      }
    };
    const { unregister } = registerFlush(flush);
    return () => {
      unregister();
      // Unmount also awaits a final flush so navigation persists pending edits.
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, title: newTitle };
    scheduleAutosave();
  };

  const handleBodyChange = (newBody: unknown) => {
    setBody(newBody);
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, body: newBody };
    scheduleAutosave();
  };

  const handleTagToggle = (tag: string) => {
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    setTags(newTags);
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, tags: newTags };
    scheduleAutosave();
  };

  const handleTypeChange = (newType: NoteType) => {
    setNoteType(newType);
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, type: newType };
    scheduleAutosave();
  };

  if (loading) {
    return (
      <div className="p-4 text-[var(--color-text-muted)]">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="min-h-11 min-w-11 px-3 bg-transparent border border-[var(--color-border)] rounded-lg text-[var(--color-text)] cursor-pointer text-sm shrink-0"
        >
          Back
        </button>
        <span className="text-[var(--color-text-muted)] text-xs ml-auto">
          {saving ? 'Saving...' : 'Saved'}
        </span>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => handleTitleChange(e.target.value)}
        placeholder="Note title"
        className="w-full py-2.5 px-0 bg-transparent border-0 border-b-2 border-b-[var(--color-border)] text-[var(--color-text)] text-xl font-bold mb-3 box-border outline-none"
      />

      {/* Note type selector */}
      <div className="flex gap-2 flex-wrap mb-3">
        {NOTE_TYPES.filter(t => !['skill-check', 'recap', 'npc'].includes(t)).map(t => (
          <button
            key={t}
            onClick={() => handleTypeChange(t as NoteType)}
            className={cn(
              'min-h-9 px-2.5 rounded-full border-none cursor-pointer text-xs font-semibold',
              noteType === t
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Editor */}
      <TiptapNoteEditor
        initialContent={body}
        onChange={handleBodyChange}
        campaignId={activeCampaign?.id ?? null}
        placeholder="Write your note..."
        showToolbar={true}
        minHeight="200px"
      />

      {/* Tags */}
      <div className="mt-4">
        <TagPicker
          selected={tags}
          onToggle={handleTagToggle}
          customTags={customTags}
          onCreateTag={handleCreateTag}
        />
      </div>
    </div>
  );
}
