import { useState, useCallback } from 'react';
import { parseBundle, verifyContentHash } from '../../utils/import/bundleParser';
import { mergeBundle } from '../../utils/import/mergeEngine';
import type { ParsedBundleResult } from '../../utils/import/bundleParser';
import type { MergeOptions } from '../../utils/import/mergeEngine';
import type { BundleContents, BundleEnvelope } from '../../types/bundle';
import { useToast } from '../../context/ToastContext';
import { db } from '../../storage/db/client';

/** Maps bundle entity type keys to their Dexie table names. */
const TABLE_NAMES: Record<string, string> = {
  campaign: 'campaigns',
  sessions: 'sessions',
  parties: 'parties',
  partyMembers: 'partyMembers',
  characters: 'characters',
  creatureTemplates: 'creatureTemplates',
  encounters: 'encounters',
  inventoryContainers: 'inventoryContainers',
  notes: 'notes',
  entityLinks: 'entityLinks',
  attachments: 'attachments',
};

/** A conflict detected between a bundle entity and a local entity. */
export interface ImportConflict {
  entityType: string;
  entityId: string;
  entityName?: string;
  localUpdatedAt: string;
  bundleUpdatedAt: string;
}

/**
 * Computes conflicts between bundle entities and existing local entities.
 * A conflict exists when both have the same ID but different updatedAt values.
 */
async function computeConflicts(bundle: BundleEnvelope): Promise<ImportConflict[]> {
  const conflicts: ImportConflict[] = [];

  for (const [entityType, tableName] of Object.entries(TABLE_NAMES)) {
    const val = bundle.contents[entityType as keyof BundleContents];
    if (!val) continue;

    const entities: Record<string, unknown>[] = Array.isArray(val)
      ? (val as Record<string, unknown>[])
      : [val as Record<string, unknown>];

    for (const entity of entities) {
      const id = entity.id as string | undefined;
      if (!id) continue;

      try {
        const local = await db.table(tableName).get(id) as Record<string, unknown> | undefined;
        if (!local) continue;

        const localUpdatedAt = local.updatedAt as string | undefined;
        const bundleUpdatedAt = entity.updatedAt as string | undefined;

        if (localUpdatedAt && bundleUpdatedAt && localUpdatedAt !== bundleUpdatedAt) {
          conflicts.push({
            entityType,
            entityId: id,
            entityName: (entity.title ?? entity.name) as string | undefined,
            localUpdatedAt,
            bundleUpdatedAt,
          });
        }
      } catch {
        // Skip entities we can't look up
      }
    }
  }

  return conflicts;
}

/**
 * Hook providing the import workflow: file picking, parsing, preview state,
 * and merge execution with toast feedback.
 */
export function useImportActions() {
  const { showToast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedBundleResult | null>(null);
  const [contentHashMismatch, setContentHashMismatch] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);

  /**
   * Opens a file picker, parses the selected file, and shows the import preview.
   * Accepts `.skaldbok.json` and legacy `.skaldmark.json`.
   */
  const startImport = useCallback(async () => {
    const file = await pickFile(['.skaldbok.json', '.skaldmark.json', '.json']);
    if (!file) return;

    const json = await file.text();
    const result = parseBundle(json);
    setParsedResult(result);

    if (result.success) {
      // Async hash verification + conflict detection in parallel
      const [hashOk, detectedConflicts] = await Promise.all([
        verifyContentHash(result.bundle, json),
        computeConflicts(result.bundle),
      ]);
      setContentHashMismatch(!hashOk);
      setConflicts(detectedConflicts);
      setShowPreview(true);
    } else {
      showToast(`Import failed: ${result.error}`);
    }
  }, [showToast]);

  /**
   * Executes the merge with user-selected options. Called by ImportPreview's onImport.
   */
  const executeImport = useCallback(async (options: MergeOptions) => {
    if (!parsedResult || !parsedResult.success) return;

    // For campaign imports, auto-target the campaign in the bundle
    const effectiveOptions = { ...options };
    if (parsedResult.bundle.type === 'campaign' && parsedResult.bundle.contents.campaign && !effectiveOptions.targetCampaignId) {
      effectiveOptions.targetCampaignId = parsedResult.bundle.contents.campaign.id;
    }

    setIsImporting(true);
    try {
      const report = await mergeBundle(parsedResult.bundle, effectiveOptions);

      // Rebuild the KB graph for the imported campaign.
      //
      // `mergeBundle` writes straight to `db.notes` / `db.entityLinks` and never
      // fires `syncNote`, and `kb_nodes` / `kb_edges` are not part of a bundle.
      // Every surface that lists notes — the Session Notes panel and the whole
      // Knowledge Base — reads `kb_nodes`, so an import used to land the rows
      // correctly and show the user *nothing*: the notes were invisible until
      // something unrelated happened to run a rebuild. That is the step where a
      // promoted note's round trip was lost, even though its row and its
      // `promoted_into` edges had both survived.
      const rebuildCampaignId =
        effectiveOptions.targetCampaignId ?? parsedResult.bundle.contents.campaign?.id;
      if (rebuildCampaignId) {
        try {
          const { bulkRebuildGraph } = await import('../kb/linkSyncEngine');
          await bulkRebuildGraph(rebuildCampaignId);
        } catch (err) {
          // Non-fatal: the data is committed and correct, only the graph is
          // stale. Surfaced rather than swallowed so the user knows to reopen
          // the Knowledge Base, which rebuilds on mount.
          console.error('[useImportActions] KB rebuild after import failed', err);
          showToast('Imported, but the knowledge graph could not be rebuilt. Open the Knowledge Base to refresh it.');
        }
      }

      if (report.errors.length > 0) {
        showToast(
          `Import completed with ${report.errors.length} error(s). ` +
          `Imported ${report.inserted} new, updated ${report.updated}, skipped ${report.skipped}.`
        );
      } else {
        showToast(
          `Imported ${report.inserted} new, updated ${report.updated}, skipped ${report.skipped}.`
        );
      }

      setShowPreview(false);
      setParsedResult(null);
    } catch (err) {
      showToast('Import failed unexpectedly. Please try again.');
      console.error('[useImportActions] executeImport error', err);
    } finally {
      setIsImporting(false);
    }
  }, [parsedResult, showToast]);

  const cancelImport = useCallback(() => {
    setShowPreview(false);
    setParsedResult(null);
    setConflicts([]);
  }, []);

  return {
    isImporting,
    parsedResult,
    contentHashMismatch,
    conflicts,
    showPreview,
    startImport,
    executeImport,
    cancelImport,
  };
}

/**
 * Opens a native file picker dialog and returns the selected file.
 */
function pickFile(accept: string[]): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept.join(',');
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0] ?? null;
      resolve(file);
    };
    // Handle cancel — listen for focus returning to the window
    const handleFocus = () => {
      window.removeEventListener('focus', handleFocus);
      // Small delay to check if a file was selected
      setTimeout(() => {
        if (!input.files || input.files.length === 0) {
          resolve(null);
        }
      }, 300);
    };
    window.addEventListener('focus', handleFocus);
    input.click();
  });
}
