import type { BundleContents } from '../../types/bundle';
import type { CharacterRecord } from '../../types/character';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import { closeBundleReferences } from './referentialClosure';
import type { Note } from '../../types/note';
import type { Attachment } from '../../types/attachment';
import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import { getCampaignById } from '../../storage/repositories/campaignRepository';
import { getSessionById, getSessionsByCampaign } from '../../storage/repositories/sessionRepository';
import { getNoteById, getNotesBySession, getNotesByCampaign } from '../../storage/repositories/noteRepository';
import { getAllLinksFrom, getAllLinksTo } from '../../storage/repositories/entityLinkRepository';
import { getPartyByCampaign, getPartyMembers } from '../../storage/repositories/partyRepository';
import { getAttachmentsByNote } from '../../storage/repositories/attachmentRepository';
import { getById as getCreatureTemplateById, listByCampaign as listCreatureTemplatesByCampaign } from '../../storage/repositories/creatureTemplateRepository';
import { listBySession as listEncountersBySession, listByCampaign as listEncountersByCampaign } from '../../storage/repositories/encounterRepository';
import { list as listInventoryContainersByCampaign } from '../../storage/repositories/inventoryContainerRepository';
import { listByCampaign as listShipsByCampaign } from '../../storage/repositories/shipRepository';
import { listByCampaign as listLedgerEntriesByCampaign } from '../../storage/repositories/ledgerRepository';
import { listByCampaign as listLedgerAccountsByCampaign } from '../../storage/repositories/ledgerAccountRepository';
import { listByCampaign as listLedgerSplitsByCampaign } from '../../storage/repositories/ledgerSplitRepository';
import { listByCampaign as listRecurringBillsByCampaign } from '../../storage/repositories/recurringBillRepository';
import { listByCampaign as listRouteStopsByCampaign } from '../../storage/repositories/routeRepository';
import { listByCampaign as listRoutePlansByCampaign } from '../../storage/repositories/routePlanRepository';
import { getNodesByCampaign as listKBNodesByCampaign } from '../../storage/repositories/kbNodeRepository';
import { getEdgesByCampaign as listKBEdgesByCampaign } from '../../storage/repositories/kbEdgeRepository';
import { getAll as getAllReferenceSections, getGroups as getAllReferenceGroups } from '../../storage/repositories/referenceSectionRepository';
import { getById as getSystemById } from '../../storage/repositories/systemRepository';

/**
 * Result of a scope collection operation.
 */
export type CollectorResult =
  | { success: true; contents: BundleContents }
  | { success: false; error: string; partialContents?: Partial<BundleContents> };

/**
 * Collects all entity links for a given entity ID (both directions, all relationship types).
 */
async function getAllLinksForEntity(entityId: string): Promise<import('../../types/entityLink').EntityLink[]> {
  const [fromLinks, toLinks] = await Promise.all([
    getAllLinksFrom(entityId),
    getAllLinksTo(entityId),
  ]);
  // Deduplicate by id
  const map = new Map<string, import('../../types/entityLink').EntityLink>();
  for (const link of fromLinks) {
    map.set(link.id, link);
  }
  for (const link of toLinks) {
    map.set(link.id, link);
  }
  return [...map.values()];
}

/**
 * Loads characters that entity links point at but collection missed.
 *
 * @remarks
 * Collectors gather characters only through party membership, while links are
 * gathered as "every edge touching a collected entity". An encounter
 * participant `represents`-ing a character who is not in the party therefore
 * produced an edge with no matching row, and `closeBundleReferences` pruned it —
 * the relationship survived export only to be dropped on the way out.
 *
 * Pulling the endpoint in is the better answer where it is cheap, which it is
 * for characters: the id is right there on the edge. Closure stays as the
 * backstop for endpoints that genuinely cannot travel (a cross-campaign or
 * soft-deleted target).
 *
 * @param links - Edges collected for the bundle.
 * @param existing - Characters already collected.
 * @returns `existing` plus any character an edge referenced that was missing.
 */
async function withLinkedCharacters(
  links: Array<{ fromEntityType?: string; fromEntityId?: string; toEntityType?: string; toEntityId?: string }>,
  existing: CharacterRecord[],
): Promise<CharacterRecord[]> {
  const have = new Set(existing.map((c) => c.id));
  const wanted = new Set<string>();
  for (const link of links) {
    if (link.fromEntityType === 'character' && link.fromEntityId && !have.has(link.fromEntityId)) {
      wanted.add(link.fromEntityId);
    }
    if (link.toEntityType === 'character' && link.toEntityId && !have.has(link.toEntityId)) {
      wanted.add(link.toEntityId);
    }
  }
  if (wanted.size === 0) return existing;
  const loaded = (
    await Promise.all([...wanted].map((id) => getCharacterById(id)))
  ).filter((c): c is CharacterRecord => c !== undefined);
  return [...existing, ...loaded];
}

/**
 * Collects all entities belonging to a character export scope.
 *
 * Includes: character record, notes linked via entity links (from OR to),
 * those notes' entity links, and attachments for those notes.
 *
 * @param characterId - The ID of the character to export.
 */
export async function collectCharacterBundle(characterId: string): Promise<CollectorResult> {
  try {
    // 1. Load character record
    const character = await getCharacterById(characterId);
    if (!character) return { success: false, error: `Character not found: ${characterId}` };

    // 2. Load entity links for this character (both directions)
    const allLinks = await getAllLinksForEntity(characterId);

    // 3. Collect note IDs from entity links
    const noteIds = new Set<string>();
    for (const link of allLinks) {
      if (link.fromEntityType === 'note') noteIds.add(link.fromEntityId);
      if (link.toEntityType === 'note') noteIds.add(link.toEntityId);
    }

    // 4. Load notes
    const notes = (
      await Promise.all([...noteIds].map((id) => getNoteById(id)))
    ).filter((n): n is Note => n !== undefined);

    // 5. Load attachments for those notes
    const attachments = (
      await Promise.all([...noteIds].map((id) => getAttachmentsByNote(id)))
    ).flat();

    const assembled = {
        characters: [character as unknown as Record<string, unknown>],
        notes,
        entityLinks: allLinks,
        attachments: attachments.map(toBundleAttachment),
      };
    const closed = closeBundleReferences(assembled as unknown as BundleContents);
    if (closed.droppedLinks > 0) {
      console.warn(
        `[collectors] dropped ${closed.droppedLinks} entity link(s) whose endpoints are not in the bundle; `
        + `they would have been rejected on import. Missing: ${closed.missingEndpoints.join(', ')}`,
      );
    }
    return { success: true, contents: closed.contents };
  } catch (err) {
    console.error('[collectors] collectCharacterBundle error', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Collects all entities belonging to a session export scope.
 *
 * Includes: session, notes (by sessionId), active party + party members,
 * linked characters, encounters (by sessionId), creature templates referenced
 * by encounter participants, entity links, and attachments.
 *
 * @param sessionId - The ID of the session to export.
 */
export async function collectSessionBundle(sessionId: string): Promise<CollectorResult> {
  try {
    // 1. Load session
    const session = await getSessionById(sessionId);
    if (!session) return { success: false, error: `Session not found: ${sessionId}` };

    // 2. Load notes by sessionId
    const notes = await getNotesBySession(sessionId);
    const noteIds = notes.map((n) => n.id);

    // 3. Load encounters by sessionId
    const encounters = await listEncountersBySession(sessionId);

    // 4. Load creature templates referenced by encounter participants.
    // Walk each participant's outgoing `represents` edges to find the
    // associated creature template ids, then batch-load the templates.
    const participantIds = encounters.flatMap((e) =>
      e.participants.map((p) => p.id),
    );
    const representsLinkLists = await Promise.all(
      participantIds.map((id) => getAllLinksFrom(id)),
    );
    const creatureIds = new Set<string>();
    for (const links of representsLinkLists) {
      for (const link of links) {
        if (link.relationshipType === 'represents' && link.toEntityType === 'creature') {
          creatureIds.add(link.toEntityId);
        }
      }
    }
    const creatureTemplates = (
      await Promise.all([...creatureIds].map((id) => getCreatureTemplateById(id)))
    ).filter((t): t is CreatureTemplate => t !== undefined);

    // 5. Load party for campaign (no listBySession — use getPartyByCampaign)
    const party = await getPartyByCampaign(session.campaignId);
    const parties = party ? [party] : [];
    const partyMembers = party ? await getPartyMembers(party.id) : [];

    // 6. Load characters linked to party members
    const characterIds = new Set(
      partyMembers
        .map((pm) => pm.linkedCharacterId)
        .filter((id): id is string => id !== undefined)
    );
    const characters = (
      await Promise.all([...characterIds].map((id) => getCharacterById(id)))
    ).filter((c): c is CharacterRecord => c !== undefined);

    // 7. Load entity links for notes + encounters
    const entityIds = [...noteIds, ...encounters.map((e) => e.id)];
    const entityLinksNested = await Promise.all(
      entityIds.map((id) => getAllLinksForEntity(id))
    );
    const entityLinkMap = new Map<string, import('../../types/entityLink').EntityLink>();
    for (const links of entityLinksNested) {
      for (const link of links) {
        entityLinkMap.set(link.id, link);
      }
    }
    const entityLinks = [...entityLinkMap.values()];

    // 8. Load attachments for notes
    const attachments = (
      await Promise.all(noteIds.map((id) => getAttachmentsByNote(id)))
    ).flat();

    // 9. Load inventory containers for the campaign — they belong to the
    //    party, not the session, but a session export should bring the
    //    party's shared loot, pack animals, etc. along with it.
    const inventoryContainers = await listInventoryContainersByCampaign(session.campaignId);

    const assembled = {
        sessions: [session],
        notes,
        encounters,
        creatureTemplates,
        parties,
        partyMembers,
        characters: (await withLinkedCharacters(entityLinks, characters))
          .map((c) => c as unknown as Record<string, unknown>),
        entityLinks,
        attachments: attachments.map(toBundleAttachment),
        inventoryContainers: inventoryContainers as unknown as BundleContents['inventoryContainers'],
      };
    const closed = closeBundleReferences(assembled as unknown as BundleContents);
    if (closed.droppedLinks > 0) {
      console.warn(
        `[collectors] dropped ${closed.droppedLinks} entity link(s) whose endpoints are not in the bundle; `
        + `they would have been rejected on import. Missing: ${closed.missingEndpoints.join(', ')}`,
      );
    }
    return { success: true, contents: closed.contents };
  } catch (err) {
    console.error('[collectors] collectSessionBundle error', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Collects all entities belonging to a campaign export scope.
 *
 * @remarks
 * This is the app's backup: the settings screen calls a campaign export "the
 * only copy that survives this device", so the standard for this function is
 * every table, not every table someone remembered. The mapping it has to satisfy
 * is `BUNDLE_TABLE_BY_KEY` in `types/bundleTables.ts`, and `bundleParity.test.ts`
 * seeds one row in each of those tables and fails if any of them does not come
 * back out of here.
 *
 * Three tables are deliberately absent, with reasons recorded in
 * `TABLES_OUTSIDE_BUNDLE`: `appSettings`, `metadata` and the legacy
 * `referenceNotes`.
 *
 * @param campaignId - The ID of the campaign to export.
 */
export async function collectCampaignBundle(campaignId: string): Promise<CollectorResult> {
  try {
    // 1. Campaign
    const campaign = await getCampaignById(campaignId);
    if (!campaign) return { success: false, error: `Campaign not found: ${campaignId}` };

    // 2. All sessions
    const sessions = await getSessionsByCampaign(campaignId);

    // 3. All notes
    const notes = await getNotesByCampaign(campaignId);
    const noteIds = notes.map((n) => n.id);

    // 4. All creature templates
    const creatureTemplates = await listCreatureTemplatesByCampaign(campaignId);

    // 5. All encounters
    const encounters = await listEncountersByCampaign(campaignId);

    // 6. All parties + party members
    const party = await getPartyByCampaign(campaignId);
    const parties = party ? [party] : [];
    const partyMembers = party ? await getPartyMembers(party.id) : [];

    // 7. All characters linked to party members
    const characterIds = new Set(
      partyMembers
        .map((pm) => pm.linkedCharacterId)
        .filter((id): id is string => id !== undefined)
    );
    const characters = (
      await Promise.all([...characterIds].map((id) => getCharacterById(id)))
    ).filter((c): c is CharacterRecord => c !== undefined);

    // 8. All entity links (for notes + encounters)
    const entityIds = [...noteIds, ...encounters.map((e) => e.id)];
    const entityLinksNested = await Promise.all(
      entityIds.map((id) => getAllLinksForEntity(id))
    );
    const entityLinkMap = new Map<string, import('../../types/entityLink').EntityLink>();
    for (const links of entityLinksNested) {
      for (const link of links) {
        entityLinkMap.set(link.id, link);
      }
    }
    const entityLinks = [...entityLinkMap.values()];

    // 9. All attachments
    const attachments = (
      await Promise.all(noteIds.map((id) => getAttachmentsByNote(id)))
    ).flat();

    // 10. All inventory containers (party coffer, pack animals, hirelings).
    const inventoryContainers = await listInventoryContainersByCampaign(campaignId);

    // 11. Everything else the campaign owns. These tables existed for several
    //     releases without ever reaching a bundle, so a "complete" export
    //     silently dropped every ship, the entire ledger, the route plan and
    //     the knowledge-base graph. `bundleParity.test.ts` now walks `db.tables`
    //     against `BUNDLE_TABLE_BY_KEY` so the next table cannot repeat it.
    const [
      ships,
      ledgerAccounts,
      ledgerEntries,
      ledgerSplits,
      recurringBills,
      routeStops,
      routePlans,
      kbNodes,
      kbEdges,
    ] = await Promise.all([
      listShipsByCampaign(campaignId),
      listLedgerAccountsByCampaign(campaignId),
      listLedgerEntriesByCampaign(campaignId),
      listLedgerSplitsByCampaign(campaignId),
      listRecurringBillsByCampaign(campaignId),
      listRouteStopsByCampaign(campaignId),
      listRoutePlansByCampaign(campaignId),
      listKBNodesByCampaign(campaignId),
      listKBEdgesByCampaign(campaignId),
    ]);

    // 12. The reference library. Device-global rather than campaign-scoped, but
    //     a campaign export is the app's only export, so leaving it out means
    //     hand-authored rules content has no backup path at all. Soft-deleted
    //     rows are excluded by default, matching every other collector.
    const [referenceSections, referenceGroups] = await Promise.all([
      getAllReferenceSections(),
      getAllReferenceGroups(),
    ]);

    // 13. The campaign's system definition. A user-authored ruleset lives only
    //     in the local `systems` table; without it a restored campaign points at
    //     a system the importing device has never seen. Bundled systems ship
    //     with the app, so an absent row is simply nothing to carry.
    const systemDefinition = await getSystemById(campaign.system);
    const systems = systemDefinition ? [systemDefinition as unknown as Record<string, unknown>] : [];

    const assembled = {
        campaign,
        systems,
        sessions,
        notes,
        creatureTemplates,
        encounters,
        parties,
        partyMembers,
        characters: (await withLinkedCharacters(entityLinks, characters))
          .map((c) => c as unknown as Record<string, unknown>),
        entityLinks,
        attachments: attachments.map(toBundleAttachment),
        inventoryContainers: inventoryContainers as unknown as BundleContents['inventoryContainers'],
        ships,
        ledgerAccounts,
        ledgerEntries,
        ledgerSplits,
        recurringBills,
        routeStops,
        routePlans,
        referenceGroups,
        referenceSections,
        kbNodes,
        kbEdges,
      };
    const closed = closeBundleReferences(assembled as unknown as BundleContents);
    if (closed.droppedLinks > 0) {
      console.warn(
        `[collectors] dropped ${closed.droppedLinks} entity link(s) whose endpoints are not in the bundle; `
        + `they would have been rejected on import. Missing: ${closed.missingEndpoints.join(', ')}`,
      );
    }
    return { success: true, contents: closed.contents };
  } catch (err) {
    console.error('[collectors] collectCampaignBundle error', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Passes a storage attachment through with its Blob intact.
 *
 * @remarks
 * The bundle serializer (`convertAttachmentsToBase64`) is what turns the Blob
 * into `data`/`encoding`, and it only does so when it finds a Blob on the row.
 * This helper used to strip the Blob first "to match the bundle schema", so
 * every export carried attachment metadata with no payload and the importer
 * rejected each one as "no restorable base64 data". The type is widened rather
 * than narrowed on purpose: the schema shape is reached after serialization,
 * not before.
 */
function toBundleAttachment(a: Attachment): Omit<Attachment, 'blob'> {
  return a as Omit<Attachment, 'blob'>;
}
