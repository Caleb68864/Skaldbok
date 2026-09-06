import { describe, it, expect } from 'vitest';
import { BUNDLED_SYSTEMS } from '../../systems/registry';
import { getEngine } from './engine';
import { systemDefinitionSchema } from '../../../schemas/system.schema';

/**
 * Sheet panels a ruleset adds are declared in its own `system.json`.
 *
 * @remarks
 * Traveller's Careers and Augments and Savage Worlds' Edges and Hindrances were
 * ~175 lines of JSX inside `SheetScreen`, keyed off panel ids, with their column
 * layouts as module constants beside them. The declaration replaces them; these
 * tests pin the two ways it could silently do nothing.
 */

describe('declared sheet panels', () => {
  it.each(BUNDLED_SYSTEMS.map(s => [s.displayName, s] as const))(
    '%s: every declared panel is one the system actually shows',
    (_name, system) => {
      // A panel declared under a key absent from `panels` renders nowhere: the
      // sheet filters by that list. The declaration would look complete and do
      // nothing, which is the failure this codebase keeps finding.
      const engine = getEngine(system);
      for (const panel of system.sheetPanels ?? []) {
        expect(
          engine.panels,
          `${system.id}: declares a "${panel.id}" panel but does not list it in panels`,
        ).toContain(panel.id);
      }
    },
  );

  it.each(BUNDLED_SYSTEMS.map(s => [s.displayName, s] as const))(
    '%s: survives schema validation with its panels intact',
    (_name, system) => {
      // Zod strips unknown keys, so a field on the type but not in the schema
      // vanishes for an *imported* system while working for a bundled one.
      const parsed = systemDefinitionSchema.parse(system);
      expect(parsed.sheetPanels?.length ?? 0).toBe(system.sheetPanels?.length ?? 0);
    },
  );

  it('Traveller declares the career and augment panels it used to hardcode', () => {
    const traveller = BUNDLED_SYSTEMS.find(s => s.id === 'traveller')!;
    const ids = (traveller.sheetPanels ?? []).map(p => p.id);
    expect(ids).toContain('careers');
    expect(ids).toContain('augments');

    const careers = traveller.sheetPanels!.find(p => p.id === 'careers')!;
    const keys = careers.sections.map(s => s.key);
    // The keys are what the hand-written panel bound to, so a character
    // recorded before this change still reads back.
    expect(keys).toEqual([
      'careerTerms',
      'decorations',
      'training',
      'allies',
      'contacts',
      'rivals',
      'enemies',
      'careers',
    ]);
  });

  it('Savage Worlds declares Edges and Hindrances as single text blocks', () => {
    const savage = BUNDLED_SYSTEMS.find(s => s.id === 'savage-worlds')!;
    for (const id of ['edges', 'hindrances']) {
      const panel = savage.sheetPanels!.find(p => p.id === id);
      expect(panel, `savage-worlds should declare a "${id}" panel`).toBeDefined();
      expect(panel!.sections).toHaveLength(1);
      expect(panel!.sections[0].kind).toBe('text');
      // No label: these render as one unlabelled box, as they did before.
      expect((panel!.sections[0] as { label?: string }).label).toBeUndefined();
    }
  });

  it('classic-fantasy declares none, and is unaffected', () => {
    const classic = BUNDLED_SYSTEMS.find(s => s.id === 'classic-fantasy')!;
    expect(classic.sheetPanels ?? []).toEqual([]);
  });

  it('every row section names at least one column', () => {
    for (const system of BUNDLED_SYSTEMS) {
      for (const panel of system.sheetPanels ?? []) {
        for (const section of panel.sections) {
          if (section.kind !== 'rows') continue;
          expect(
            section.columns.length,
            `${system.id}/${panel.id}/${section.key} has no columns`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
