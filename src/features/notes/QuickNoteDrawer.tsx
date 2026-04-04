import { useState, useEffect, useRef } from 'react';
import { TiptapNoteEditor } from '../../components/notes/TiptapNoteEditor';
import { TagPicker } from '../../components/notes/TagPicker';
import { AttachButton } from '../../components/notes/AttachButton';
import { AttachmentThumbs } from '../../components/notes/AttachmentThumbs';
import { useNoteActions } from './useNoteActions';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useAppState } from '../../context/AppStateContext';
import * as attachmentRepository from '../../storage/repositories/attachmentRepository';
import { cn } from '../../lib/utils';

/**
 * Props for the {@link QuickNoteDrawer} component.
 */
interface QuickNoteDrawerProps {
  /** Called when the drawer should be dismissed without saving. */
  onClose: () => void;
  /** Called after a note has been successfully created and persisted. */
  onSaved: () => void;
}

/**
 * Bottom-sheet drawer for rapidly capturing a new generic note during a session.
 *
 * @remarks
 * Provides a minimal capture flow — title (required), optional tags, optional
 * Tiptap rich-text body, and up to 10 image attachments. Attachments are saved
 * to IndexedDB after the note record is created. Object URLs for pending file
 * previews are revoked on unmount to prevent memory leaks.
 *
 * The Save button is disabled until a non-empty title is entered. Tags are
 * persisted per-campaign in app settings (`settings.customTags`).
 *
 * @param props - {@link QuickNoteDrawerProps}
 *
 * @example
 * ```tsx
 * {showQuickNote && (
 *   <QuickNoteDrawer
 *     onClose={() => setShowQuickNote(false)}
 *     onSaved={refreshNotes}
 *   />
 * )}
 * ```
 */
export function QuickNoteDrawer({ onClose, onSaved }: QuickNoteDrawerProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<unknown>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const pendingUrlsRef = useRef<string[]>([]);
  const { createNote } = useNoteActions();
  const { activeCampaign } = useCampaignContext();
  const { settings, updateSettings } = useAppState();
  const campaignId = activeCampaign?.id ?? null;
  const customTags = campaignId ? (settings.customTags?.[campaignId] ?? []) : [];

  /**
   * Adds a new tag to the campaign's custom tag list if it is not already present.
   *
   * @param tag - The tag string to create.
   */
  const handleCreateTag = (tag: string) => {
    if (!campaignId) return;
    const existing = settings.customTags?.[campaignId] ?? [];
    if (existing.includes(tag)) return;
    updateSettings({ customTags: { ...settings.customTags, [campaignId]: [...existing, tag] } });
  };

  // Build preview entries for pending files
  const pendingThumbs = pendingFiles.map((_file, index) => ({
    id: `pending-${index}`,
    objectUrl: pendingUrlsRef.current[index] ?? '',
    caption: undefined,
  }));

  // Revoke pending preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  /**
   * Handles a file selected via {@link AttachButton}, creates an object URL
   * for preview, and appends the file to the pending list.
   *
   * @param file - The image file the user selected.
   */
  const handleFileSelected = (file: File) => {
    const url = URL.createObjectURL(file);
    pendingUrlsRef.current = [...pendingUrlsRef.current, url];
    setPendingFiles(prev => [...prev, file]);
  };

  /**
   * Removes a pending (not-yet-saved) attachment by its preview ID, revoking
   * the corresponding object URL.
   *
   * @param id - The pending thumb ID in the format `"pending-<index>"`.
   */
  const handlePendingDelete = (id: string) => {
    const index = parseInt(id.replace('pending-', ''), 10);
    const url = pendingUrlsRef.current[index];
    if (url) URL.revokeObjectURL(url);
    pendingUrlsRef.current = pendingUrlsRef.current.filter((_, i) => i !== index);
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Creates the note record and saves any pending attachments, then calls
   * `onSaved` and `onClose`. No-op when the title field is empty.
   */
  const handleSave = async () => {
    if (!title.trim()) return;
    const note = await createNote({
      title: title.trim(),
      type: 'generic',
      body,
      pinned: false,
      status: 'active',
      tags: tags.length > 0 ? tags : undefined,
      typeData: {},
    });
    if (note && activeCampaign) {
      for (const file of pendingFiles) {
        try {
          await attachmentRepository.createAttachment(note.id, activeCampaign.id, file);
        } catch (e) {
          console.error('QuickNoteDrawer: failed to save attachment', e);
        }
      }
    }
    onSaved();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="Quick note"
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-t-2xl w-full max-w-[480px] px-4 pt-6 pb-8"
      >
        <h3 className="text-[var(--color-text)] mb-3">Quick Note</h3>
        <input
          type="text"
          placeholder="Note title (required)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
          className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-3 box-border"
        />
        <TagPicker selected={tags} onToggle={tag => setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} customTags={customTags} onCreateTag={handleCreateTag} />
        <div className="mb-2">
          <AttachButton onFileSelected={handleFileSelected} disabled={pendingFiles.length >= 10} />
          <AttachmentThumbs
            attachments={pendingThumbs}
            onDelete={handlePendingDelete}
            onCaptionChange={() => { /* captions saved post-creation */ }}
          />
        </div>
        <div className="mb-3">
          <TiptapNoteEditor
            initialContent={null}
            onChange={setBody}
            campaignId={activeCampaign?.id ?? null}
            placeholder="Add note body (optional)..."
            showToolbar
            minHeight="200px"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className={cn(
              'flex-1 min-h-11 min-w-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer',
              !title.trim() ? 'opacity-60' : 'opacity-100'
            )}
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 px-4 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg text-base cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
