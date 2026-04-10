import type { CharacterRecord } from '../../types/character';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import blankTemplate from '../../../sample-data/dragonbane.blank.character.json';

export function createBlankCharacter(systemId: string): CharacterRecord {
  return {
    ...(blankTemplate as CharacterRecord),
    id: generateId(),
    systemId,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}
