import type { CharacterRecord } from '../types/character';

/**
 * Returns true if the character currently has any metal equipment equipped.
 * Checks equipped weapons, armor, and helmet for `metal === true`.
 * Only considers items that are currently equipped (`equipped === true`).
 * Treats `metal: undefined` as false for backward compatibility.
 */
export function isMetalEquipped(character: CharacterRecord): boolean {
  const weaponMetal =
    character.weapons?.filter((w) => w.equipped).some((w) => w.metal === true) ?? false;

  const armorMetal =
    character.armor !== null &&
    character.armor !== undefined &&
    character.armor.equipped === true &&
    character.armor.metal === true;

  const helmetMetal =
    character.helmet !== null &&
    character.helmet !== undefined &&
    character.helmet.equipped === true &&
    character.helmet.metal === true;

  return weaponMetal || armorMetal || helmetMetal;
}
