/**
 * Selection layer for {@link SessionLog}: tap-to-select entries, an action
 * bar that opens {@link PromoteEntriesSheet} with the current selection, and
 * a Review action that runs {@link scanForLinks} across every entry in the
 * session (not just the selected ones) and renders {@link SuggestedLinksPanel}.
 */

import { useEffect, useMemo, useState } from 'react';
import { PromoteEntriesSheet } from '../../notes/PromoteEntriesSheet';
import { SuggestedLinksPanel } from '../../notes/SuggestedLinksPanel';
import { docToText } from '../../notes/textToDoc';
import { scanForLinks, buildLinkScanDictionary, type LinkScanSuggestion } from '../../notes/linkScanner';
import * as noteRepository from '../../../storage/repositories/noteRepository';
import * as entityLinkRepository from '../../../storage/repositories/entityLinkRepository';
import * as creatureTemplateRepository from '../../../storage/repositories/creatureTemplateRepository';
import { useCampaignContext } from '../../campaign/CampaignContext';
import { useSessionRefreshSafe } from '../SessionRefreshContext';
import { cn } from '../../../lib/utils';
import { useModalBehaviour } from '../../../hooks/useModalBehaviour';
import type { Note } from '../../../types/note';
import type { EntityLink } from '../../../types/entityLink';

/**
 * Props for {@link SessionLogSelection}.
 *
 * @remarks
 * The owner keeps the data and the writes; this component owns only the
 * selection. That split is why `entries` comes in already scoped to the
 * session and every mutation leaves via a callback — it has no repository
 * access of its own and deliberately takes no `sessionId`, which would be a
 * second source of truth for scoping the caller has already done.
 */
export interface SessionLogSelectionProps {
  /** The active session's log entries, in the order they should be rendered. */
  entries: Note[];
  /** Campaign id, used for note search / dictionary scoping when promoting. */
  campaignId: string;
  /** Called when a tapped entry (outside selection mode) should open for edit. */
  onEditEntry: (entry: Note) => void;
  /** Called after a promote action completes, so the caller can refresh its entry list. */
  onPromoted?: () => void;
  /**
   * Soft-deletes the selected entries. Omit to hide the Delete action.
   *
   * @remarks
   * Deletion lives here rather than on a row gesture: a touch long-press is
   * what enters selection mode, so binding delete to the same gesture made
   * selecting an entry destroy it. The owner is expected to offer an Undo.
   */
  onDeleteEntries?: (entries: Note[]) => Promise<void> | void;
  /** Renders a single entry's row content; the wrapper adds selection affordances. */
  renderEntry: (entry: Note) => React.ReactNode;
}

/** Badge shown on an entry that carries a `promoted_into` link, referencing the target note id. */
function PromotedBadge({ targetNoteId }: { targetNoteId: string }) {
  return (
    <span
      data-promoted-into={targetNoteId}
      className="ml-2 inline-block rounded bg-[var(--color-state-active,#2563eb)]/20 px-1.5 py-0.5 text-xs"
    >
      Promoted
    </span>
  );
}

/**
 * Wraps a session's log entries with tap-to-select, an action bar for
 * promoting the current selection, and a Review sweep over the whole session.
 */
export function SessionLogSelection({
  entries,
  campaignId,
  onEditEntry,
  onPromoted,
  onDeleteEntries,
  renderEntry,
}: SessionLogSelectionProps) {
  const { activeParty } = useCampaignContext();
  const sessionRefresh = useSessionRefreshSafe();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Which mode the promote sheet opens in — Promote and Tag are both entry points to it. */
  const [sheetMode, setSheetMode] = useState<'new' | 'tag'>('new');
  const [promotedTargets, setPromotedTargets] = useState<Record<string, string>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const reviewRef = useModalBehaviour<HTMLDivElement>(() => setReviewOpen(false), reviewOpen);
  const [reviewSuggestions, setReviewSuggestions] = useState<LinkScanSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const links: Record<string, string> = {};
      await Promise.all(
        entries.map(async entry => {
          const outgoing: EntityLink[] = await entityLinkRepository.getLinksFrom(entry.id, 'promoted_into');
          const target = outgoing.find(link => link.toEntityType === 'note');
          if (target) links[entry.id] = target.toEntityId;
        }),
      );
      if (!cancelled) setPromotedTargets(links);
    })();
    return () => { cancelled = true; };
  }, [entries]);

  const selectedEntries = useMemo(
    () => entries.filter(entry => selectedIds.has(entry.id)),
    [entries, selectedIds],
  );

  const toggleSelected = (entry: Note) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  };

  const handleEntryTap = (entry: Note) => {
    if (selectedIds.size > 0) {
      toggleSelected(entry);
    } else {
      onEditEntry(entry);
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleDelete = async () => {
    if (!onDeleteEntries) return;
    const doomed = selectedEntries;
    clearSelection();
    await onDeleteEntries(doomed);
  };

  const handlePromoted = () => {
    clearSelection();
    setSheetOpen(false);
    onPromoted?.();
    // A promoted note is a new session note and a new timeline event, but both
    // of those surfaces live outside this component and only re-query when
    // their refresh token changes. Without this the note is written and synced
    // correctly yet stays invisible until the next navigation.
    sessionRefresh?.bumpAll();
  };

  const runReview = async () => {
    const templates = await creatureTemplateRepository.listByCampaign(campaignId);
    const dictionary = buildLinkScanDictionary({
      partyMembers: (activeParty?.members ?? [])
        .filter(m => m.linkedCharacterId)
        .map(m => ({ characterId: m.linkedCharacterId as string, characterName: m.name ?? '' })),
      creatureTemplates: templates.map(t => ({ id: t.id, name: t.name, category: t.category })),
      notes: (await noteRepository.getNotesByCampaign(campaignId)).map(n => ({ id: n.id, title: n.title })),
    });
    const combinedText = entries.map(entry => docToText(entry.body)).join('\n\n');
    setReviewSuggestions(scanForLinks({ text: combinedText, dictionary }));
    setReviewOpen(true);
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {entries.map(entry => {
          const isSelected = selectedIds.has(entry.id);
          const promotedTargetId = promotedTargets[entry.id];
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => handleEntryTap(entry)}
                onContextMenu={e => { e.preventDefault(); toggleSelected(entry); }}
                aria-pressed={isSelected}
                className={cn(
                  'w-full rounded border px-3 py-2 text-left',
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border,#ddd)]',
                )}
              >
                {renderEntry(entry)}
                {promotedTargetId && <PromotedBadge targetNoteId={promotedTargetId} />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={runReview}
          className="min-h-9 rounded px-3 text-xs font-medium text-[var(--color-accent)]"
        >
          Review
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div
          role="toolbar"
          aria-label="Selection actions"
          className="sticky bottom-0 flex items-center justify-between gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        >
          <span className="text-sm">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setSheetMode('new'); setSheetOpen(true); }}
              className="min-h-9 rounded bg-[var(--color-accent)] px-3 text-xs font-semibold text-[var(--color-on-accent,#fff)]"
            >
              Promote
            </button>
            <button
              type="button"
              onClick={() => { setSheetMode('tag'); setSheetOpen(true); }}
              className="min-h-9 rounded border border-[var(--color-border)] px-3 text-xs"
            >
              Tag
            </button>
            {onDeleteEntries && (
              <button
                type="button"
                onClick={handleDelete}
                className="min-h-9 rounded border border-[var(--color-border)] px-3 text-xs text-[var(--color-state-danger,#dc2626)]"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={clearSelection}
              className="min-h-9 rounded border border-[var(--color-border)] px-3 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sheetOpen && (
        <PromoteEntriesSheet
          entries={selectedEntries}
          campaignId={campaignId}
          initialMode={sheetMode}
          onClose={() => setSheetOpen(false)}
          onDone={handlePromoted}
        />
      )}

      {reviewOpen && (
        <div
          ref={reviewRef}
          role="dialog"
          aria-modal="true"
          aria-label="Review session links"
          onClick={() => setReviewOpen(false)}
          className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl bg-[var(--color-surface)] px-4 pt-6 pb-8"
          >
            <h3 className="mb-3 text-[var(--color-text)]">Review session</h3>
            <SuggestedLinksPanel
              suggestions={reviewSuggestions}
              body={entries.map(entry => docToText(entry.body)).join('\n\n')}
              // Scopes dismissals to this campaign — see PromoteEntriesSheet.
              campaignId={campaignId}
              // The scan runs over every entry concatenated into one body, so an
              // approved span cannot be mapped back to the entry it came from and
              // there is nowhere to persist it. The panel used to render Approve
              // and Approve all here and silently discard the result; this hides
              // them. Dismiss still works — it persists to settings.
              allowApply={false}
              onApprove={() => { /* unreachable: allowApply={false} hides every apply action */ }}
            />
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              className="mt-3 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 text-base text-[var(--color-text)]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
