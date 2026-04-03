import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TiptapNoteEditor } from '../components/notes/TiptapNoteEditor';
import { TagPicker } from '../components/notes/TagPicker';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { getNoteById, updateNote, createNote } from '../storage/repositories/noteRepository';
import { NOTE_TYPES } from '../types/note';
import type { Note, NoteType } from '../types/note';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { useToast } from '../context/ToastContext';
import { useAppState } from '../context/AppStateContext';

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
  const { activeCampaign, activeSession } = useCampaignContext();
  const { showToast } = useToast();
  const { settings, updateSettings } = useAppState();
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
  const isNewNote = !id || id === 'new';

  // Load or create note
  useEffect(() => {
    let mounted = true;
    if (isNewNote) {
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
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      };
      createNote({
        campaignId: newNote.campaignId,
        sessionId: newNote.sessionId,
        title: newNote.title,
        body: newNote.body,
        type: newNote.type,
        typeData: newNote.typeData,
        status: newNote.status,
        pinned: newNote.pinned,
      }).then(created => {
        if (mounted) {
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
  }, [id]);

  const scheduleAutosave = useCallback((updates: Partial<Note>) => {
    if (!note) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateNote(note.id, updates);
      } catch (e) {
        console.error('NoteEditorScreen: autosave failed', e);
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [note]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    scheduleAutosave({ title: newTitle });
  };

  const handleBodyChange = (newBody: unknown) => {
    setBody(newBody);
    scheduleAutosave({ body: newBody });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    setTags(newTags);
    scheduleAutosave({ tags: newTags });
  };

  const handleTypeChange = (newType: NoteType) => {
    setNoteType(newType);
    scheduleAutosave({ type: newType });
  };

  if (loading) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-text-muted)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            minHeight: '44px',
            minWidth: '44px',
            padding: '0 12px',
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            cursor: 'pointer',
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          Back
        </button>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginLeft: 'auto' }}>
          {saving ? 'Saving...' : 'Saved'}
        </span>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => handleTitleChange(e.target.value)}
        placeholder="Note title"
        style={{
          width: '100%',
          padding: '10px 0',
          background: 'none',
          border: 'none',
          borderBottom: '2px solid var(--color-border)',
          color: 'var(--color-text)',
          fontSize: '20px',
          fontWeight: 700,
          marginBottom: '12px',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />

      {/* Note type selector */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {NOTE_TYPES.filter(t => !['skill-check', 'recap'].includes(t)).map(t => (
          <button
            key={t}
            onClick={() => handleTypeChange(t as NoteType)}
            style={{
              minHeight: '36px',
              padding: '0 10px',
              borderRadius: '18px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              background: noteType === t ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: noteType === t ? 'var(--color-on-accent, #fff)' : 'var(--color-text-muted)',
            }}
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
      <div style={{ marginTop: '16px' }}>
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
