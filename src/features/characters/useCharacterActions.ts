import * as characterRepository from '../../storage/repositories/characterRepository';
import { createBlankCharacter } from './characterMappers';
import { DEFAULT_SYSTEM_ID } from '../../systems/registry';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { db } from '../../storage/db/client';
import { flushAll } from '../persistence/autosaveFlush';

/**
 * Character library mutations: create, duplicate, and delete.
 *
 * @remarks
 * Delete flushes pending autosaves before removing the row so an in-flight save can't
 * resurrect the character after deletion — via `clearCharacter` when the target
 * is active (which flushes internally) or an explicit {@link flushAll} otherwise — and
 * also cleans up any party-member rows that linked to the character. Create seeds a
 * blank character for the chosen system; duplicate deep-copies with a fresh id and a
 * "(Copy)" name.
 */
export function useCharacterActions() {
  const { clearCharacter, character: activeCharacter } = useActiveCharacter();

  async function createCharacter(name?: string, systemId: string = DEFAULT_SYSTEM_ID) {
    const newChar = createBlankCharacter(systemId);
    // If a name is provided and non-empty, use it; otherwise keep the blank template default
    if (name && name.trim().length > 0) {
      newChar.name = name.trim();
    }
    await characterRepository.save(newChar);
    return newChar;
  }

  async function duplicateCharacter(id: string) {
    const source = await characterRepository.getById(id);
    if (!source) throw new Error('Character not found');
    const copy = {
      ...source,
      id: generateId(),
      name: source.name + ' (Copy)',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await characterRepository.save(copy);
    return copy;
  }

  async function deleteCharacter(id: string) {
    if (activeCharacter?.id === id) {
      // clearCharacter awaits flushAll internally.
      await clearCharacter();
    } else {
      // Non-active character: still flush so a pending autosave for this
      // character lands before we remove the row.
      await flushAll();
    }
    await db.partyMembers.where('linkedCharacterId').equals(id).delete();
    await characterRepository.remove(id);
  }

  return { createCharacter, duplicateCharacter, deleteCharacter };
}
