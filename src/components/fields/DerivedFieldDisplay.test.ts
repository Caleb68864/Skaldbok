import { describe, it, expect } from 'vitest';
import { splitDerivedValues, commitOverrideValue } from './DerivedFieldDisplay';

describe('splitDerivedValues', () => {
  it('edits the computed value when no override and no modifier', () => {
    const { stored, shown, isModified } = splitDerivedValues(10, undefined, null);
    expect(stored).toBe(10);
    expect(shown).toBe(10);
    expect(isModified).toBe(false);
  });

  it('shows the buffed value but still edits the computed one', () => {
    // The regression: seeding the input from `shown` while Hasted persists the
    // buff into derivedOverrides on the next blur.
    const { stored, shown, isModified } = splitDerivedValues(10, 14, null);
    expect(stored).toBe(10);
    expect(shown).toBe(14);
    expect(isModified).toBe(true);
  });

  it('edits the override, not the computed value, when one is set', () => {
    const { stored, shown } = splitDerivedValues(10, undefined, 12);
    expect(stored).toBe(12);
    expect(shown).toBe(12);
  });

  it('shows the buff on top of an override and still edits the override', () => {
    const { stored, shown, isModified } = splitDerivedValues(10, 16, 12);
    expect(stored).toBe(12);
    expect(shown).toBe(16);
    expect(isModified).toBe(true);
  });

  it('treats a modifier that nets to zero as unmodified', () => {
    const { shown, isModified } = splitDerivedValues(10, 10, null);
    expect(shown).toBe(10);
    expect(isModified).toBe(false);
  });

  it('passes a non-numeric derived value through', () => {
    const { stored, shown } = splitDerivedValues('+D4', undefined, null);
    expect(stored).toBe('+D4');
    expect(shown).toBe('+D4');
  });
});

describe('commitOverrideValue', () => {
  it('writes a genuinely changed value', () => {
    expect(commitOverrideValue('14', 10)).toBe(14);
  });

  it('does not write when the seed is committed unchanged', () => {
    // Tap the field, tap away: no override should appear.
    expect(commitOverrideValue('10', 10)).toBeNull();
  });

  it('does not write a blank field', () => {
    // Number('') === 0, and an override of 0 disables the stat.
    expect(commitOverrideValue('', 10)).toBeNull();
    expect(commitOverrideValue('   ', 10)).toBeNull();
  });

  it('does not write a non-numeric entry', () => {
    expect(commitOverrideValue('fast', 10)).toBeNull();
    expect(commitOverrideValue('Infinity', 10)).toBeNull();
  });

  it('writes an explicit zero, which is not the seed', () => {
    expect(commitOverrideValue('0', 10)).toBe(0);
  });

  it('compares against a string seed numerically', () => {
    expect(commitOverrideValue('10', '10')).toBeNull();
  });
});
