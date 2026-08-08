import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { systemDefinitionSchema } from '../../../schemas/system.schema';
import { BUNDLED_SYSTEMS } from '../../systems/registry';
import { WEAPON_BUILT_IN_FIELD_IDS, ARMOR_BUILT_IN_FIELD_IDS } from '../../types/system';

/**
 * `itemFields.hiddenBuiltIns` is matched with `!hiddenBuiltIns.includes(id)`,
 * which fails *open*: an id nothing checks silently shows the field, and a
 * mistyped id silently shows it too. Neither is a type error and neither
 * produces a warning, so both sides need pinning.
 */

/** Every file that decides whether a built-in item field renders. */
const CONSUMERS = [
  'src/components/fields/WeaponCard.tsx',
  'src/components/fields/WeaponEditor.tsx',
  'src/screens/GearScreen.tsx',
];

const consumerSource = CONSUMERS.map(f => readFileSync(f, 'utf8')).join('\n');

describe('hiddenBuiltIns: schema side', () => {
  it('rejects a weapon id that is not a real built-in', () => {
    const def = JSON.parse(JSON.stringify(BUNDLED_SYSTEMS[0]));
    def.itemFields = { hiddenBuiltIns: { weapon: ['durabilty'] } };
    const result = systemDefinitionSchema.safeParse(def);
    expect(result.success, 'a typo in hiddenBuiltIns must not validate').toBe(false);
  });

  it('rejects an armour id that is not a real built-in', () => {
    const def = JSON.parse(JSON.stringify(BUNDLED_SYSTEMS[0]));
    def.itemFields = { hiddenBuiltIns: { armor: ['bodypart'] } };
    expect(systemDefinitionSchema.safeParse(def).success).toBe(false);
  });

  it('accepts every declared built-in id', () => {
    const def = JSON.parse(JSON.stringify(BUNDLED_SYSTEMS[0]));
    def.itemFields = {
      hiddenBuiltIns: {
        weapon: [...WEAPON_BUILT_IN_FIELD_IDS],
        armor: [...ARMOR_BUILT_IN_FIELD_IDS],
      },
    };
    const result = systemDefinitionSchema.safeParse(def);
    expect(result.success, JSON.stringify(result.success ? '' : result.error.issues)).toBe(true);
  });

  it('every bundled system already validates', () => {
    for (const system of BUNDLED_SYSTEMS) {
      expect(systemDefinitionSchema.safeParse(system).success, `${system.id} does not validate`).toBe(true);
    }
  });
});

describe('hiddenBuiltIns: consumer side', () => {
  it.each([...ARMOR_BUILT_IN_FIELD_IDS])(
    'armour built-in "%s" is actually checked before rendering',
    id => {
      // Armour `weight` was advertised as hideable and never checked, so a
      // system that declared it hidden still got the field.
      expect(
        consumerSource.includes(`showsArmorField('${id}')`),
        `hiddenBuiltIns.armor accepts "${id}" but no consumer guards it — ` +
          `hiding it would silently do nothing`,
      ).toBe(true);
    },
  );

  it.each([...WEAPON_BUILT_IN_FIELD_IDS])(
    'weapon built-in "%s" is actually checked before rendering',
    id => {
      // WeaponEditor guards name/range/damage/features through a filtered
      // array, so accept either the direct call or that filter's field list.
      const guarded =
        consumerSource.includes(`shows('${id}')`) ||
        consumerSource.includes(`'${id}', 'text'`) ||
        new RegExp(`\\['[^']*', '${id}',`).test(consumerSource);
      expect(
        guarded,
        `hiddenBuiltIns.weapon accepts "${id}" but no consumer guards it — ` +
          `hiding it would silently do nothing`,
      ).toBe(true);
    },
  );
});
