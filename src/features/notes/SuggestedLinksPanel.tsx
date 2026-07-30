/**
 * Review UI for {@link features/notes/linkScanner!scanForLinks | scanForLinks} output: lists each suggested entity
 * link with its match confidence, lets the user approve (turning the
 * matched span into a `wikiLink` node in the note body) or dismiss
 * (persisting the dismissal so the same suggestion does not reappear on
 * re-scan), plus a bulk-approve action and a "create NPC note" affordance
 * for missing-record candidates.
 */

import { useState, useCallback, useEffect } from 'react';
import type { LinkScanSuggestion } from './linkScanner.js';
import { textToDoc, type ProseMirrorNode } from './textToDoc.js';
import * as settingsRepository from '../../storage/repositories/settingsRepository.js';
import type { AppSettings } from '../../types/settings.js';

/**
 * Re-exported from {@link features/notes/textToDoc!ProseMirrorNode | textToDoc}
 * so importers of this panel keep working.
 *
 * @remarks
 * This file used to declare its own structurally identical copy. The two
 * interoperated by accident rather than by contract, and nothing would have
 * caught them drifting apart — the doc shape has exactly one owner now.
 */
export type { ProseMirrorNode } from './textToDoc.js';

/** Settings shape carrying the dismissed-suggestion bucket, kept local to this panel. */
type SettingsWithDismissals = AppSettings;

const FALLBACK_SETTINGS: SettingsWithDismissals = {
  id: 'default',
  schemaVersion: 1,
  activeCharacterId: null,
  theme: 'dark',
  mode: 'play',
  wakeLockEnabled: false,
};

/**
 * Bucket key used when no campaign id is available (component rendered
 * without campaign context). Keeps the per-campaign `Record` shape uniform
 * while still behaving sensibly for callers that don't have a campaign yet.
 */
const NO_CAMPAIGN_BUCKET = '__no_campaign__';

/**
 * Reads the per-campaign dismissal bucket for `campaignId` out of the
 * persisted `dismissedLinkSuggestions` field.
 *
 * Handles the legacy pre-per-campaign shape (a flat `string[]`) defensively:
 * that shape predates campaign scoping, so it carries no reliable campaign
 * association and is treated as "no per-campaign dismissals yet" rather than
 * migrated or crashed on.
 */
function readDismissedBucket(
  stored: SettingsWithDismissals,
  campaignId: string | null | undefined
): string[] {
  const raw = stored.dismissedLinkSuggestions;
  if (!raw) return [];
  if (Array.isArray(raw)) return [];
  const bucketKey = campaignId ?? NO_CAMPAIGN_BUCKET;
  return raw[bucketKey] ?? [];
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replaces the first plain-text occurrence of `suggestion.matchedText` with a
 * `wikiLink` node carrying the target's id and label.
 *
 * @remarks
 * Doc-in / doc-out so approvals can be chained. This replaced a text-in variant
 * whose result had to be serialized with `docToText` to be fed back in, which
 * rendered every `wikiLink` to a bare `[[label]]` that re-parsed with
 * `attrs.id = null` — so approving a second suggestion silently unresolved the
 * first, and "Approve all" kept an id only for the link it handled last. This
 * walks the doc instead, so nodes it does not touch survive byte-for-byte, ids
 * included.
 *
 * Working structurally also retires the `alreadyWrapped` guard the text path
 * needs: an existing link is a `wikiLink` atom rather than the characters
 * `[[…]]`, so a later suggestion whose `matchedText` is a substring of it has
 * nothing to match against and cannot produce `[[Sir [[Aldric]]]]`.
 *
 * Only the first match across the whole doc is replaced, matching the text
 * variant's contract.
 *
 * @param doc - Doc to apply the suggestion to; not mutated.
 * @param suggestion - The suggestion whose `matchedText` should become a link.
 * @returns A new doc with the first plain-text occurrence linked.
 */
export function applySuggestionToDoc(
  doc: ProseMirrorNode,
  suggestion: LinkScanSuggestion
): ProseMirrorNode {
  const boundary = new RegExp(`\\b${escapeRegex(suggestion.matchedText)}\\b`);
  let replaced = false;

  const visit = (node: ProseMirrorNode): ProseMirrorNode => {
    if (replaced || !Array.isArray(node.content)) return node;

    const nodes: ProseMirrorNode[] = [];
    let changed = false;

    for (const child of node.content) {
      if (replaced) {
        nodes.push(child);
        continue;
      }
      // Descend into blocks; only `text` children are candidates for linking.
      if (child.type !== 'text' || typeof child.text !== 'string') {
        const visited = visit(child);
        if (visited !== child) changed = true;
        nodes.push(visited);
        continue;
      }
      const match = boundary.exec(child.text);
      if (!match) {
        nodes.push(child);
        continue;
      }
      replaced = true;
      changed = true;
      const before = child.text.slice(0, match.index);
      const after = child.text.slice(match.index + match[0].length);
      if (before) nodes.push({ type: 'text', text: before });
      nodes.push({
        type: 'wikiLink',
        attrs: {
          id: suggestion.target?.entityId ?? null,
          label: suggestion.matchedText,
        },
      });
      if (after) nodes.push({ type: 'text', text: after });
    }

    return changed ? { ...node, content: nodes } : node;
  };

  return visit(doc);
}

/**
 * Reads the persisted set of dismissed suggestion keys for `campaignId` (see
 * {@link LinkScanSuggestion.key}). Pass `null`/`undefined` when no campaign
 * context is available; dismissals are then scoped to a fallback bucket
 * rather than bleeding across campaigns.
 */
export async function getDismissedSuggestionKeys(
  campaignId?: string | null
): Promise<string[]> {
  const stored = (await settingsRepository.get()) as SettingsWithDismissals | undefined;
  if (!stored) return [];
  return readDismissedBucket(stored, campaignId);
}

/** Persists a dismissal so a re-scan of the same text does not re-offer this suggestion. */
export async function persistDismissedSuggestion(
  key: string,
  campaignId?: string | null
): Promise<void> {
  const stored = ((await settingsRepository.get()) as SettingsWithDismissals | undefined) ?? FALLBACK_SETTINGS;
  const bucketKey = campaignId ?? NO_CAMPAIGN_BUCKET;
  const existingRaw = stored.dismissedLinkSuggestions;
  // A legacy flat array carries no per-campaign association; treat it as an
  // empty starting point rather than trying to merge or migrate it.
  const existingMap = existingRaw && !Array.isArray(existingRaw) ? existingRaw : {};
  const existing = existingMap[bucketKey] ?? [];
  if (existing.includes(key)) return;
  const updated: SettingsWithDismissals = {
    ...stored,
    dismissedLinkSuggestions: {
      ...existingMap,
      [bucketKey]: [...existing, key],
    },
  };
  await settingsRepository.save(updated as AppSettings);
}

/** Props for {@link SuggestedLinksPanel}. */
export interface SuggestedLinksPanelProps {
  /** Suggestions produced by {@link features/notes/linkScanner!scanForLinks | scanForLinks}, already filtered against dismissals by the caller. */
  suggestions: LinkScanSuggestion[];
  /** Current plain-text body the suggestions were scanned from. */
  body: string;
  /**
   * Active campaign id, used to scope dismissed-suggestion persistence so a
   * dismissal in one campaign doesn't suppress the same suggestion in
   * another. Optional — when absent, dismissals fall back to a shared
   * "no campaign" bucket rather than crashing.
   */
  campaignId?: string | null;
  /** Called after a suggestion is approved, with the doc produced by {@link applySuggestionToDoc}. */
  /**
   * Fired after a suggestion is applied. `updatedBody` is a ProseMirror doc
   * whose `wikiLink` nodes carry the resolved `entityId` — consumers must
   * persist the **doc**, not a text serialization of it. Flattening it via
   * `docToText` and re-parsing with `textToDoc` silently discards every id.
   */
  onApprove: (suggestion: LinkScanSuggestion, updatedBody: ProseMirrorNode) => void;
  /** Called after a suggestion's dismissal has been persisted. */
  onDismiss?: (suggestion: LinkScanSuggestion) => void;
  /**
   * Called when the user asks to create a note for a missing-record candidate.
   * Resolve with the new note's id to have the panel link the span to it, or
   * with `null` if creation was cancelled or failed. Omit the prop entirely to
   * hide the action.
   */
  onCreateNote?: (suggestion: LinkScanSuggestion) => Promise<string | null>;
  /**
   * Whether approving is meaningful here. Defaults to `true`.
   *
   * @remarks
   * Set `false` for callers that scan a **merged** body — the session review
   * sweep concatenates every log entry, so an approved span cannot be mapped
   * back to the entry it came from and the caller has nowhere to persist it.
   * Those callers previously rendered Approve / Approve all anyway and silently
   * discarded the result. Dismiss stays available in either mode: it persists
   * to settings and does not depend on a writable body.
   */
  allowApply?: boolean;
}

/** Lists link suggestions with Approve/Dismiss actions and a bulk-approve control. */
export function SuggestedLinksPanel({
  suggestions,
  body,
  campaignId = null,
  onApprove,
  onDismiss,
  onCreateNote,
  allowApply = true,
}: SuggestedLinksPanelProps) {
  // Doc, not text: serializing between approvals nulls the ids of links already
  // approved (see `applySuggestionToDoc`).
  const [bodyDoc, setBodyDoc] = useState<ProseMirrorNode>(() => textToDoc(body));
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());
  /** Key of the suggestion whose record is currently being created, if any. */
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  // Belt-and-suspenders: re-check persisted dismissals here so a suggestion
  // never re-appears even if a caller forgets to filter before passing
  // `suggestions` in (e.g. on a fresh re-scan).
  useEffect(() => {
    let cancelled = false;
    getDismissedSuggestionKeys(campaignId).then(keys => {
      if (!cancelled) setDismissedKeys(new Set(keys));
    });
    return () => {
      cancelled = true;
    };
  }, [suggestions, campaignId]);

  const visible = suggestions.filter(s => !resolvedKeys.has(s.key) && !dismissedKeys.has(s.key));

  const handleApprove = useCallback(
    (suggestion: LinkScanSuggestion) => {
      const updatedDoc = applySuggestionToDoc(bodyDoc, suggestion);
      setBodyDoc(updatedDoc);
      setResolvedKeys(prev => new Set(prev).add(suggestion.key));
      onApprove(suggestion, updatedDoc);
    },
    [bodyDoc, onApprove]
  );

  const handleDismiss = useCallback(
    (suggestion: LinkScanSuggestion) => {
      setResolvedKeys(prev => new Set(prev).add(suggestion.key));
      persistDismissedSuggestion(suggestion.key, campaignId)
        .then(() => onDismiss?.(suggestion))
        .catch(err => console.error('Failed to persist link-suggestion dismissal', err));
    },
    [onDismiss, campaignId]
  );

  /**
   * Creates the missing record, then links the span to it.
   *
   * A suggestion with `isMissingRecord` has no `target`, so approving it would
   * insert a `wikiLink` with a null id — a link to nothing. Creation has to
   * supply the id first, which is why this awaits the caller rather than
   * firing and forgetting.
   */
  const handleCreateNote = useCallback(
    (suggestion: LinkScanSuggestion) => {
      if (!onCreateNote) return;
      setCreatingKey(suggestion.key);
      onCreateNote(suggestion)
        .then(entityId => {
          if (!entityId) return;
          const linked: LinkScanSuggestion = {
            ...suggestion,
            target: { entityId, entityType: 'note' },
            isMissingRecord: false,
          };
          const updatedDoc = applySuggestionToDoc(bodyDoc, linked);
          setBodyDoc(updatedDoc);
          setResolvedKeys(prev => new Set(prev).add(suggestion.key));
          onApprove(linked, updatedDoc);
        })
        .catch(err => console.error('Failed to create note for link suggestion', err))
        .finally(() => setCreatingKey(null));
    },
    [onCreateNote, bodyDoc, onApprove]
  );

  const handleBulkApprove = useCallback(() => {
    let runningDoc = bodyDoc;
    const resolved = new Set(resolvedKeys);
    for (const suggestion of visible) {
      if (suggestion.isMissingRecord) continue;
      runningDoc = applySuggestionToDoc(runningDoc, suggestion);
      resolved.add(suggestion.key);
      // Each callback carries the doc accumulated so far, so a consumer that
      // keeps only the last one still ends up with every approved id.
      onApprove(suggestion, runningDoc);
    }
    setBodyDoc(runningDoc);
    setResolvedKeys(resolved);
  }, [bodyDoc, visible, resolvedKeys, onApprove]);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Suggested links</h3>
        {allowApply && (
          <button
            type="button"
            onClick={handleBulkApprove}
            className="text-xs font-medium text-[var(--color-accent)]"
          >
            Approve all
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {visible.map(suggestion => (
          <li
            key={suggestion.key}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{suggestion.matchedText}</span>
              <span
                data-confidence={suggestion.confidence}
                className={
                  suggestion.confidence === 'exact'
                    ? 'rounded bg-[var(--color-state-active,#2563eb)]/20 px-1.5 py-0.5 text-xs'
                    : 'rounded border border-dashed border-current px-1.5 py-0.5 text-xs italic opacity-80'
                }
              >
                {suggestion.confidence === 'exact' ? 'exact' : 'fuzzy'}
              </span>
              {suggestion.isMissingRecord && (
                <span className="text-xs opacity-70">no matching record</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {suggestion.isMissingRecord ? (
                // Only offered when a caller can actually create the record.
                // Without a handler this button was a permanent no-op.
                allowApply &&
                onCreateNote && (
                  <button
                    type="button"
                    onClick={() => handleCreateNote(suggestion)}
                    disabled={creatingKey === suggestion.key}
                    className="text-xs font-medium disabled:opacity-50"
                  >
                    {/* Deliberately not "Create note": the promote sheet's own
                        submit button uses that label, and two controls with one
                        label is ambiguous for the user and for a test locator. */}
                    {creatingKey === suggestion.key ? 'Creating…' : 'Create NPC note'}
                  </button>
                )
              ) : (
                allowApply && (
                  <button
                    type="button"
                    onClick={() => handleApprove(suggestion)}
                    className="text-xs font-medium"
                  >
                    Approve
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => handleDismiss(suggestion)}
                className="text-xs opacity-70"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
