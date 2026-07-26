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

  it('imports a non-Dragonbane bundle (system id is free-form, not a fixed literal)', () => {
    // Regression: the envelope schema previously pinned `system` to
    // `z.literal('classic-fantasy')`, which rejected every Traveller / Savage
    // Worlds character bundle at import. It is a free-form system id now.
    const travellerChar = { ...validChar, id: 'milo-1', name: 'Milo Aer', systemId: 'traveller' };
    const json = JSON.stringify({
      version: 1,
      type: 'character',
      exportedAt: '2026-01-01T00:00:00.000Z',
      system: 'traveller',
      contents: { characters: [travellerChar] },
    });
    const result = parseBundle(json);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.bundle.system).toBe('traveller');
    expect(result.bundle.contents.characters?.[0].id).toBe('milo-1');
  });

  it('imports a valid character with no warnings', () => {
    const result = parseBundle(bundleJson([validChar]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.bundle.contents.characters).toHaveLength(1);
    expect(result.warnings.filter(w => w.entityType === 'characters')).toHaveLength(0);
  });

  it('preserves fields the schema does not enumerate (no silent strip on import)', () => {
    // portraitUri and uiState sheet-layout keys aren't in characterRecordSchema;
    // validation must NOT drop them (that would reset a portrait / card layout).
    const rich = {
      ...validChar,
      portraitUri: 'data:image/png;base64,AAAA',
      uiState: { expandedSections: [], sheetCardOrder: ['identity', 'attributes'], pinnedSkills: ['gunCombat'] },
    };
    const result = parseBundle(bundleJson([rich]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    const imported = result.bundle.contents.characters?.[0] as Record<string, unknown>;
    expect(imported.portraitUri).toBe('data:image/png;base64,AAAA');
    expect((imported.uiState as Record<string, unknown>).sheetCardOrder).toEqual(['identity', 'attributes']);
    expect((imported.uiState as Record<string, unknown>).pinnedSkills).toEqual(['gunCombat']);
  });
});
