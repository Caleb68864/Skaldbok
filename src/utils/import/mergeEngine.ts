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

  try {
    for (const entityType of PROCESSING_ORDER) {
      if (!options.selectedEntityTypes.has(entityType)) continue;

      const entities = getEntities(bundle.contents, entityType);
      if (!entities || entities.length === 0) continue;

      for (const entity of entities) {
        try {
          await mergeEntity(entity, entityType, options, bundle.contents, report);
        } catch (err) {
          report.errors.push({
            entityType,
            entityId: (entity as Record<string, unknown>).id as string ?? 'unknown',
            message: String(err),
          });
        }
      }
    }
  } catch (err) {
    report.errors.push({ entityType: 'unknown', entityId: 'unknown', message: String(err) });
  }

  return report;
}

/**
 * Merges a single entity into IndexedDB using dedup rules.
 */
async function mergeEntity(
  entity: Record<string, unknown>,
  entityType: keyof BundleContents,
  options: MergeOptions,
  bundleContents: BundleContents,
  report: MergeReport
): Promise<void> {
  const id = entity.id as string;
  if (!id) {
    report.errors.push({ entityType, entityId: 'no-id', message: 'Entity missing id field' });
    return;
  }

  // Apply re-parenting
  const reparented = applyReparenting(entity, options.targetCampaignId, bundleContents);

  // Look up existing entity in IndexedDB
  const tableName = TABLE_NAMES[entityType];
  if (!tableName) {
    report.errors.push({ entityType, entityId: id, message: `Unknown table for ${entityType}` });
    return;
  }

  const existing = await db.table(tableName).get(id) as Record<string, unknown> | undefined;

  if (!existing) {
    // Insert new entity — use put() to preserve original ID
    await db.table(tableName).put(reparented);
    report.inserted++;

    // Check for unresolvable linkedCreatureId on encounter participants
    if (entityType === 'encounters') {
      await warnUnresolvableCreatureLinks(reparented);
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

  if (bundleUpdatedAt > localUpdatedAt) {
    // Bundle is newer — update local
    await db.table(tableName).put(reparented);
    report.updated++;
  } else {
    // Bundle is same age or older — keep local
    report.skipped++;
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
