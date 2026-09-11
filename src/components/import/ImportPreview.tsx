import { useState, useEffect } from 'react';
import type { BundleEnvelope, BundleContents } from '../../types/bundle';
import type { ValidationWarning } from '../../utils/import/bundleParser';
import type { MergeOptions } from '../../utils/import/mergeEngine';
import { getAllCampaigns } from '../../storage/repositories/campaignRepository';
import type { Campaign } from '../../types/campaign';
import { BUNDLE_ENTITY_LABELS } from '../../types/bundleTables';
import { resolveImportCampaignTarget } from '../../utils/import/importCampaignTarget';
import { cn } from '../../lib/utils';
import { useModalBehaviour } from '../../hooks/useModalBehaviour';

/** One import conflict: an incoming entity whose id already exists locally, with both timestamps for the user to compare. */
interface ConflictInfo {
  entityType: string;
  entityId: string;
  entityName?: string;
  bundleUpdatedAt: string;
  localUpdatedAt: string;
}

/** Props for {@link ImportPreview}. `onImport` commits with the chosen {@link MergeOptions}; `isImporting` disables the controls while it runs. */
interface ImportPreviewProps {
  bundle: BundleEnvelope;
  warnings: ValidationWarning[];
  conflicts: ConflictInfo[];
  contentHashMismatch?: boolean;
  onImport: (options: MergeOptions) => Promise<void>;
  onCancel: () => void;
  isImporting?: boolean;
}

/**
 * Display names for the per-group import checkboxes.
 *
 * @remarks
 * Comes from the shared registry: `getAvailableEntityTypes` iterates these keys,
 * so a group missing a label was not merely unlabelled — it never appeared in
 * the dialog and could not be imported at all.
 */
const ENTITY_LABELS = BUNDLE_ENTITY_LABELS;

/** Entity-group keys present in the bundle with at least one row, in a stable display order. */
function getAvailableEntityTypes(contents: BundleContents): string[] {
  return Object.keys(ENTITY_LABELS).filter((key) => {
    const val = (contents as Record<string, unknown>)[key];
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  });
}

/** Number of rows for one entity group (1 for the singular `campaign`, array length otherwise). */
function getEntityCount(contents: BundleContents, type: string): number {
  const val = (contents as Record<string, unknown>)[type];
  if (!val) return 0;
  if (Array.isArray(val)) return val.length;
  return 1;
}

/**
 * Import preview component showing bundle metadata, entity counts,
 * validation warnings, conflicts, and per-entity-group checkboxes.
 */
export function ImportPreview({
  bundle,
  warnings,
  conflicts,
  contentHashMismatch,
  onImport,
  onCancel,
  isImporting = false,
}: ImportPreviewProps) {
  const availableTypes = getAvailableEntityTypes(bundle.contents);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(availableTypes));
  const [targetCampaignId, setTargetCampaignId] = useState<string | undefined>();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // What this import needs in the way of a campaign, answered from the rows the
  // user actually selected rather than from `bundle.type`. Branching on the
  // declared scope demanded a target campaign for every character bundle — even
  // though a `CharacterRecord` has no `campaignId` — which on a fresh install
  // meant the restore path was gated on already having the thing being restored.
  const campaignTarget = resolveImportCampaignTarget(bundle, selectedTypes);
  const needsCampaignSelector = campaignTarget.kind === 'required';
  const canImport = selectedTypes.size > 0 && (!needsCampaignSelector || !!targetCampaignId);

  // A bundle that brings its own campaign is restored under that campaign's own
  // id; nothing is asked and no second campaign is invented.
  const effectiveTargetCampaignId =
    campaignTarget.kind === 'bundled' ? campaignTarget.campaignId : targetCampaignId;

  const totalSelected = availableTypes
    .filter((type) => selectedTypes.has(type))
    .reduce((sum, type) => sum + getEntityCount(bundle.contents, type), 0);

  // Loaded unconditionally: the dialog has to be able to say "there are no
  // campaigns yet" as distinct from "pick one", and the requirement now moves
  // as the user ticks and unticks groups rather than being fixed on open.
  useEffect(() => {
    let cancelled = false;
    getAllCampaigns()
      .then((all) => { if (!cancelled) setCampaigns(all); })
      .catch((err) => { console.error('[ImportPreview] could not list campaigns', err); });
    return () => { cancelled = true; };
  }, []);

  const handleToggle = (type: string, checked: boolean) => {
    const next = new Set(selectedTypes);
    if (checked) next.add(type);
    else next.delete(type);
    setSelectedTypes(next);
  };

  const handleImport = async () => {
    await onImport({
      targetCampaignId: effectiveTargetCampaignId,
      selectedEntityTypes: selectedTypes as Set<keyof BundleContents>,
    });
  };


  const dialogRef = useModalBehaviour<HTMLDivElement>(onCancel);

  return (
    <div
      ref={dialogRef}
      aria-modal="true"
      role="dialog"
      aria-label="Import preview"
      onClick={onCancel}
      className="fixed inset-0 bg-black/50 z-[300] flex items-end sm:items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl w-full max-w-[520px] max-h-[85vh] overflow-y-auto px-4 pt-5 pb-6"
      >
        {/* Content hash mismatch warning */}
        {contentHashMismatch && (
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-warning)] rounded-lg px-3 py-2 mb-3 text-xs text-[var(--color-warning)]">
            File integrity check failed. The file may have been modified after export. Import is still allowed.
          </div>
        )}

        {/* Bundle metadata */}
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] rounded-full text-xs font-bold uppercase">
            {bundle.type}
          </span>
          <span className="text-[var(--color-text-muted)] text-xs">
            Exported {new Date(bundle.exportedAt).toLocaleDateString()}
          </span>
          {bundle.exportedBy && (
            <span className="text-[var(--color-text-muted)] text-xs">
              by {bundle.exportedBy}
            </span>
          )}
        </div>

        {/* Entity counts table */}
        <div className="mb-4">
          <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-2">
            Contents
          </h4>
          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
            {availableTypes.map((type) => (
              <div
                key={type}
                className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has(type)}
                    onChange={(e) => handleToggle(type, e.target.checked)}
                    className="w-4 h-4 accent-[var(--color-accent)]"
                  />
                  <span className="text-[var(--color-text)] text-sm">
                    {ENTITY_LABELS[type] ?? type}
                  </span>
                </div>
                <span className="text-[var(--color-text-muted)] text-sm tabular-nums">
                  {getEntityCount(bundle.contents, type)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Validation warnings */}
        {warnings.length > 0 && (
          <div className="mb-4">
            <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-1">
              Warnings ({warnings.length})
            </h4>
            <div className="max-h-32 overflow-y-auto">
              {warnings.map((w, i) => (
                <div key={i} className="text-xs text-[var(--color-warning)] mb-0.5">
                  {w.entityType}[{w.entityIndex}].{w.path}: {w.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="mb-4">
            <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-1">
              Conflicts ({conflicts.length})
            </h4>
            <p className="text-[var(--color-text-muted)] text-xs mb-1">
              Newer bundle versions will overwrite local data.
            </p>
            <div className="max-h-32 overflow-y-auto">
              {conflicts.slice(0, 10).map((c, i) => (
                <div key={i} className="text-xs text-[var(--color-text)] mb-0.5">
                  {c.entityType}: {c.entityName ?? c.entityId}
                </div>
              ))}
              {conflicts.length > 10 && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  ...and {conflicts.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Restoring a bundle that brought its own campaign — nothing to ask. */}
        {campaignTarget.kind === 'bundled' && (
          <div
            data-testid="import-restores-campaign"
            className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-xs text-[var(--color-text-muted)]"
          >
            Restores the campaign <span className="font-semibold text-[var(--color-text)]">{campaignTarget.campaignName}</span>{' '}
            under its own identity. Re-importing this file updates that campaign rather than
            creating a second copy.
          </div>
        )}

        {/* Campaign selector — only for rows that carry a campaignId and have no
            campaign of their own in the bundle. */}
        {needsCampaignSelector && (
          <div className="mb-4">
            <label className="block text-[var(--color-text-muted)] text-xs font-semibold mb-1">
              Import into campaign
            </label>
            {campaigns.length === 0 ? (
              <p data-testid="import-no-campaigns" className="text-xs text-[var(--color-warning)]">
                {campaignTarget.groupLabels.join(', ')} belong to a campaign, and this device has
                none yet. Untick {campaignTarget.groupLabels.length > 1 ? 'those groups' : 'that group'} to
                import the rest now, or create a campaign first from the campaign menu.
              </p>
            ) : (
              <>
                <select
                  value={targetCampaignId ?? ''}
                  onChange={(e) => setTargetCampaignId(e.target.value || undefined)}
                  className="w-full px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm"
                >
                  <option value="">Select a campaign...</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {!targetCampaignId && (
                  <p className="text-xs text-red-500 mt-1">
                    {campaignTarget.groupLabels.join(', ')} need a campaign. Select one, or untick
                    them to import the rest.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isImporting}
            className="min-h-11 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport || isImporting}
            className={cn(
              'min-h-11 px-5 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer',
              (!canImport || isImporting) && 'opacity-60'
            )}
          >
            {isImporting ? 'Importing...' : `Import ${totalSelected} items`}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ConflictInfo, ImportPreviewProps };
