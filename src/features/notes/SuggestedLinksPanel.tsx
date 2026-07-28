/**
 * Review UI for {@link scanForLinks} output: lists each suggested entity
 * link with its match confidence, lets the user approve (turning the
 * matched span into a `wikiLink` node in the note body) or dismiss
 * (persisting the dismissal so the same suggestion does not reappear on
 * re-scan), plus a bulk-approve action and a "create NPC note" affordance
 * for missing-record candidates.
 */

import { useState, useCallback, useEffect } from 'react';
import type { LinkScanSuggestion } from './linkScanner.js';
import { docToText } from './textToDoc.js';
import * as settingsRepository from '../../storage/repositories/settingsRepository.js';
import type { AppSettings } from '../../types/settings.js';

type ProseMirrorNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
};

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
 * Replaces the first whole-word occurrence of `suggestion.matchedText` in
 * `bodyText` with a `wikiLink` node carrying the target's id and label.
 * Returns a ProseMirror-shaped doc, mirroring {@link textToDoc}'s output.
 */
export function applySuggestionToBody(
  bodyText: string,
  suggestion: LinkScanSuggestion
): ProseMirrorNode {
  const paragraphs = bodyText.split(/\n\s*\n/);
  let replaced = false;
  const boundary = new RegExp(`\\b${escapeRegex(suggestion.matchedText)}\\b`, 'g');

  /**
   * True when the match at `index` already sits inside a `[[…]]` span.
   *
   * Without this, approving two suggestions that share the same
   * `matchedText` — e.g. a note titled after an NPC plus that NPC's creature
   * template, which produce distinct suggestion keys but identical text —
   * wraps the span twice and corrupts the body to `[[[[Name]]]]`. The word
   * boundary alone does not protect against it, because `[` and `]` are
   * non-word characters, so `\bName\b` happily matches inside `[[Name]]`.
   */
  const alreadyWrapped = (paragraph: string, index: number, length: number): boolean =>
    paragraph.slice(Math.max(0, index - 2), index) === '[[' &&
    paragraph.slice(index + length, index + length + 2) === ']]';

  const content: ProseMirrorNode[] = paragraphs.map(paragraph => {
    if (!replaced) {
      boundary.lastIndex = 0;
      let match = boundary.exec(paragraph);
      while (match && alreadyWrapped(paragraph, match.index, match[0].length)) {
        match = boundary.exec(paragraph);
      }
      if (match) {
        replaced = true;
        const before = paragraph.slice(0, match.index);
        const after = paragraph.slice(match.index + match[0].length);
        const nodes: ProseMirrorNode[] = [];
        if (before) nodes.push({ type: 'text', text: before });
        nodes.push({
          type: 'wikiLink',
          attrs: {
            id: suggestion.target?.entityId ?? null,
            label: suggestion.matchedText,
          },
        });
        if (after) nodes.push({ type: 'text', text: after });
        return { type: 'paragraph', content: nodes };
      }
    }
    return {
      type: 'paragraph',
      content: paragraph ? [{ type: 'text', text: paragraph }] : [],
    };
  });

  return { type: 'doc', content };
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

export interface SuggestedLinksPanelProps {
  /** Suggestions produced by {@link scanForLinks}, already filtered against dismissals by the caller. */
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
  /** Called after a suggestion is approved, with the doc produced by {@link applySuggestionToBody}. */
  onApprove: (suggestion: LinkScanSuggestion, updatedBody: unknown) => void;
  /** Called after a suggestion's dismissal has been persisted. */
  onDismiss?: (suggestion: LinkScanSuggestion) => void;
  /** Called when the user asks to create an NPC note for a missing-record candidate. */
  onCreateNote?: (suggestion: LinkScanSuggestion) => void;
}

/** Lists link suggestions with Approve/Dismiss actions and a bulk-approve control. */
export function SuggestedLinksPanel({
  suggestions,
  body,
  campaignId = null,
  onApprove,
  onDismiss,
  onCreateNote,
}: SuggestedLinksPanelProps) {
  const [bodyText, setBodyText] = useState(body);
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());
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
      const updatedDoc = applySuggestionToBody(bodyText, suggestion);
      setBodyText(docToText(updatedDoc));
      setResolvedKeys(prev => new Set(prev).add(suggestion.key));
      onApprove(suggestion, updatedDoc);
    },
    [bodyText, onApprove]
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

  const handleBulkApprove = useCallback(() => {
    let runningText = bodyText;
    const resolved = new Set(resolvedKeys);
    for (const suggestion of visible) {
      if (suggestion.isMissingRecord) continue;
      const updatedDoc = applySuggestionToBody(runningText, suggestion);
      runningText = docToText(updatedDoc);
      resolved.add(suggestion.key);
      onApprove(suggestion, updatedDoc);
    }
    setBodyText(runningText);
    setResolvedKeys(resolved);
  }, [bodyText, visible, resolvedKeys, onApprove]);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Suggested links</h3>
        <button
          type="button"
          onClick={handleBulkApprove}
          className="text-xs font-medium text-[var(--color-accent)]"
        >
          Approve all
        </button>
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
                <button
                  type="button"
                  onClick={() => onCreateNote?.(suggestion)}
                  className="text-xs font-medium"
                >
                  Create NPC note
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleApprove(suggestion)}
                  className="text-xs font-medium"
                >
                  Approve
                </button>
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
