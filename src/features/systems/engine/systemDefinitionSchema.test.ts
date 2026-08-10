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

  it('rejects a skill in a group the system never declares', () => {
    // Silently dropping the skill out of its group is the failure mode: the
    // "all at 0" action would just skip it, and nobody would notice.
    expect(broken((d: any) => { d.skillCategories[0].skills[0].groupId = 'ghost'; })).toBe(false);
  });

  it('rejects a declared group with no member skills', () => {
    expect(broken((d: any) => { d.skillGroups = [...(d.skillGroups ?? []), { id: 'ghost', name: 'Ghost' }]; })).toBe(false);
  });

  it('rejects a duplicate skill group id', () => {
    expect(broken((d: any) => {
      d.skillGroups = [{ id: 'g', name: 'G' }, { id: 'g', name: 'G again' }];
      d.skillCategories[0].skills[0].groupId = 'g';
    })).toBe(false);
  });

  it('preserves groupId and skillGroups through the parse', () => {
    // Zod strips unknown keys, so a field added to the type but not the schema
    // reaches the engine as undefined — silently, and only for imported systems.
    const traveller: any = BUNDLED_SYSTEMS.find(s => s.id === 'traveller');
    const result = systemDefinitionSchema.safeParse(traveller);
    expect(result.success).toBe(true);
    if (result.success) {
      const gunner = result.data.skillCategories
        .flatMap(c => c.skills)
        .find(s => s.id === 'gunner');
      expect(gunner?.groupId).toBe('gunner');
      expect(result.data.skillGroups?.find(g => g.id === 'gunner')?.name).toBe('Gunner');
    }
  });

  it('preserves routePlanner and every declared field through the parse', () => {
    // Same trap as `groupId` above, and the reason the route planner exists at
    // all: the whole feature is gated on this key surviving. If the schema entry
    // were dropped, bundled Traveller would keep working — it is read straight
    // off the module — while every *imported* system silently lost its route
    // planner, with the screen and its nav link simply never appearing.
    const traveller: any = BUNDLED_SYSTEMS.find(s => s.id === 'traveller');
    const result = systemDefinitionSchema.safeParse(traveller);
    expect(result.success).toBe(true);
    if (result.success) {
      const planner = result.data.routePlanner;
      expect(planner).toBeDefined();
      expect(planner?.fields).toHaveLength(5);
      expect(planner?.fields.map(f => f.id)).toEqual(['name', 'uwp', 'hex', 'jump', 'notes']);
      // The labels are the point: they are the system's vocabulary, and the
      // screen renders whatever it is handed.
      expect(planner?.fields.every(f => f.label.length > 0)).toBe(true);
      expect(planner?.label.length).toBeGreaterThan(0);
      // `distanceFieldId` must name a field that actually exists, or the total
      // silently reads 0 for every stop.
      expect(planner?.fields.map(f => f.id)).toContain(planner?.distanceFieldId);
    }
  });

  it('does not invent a routePlanner for a system that declares none', () => {
    // The absence of this key is what gates the whole feature off for a
    // ruleset, so a schema default here would hand every system a route screen.
    const def: any = BUNDLED_SYSTEMS.find(s => s.id === 'classic-fantasy');
    const result = systemDefinitionSchema.safeParse(def);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.routePlanner).toBeUndefined();
  });

  it('accepts a system that declares no groups at all', () => {
    // Groups are additive; a ruleset without specialities must be unaffected.
    const def: any = JSON.parse(JSON.stringify(BUNDLED_SYSTEMS[0]));
    delete def.skillGroups;
    for (const cat of def.skillCategories) for (const s of cat.skills) delete s.groupId;
    expect(systemDefinitionSchema.safeParse(def).success).toBe(true);
  });

  it('preserves the full label surface, not just the four core keys', () => {
    // Before the schema was widened these keys were silently stripped by Zod,
    // so a system.json override never reached the engine merge.
    const def: any = JSON.parse(JSON.stringify(BUNDLED_SYSTEMS[0]));
    def.labels = {
      ...(def.labels ?? {}),
      participantHealth: 'Vitality',
      storyBankPanel: 'Legends',
      // The creature-template headings, added when ParticipantDrawer stopped
      // hardcoding HP/Armor/Mv. Every new SystemLabels key has to be mirrored
      // here or Zod drops it before the engine merge — that silent strip is
      // exactly what this test exists to catch.
      creatureHealth: 'Vigour',
      creatureArmor: 'Plating',
      creatureMovement: 'Stride',
    };
    const result = systemDefinitionSchema.safeParse(def);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.labels?.participantHealth).toBe('Vitality');
      expect(result.data.labels?.storyBankPanel).toBe('Legends');
      expect(result.data.labels?.creatureHealth).toBe('Vigour');
      expect(result.data.labels?.creatureArmor).toBe('Plating');
      expect(result.data.labels?.creatureMovement).toBe('Stride');
    }
  });

  it('survives a financeFields declaration intact', () => {
    // Zod strips unknown keys, so a field added to the type but not the schema
    // vanishes for imported systems while working for bundled ones.
    const def: any = JSON.parse(JSON.stringify(BUNDLED_SYSTEMS[0]));
    def.financeFields = [
      { id: 'debt', label: 'Debt', unit: 'currency' },
      { id: 'income', label: 'Income', unit: 'currency', per: 'month', group: 'Cash Flow' },
    ];
    const result = systemDefinitionSchema.safeParse(def);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.financeFields).toEqual(def.financeFields);
    }
  });

  it('keeps the reservePot term, which the ledger reads', () => {
    const def: any = JSON.parse(JSON.stringify(BUNDLED_SYSTEMS[0]));
    def.terms = { ...(def.terms ?? {}), reservePot: 'Guild tithe' };
    const result = systemDefinitionSchema.safeParse(def);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.terms?.reservePot).toBe('Guild tithe');
  });

  it('rejects a panel key the app cannot render', () => {
    // A typo'd panel is otherwise a screen that silently never appears.
    expect(broken((d: any) => { d.panels = ['skills', 'invnetory']; })).toBe(false);
    expect(broken((d: any) => { d.panels = ['skills', 'inventory']; })).toBe(true);
  });

  it('rejects money with no unit worth 1', () => {
    // Everything is counted in base units; without one, totals decompose
    // against a scale nothing else shares.
    expect(broken((d: any) => {
      d.currency = { denominations: [{ id: 'slab', label: 'Slab', abbr: 'sl', value: 20 }] };
    })).toBe(false);
  });

  it('rejects a base denomination that is missing, or is not the unit', () => {
    const denominations = [
      { id: 'slab', label: 'Slab', abbr: 'sl', value: 20 },
      { id: 'bit', label: 'Bit', abbr: 'b', value: 1 },
    ];
    expect(broken((d: any) => { d.currency = { denominations, baseDenominationId: 'ghost' }; })).toBe(false);
    expect(broken((d: any) => { d.currency = { denominations, baseDenominationId: 'slab' }; })).toBe(false);
    expect(broken((d: any) => { d.currency = { denominations, baseDenominationId: 'bit' }; })).toBe(true);
  });

  it('rejects a base denomination named without the denominations', () => {
    // It would point into the adapter's list, which the schema cannot see — so
    // a wrong id could not be caught, and would mislabel every amount.
    expect(broken((d: any) => { d.currency = { baseDenominationId: 'copper' }; })).toBe(false);
    expect(broken((d: any) => { d.currency = { label: 'Purse' }; })).toBe(true);
  });

  it('rejects duplicate denomination ids', () => {
    expect(broken((d: any) => {
      d.currency = {
        denominations: [
          { id: 'bit', label: 'Bit', abbr: 'b', value: 1 },
          { id: 'bit', label: 'Bit again', abbr: 'b2', value: 5 },
        ],
      };
    })).toBe(false);
  });

  it('still declares every finance line the Traveller sheet used to hardcode', () => {
    // These six were literals in SheetScreen and again in PrintableSheet.
    // Dropping one from system.json now blanks it on both surfaces at once,
    // with nothing else to notice.
    const traveller = BUNDLED_SYSTEMS.find(s => s.id === 'traveller');
    expect(traveller).toBeDefined();
    expect((traveller?.financeFields ?? []).map(f => f.id)).toEqual([
      'shipShares',
      'debt',
      'income',
      'livingCost',
      'annualPension',
      'shipPayments',
    ]);
  });
});
