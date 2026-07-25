import { describe, it, expect } from 'vitest';
import { parseBundle } from './bundleParser';

/** A minimal character record that passes characterRecordSchema (rest defaults). */
const validChar = {
  id: 'good-1',
  schemaVersion: 4,
  systemId: 'classic-fantasy',
  name: 'Good',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  attributes: { str: 10 },
  conditions: {},
  resources: {},
  skills: {},
};

/** Same shape but `attributes` is a string — rejected by characterRecordSchema. */
const malformedChar = { ...validChar, id: 'bad-1', name: 'Bad', attributes: 'not-an-object' };

function bundleJson(characters: unknown[]): string {
  return JSON.stringify({
    version: 1,
    type: 'character',
    exportedAt: '2026-01-01T00:00:00.000Z',
    system: 'classic-fantasy',
    contents: { characters },
  });
}

describe('parseBundle — character validation', () => {
  it('keeps a valid character and skips a malformed one with a warning', () => {
    const result = parseBundle(bundleJson([validChar, malformedChar]));
    expect(result.success).toBe(true);
    if (!result.success) return;

    // The malformed record must not enter the imported contents.
    expect(result.bundle.contents.characters).toHaveLength(1);
    expect(result.bundle.contents.characters?.[0].id).toBe('good-1');

    // ...and it must surface as a per-entity warning (index 1), not a hard failure.
    const charWarning = result.warnings.find(w => w.entityType === 'characters');
    expect(charWarning).toBeDefined();
    expect(charWarning?.entityIndex).toBe(1);
  });

  it('imports a valid character with no warnings', () => {
    const result = parseBundle(bundleJson([validChar]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.bundle.contents.characters).toHaveLength(1);
    expect(result.warnings.filter(w => w.entityType === 'characters')).toHaveLength(0);
  });
});
