import { describe, it, expect } from 'vitest';
import {
  resolveSkillCategories,
  removeCustomSkill,
  isCustomSkill,
  isSkillNameAvailable,
  ORPHAN_CUSTOM_CATEGORY_ID,
} from './customSkills';
import type { CharacterRecord, CustomSkillDefinition } from '../../types/character';
import type { SystemDefinition } from '../../types/system';

const system = {
  id: 'traveller',
  skillCategories: [
    {
      id: 'knowledge',
      name: 'Knowledge & Trade',
      skills: [
        { id: 'language', name: 'Language (Galanglic)', baseChance: 0, linkedAttributeId: 'edu', groupId: 'language' },
      ],
    },
    { id: 'social', name: 'Social', skills: [{ id: 'admin', name: 'Admin', baseChance: 0 }] },
  ],
} as unknown as SystemDefinition;

const zhodani: CustomSkillDefinition = {
  id: 'custom-1',
  name: 'Language (Zhodani)',
  categoryId: 'knowledge',
  linkedAttributeId: 'edu',
  groupId: 'language',
};

function character(customSkills: CustomSkillDefinition[] = [], skills: CharacterRecord['skills'] = {}) {
  return { customSkills, skills } as CharacterRecord;
}

describe('resolveSkillCategories', () => {
  it('appends a custom skill after the declared ones in its category', () => {
    const out = resolveSkillCategories(system, character([zhodani]));
    // The book's order must not be disturbed by a player addition.
    expect(out[0].skills.map(s => s.id)).toEqual(['language', 'custom-1']);
  });

  it('carries the linked attribute and group through, so it rolls like a real skill', () => {
    const merged = resolveSkillCategories(system, character([zhodani]))[0].skills[1];
    expect(merged.linkedAttributeId).toBe('edu');
    expect(merged.groupId).toBe('language');
  });

  it('drops categoryId from the merged definition', () => {
    // Leaving it on invites a consumer to branch on "is this custom?", which is
    // what merging exists to prevent.
    expect(resolveSkillCategories(system, character([zhodani]))[0].skills[1]).not.toHaveProperty('categoryId');
  });

  it('leaves categories without custom skills untouched', () => {
    const out = resolveSkillCategories(system, character([zhodani]));
    expect(out[1]).toBe(system.skillCategories[1]);
  });

  it('returns the system array itself when there are no custom skills', () => {
    // The common case must not allocate.
    expect(resolveSkillCategories(system, character())).toBe(system.skillCategories);
    expect(resolveSkillCategories(system, null)).toBe(system.skillCategories);
  });

  it('files a skill whose category no longer exists into a trailing Custom group', () => {
    // A skill the user cannot see is one they cannot delete either.
    const orphan = { ...zhodani, categoryId: 'deleted-category' };
    const out = resolveSkillCategories(system, character([orphan]));
    expect(out).toHaveLength(3);
    expect(out[2].id).toBe(ORPHAN_CUSTOM_CATEGORY_ID);
    expect(out[2].skills.map(s => s.id)).toEqual(['custom-1']);
  });

  it('adds no Custom category when every skill is filed correctly', () => {
    expect(resolveSkillCategories(system, character([zhodani]))).toHaveLength(2);
  });

  it('does not mutate the system definition', () => {
    resolveSkillCategories(system, character([zhodani]));
    expect(system.skillCategories[0].skills).toHaveLength(1);
  });

  it('survives a null system', () => {
    expect(resolveSkillCategories(null, character([zhodani]))).toEqual([
      { id: ORPHAN_CUSTOM_CATEGORY_ID, name: 'Custom', skills: [expect.objectContaining({ id: 'custom-1' })] },
    ]);
  });
});

describe('isCustomSkill', () => {
  it('distinguishes authored skills from declared ones', () => {
    const c = character([zhodani]);
    expect(isCustomSkill(c, 'custom-1')).toBe(true);
    expect(isCustomSkill(c, 'language')).toBe(false);
  });
});

describe('removeCustomSkill', () => {
  it('removes the definition and the stored value together', () => {
    // Leaving the value orphans it under an id no category declares - exactly
    // the invisible state this feature exists to end.
    const c = character([zhodani], { 'custom-1': { value: 2, trained: true }, language: { value: 1, trained: true } });
    const patch = removeCustomSkill(c, 'custom-1');
    expect(patch.customSkills).toEqual([]);
    expect(patch.skills).not.toHaveProperty('custom-1');
  });

  it('preserves unrelated skill values', () => {
    const c = character([zhodani], { 'custom-1': { value: 2, trained: true }, language: { value: 1, trained: true } });
    expect(removeCustomSkill(c, 'custom-1').skills.language).toEqual({ value: 1, trained: true });
  });

  it('does not mutate the character it was given', () => {
    const c = character([zhodani], { 'custom-1': { value: 2, trained: true } });
    removeCustomSkill(c, 'custom-1');
    expect(c.skills).toHaveProperty('custom-1');
    expect(c.customSkills).toHaveLength(1);
  });
});

describe('isSkillNameAvailable', () => {
  it('rejects a name a declared skill already uses', () => {
    expect(isSkillNameAvailable(system, character(), 'Language (Galanglic)')).toBe(false);
  });

  it('rejects a name another custom skill already uses', () => {
    expect(isSkillNameAvailable(system, character([zhodani]), 'Language (Zhodani)')).toBe(false);
  });

  it('compares case- and whitespace-insensitively', () => {
    // Two rows reading the same thing under different ids is a trap: the player
    // edits one and the other silently keeps its old value.
    expect(isSkillNameAvailable(system, character(), '  language (galanglic)  ')).toBe(false);
  });

  it('accepts a genuinely new name', () => {
    expect(isSkillNameAvailable(system, character([zhodani]), 'Language (Vilani)')).toBe(true);
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(isSkillNameAvailable(system, character(), '')).toBe(false);
    expect(isSkillNameAvailable(system, character(), '   ')).toBe(false);
  });
});

describe('a custom skill resolves like a declared one', () => {
  /**
   * @remarks
   * Regression: `SkillsScreen.cycleSkillMark` looked the definition up in
   * `system.skillCategories` rather than the merged list, so a player-authored
   * skill returned `undefined` and its fallback was computed from
   * `baseChance: 0` with no linked attribute. Silent, and only reachable by
   * marking a custom skill in a roll-under system.
   *
   * The general rule this pins: anything that needs a skill *definition* must
   * go through `resolveSkillCategories`, because the character's own skills
   * exist nowhere else.
   */
  it('is found by an id lookup over the merged categories', () => {
    const merged = resolveSkillCategories(system, character([zhodani]));
    const found = merged.flatMap(c => c.skills).find(s => s.id === 'custom-1');
    expect(found).toBeDefined();
    expect(found?.linkedAttributeId).toBe('edu');
  });

  it('is NOT found by the same lookup over the system alone', () => {
    // Pins why the merge is required rather than incidental.
    const found = system.skillCategories.flatMap(c => c.skills).find(s => s.id === 'custom-1');
    expect(found).toBeUndefined();
  });
});
