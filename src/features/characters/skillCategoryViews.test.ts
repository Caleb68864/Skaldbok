import { describe, it, expect } from 'vitest';
import { buildSkillCategoryViews, countVisibleSkills } from './skillCategoryViews';
import type { CharacterSkill } from '../../types/character';
import type { SkillCategory } from '../../types/system';

/** The Traveller relevance rule: level 0 is a real, trained skill. */
const isRelevant = (skill: CharacterSkill | undefined) => !!skill && (skill.trained || skill.value > 0);

const categories: SkillCategory[] = [
  {
    id: 'combat',
    name: 'Combat',
    skills: [
      { id: 'gunCombat', name: 'Gun Combat (Slug)', baseChance: 0, linkedAttributeId: 'dex' },
      { id: 'gunner', name: 'Gunner (Turret)', baseChance: 0, linkedAttributeId: 'dex' },
      { id: 'melee', name: 'Melee (Blade)', baseChance: 0, linkedAttributeId: 'str' },
    ],
  },
  {
    id: 'science',
    name: 'Science',
    skills: [
      { id: 'scienceBiology', name: 'Science (Biology)', baseChance: 0, linkedAttributeId: 'edu' },
      { id: 'sciencePhysics', name: 'Science (Physics)', baseChance: 0, linkedAttributeId: 'edu' },
    ],
  },
];

function build(overrides: Partial<Parameters<typeof buildSkillCategoryViews>[0]> = {}) {
  return buildSkillCategoryViews({
    categories,
    characterSkills: {},
    isRelevant,
    filter: 'all',
    search: '',
    openOverrides: {},
    ...overrides,
  });
}

describe('buildSkillCategoryViews', () => {
  it('opens a category the character has skills in and collapses the rest', () => {
    const views = build({ characterSkills: { gunner: { value: 1, trained: true } } });
    expect(views.find(v => v.category.id === 'combat')?.open).toBe(true);
    expect(views.find(v => v.category.id === 'science')?.open).toBe(false);
  });

  it('collapses every category for a character with no skills', () => {
    // The whole point: Edit Mode opens as headings, not a 103-row scroll.
    expect(build().every(v => v.open === false)).toBe(true);
  });

  it('never hides a search hit behind a collapsed heading', () => {
    // Science is collapsed by default here — a query must force it open.
    const views = build({ search: 'biology' });
    const science = views.find(v => v.category.id === 'science');
    expect(science?.open).toBe(true);
    expect(science?.skills.map(s => s.id)).toEqual(['scienceBiology']);
  });

  it('drops categories with no matching rows', () => {
    const views = build({ search: 'biology' });
    expect(views.map(v => v.category.id)).toEqual(['science']);
  });

  it('matches skill names case-insensitively and on substrings', () => {
    expect(build({ search: 'TURRET' })[0].skills.map(s => s.id)).toEqual(['gunner']);
  });

  it('ignores surrounding whitespace in the query', () => {
    // A trailing space from a tablet keyboard must not blank the list.
    const padded = build({ search: '  turret  ' });
    expect(padded).toEqual(build({ search: 'turret' }));
    expect(padded[0].skills.map(s => s.id)).toEqual(['gunner']);
  });

  it('treats a whitespace-only query as no query at all', () => {
    expect(build({ search: '   ' })).toEqual(build({ search: '' }));
  });

  it('lets an explicit toggle override the default in both directions', () => {
    const withSkill = { characterSkills: { gunner: { value: 1, trained: true } } };
    // Default-open category, forced closed.
    expect(build({ ...withSkill, openOverrides: { combat: false } })
      .find(v => v.category.id === 'combat')?.open).toBe(false);
    // Default-closed category, forced open.
    expect(build({ ...withSkill, openOverrides: { science: true } })
      .find(v => v.category.id === 'science')?.open).toBe(true);
  });

  it('keeps a user-opened category open while the query narrows it', () => {
    // The override must survive typing, not be recomputed away.
    const views = build({ search: 'science', openOverrides: { science: false } });
    expect(views.find(v => v.category.id === 'science')?.open).toBe(false);
  });

  it('shows only relevant rows under the relevant filter', () => {
    const views = build({
      filter: 'relevant',
      characterSkills: { gunner: { value: 0, trained: true }, melee: { value: 0, trained: false } },
    });
    // Trained at 0 is relevant in Traveller; untrained at 0 is not.
    expect(views.map(v => v.category.id)).toEqual(['combat']);
    expect(views[0].skills.map(s => s.id)).toEqual(['gunner']);
  });

  it('delegates relevance to the supplied predicate rather than reimplementing it', () => {
    const views = build({ filter: 'relevant', isRelevant: () => true });
    expect(countVisibleSkills(views)).toBe(5);
  });
});

describe('countVisibleSkills', () => {
  it('sums rows across categories', () => {
    expect(countVisibleSkills(build())).toBe(5);
  });

  it('is 0 when nothing matches', () => {
    expect(countVisibleSkills(build({ search: 'zhodani' }))).toBe(0);
  });
});
