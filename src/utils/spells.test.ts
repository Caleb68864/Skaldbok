import { describe, it, expect } from 'vitest';
import { isMagicTrick, getSpellRank } from './spells';
import { classicFantasyEngine } from '../features/systems/engine/classicFantasyEngine';
import type { Spell } from '../types/character';

/**
 * A trick used to be detected as `school.toLowerCase().includes('trick')` in
 * three separate places — a naming convention in the bundled content, treated
 * as a rule. The schools that count are the system's to declare.
 */
function spell(school: string, powerLevel = 1): Spell {
  return { id: 's1', name: 'Test', school, powerLevel, range: '', duration: '', summary: '' } as unknown as Spell;
}

describe('isMagicTrick', () => {
  it('treats an explicit power level of 0 as a trick in any system', () => {
    // The genuinely general half of the rule.
    expect(isMagicTrick(spell('Animism', 0), [])).toBe(true);
    expect(isMagicTrick(spell('Anything', 0))).toBe(true);
  });

  it('matches a school the system declares as a trick school', () => {
    const schools = classicFantasyEngine.magic!.trickSchools;
    expect(schools, 'classic-fantasy should declare its trick schools').toBeDefined();
    expect(isMagicTrick(spell('Magic Tricks'), schools)).toBe(true);
  });

  it('does not treat an ordinary school as a trick', () => {
    expect(isMagicTrick(spell('Elementalism'), classicFantasyEngine.magic!.trickSchools)).toBe(false);
  });

  it('ignores the word "trick" when the system does not declare it', () => {
    // A system whose schools happen to contain the word no longer gets trick
    // handling by accident.
    expect(isMagicTrick(spell('Trickster Magic'), ['cantrip'])).toBe(false);
    expect(isMagicTrick(spell('Cantrips'), ['cantrip'])).toBe(true);
  });

  it('falls back to the old substring test when no list is given', () => {
    // User-authored data that never named its trick schools still classifies.
    expect(isMagicTrick(spell('Magic Tricks'))).toBe(true);
  });

  it('is case-insensitive on both sides', () => {
    expect(isMagicTrick(spell('MAGIC TRICKS'), ['Magic Tricks'])).toBe(true);
  });
});

describe('getSpellRank', () => {
  it('ranks a power-level-0 spell as 0', () => {
    expect(getSpellRank(spell('Animism', 0))).toBe(0);
  });

  it('falls back to the power level when no rank is set', () => {
    expect(getSpellRank(spell('Elementalism', 2))).toBe(2);
  });
});
