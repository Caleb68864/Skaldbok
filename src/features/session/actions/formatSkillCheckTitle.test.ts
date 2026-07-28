import { describe, it, expect } from 'vitest';
import {
  formatModTags,
  formatOutcomeTitle,
  parseModsFromTitle,
  readOutcomeTypeData,
} from './formatSkillCheckTitle';

/** Traveller's outcome and modifier vocabulary, as the engine reports it. */
const TRAVELLER_OUTCOMES = [
  { id: 'exceptional-success', label: 'Exceptional Success' },
  { id: 'success', label: 'Success' },
  { id: 'failure', label: 'Failure' },
  { id: 'exceptional-failure', label: 'Exceptional Failure' },
];
const TRAVELLER_MODIFIERS = [
  { id: 'boon', label: 'Boon' },
  { id: 'bane', label: 'Bane' },
];

describe('formatModTags', () => {
  it('resolves labels from the supplied modifier vocabulary', () => {
    expect(formatModTags({ boon: true }, TRAVELLER_MODIFIERS)).toBe(' (Boon)');
  });

  it('follows the vocabulary order, not the object key order', () => {
    const mods = { bane: true, boon: true };
    expect(formatModTags(mods, TRAVELLER_MODIFIERS)).toBe(' (Boon, Bane)');
  });

  it('omits inactive modifiers', () => {
    expect(formatModTags({ boon: false, bane: true }, TRAVELLER_MODIFIERS)).toBe(' (Bane)');
  });

  it('returns an empty string when nothing is active', () => {
    expect(formatModTags({ boon: false }, TRAVELLER_MODIFIERS)).toBe('');
  });

  it('falls back to a readable label for an id the vocabulary does not know', () => {
    // A row logged under a system that has since been edited must still read.
    expect(formatModTags({ 'wild-attack': true }, TRAVELLER_MODIFIERS)).toBe(' (Wild Attack)');
  });

  it('still formats the legacy Dragonbane flags with no vocabulary passed', () => {
    expect(formatModTags({ boon: true, pushed: true })).toBe(' (Boon, Pushed)');
  });
});

describe('formatOutcomeTitle', () => {
  it('prints the outcome label, not the stored id', () => {
    const title = formatOutcomeTitle(
      { actor: 'Rasa', subject: 'Gun Combat', result: 'exceptional-success' },
      { outcomes: TRAVELLER_OUTCOMES },
    );
    expect(title).toBe('Rasa: Gun Combat — Exceptional Success');
  });

  it('includes resolved modifier tags', () => {
    const title = formatOutcomeTitle(
      { actor: 'Rasa', subject: 'Gun Combat', result: 'success', mods: { boon: true } },
      { outcomes: TRAVELLER_OUTCOMES, rollModifiers: TRAVELLER_MODIFIERS },
    );
    expect(title).toBe('Rasa: Gun Combat (Boon) — Success');
  });

  it('falls back to a readable form when the outcome is not in the vocabulary', () => {
    const title = formatOutcomeTitle(
      { actor: 'Rasa', subject: 'Gun Combat', result: 'critical-failure' },
      { outcomes: TRAVELLER_OUTCOMES },
    );
    expect(title).toBe('Rasa: Gun Combat — Critical Failure');
  });

  it('names an actorless entry rather than printing an empty prefix', () => {
    expect(formatOutcomeTitle({ actor: '', subject: 'Astrogation', result: 'success' }))
      .toContain('Unknown');
  });
});

describe('readOutcomeTypeData', () => {
  it('preserves an outcome id outside the legacy four', () => {
    // The drawer must not silently downgrade a Traveller result on open.
    const data = readOutcomeTypeData(
      { subject: 'Gun Combat', actor: 'Rasa', result: 'exceptional-success' },
      'fallback title',
    );
    expect(data.result).toBe('exceptional-success');
  });

  it('reads the legacy skill/character field names', () => {
    const data = readOutcomeTypeData({ skill: 'Sneaking', character: 'Eira', result: 'success' }, '');
    expect(data.subject).toBe('Sneaking');
    expect(data.actor).toBe('Eira');
  });
});

describe('parseModsFromTitle', () => {
  it('recovers flags from a pre-structural title', () => {
    expect(parseModsFromTitle('Eira: Sneaking (Boon, Pushed) — success')).toMatchObject({
      boon: true,
      pushed: true,
    });
  });

  it('returns no active flags when the title has no parenthetical', () => {
    const mods = parseModsFromTitle('Eira: Sneaking — success');
    expect(Object.values(mods).some(Boolean)).toBe(false);
  });
});
