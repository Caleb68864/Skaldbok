import { useState, useEffect } from 'react';
import type { BundleEnvelope, BundleContents } from '../../types/bundle';
import type { ValidationWarning } from '../../utils/import/bundleParser';
import type { MergeOptions } from '../../utils/import/mergeEngine';
import { getAllCampaigns } from '../../storage/repositories/campaignRepository';
import type { Campaign } from '../../types/campaign';
import { cn } from '../../lib/utils';

interface ConflictInfo {
  entityType: string;
  entityId: string;
  entityName?: string;
  bundleUpdatedAt: string;
  localUpdatedAt: string;
}

interface ImportPreviewProps {
  bundle: BundleEnvelope;
  warnings: ValidationWarning[];
  conflicts: ConflictInfo[];
  contentHashMismatch?: boolean;
  onImport: (options: MergeOptions) => Promise<void>;
  onCancel: () => void;
  isImporting?: boolean;
}

const ENTITY_LABELS: Record<string, string> = {
  campaign: 'Campaign',
  sessions: 'Sessions',
  parties: 'Parties',
  partyMembers: 'Party Members',
  characters: 'Characters',
  creatureTemplates: 'Creature Templates',
  encounters: 'Encounters',
  notes: 'Notes',
  entityLinks: 'Entity Links',
  attachments: 'Attachments',
};

function getAvailableEntityTypes(contents: BundleContents): string[] {
  return Object.keys(ENTITY_LABELS).filter((key) => {
    const val = (contents as Record<string, unknown>)[key];
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  });
}

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

  const needsCampaignSelector = bundle.type === 'session' || bundle.type === 'character';
  const canImport = selectedTypes.size > 0 && (!needsCampaignSelector || !!targetCampaignId);

  const totalSelected = availableTypes
    .filter((type) => selectedTypes.has(type))
    .reduce((sum, type) => sum + getEntityCount(bundle.contents, type), 0);

  // Load campaigns for the selector
  useEffect(() => {
    if (needsCampaignSelector) {
      getAllCampaigns().then(setCampaigns);
    }
  }, [needsCampaignSelector]);

  const handleToggle = (type: string, checked: boolean) => {
    const next = new Set(selectedTypes);
    if (checked) next.add(type);
    else next.delete(type);
    setSelectedTypes(next);
  };

  const handleImport = async () => {
    await onImport({
      targetCampaignId,
      selectedEntityTypes: selectedTypes as Set<keyof BundleContents>,
    });
  };

  return (
    <div
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
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 mb-3 text-xs text-amber-800 dark:text-amber-200">
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
                <div key={i} className="text-xs text-amber-700 dark:text-amber-300 mb-0.5">
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

        {/* Campaign selector */}
        {needsCampaignSelector && (
          <div className="mb-4">
            <label className="block text-[var(--color-text-muted)] text-xs font-semibold mb-1">
              Import into campaign
            </label>
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
              <p className="text-xs text-red-500 mt-1">Select a campaign to enable import.</p>
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
