import * as characterRepository from '../../storage/repositories/characterRepository';
import { createBlankCharacter } from './characterMappers';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';

export function useCharacterActions() {
  const { clearCharacter, character: activeCharacter } = useActiveCharacter();

  async function createCharacter() {
    const newChar = createBlankCharacter('dragonbane');
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
    await characterRepository.remove(id);
  }

  return { createCharacter, duplicateCharacter, deleteCharacter };
}
