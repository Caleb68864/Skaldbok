import { describe, it, expect } from 'vitest';
import { systemDefinitionSchema } from '../../../../schemas/system.schema';
import { BUNDLED_SYSTEMS } from '../../../systems/registry';

/**
 * Guards the bundled system definitions against the schema (they are loaded via
 * a raw cast at runtime, so nothing else parses them), and pins the
 * cross-reference `superRefine` so a future edit with a dangling id or a
 * duplicate is rejected at load with a clear message rather than misbehaving.
 */
describe('systemDefinitionSchema', () => {
  it.each(BUNDLED_SYSTEMS.map(s => [s.displayName, s] as const))(
    'accepts the bundled %s definition',
    (_name, system) => {
      const result = systemDefinitionSchema.safeParse(system);
      if (!result.success) {
        // Surface the exact issue if a bundled def ever drifts.
        throw new Error(result.error.issues.map(i => i.message).join('; '));
      }
      expect(result.success).toBe(true);
    },
  );

  // Deep-clone a real definition, then break one cross-reference at a time.
  const broken = (mutate: (def: Record<string, unknown>) => void) => {
    const def = JSON.parse(JSON.stringify(BUNDLED_SYSTEMS[0]));
    mutate(def);
    return systemDefinitionSchema.safeParse(def).success;
  };

  it('rejects a skill linked to an unknown attribute', () => {
    expect(broken((d: any) => { d.skillCategories[0].skills[0].linkedAttributeId = 'ghost'; })).toBe(false);
  });

  it('rejects a resource derivedFrom an unknown attribute', () => {
    expect(broken((d: any) => { d.resources[0].derivedFrom = 'ghost'; })).toBe(false);
  });

  it('rejects a duplicate attribute id', () => {
    expect(broken((d: any) => { d.attributes.push({ ...d.attributes[0] }); })).toBe(false);
  });

  it('rejects an attribute whose min exceeds max', () => {
    expect(broken((d: any) => { d.attributes[0].min = 999; d.attributes[0].max = 0; })).toBe(false);
  });
});
