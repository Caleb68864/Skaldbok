import { describe, expect, it } from 'vitest';
import type { CharacterRecord } from '../../types/character';
import type { InventoryContainer } from '../../types/inventoryContainer';
import { inferTravellerGearCategory, reviewTravellerGear } from './gearRestrictions';

const character = (overrides: Partial<CharacterRecord> = {}) => ({
  name: 'Milo', weapons: [], armor: null, helmet: null, inventory: [], tinyItems: [], ...overrides,
}) as CharacterRecord;

describe('Traveller party gear review', () => {
  it('recognizes clear weapon, armour, explosive, and contraband names', () => {
    expect(inferTravellerGearCategory('Laser Pistol', 'weapon')).toBe('energyWeapon');
    expect(inferTravellerGearCategory('Cloth Armour', 'armour')).toBe('clothArmour');
    expect(inferTravellerGearCategory('Frag Grenade')).toBe('explosive');
    expect(inferTravellerGearCategory('Frag grenades')).toBe('explosive');
    expect(inferTravellerGearCategory('Combat drugs')).toBe('drugs');
    expect(inferTravellerGearCategory('Data pad')).toBe('computer');
    expect(inferTravellerGearCategory('Rope')).toBeNull();
  });

  it('uses declared classes ahead of name matches and includes party containers', () => {
    const hero = character({
      weapons: [{ name: 'Custom sidearm', restrictionClass: 'energyWeapon' } as CharacterRecord['weapons'][number]],
      armor: { name: 'Traveller coat', restrictionClass: 'clothArmour' } as CharacterRecord['armor'],
      inventory: [{ name: 'Frag grenade', quantity: 2 } as CharacterRecord['inventory'][number]],
    });
    const locker = { name: 'Ship locker', items: [{ name: 'Stunner', quantity: 1 }] } as InventoryContainer;
    const findings = reviewTravellerGear([hero], [locker], 4, 0);
    expect(findings.map(value => [value.owner, value.item, value.action])).toEqual([
      ['Milo', 'Custom sidearm', 'leave aboard'],
      ['Milo', 'Traveller coat', 'leave aboard'],
      ['Milo', 'Frag grenade', 'leave aboard'],
    ]);
  });

  it('flags government contraband for review and keeps unknown weapons visible', () => {
    const hero = character({
      weapons: [{ name: 'Odd weapon' } as CharacterRecord['weapons'][number]],
      inventory: [{ name: 'Combat drugs', quantity: 1 }, { name: 'Rope', quantity: 1 }] as CharacterRecord['inventory'],
    });
    const findings = reviewTravellerGear([hero], [], 0, 2);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ item: 'Odd weapon', action: 'ask GM' }),
      expect.objectContaining({ item: 'Combat drugs', action: 'ask GM' }),
    ]));
    expect(findings.some(value => value.item === 'Rope')).toBe(false);
  });

  it('does not treat shotgun or stunner as a generic firearm', () => {
    const hero = character({ weapons: [
      { name: 'Shotgun' }, { name: 'Stunner' }, { name: 'Rifle' },
    ] as CharacterRecord['weapons'] });
    expect(reviewTravellerGear([hero], [], 6, 0).map(value => value.item)).toEqual(['Rifle']);
    expect(reviewTravellerGear([hero], [], 8, 0).map(value => value.item)).toEqual(['Shotgun', 'Stunner', 'Rifle']);
  });

  it.each([
    ['battleDress', 1], ['energyWeapon', 2], ['flakArmour', 3], ['clothArmour', 4],
    ['meshArmour', 5], ['firearm', 6], ['shotgun', 7], ['blade', 8], ['otherWeapon', 9],
  ])('%s becomes restricted at Law %i', (restrictionClass, threshold) => {
    const hero = character({ inventory: [{ name: 'Declared item', restrictionClass, quantity: 1 }] as CharacterRecord['inventory'] });
    expect(reviewTravellerGear([hero], [], threshold - 1, 0).some(value => value.action === 'leave aboard')).toBe(false);
    expect(reviewTravellerGear([hero], [], threshold, 0)).toEqual([
      expect.objectContaining({ item: 'Declared item', action: 'leave aboard' }),
    ]);
  });
});
