import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';
import { db } from '../../storage/db/client';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import type { CharacterRecord } from '../../types/character';
import type { EncounterParticipant } from '../../types/encounter';

/**
 * Adds linked party characters to an encounter, skipping PCs already present.
 *
 * @returns number of newly-added participants
 */
export async function addPartyCharactersToEncounter(
  encounterId: string,
  characterIds: string[],
): Promise<number> {
  if (characterIds.length === 0) return 0;

  const characters = (
    await Promise.all(characterIds.map((id) => getCharacterById(id)))
  ).filter((character): character is CharacterRecord => character !== undefined);

  if (characters.length === 0) return 0;

  const now = nowISO();
  let addedCount = 0;

  await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
    const enc = await db.encounters.get(encounterId);
    if (!enc) throw new Error(`encounter ${encounterId} not found`);

    const participantIds = new Set((enc.participants ?? []).map((p) => p.id));
    const existingLinks = await db.entityLinks.toArray();
    const existingCharacterIds = new Set(
      existingLinks
        .filter((link) =>
          !link.deletedAt
          && link.relationshipType === 'represents'
          && link.toEntityType === 'character'
          && participantIds.has(link.fromEntityId),
        )
        .map((link) => link.toEntityId),
    );

    let updatedParticipants = [...(enc.participants ?? [])];

    for (const character of characters) {
      if (existingCharacterIds.has(character.id)) continue;

      const participantId = generateId();
      const newParticipant: EncounterParticipant = {
        id: participantId,
        name: character.name,
        type: 'pc',
        instanceState: {},
        sortOrder: updatedParticipants.length + 1,
      };

      updatedParticipants.push(newParticipant);

      await entityLinkRepository.createLink({
        fromEntityId: participantId,
        fromEntityType: 'encounterParticipant',
        toEntityId: character.id,
        toEntityType: 'character',
        relationshipType: 'represents',
      });

      existingCharacterIds.add(character.id);
      addedCount += 1;
    }

    if (addedCount > 0) {
      await db.encounters.update(encounterId, {
        participants: updatedParticipants,
        updatedAt: now,
      });
    }
  });

  return addedCount;
}
