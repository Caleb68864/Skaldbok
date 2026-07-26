import { db } from '../../storage/db/client';
import type { BundleEnvelope, BundleContents } from '../../types/bundle';
import { getById as getCreatureTemplateById } from '../../storage/repositories/creatureTemplateRepository';

/**
 * Options controlling how a bundle is merged into local IndexedDB.
 */
export interface MergeOptions {
  /** Campaign ID to assign to all imported entities that have a campaignId field. */
  targetCampaignId?: string;
  /** Which entity types to process. Entity types not in this set are skipped. */
  selectedEntityTypes: Set<keyof BundleContents>;
}

/**
 * A single error encountered during merge.
 */
export interface MergeError {
  entityType: string;
  entityId: string;
  message: string;
}

/**
 * Summary report of a merge operation.
 */
export interface MergeReport {
  inserted: number;
  updated: number;
  skipped: number;
  errors: MergeError[];
}

/**
 * FK-safe processing order. Entities must be imported in this order so that
 * foreign key references resolve correctly (e.g. campaigns before sessions).
 */
const PROCESSING_ORDER: (keyof BundleContents)[] = [
  'campaign',
  'sessions',
  'parties',
  'partyMembers',
  'characters',
  'creatureTemplates',
  'encounters',
  'inventoryContainers',
  'notes',
  'entityLinks',
  'attachments',
];

/**
 * Maps entity type keys to their Dexie table names.
 */
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

/**
 * Merges parsed bundle contents into local IndexedDB.
 *
 * @remarks
 * Processes entities in FK-safe order, resolving conflicts by `updatedAt`
 * comparison. Supports selective import via `selectedEntityTypes` and
 * re-parenting via `targetCampaignId`. Never throws — all errors are
 * captured in the returned `MergeReport`.
 *
 * @param bundle - The parsed bundle envelope to merge.
 * @param options - Merge configuration (target campaign, selected types).
 * @returns A report with counts of inserted, updated, skipped entities and any errors.
 */
export async function mergeBundle(
  bundle: BundleEnvelope,
  options: MergeOptions
): Promise<MergeReport> {
  const report: MergeReport = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  // Encounters whose participant creature-links to verify AFTER the transaction
  // commits — done outside the tx so no repository read runs inside it.
  const encountersToCheck: Record<string, unknown>[] = [];

  try {
    // One transaction over every table the merge writes: a catastrophic mid-loop
    // failure (quota exceeded, tab closed, DB error) now rolls the WHOLE import
    // back instead of leaving entities without their relationship edges. Bad
    // individual entities (e.g. an unrestorable attachment) are still collected
    // as per-entity errors and skipped so one bad row doesn't abort the import;
    // only DB-fatal errors are re-thrown to trigger the rollback.
    await db.transaction(
      'rw',
      [
        db.campaigns, db.sessions, db.parties, db.partyMembers, db.characters,
        db.creatureTemplates, db.encounters, db.inventoryContainers, db.notes,
        db.entityLinks, db.attachments,
      ],
      async () => {
        for (const entityType of PROCESSING_ORDER) {
          if (!options.selectedEntityTypes.has(entityType)) continue;

          const entities = getEntities(bundle.contents, entityType);
          if (!entities || entities.length === 0) continue;

          for (const entity of entities) {
            try {
              await mergeEntity(entity, entityType, options, bundle.contents, report, encountersToCheck);
            } catch (err) {
              if (isFatalMergeError(err)) throw err; // abort + roll back the whole import
              report.errors.push({
                entityType,
                entityId: (entity as Record<string, unknown>).id as string ?? 'unknown',
                message: String(err),
              });
            }
          }
        }
      }
    );
  } catch (err) {
    // The transaction aborted and rolled back — nothing was committed, so the
    // running insert/update tallies are void.
    report.inserted = 0;
    report.updated = 0;
    report.errors.push({ entityType: 'unknown', entityId: 'unknown', message: `Import rolled back: ${String(err)}` });
    return report;
  }

  // Post-commit, non-transactional: warn about participants whose linked
  // creature template didn't come through.
  for (const enc of encountersToCheck) {
    await warnUnresolvableCreatureLinks(enc);
  }

  return report;
}

/**
 * Whether a thrown error is a DB-fatal failure that should roll the whole import
 * back (vs a per-entity data error that's logged and skipped). Quota/closed/
 * aborted DB conditions are fatal; a malformed single row (e.g. bad base64 in an
 * attachment → InvalidCharacterError) is not.
 */
function isFatalMergeError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? '';
  return (
    name === 'QuotaExceededError' ||
    name === 'AbortError' ||
    name === 'DatabaseClosedError' ||
    name === 'DexieError'
  );
}

/**
 * Merges a single entity into IndexedDB using dedup rules.
 */
async function mergeEntity(
  entity: Record<string, unknown>,
  entityType: keyof BundleContents,
  options: MergeOptions,
  bundleContents: BundleContents,
  report: MergeReport,
  encountersToCheck: Record<string, unknown>[]
): Promise<void> {
  const id = entity.id as string;
  if (!id) {
    report.errors.push({ entityType, entityId: 'no-id', message: 'Entity missing id field' });
    return;
  }

  // Apply re-parenting, then force the row LIVE. Exports ship live data only
  // (soft-deleted rows are skipped), so any deletedAt/softDeletedBy on an
  // imported row is spurious — a hand-edited or hostile bundle carrying a
  // tombstone must not overwrite a live local row (it would vanish from the UI)
  // nor import as an invisible tombstone that still claims the id.
  const reparented = { ...applyReparenting(entity, options.targetCampaignId, bundleContents) } as Record<string, unknown>;
  delete reparented.deletedAt;
  delete reparented.softDeletedBy;

  // Look up existing entity in IndexedDB
  const tableName = TABLE_NAMES[entityType];
  if (!tableName) {
    report.errors.push({ entityType, entityId: id, message: `Unknown table for ${entityType}` });
    return;
  }

  const existing = await db.table(tableName).get(id) as Record<string, unknown> | undefined;

  if (!existing) {
    // For attachments: restore base64 data back to Blob before inserting.
    const toInsert = entityType === 'attachments' ? restoreAttachmentBlob(reparented) : reparented;
    if (!toInsert) {
      report.errors.push({ entityType, entityId: id, message: 'Attachment has no restorable base64 data; skipped' });
      return;
    }
    // Insert new entity — use put() to preserve original ID
    await db.table(tableName).put(toInsert);
    report.inserted++;
    console.info(`[merge] insert ${entityType} ${id}`);

    // Defer the participant creature-link check until after the transaction
    // commits (it reads a repository, which must not run inside the tx).
    if (entityType === 'encounters') {
      encountersToCheck.push(reparented);
    }
    return;
  }

  // Dedup rules based on updatedAt
  const bundleUpdatedAt = entity.updatedAt as string | undefined;
  const localUpdatedAt = existing.updatedAt as string | undefined;

  if (!bundleUpdatedAt || !localUpdatedAt) {
    report.skipped++;
    return;
  }

  // Compare as parsed timestamps, not raw strings: a hand-edited/community
  // bundle may carry a differently-formatted timestamp than the local ISO-Z
  // one, and a lexicographic compare would then pick the wrong winner (overwrite
  // a newer local row, or fail to apply a newer import). An unparseable bundle
  // timestamp yields NaN, so the comparison is false and the local row is kept.
  const bundleTime = Date.parse(bundleUpdatedAt);
  const localTime = Date.parse(localUpdatedAt);

  if (bundleTime > localTime) {
    // Bundle is newer — update local
    const toUpdate = entityType === 'attachments' ? restoreAttachmentBlob(reparented) : reparented;
    if (!toUpdate) {
      report.errors.push({ entityType, entityId: id, message: 'Attachment has no restorable base64 data; skipped' });
      return;
    }
    await db.table(tableName).put(toUpdate);
    report.updated++;
    console.info(`[merge] update ${entityType} ${id}`);
  } else {
    // Bundle is same age or older — keep local
    report.skipped++;
    console.info(`[merge] skip ${entityType} ${id}`);
  }
}

/**
 * Applies campaign re-parenting and session ID clearing to an entity.
 */
function applyReparenting(
  entity: Record<string, unknown>,
  targetCampaignId: string | undefined,
  bundleContents: BundleContents
): Record<string, unknown> {
  if (!targetCampaignId) return entity;

  const result = { ...entity };

  // Set campaignId on all entities that have it
  if ('campaignId' in result) {
    result.campaignId = targetCampaignId;
  }

  // Clear sessionId when the session is NOT in the bundle
  if ('sessionId' in result && result.sessionId) {
    const sessionInBundle = (bundleContents.sessions ?? []).some(
      (s) => s.id === result.sessionId
    );
    if (!sessionInBundle) {
      result.sessionId = undefined;
    }
  }

  return result;
}

/**
 * Extracts entity array from BundleContents for a given type.
 * Campaign is a single object, not an array.
 */
function getEntities(
  contents: BundleContents,
  entityType: keyof BundleContents
): Record<string, unknown>[] {
  const val = contents[entityType];
  if (!val) return [];
  if (Array.isArray(val)) return val as Record<string, unknown>[];
  // campaign is a single object
  return [val as Record<string, unknown>];
}

/**
 * Converts a bundle attachment (base64 `data` field) back to a storage
 * attachment (`blob` field) for insertion into IndexedDB. Returns `null` when
 * the row carries no usable base64 payload — storing it verbatim would persist a
 * blob-less attachment the app can't render, so the caller skips + reports it.
 */
function restoreAttachmentBlob(entity: Record<string, unknown>): Record<string, unknown> | null {
  const data = entity.data as string | undefined;
  const encoding = entity.encoding as string | undefined;
  if (!data || encoding !== 'base64') return null;
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const mimeType = (entity.mimeType as string) ?? 'application/octet-stream';
  const blob = new Blob([bytes], { type: mimeType });
  const { data: _data, encoding: _enc, ...rest } = entity;
  return { ...rest, blob };
}

/**
 * Logs warnings for encounter participants with unresolvable linkedCreatureId.
 */
async function warnUnresolvableCreatureLinks(entity: Record<string, unknown>): Promise<void> {
  const participants = entity.participants as Array<Record<string, unknown>> | undefined;
  if (!participants) return;
  for (const participant of participants) {
    const linkedCreatureId = participant.linkedCreatureId as string | undefined;
    if (linkedCreatureId) {
      const templateExists = await getCreatureTemplateById(linkedCreatureId);
      if (!templateExists) {
        console.warn(
          `[mergeEngine] Unresolvable linkedCreatureId: ${linkedCreatureId} for participant ${participant.id} in encounter ${entity.id}`
        );
      }
    }
  }
}
