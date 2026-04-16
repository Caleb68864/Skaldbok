import { useState } from 'react';
import { TiptapNoteEditor } from '../../../components/notes/TiptapNoteEditor';
import { TagPicker } from '../../../components/notes/TagPicker';
import { useSessionLog } from '../useSessionLog';
import { useToast } from '../../../context/ToastContext';
import { useSessionEncounterContextSafe } from '../SessionEncounterContext';
import { useAppState } from '../../../context/AppStateContext';
import { AttachToControl, resolveAttach, type AttachToValue } from './AttachToControl';
import type { NoteType } from '../../../types/note';
import { cn } from '../../../lib/utils';

export interface QuickNoteActionProps {
  /** Active campaign id, forwarded to TiptapNoteEditor for mention lookups. */
  campaignId: string | null;
  /** Called when the user cancels or after a successful save. */
  onClose: () => void;
  /** Optional callback fired after a successful save. */
  onSaved?: () => void;
  /** Optional starting attach target inherited from timeline context. */
  initialAttachTo?: AttachToValue;
}

/** Note types the user can pick when creating a timeline entry. System-only
 * types (`npc`, `combat`, `skill-check`) are excluded — those flow from
 * dedicated quick-log actions, not the freeform entry form. */
const SELECTABLE_NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'generic', label: 'Note' },
  { value: 'location', label: 'Location' },
  { value: 'loot', label: 'Loot' },
  { value: 'rumor', label: 'Rumor' },
  { value: 'quote', label: 'Quote' },
  { value: 'recap', label: 'Recap' },
];

/**
 * Full timeline-entry form surfaced by the FAB's "Note" quick-log action and
 * by the timeline's "Add to Timeline" button.
 *
 * @remarks
 * Originally a bare Quick Note dialog (title + body + attach-to), this form
 * now supports:
 *  - Selectable note type (generic / location / loot / rumor / quote / recap)
 *  - Custom + predefined tags via {@link TagPicker}
 *  - PC / NPC linking via `@mentions` in the rich-text body — handled by
 *    {@link TiptapNoteEditor} and the existing KB mention-sync pipeline.
 *
 * The explicit PC/NPC chip multiselect is a deferred follow-up: it needs a
 * new `mentions` relationship type in `entityLinkRepository` (per CLAUDE.md),
 * plus a picker component for creature templates of category `'npc'`.
 */
export function QuickNoteAction({ campaignId, onClose, onSaved, initialAttachTo = 'auto' }: QuickNoteActionProps) {
  const { logToSession } = useSessionLog();
  const { showToast } = useToast();
  const sessionEncounterCtx = useSessionEncounterContextSafe();
  const { settings, updateSettings } = useAppState();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<unknown>(undefined);
  const [attachTo, setAttachTo] = useState<AttachToValue>(initialAttachTo);
  const [noteType, setNoteType] = useState<NoteType>('generic');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const customTags = campaignId ? (settings.customTags?.[campaignId] ?? []) : [];
  const handleCreateTag = (tag: string) => {
    if (!campaignId) return;
    const existing = settings.customTags?.[campaignId] ?? [];
    if (existing.includes(tag)) return;
    updateSettings({
      customTags: { ...settings.customTags, [campaignId]: [...existing, tag] },
    }).catch(console.error);
  };

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const target = resolveAttach(attachTo);
      const finalTitle = title.trim() || SELECTABLE_NOTE_TYPES.find(t => t.value === noteType)?.label || 'Note';
      await logToSession(
        finalTitle,
        noteType,
        { body, tags: tags.length > 0 ? tags : undefined },
        { targetEncounterId: target },
      );

      // Success toast — include type + attach context so the user can tell at
      // a glance where the entry landed.
      let encounterTitle: string | null = null;
      if (attachTo === 'auto') {
        encounterTitle = sessionEncounterCtx?.activeEncounter?.title ?? null;
      } else if (typeof attachTo === 'string') {
        encounterTitle = 'encounter';
      }
      const typeLabel = SELECTABLE_NOTE_TYPES.find(t => t.value === noteType)?.label ?? 'Note';
      if (encounterTitle) {
        showToast(`${typeLabel} logged to ${encounterTitle}`, 'success', 2000);
      } else {
        showToast(`${typeLabel} logged to session`, 'success', 2000);
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-w-[300px]">
      {/* Title */}
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
      />

      {/* Note type selector — chip row for touch targets */}
      <div>
        <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1.5">Type</div>
        <div className="flex flex-wrap gap-1.5">
          {SELECTABLE_NOTE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setNoteType(t.value)}
              className={cn(
                'min-h-9 px-3 rounded-full border text-xs font-semibold cursor-pointer',
                noteType === t.value
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] border-[var(--color-border)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body — @mentions in the body link to PCs/NPCs via the KB sync */}
      <div>
        <TiptapNoteEditor
          initialContent={body}
          onChange={setBody}
          campaignId={campaignId}
          placeholder="Details… (type @ to link a PC or NPC)"
          showToolbar
          minHeight="120px"
        />
      </div>

      {/* Tags */}
      <div>
        <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1.5">Tags</div>
        <TagPicker
          selected={tags}
          onToggle={(tag) => setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))}
          customTags={customTags}
          onCreateTag={handleCreateTag}
        />
      </div>

      {/* Attach-to control (session vs encounter) */}
      <AttachToControl value={attachTo} onChange={setAttachTo} defaultValue={initialAttachTo} />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-4 py-2 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg text-sm font-semibold cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="min-h-11 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </div>
  );
}
