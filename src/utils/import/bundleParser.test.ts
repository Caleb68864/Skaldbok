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

describe('parseBundle — non-character entities keep their fields', () => {
  /** A creature carrying system-specific stats no shared schema enumerates. */
  const travellerCreature = {
    id: 'creature-1',
    campaignId: 'camp-1',
    name: 'Vargr Raider',
    category: 'monster' as const,
    stats: { hp: 8, armor: 2, movement: 6 },
    attacks: [],
    abilities: [],
    skills: [],
    tags: [],
    status: 'active' as const,
    schemaVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    // The point of the test: Traveller characteristics and a UWP live outside
    // creatureTemplateSchema's fixed hp/armor/movement triple.
    characteristics: { str: 9, dex: 8, end: 10 },
    uwp: 'B564500-B',
  };

  it('does not strip system stats from a creature template', () => {
    // Only characterRecordSchema has .passthrough(), and the envelope schema
    // nests the contents schema — so parsing the envelope used to discard every
    // unenumerated field on every non-character entity before per-entity
    // validation even ran. A Traveller/SWADE bestiary arrived gutted.
    const json = JSON.stringify({
      version: 1,
      type: 'campaign',
      exportedAt: '2026-01-01T00:00:00.000Z',
      system: 'traveller',
      contents: { creatureTemplates: [travellerCreature] },
    });
    const result = parseBundle(json);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const imported = result.bundle.contents.creatureTemplates?.[0] as Record<string, unknown>;
    expect(imported.characteristics).toEqual({ str: 9, dex: 8, end: 10 });
    expect(imported.uwp).toBe('B564500-B');
  });

  it('still rejects a malformed row rather than passing everything through', () => {
    // Preserving unknown fields must not become "accept anything".
    const json = JSON.stringify({
      version: 1,
      type: 'campaign',
      exportedAt: '2026-01-01T00:00:00.000Z',
      system: 'traveller',
      contents: {
        creatureTemplates: [travellerCreature, { ...travellerCreature, id: 'bad', name: 42 }],
      },
    });
    const result = parseBundle(json);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.bundle.contents.creatureTemplates).toHaveLength(1);
    expect(result.warnings.some(w => w.entityType === 'creatureTemplates')).toBe(true);
  });
});

describe('parseBundle — envelope scope cross-check', () => {
  it('warns when a bundle labelled character carries a campaign', () => {
    // Nothing verified the envelope's `type` against its contents, so a
    // hand-edited or community bundle could merge as the wrong kind entirely.
    const json = JSON.stringify({
      version: 1,
      type: 'character',
      exportedAt: '2026-01-01T00:00:00.000Z',
      system: 'classic-fantasy',
      contents: {
        characters: [validChar],
        campaign: {
          id: 'c1', name: 'Smuggled Campaign', system: 'classic-fantasy',
          status: 'active', schemaVersion: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    });
    const result = parseBundle(json);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.warnings.some(w => w.entityType === 'envelope')).toBe(true);
  });

  it('does not warn when the label matches the contents', () => {
    const result = parseBundle(bundleJson([validChar]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.warnings.some(w => w.entityType === 'envelope')).toBe(false);
  });
});
