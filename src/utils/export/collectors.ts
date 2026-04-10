import type { BundleContents } from '../../types/bundle';
import type { CharacterRecord } from '../../types/character';
import type { CreatureTemplate } from '../../types/creatureTemplate';
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

    return {
      success: true,
      contents: {
        characters: [character as unknown as Record<string, unknown>],
        notes,
        entityLinks: allLinks,
        attachments: attachments.map(toBundleAttachment),
      },
    };
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

    return {
      success: true,
      contents: {
        sessions: [session],
        notes,
        encounters,
        creatureTemplates,
        parties,
        partyMembers,
        characters: characters.map((c) => c as unknown as Record<string, unknown>),
        entityLinks,
        attachments: attachments.map(toBundleAttachment),
      },
    };
  } catch (err) {
    console.error('[collectors] collectSessionBundle error', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Collects all entities belonging to a campaign export scope.
 *
 * Includes: everything — campaign, all sessions, all parties/members,
 * all notes, all characters, all creature templates, all encounters,
 * all entity links, and all attachments.
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

    return {
      success: true,
      contents: {
        campaign,
        sessions,
        notes,
        creatureTemplates,
        encounters,
        parties,
        partyMembers,
        characters: characters.map((c) => c as unknown as Record<string, unknown>),
        entityLinks,
        attachments: attachments.map(toBundleAttachment),
      },
    };
  } catch (err) {
    console.error('[collectors] collectCampaignBundle error', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Strips the Blob field from a storage attachment, producing the
 * bundle-safe shape (matching `attachmentBundleSchema`). The actual
 * Blob→base64 conversion happens later in the bundle serializer.
 */
function toBundleAttachment(a: Attachment): Omit<Attachment, 'blob'> {
  const { blob: _blob, ...rest } = a;
  return rest;
}
