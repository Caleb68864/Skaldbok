import * as characterRepository from '../../storage/repositories/characterRepository';
import { createBlankCharacter } from './characterMappers';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { db } from '../../storage/db/client';

export function useCharacterActions() {
  const { clearCharacter, character: activeCharacter } = useActiveCharacter();

  async function createCharacter(name?: string) {
    const newChar = createBlankCharacter('dragonbane');
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
      clearCharacter();
    }
    await db.partyMembers.where('linkedCharacterId').equals(id).delete();
    await characterRepository.remove(id);
  }

  return { createCharacter, duplicateCharacter, deleteCharacter };
}
