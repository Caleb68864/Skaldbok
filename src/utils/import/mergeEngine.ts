import { db } from '../../storage/db/client';
import type { BundleEnvelope, BundleContents } from '../../types/bundle';
import { getById as getCreatureTemplateById } from '../../storage/repositories/creatureTemplateRepository';
import { getSessionById } from '../../storage/repositories/sessionRepository';
import { getCampaignById } from '../../storage/repositories/campaignRepository';
import { getPartyByCampaign, getPartyById, getPartyMembers } from '../../storage/repositories/partyRepository';
import { importablePortraitUri } from './portraitUri';
import { BUNDLE_PROCESSING_ORDER, BUNDLE_TABLE_BY_KEY } from '../../types/bundleTables';

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
 *
 * @remarks
 * Both this and the table mapping used to be maintained here by hand, and were
 * one of the four copies of the same list that let the campaign export omit six
 * tables. They now come from the single registry in `types/bundleTables.ts`.
 */
const PROCESSING_ORDER = BUNDLE_PROCESSING_ORDER;

/** Maps entity type keys to their Dexie table names. */
const TABLE_NAMES = BUNDLE_TABLE_BY_KEY;

/**
 * Maps an entityLink endpoint TYPE (the free-string `fromEntityType`/
 * `toEntityType`) to the Dexie table that backs it, for existence checks.
 *
 * @remarks
 * `encounterParticipant` is intentionally absent: participants live inside an
 * encounter's embedded `participants` array, not a table of their own, so a
 * `represents` edge's participant endpoint can't be verified this way and is
 * left unchecked (it lives and dies with its encounter row anyway).
 */
const LINK_ENDPOINT_TABLES: Record<string, string> = {
  campaign: 'campaigns',
  session: 'sessions',
  party: 'parties',
  partyMember: 'partyMembers',
  character: 'characters',
  creature: 'creatureTemplates',
  encounter: 'encounters',
  note: 'notes',
  inventoryContainer: 'inventoryContainers',
};

/**
 * Returns a description of the first table-backed endpoint an entityLink points
 * at that does NOT exist (in the DB, including rows imported earlier in this
 * same transaction), or `null` when both resolvable endpoints are present.
 * Unmappable endpoint types (encounterParticipant) are skipped, not rejected.
 */
async function danglingLinkEndpoint(link: Record<string, unknown>): Promise<string | null> {
  const endpoints: Array<[idKey: string, typeKey: string]> = [
    ['fromEntityId', 'fromEntityType'],
    ['toEntityId', 'toEntityType'],
  ];
  for (const [idKey, typeKey] of endpoints) {
    const type = link[typeKey] as string | undefined;
    const entityId = link[idKey] as string | undefined;
    if (!type || !entityId) continue;
    // An own-property check, not plain indexing: `type` comes from the imported file, and
    // `"constructor"` would otherwise resolve to a function that `db.table`
    // then throws on. It failed safe only because the throw was caught.
    const table = Object.prototype.hasOwnProperty.call(LINK_ENDPOINT_TABLES, type) ? LINK_ENDPOINT_TABLES[type] : undefined;
    if (!table) continue; // unverifiable endpoint type — don't reject on it
    const exists = await db.table(table).get(entityId);
    // A tombstone counts as missing: a live edge must not point at a deleted row.
    if (!exists || exists.deletedAt) return `${type} "${entityId}"`;
  }
  return null;
}

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
    // Read before the transaction, through the repository: which sessions the
    // imported notes may keep pointing at. Inside the `try` so a failed read is
    // reported like any other, keeping the never-throws contract.
    const sessionsPresent = options.targetCampaignId
      ? await sessionsAfterImport(bundle.contents, options)
      : new Set<string>();
    const partyFold = options.targetCampaignId
      ? await partyFoldFor(bundle.contents, options.targetCampaignId)
      : null;

    // One transaction over every table the merge writes: a catastrophic mid-loop
    // failure (quota exceeded, tab closed, DB error) now rolls the WHOLE import
    // back instead of leaving entities without their relationship edges. Bad
    // individual entities (e.g. an unrestorable attachment) are still collected
    // as per-entity errors and skipped so one bad row doesn't abort the import;
    // only DB-fatal errors are re-thrown to trigger the rollback.
    // The table list is derived from the registry rather than written out, so a
    // newly-exported table cannot arrive in a bundle that the transaction has no
    // lock on — Dexie throws `NotFoundError` on the first write to an unlisted
    // table, which `isFatalMergeError` would not have recognised.
    await db.transaction(
      'rw',
      BUNDLE_PROCESSING_ORDER.map((key) => db.table(BUNDLE_TABLE_BY_KEY[key])),
      async () => {
        for (const entityType of PROCESSING_ORDER) {
          if (!options.selectedEntityTypes.has(entityType)) continue;

          const entities = getEntities(bundle.contents, entityType);
          if (!entities || entities.length === 0) continue;

          for (const entity of entities) {
            try {
              await mergeEntity(entity, entityType, options, report, encountersToCheck, sessionsPresent, partyFold);
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
    // The transaction aborted and rolled back — nothing was committed, so every
    // running tally is void, `skipped` included. Leaving `skipped` standing is
    // how "Import completed with N error(s). Imported 0 new, updated 0, skipped
    // 12." reached the screen after a restore that restored nothing.
    report.inserted = 0;
    report.updated = 0;
    report.skipped = 0;
    // First, not last. `useImportActions` renders `errors.slice(0, 3)` and puts
    // the rest behind "(+N more in the console)", so with three or more prior
    // per-entity errors the one sentence saying nothing was restored was the one
    // the user could not see.
    report.errors.unshift({ entityType: 'unknown', entityId: 'unknown', message: `Import rolled back: ${String(err)}` });
    return report;
  }

  // Post-commit, non-transactional: warn about participants whose linked
  // creature template didn't come through.
  for (const enc of encountersToCheck) {
    // Advisory only, and run after the import committed: a failed read here
    // must not turn a finished import into a reported failure.
    await warnUnresolvableCreatureLinks(enc).catch((e) => console.warn('[mergeEngine] creature link check failed', e));
  }

  return report;
}

/**
 * Whether a thrown error is a DB-fatal failure that should roll the whole import
 * back (vs a per-entity data error that's logged and skipped). Quota/closed/
 * aborted DB conditions are fatal; a malformed single row (e.g. bad base64 in an
 * attachment → InvalidCharacterError) is not.
 *
 * @remarks
 * The **whole chain** is examined, not just the top-level error. This read
 * `err.name` off the outermost error only, which works today for the accidental
 * reason that `mergeEngine` makes raw `db.*` calls: a quota failure arrives as
 * `QuotaExceededError` itself. `CLAUDE.md` says this layer should be calling
 * repositories, and every repository write re-throws as
 * `new Error("Failed to …", { cause: err })` — a plain `Error` whose `name` is
 * `'Error'`. One wrapping layer was therefore enough to make a full disk read
 * as a per-row problem, so the import "finished", the rollback never fired, and
 * a fresh install was left holding half a campaign with nothing to fall back
 * on. The 130 `{ cause: … }` sites `4083893` added exist for exactly this
 * question and, until now, nothing in production read one.
 *
 * A chain deeper than {@link MAX_CAUSE_DEPTH} is treated as **fatal**, not as
 * safe. It is a shape this classifier cannot reason about, and on the restore
 * path the two wrong answers are not symmetrical: aborting an import the user
 * can retry costs a retry, while continuing past a fatal failure leaves a
 * device holding a partial campaign it cannot recover from. A cycle in the
 * chain is different — every distinct link has been examined by the time one
 * repeats, so that is a real answer rather than a give-up.
 */
function isFatalMergeError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (current === null || current === undefined) return false;
    // Every distinct link already examined; the chain just loops.
    if (seen.has(current)) return false;
    seen.add(current);
    // Dexie never assigns the name 'DexieError' to a thrown error — concrete
    // failures carry their own names — so the old check let a closed or
    // mis-versioned database read as a per-row problem and the import
    // "finished".
    const name = (current as { name?: string }).name ?? '';
    if (FATAL_MERGE_ERROR_NAMES.has(name)) return true;
    if (typeof current !== 'object') return false;
    current = (current as { cause?: unknown }).cause;
  }
  return true;
}

/**
 * How many `cause` links deep to look before giving up.
 *
 * @remarks
 * Generous: the deepest chain this codebase can produce is repository wrapper →
 * Dexie error, and a refactor adding two more layers should still be classified
 * rather than assumed. Giving up resolves to *fatal* — see
 * {@link isFatalMergeError}.
 */
const MAX_CAUSE_DEPTH = 16;

/** Error names that mean the database itself is unusable, not one row. */
const FATAL_MERGE_ERROR_NAMES = new Set([
  'QuotaExceededError',
  'AbortError',
  'DatabaseClosedError',
  'VersionError',
  'OpenFailedError',
  'UpgradeError',
  'InvalidStateError',
  'MissingAPIError',
  'UnknownError',
  'TransactionInactiveError',
]);

/**
 * Merges a single entity into IndexedDB using dedup rules.
 */
async function mergeEntity(
  entity: Record<string, unknown>,
  entityType: keyof BundleContents,
  options: MergeOptions,
  report: MergeReport,
  encountersToCheck: Record<string, unknown>[],
  sessionsPresent: Set<string>,
  partyFold: PartyFold | null,
): Promise<void> {
  const id = entity.id as string;
  if (!id) {
    report.errors.push({ entityType, entityId: 'no-id', message: 'Entity missing id field' });
    return;
  }

  // A bundle's party is folded into the campaign's own party rather than
  // inserted beside it. See `partyFoldFor`.
  if (partyFold && entityType === 'parties' && partyFold.remap.has(id)) {
    report.skipped++;
    return;
  }
  if (partyFold && entityType === 'partyMembers') {
    const from = entity.partyId;
    if (typeof from === 'string' && partyFold.remap.has(from)) {
      const linked = entity.linkedCharacterId;
      if (typeof linked === 'string' && partyFold.seatedCharacters.has(linked)) {
        // Already seated in the campaign's party: a second seat would list the
        // character twice. Nothing local is changed.
        report.skipped++;
        return;
      }
      entity = { ...entity, partyId: partyFold.remap.get(from) };
      if (typeof linked === 'string') partyFold.seatedCharacters.add(linked);
    }
  }

  // Apply re-parenting, then force the row LIVE. Exports ship live data only
  // (soft-deleted rows are skipped), so any deletedAt/softDeletedBy on an
  // imported row is spurious — a hand-edited or hostile bundle carrying a
  // tombstone must not overwrite a live local row (it would vanish from the UI)
  // nor import as an invisible tombstone that still claims the id.
  const reparented = { ...applyReparenting(entity, entityType, options.targetCampaignId, sessionsPresent) } as Record<string, unknown>;
  delete reparented.deletedAt;
  delete reparented.softDeletedBy;
  if (entityType === 'characters' && 'portraitUri' in reparented) {
    // Inline images only — see importablePortraitUri.
    reparented.portraitUri = importablePortraitUri(reparented.portraitUri);
  }

  // Skip an entityLink whose endpoints didn't make it into the DB — importing it
  // would create a dangling edge. This catches both the "user deselected the
  // note/character type but kept entityLinks" case and the "an endpoint entity
  // was stripped as schema-invalid" case. entityLinks are processed last, so
  // valid endpoints (imported earlier in this transaction, or already local)
  // are visible to the lookup.
  if (entityType === 'entityLinks') {
    const missing = await danglingLinkEndpoint(reparented);
    if (missing) {
      report.errors.push({ entityType, entityId: id, message: `Edge references missing ${missing}; skipped to avoid a dangling link` });
      return;
    }
  }

  // The same for a photo whose note is not here: an attachment is reached only
  // through `getAttachmentsByNote`, so one without a live note can never be
  // shown, restored or removed, and only takes up space. This happens when
  // Notes is unticked and Attachments is not, or when the note was dropped as
  // schema-invalid. A photo that is kept takes its note's campaign, which is
  // where the Trash looks for it.
  if (entityType === 'attachments') {
    const noteId = reparented.noteId;
    const note = typeof noteId === 'string' ? await db.notes.get(noteId) : undefined;
    if (!note || note.deletedAt) {
      report.errors.push({ entityType, entityId: id, message: `Photo belongs to note "${String(noteId)}", which is not on this device; skipped` });
      return;
    }
    reparented.campaignId = note.campaignId;
  }

  // H8: a portrait belongs to its character, and is reached only through it.
  if (entityType === 'portraits') {
    const characterId = reparented.characterId;
    const character = typeof characterId === 'string' ? await db.characters.get(characterId) : undefined;
    if (!character || character.deletedAt) {
      report.errors.push({ entityType, entityId: id, message: `Portrait belongs to character "${String(characterId)}", which is not on this device; skipped` });
      return;
    }
  }

  // Look up existing entity in IndexedDB
  const tableName = TABLE_NAMES[entityType];
  if (!tableName) {
    report.errors.push({ entityType, entityId: id, message: `Unknown table for ${entityType}` });
    return;
  }

  const existing = await db.table(tableName).get(id) as Record<string, unknown> | undefined;

  if (!existing) {
    // For attachments: restore base64 data back to Blob before inserting.
    const toInsert = entityType === 'attachments' || entityType === 'portraits' ? restoreAttachmentBlob(reparented) : reparented;
    if (!toInsert) {
      report.errors.push({ entityType, entityId: id, message: 'Attachment has no restorable image payload (missing, oversized, or not an image); skipped' });
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

  // A system definition carries neither `createdAt` nor `updatedAt` — it is
  // versioned by its own integer `version`, the same counter `useSystemDefinition`
  // gates its IndexedDB cache on. Sent down the timestamp path below, every
  // re-import of an already-installed ruleset would be reported as an id
  // collision. Overwrite only on a strictly higher version, matching the cache.
  if (entityType === 'systems') {
    const bundleVersion = reparented.version;
    const localVersion = existing.version;
    if (typeof bundleVersion === 'number' && typeof localVersion === 'number' && bundleVersion > localVersion) {
      await db.table(tableName).put(reparented);
      report.updated++;
      console.info(`[merge] update ${entityType} ${id}`);
    } else {
      report.skipped++;
      console.info(`[merge] skip ${entityType} ${id}`);
    }
    return;
  }

  // Id-collision guard: the same id already exists locally. Distinguish a newer
  // version of the SAME entity from an id COLLISION (a hand-edited/community
  // bundle reusing an id that locally belongs to something else) by createdAt —
  // it's immutable, so a rename/edit keeps it while two genuinely-different
  // entities were created at different times. Same-id + different-createdAt =
  // collision → keep the local row and report it rather than overwrite unrelated
  // data. (A rename keeps createdAt, so legitimate updates are unaffected.)
  //
  // A missing `createdAt` on either side is a collision too, not a pass. The
  // guard used to require *both* to be present and to differ, so a bundle row
  // with no `createdAt` and a far-future `updatedAt` sailed through it and
  // overwrote the local row — the one shape an attacker or a careless
  // hand-edited bundle would actually have.
  const bundleCreated = reparented.createdAt as string | undefined;
  const localCreated = existing.createdAt as string | undefined;
  if (bundleCreated === undefined || localCreated === undefined || bundleCreated !== localCreated) {
    report.errors.push({
      entityType,
      entityId: id,
      message: `Id "${id}" already belongs to a different local ${String(entityType)} (created ${localCreated ?? 'unknown'}, bundle's created ${bundleCreated ?? 'unknown'}); kept local to avoid overwriting unrelated data`,
    });
    return;
  }

  // A tombstoned local row is a collision as well. `existing` is read straight
  // from the table, so a soft-deleted row is visible here; overwriting one
  // resurrects a record the user deleted, under whatever content the bundle
  // carries, with no trace that it had been deleted.
  if (existing.deletedAt) {
    report.errors.push({
      entityType,
      entityId: id,
      message: `Id "${id}" belongs to a deleted local ${String(entityType)}; kept the deletion rather than resurrecting it from the bundle`,
    });
    return;
  }

  // Dedup rules based on updatedAt
  // Attachments gained `updatedAt` on 2026-11-21 (a caption edit is a change);
  // a row written before that has only `createdAt`, which is when it last
  // changed. Without this, an edited caption never crossed an import.
  const fallback = entityType === 'attachments' ? 'createdAt' : null;
  const bundleUpdatedAt = (entity.updatedAt ?? (fallback ? entity[fallback] : undefined)) as string | undefined;
  const localUpdatedAt = (existing.updatedAt ?? (fallback ? existing[fallback] : undefined)) as string | undefined;

  // Neither side carries a timestamp: the same id with nothing to compare. Kept
  // as a skip rather than one error per row.
  if (!bundleUpdatedAt && !localUpdatedAt) {
    report.skipped++;
    return;
  }

  if (!bundleUpdatedAt || !localUpdatedAt) {
    // Can't compare — surface it instead of silently dropping the entity, since
    // a would-be-newer import that happens to lack updatedAt otherwise vanishes
    // with only an aggregate "skipped" count.
    report.errors.push({
      entityType,
      entityId: id,
      message: `Could not compare timestamps for ${String(entityType)} "${id}" (missing updatedAt); kept the local copy`,
    });
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
    const toUpdate = entityType === 'attachments' || entityType === 'portraits' ? restoreAttachmentBlob(reparented) : reparented;
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
  entityType: keyof BundleContents,
  targetCampaignId: string | undefined,
  sessionsPresent: Set<string>,
): Record<string, unknown> {
  if (!targetCampaignId) return entity;

  const result = { ...entity };

  // Set campaignId on all entities that have it
  if ('campaignId' in result) {
    result.campaignId = targetCampaignId;
  }

  // Clear a note's sessionId when that session will not exist after the
  // import. This used to ask only whether the session was in the *bundle*, so
  // with Sessions unticked the notes kept pointing at a session that was never
  // written and every session-scoped read missed them. An encounter keeps its
  // id: `encounterSchema` requires one, and clearing it made the row fail
  // validation on every read; it stays reachable from the campaign.
  if ('sessionId' in result && result.sessionId && entityType !== 'encounters') {
    if (!sessionsPresent.has(result.sessionId as string)) {
      result.sessionId = undefined;
    }
  }

  return result;
}

/** How an import into a chosen campaign folds the bundle's party into the campaign's. */
interface PartyFold {
  /** Bundle party id → the target campaign's party id. */
  remap: Map<string, string>;
  /** Characters already seated in the target party (grows as members are folded in). */
  seatedCharacters: Set<string>;
}

/**
 * Works out how the bundle's parties fold into the target campaign's party.
 *
 * @remarks
 * **Decided by agent 2026-11-21 (owner may revisit).** A session or notes
 * bundle imported into an existing campaign, or into one just created in the
 * import dialog (which makes its own party), carried its own `parties` row
 * with a different id. That was inserted as a second live party; its members
 * kept pointing at it, and `CampaignContext` only ever shows the campaign's
 * active party, so the import reported the members inserted and the party
 * drawer showed none of them.
 *
 * Now, when the target campaign already has a party, a bundle party that is
 * not already on this device is not inserted: its members join the
 * campaign's party (preferring `activePartyId`), and a member whose character
 * already has a seat there is skipped. Non-destructive: nothing local is
 * changed or removed, and a bundle party already on the device (a re-import of
 * the same backup) is merged as before. A campaign with no party keeps the old
 * behaviour, so the bundle's party becomes its party.
 */
async function partyFoldFor(contents: BundleContents, targetCampaignId: string): Promise<PartyFold | null> {
  const bundleParties = (contents.parties ?? []) as Array<{ id?: unknown }>;
  if (bundleParties.length === 0) return null;
  const campaign = await getCampaignById(targetCampaignId);
  const target = await getPartyByCampaign(targetCampaignId, { preferPartyId: campaign?.activePartyId });
  if (!target) return null;
  const remap = new Map<string, string>();
  for (const party of bundleParties) {
    if (typeof party.id !== 'string' || party.id === target.id) continue;
    if (await getPartyById(party.id)) continue; // already here: merge as before
    remap.set(party.id, target.id);
  }
  if (remap.size === 0) return null;
  const seated = new Set(
    (await getPartyMembers(target.id))
      .map((m) => m.linkedCharacterId)
      .filter((cid): cid is string => typeof cid === 'string'),
  );
  return { remap, seatedCharacters: seated };
}

/**
 * The session ids imported rows may point at once this import is done.
 *
 * @remarks
 * A session counts when it is in the bundle **and** Sessions is selected, or
 * when it is already live on the device.
 */
async function sessionsAfterImport(contents: BundleContents, options: MergeOptions): Promise<Set<string>> {
  const present = new Set<string>();
  if (options.selectedEntityTypes.has('sessions')) {
    for (const s of contents.sessions ?? []) present.add(s.id);
  }
  const referenced = new Set<string>();
  for (const key of ['notes', 'encounters'] as const) {
    for (const row of (contents[key] ?? []) as Array<{ sessionId?: unknown }>) {
      if (typeof row.sessionId === 'string' && !present.has(row.sessionId)) referenced.add(row.sessionId);
    }
  }
  for (const id of referenced) {
    if (await getSessionById(id)) present.add(id);
  }
  return present;
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
  // The bundle's declared mime type and size are untrusted. Attachments are
  // images (the repository re-encodes everything it stores through a canvas),
  // so anything else is refused, and the payload is capped before decoding
  // rather than after.
  const mimeType = entity.mimeType;
  if (typeof mimeType !== 'string' || !ALLOWED_ATTACHMENT_MIME.has(mimeType)) return null;
  if (data.length > MAX_ATTACHMENT_BASE64_LENGTH) return null;
  let binary: string;
  try {
    binary = atob(data);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const { data: _data, encoding: _enc, ...rest } = entity;
  return { ...rest, blob, sizeBytes: bytes.length };
}

/** Image types the attachment store produces; a bundle claiming anything else is refused. */
const ALLOWED_ATTACHMENT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** 10 MiB of decoded image, as base64 length (4/3 expansion). */
const MAX_ATTACHMENT_BASE64_LENGTH = Math.ceil((10 * 1024 * 1024) * 4 / 3);

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
