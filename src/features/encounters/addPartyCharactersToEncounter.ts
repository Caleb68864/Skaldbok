import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import * as encounterRepository from '../../storage/repositories/encounterRepository';
import type { CharacterRecord } from '../../types/character';

/**
 * Adds linked party characters to an encounter, skipping PCs already present.
 *
 * @remarks
 * This used to open `db.transaction('rw', [db.encounters, db.entityLinks], …)`
 * by hand, read the encounter and write straight into it — **without checking
 * `deletedAt`**, so adding the party to a soft-deleted encounter succeeded and
 * put every PC somewhere no screen lists and no Trash entry reaches. Proved
 * directly: the whole party landed in a tombstoned encounter and the function
 * reported the number added.
 *
 * The transaction, the tombstone refusal, the `represents` edges and the PC
 * deduplication now all live in
 * {@link encounterRepository.addRepresentedParticipants}, which three other
 * screens reach through as well. What is left here is the part that is actually
 * this file's own: resolving character ids to records.
 *
 * @param encounterId - Encounter to add to.
 * @param characterIds - Character ids to add; unresolvable ones are skipped.
 * @returns Number of newly-added participants. `0` if the encounter is
 * soft-deleted, if no id resolved, or if every character was already present.
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

  const added = await encounterRepository.addRepresentedParticipants(
    encounterId,
    characters.map((character) => ({
      name: character.name,
      type: 'pc' as const,
      represents: { id: character.id, type: 'character' as const },
    })),
  );
  return added.length;
}
