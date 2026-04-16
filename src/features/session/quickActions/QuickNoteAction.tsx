import { useEffect, useState } from 'react';
import { TiptapNoteEditor } from '../../../components/notes/TiptapNoteEditor';
import { TagPicker } from '../../../components/notes/TagPicker';
import { useSessionLog } from '../useSessionLog';
import { useToast } from '../../../context/ToastContext';
import { useSessionEncounterContextSafe } from '../SessionEncounterContext';
import { useAppState } from '../../../context/AppStateContext';
import { useCampaignContext } from '../../campaign/CampaignContext';
import * as creatureTemplateRepository from '../../../storage/repositories/creatureTemplateRepository';
import { getById as getCharacterById } from '../../../storage/repositories/characterRepository';
import { AttachToControl, resolveAttach, type AttachToValue } from './AttachToControl';
import type { NoteType } from '../../../types/note';
import type { CreatureTemplate } from '../../../types/creatureTemplate';
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

/**
 * Selectable note types for the timeline-entry form. System-only types
 * (`npc`, `combat`, `skill-check`) flow from dedicated quick-log actions and
 * are excluded here.
 */
const SELECTABLE_NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'generic', label: 'Note' },
  { value: 'location', label: 'Location' },
  { value: 'loot', label: 'Loot' },
  { value: 'rumor', label: 'Rumor' },
  { value: 'quote', label: 'Quote' },
  { value: 'recap', label: 'Recap' },
];

/**
 * A chip entry representing either a party member (PC) or an NPC creature
 * template. Used by the inline chip rows so both can share the same
 * selected-id container.
 */
interface MentionChip {
  id: string;
  name: string;
  kind: 'partyMember' | 'creature';
}

/**
 * Full timeline-entry form surfaced by the FAB's "Note" quick-log action and
 * by the timeline's "Add to Timeline" button.
 *
 * @remarks
 * Fields:
 *  - Title (optional)
 *  - Note type (chip row): Note / Location / Loot / Rumor / Quote / Recap
 *  - Rich-text body (supports `@mentions` for power users)
 *  - Tag picker (predefined + per-campaign custom tags)
 *  - **PC chip row** — party members of the active campaign
 *  - **NPC chip row** — non-deleted creature templates of `category: 'npc'`
 *  - Attach-to control (session vs. specific encounter)
 *
 * PC/NPC chips are the touch-friendly path for linking entities — typing
 * `@Aldric` during live play is slow. On save, selected chips are persisted
 * inside the note's `typeData.mentions` as
 * `[{ id, name, kind: 'partyMember' | 'creature' }]`. That makes the
 * linkage recoverable from the note row alone.
 *
 * Follow-up: mirroring the mentions into `entityLinks` with a new `mentions`
 * relationship type (per CLAUDE.md conventions) so downstream views (the
 * timeline details panel, KB graph, etc.) can query "notes that mention PC X"
 * without reading every note's typeData. Deliberately deferred — adding a new
 * relationship type also requires updating the relationship-types table in
 * `CLAUDE.md` and the comment at the top of `entityLinkRepository.ts`.
 */
export function QuickNoteAction({ campaignId, onClose, onSaved, initialAttachTo = 'auto' }: QuickNoteActionProps) {
  const { logToSession } = useSessionLog();
  const { showToast } = useToast();
  const sessionEncounterCtx = useSessionEncounterContextSafe();
  const { settings, updateSettings } = useAppState();
  const { activeParty } = useCampaignContext();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState<unknown>(undefined);
  const [attachTo, setAttachTo] = useState<AttachToValue>(initialAttachTo);
  const [noteType, setNoteType] = useState<NoteType>('generic');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [attachTouched, setAttachTouched] = useState(false);

  // Resolve party members — join with linked CharacterRecord where present so
  // we show the PC name rather than the (often blank) party-member slot name.
  const [partyChips, setPartyChips] = useState<MentionChip[]>([]);
  useEffect(() => {
    const members = activeParty?.members ?? [];
    if (members.length === 0) {
      setPartyChips([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      members.map(async (m) => {
        let name = m.name ?? 'Unknown';
        if (m.linkedCharacterId) {
          const char = await getCharacterById(m.linkedCharacterId);
          if (char?.name) name = char.name;
        }
        return { id: m.id, name, kind: 'partyMember' as const };
      }),
    ).then((chips) => {
      if (!cancelled) setPartyChips(chips);
    });
    return () => { cancelled = true; };
  }, [activeParty]);

  // Load NPCs for the active campaign. We filter by category='npc' to keep
  // the chip row focused — monsters/animals are encountered via the Bestiary
  // flow, which creates its own NPC notes.
  const [npcChips, setNpcChips] = useState<MentionChip[]>([]);
  useEffect(() => {
    if (!campaignId) { setNpcChips([]); return; }
    let cancelled = false;
    creatureTemplateRepository.listByCampaign(campaignId).then((templates: CreatureTemplate[]) => {
      if (cancelled) return;
      const npcs = templates
        .filter((t) => t.category === 'npc')
        .map((t) => ({ id: t.id, name: t.name, kind: 'creature' as const }));
      setNpcChips(npcs);
    });
    return () => { cancelled = true; };
  }, [campaignId]);

  useEffect(() => {
    setAttachTo(initialAttachTo);
    setAttachTouched(false);
  }, [initialAttachTo]);

  useEffect(() => {
    if (attachTouched) return;
    if (initialAttachTo !== 'auto') return;

    if (noteType === 'loot' || noteType === 'recap') {
      setAttachTo(null);
      return;
    }

    setAttachTo('auto');
  }, [attachTouched, initialAttachTo, noteType]);

  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const toggleMention = (id: string) =>
    setSelectedMentionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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
      // Build the mentions array from the selected chip ids. Keep only chips
      // that still resolve — a stale selection (chip list changed while the
      // drawer was open) is silently dropped.
      const allChips = [...partyChips, ...npcChips];
      const mentions = selectedMentionIds
        .map((id) => allChips.find((c) => c.id === id))
        .filter((c): c is MentionChip => c !== undefined)
        .map((c) => ({ id: c.id, name: c.name, kind: c.kind }));

      const target = resolveAttach(attachTo);
      const typeLabel = SELECTABLE_NOTE_TYPES.find((t) => t.value === noteType)?.label ?? 'Note';
      const finalTitle = title.trim() || typeLabel;

      await logToSession(
        finalTitle,
        noteType,
        {
          body,
          tags: tags.length > 0 ? tags : undefined,
          mentions: mentions.length > 0 ? mentions : undefined,
        },
        { targetEncounterId: target },
      );

      // Success toast tells the user where it landed.
      let encounterTitle: string | null = null;
      if (attachTo === 'auto') {
        encounterTitle = sessionEncounterCtx?.activeEncounter?.title ?? null;
      } else if (typeof attachTo === 'string') {
        encounterTitle = 'encounter';
      }
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

  const renderChipRow = (chips: MentionChip[]) => (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => {
        const active = selectedMentionIds.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggleMention(c.id)}
            className={cn(
              'min-h-9 px-3 rounded-full border text-xs font-semibold cursor-pointer',
              active
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-[var(--color-accent)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] border-[var(--color-border)]',
            )}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );

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

      {/* Note type selector */}
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

      {/* Body */}
      <TiptapNoteEditor
        initialContent={body}
        onChange={setBody}
        campaignId={campaignId}
        placeholder="Details…"
        showToolbar
        minHeight="120px"
      />

      {/* Tags — TagPicker renders its own "Tags" heading */}
      <TagPicker
        selected={tags}
        onToggle={(tag) => setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))}
        customTags={customTags}
        onCreateTag={handleCreateTag}
      />

      {/* PC chips */}
      {partyChips.length > 0 && (
        <div>
          <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1.5">Player Characters</div>
          {renderChipRow(partyChips)}
        </div>
      )}

      {/* NPC chips */}
      {npcChips.length > 0 && (
        <div>
          <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1.5">NPCs</div>
          {renderChipRow(npcChips)}
        </div>
      )}

      {/* Attach-to */}
      <AttachToControl
        value={attachTo}
        onChange={(value) => {
          setAttachTouched(true);
          setAttachTo(value);
        }}
        defaultValue={initialAttachTo}
      />

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
