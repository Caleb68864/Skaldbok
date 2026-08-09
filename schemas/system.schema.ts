import { z } from 'zod';
import { WEAPON_BUILT_IN_FIELD_IDS, ARMOR_BUILT_IN_FIELD_IDS } from '../src/types/system';

const attributeDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique attribute identifier'),
  name: z.string().min(1).describe('Attribute display name'),
  abbreviation: z.string().min(1).describe('Short abbreviation, e.g. STR'),
  min: z.number().describe('Minimum attribute value'),
  max: z.number().describe('Maximum attribute value'),
  scale: z.object({
    kind: z.literal('die-ladder'),
    // Must be non-empty positive integers: the attribute stepper indexes into
    // this ladder, and an empty/garbage ladder would write `undefined` into a
    // saved attribute (→ NaN derived stats).
    ladder: z.array(z.number().int().positive()).min(1),
    allowsPlus: z.boolean().optional(),
  }).optional().describe('Die-ladder scale for trait-die systems (Savage Worlds)'),
});

// Machine-readable penalty a condition imposes while active. Conditions whose
// penalty targets the *attacker* or only *attack* rolls (SWADE Prone/Vulnerable)
// intentionally omit this and stay description-only, since `scope` cannot express
// those cases.
const conditionEffectSchema = z.union([
  z.object({ scope: z.enum(['all-traits', 'attribute-linked']), modifier: z.number() }),
  z.object({ scope: z.literal('no-actions') }),
]);

const conditionDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique condition identifier'),
  name: z.string().min(1).describe('Condition display name'),
  linkedAttributeId: z.string().min(1).optional().describe('Attribute this condition is linked to (Dragonbane)'),
  description: z.string().describe('Short description of the condition effect'),
  effect: conditionEffectSchema.optional().describe('Machine-readable penalty while active'),
  duration: z.enum(['until-cleared', 'end-of-next-turn', 'scene']).optional(),
  recovery: z.object({
    traitId: z.string().min(1),
    targetNumber: z.number(),
    onCriticalFailure: z.string().optional(),
  }).optional().describe('A roll that can clear the condition'),
});

const resourceDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique resource identifier'),
  name: z.string().min(1).describe('Resource display name'),
  derivedFrom: z.string().optional().describe('Attribute id this resource derives from'),
  min: z.number().describe('Minimum resource value'),
  defaultMax: z.number().describe('Default maximum value'),
  direction: z.enum(['depletes', 'accumulates']).optional().describe('Whether the resource counts down or up'),
  refresh: z.enum(['never', 'session', 'rest']).optional().describe('When the resource resets to full'),
});

const skillDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique skill identifier'),
  name: z.string().min(1).describe('Skill display name'),
  baseChance: z.number().describe('Base chance percentage (roll-under systems only; 0 and unused for trait-die systems)'),
  linkedAttributeId: z.string().optional().describe('Linked attribute id'),
  groupId: z.string().optional().describe('Speciality group this skill belongs to'),
});

const skillGroupSchema = z.object({
  id: z.string().min(1).describe('Unique skill group identifier'),
  name: z.string().min(1).describe('Group display name, e.g. "Gun Combat"'),
});

const skillCategorySchema = z.object({
  id: z.string().min(1).describe('Unique category identifier'),
  name: z.string().min(1).describe('Category display name'),
  skills: z.array(skillDefinitionSchema).describe('Skills in this category'),
});

const sectionLayoutSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sections: z.array(z.string()),
});

export const systemDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique system identifier'),
  version: z.number().int().positive().describe('System definition version'),
  name: z.string().min(1).describe('System machine name'),
  displayName: z.string().min(1).describe('Human-readable system name'),
  attributes: z.array(attributeDefinitionSchema).describe('Attribute definitions'),
  conditions: z.array(conditionDefinitionSchema).describe('Condition definitions'),
  resources: z.array(resourceDefinitionSchema).describe('Resource definitions'),
  skillCategories: z.array(skillCategorySchema).describe('Grouped skill definitions'),
  skillGroups: z.array(skillGroupSchema).optional().describe('Speciality groups referenced by skill groupId'),
  sectionLayouts: z.array(sectionLayoutSchema).optional().describe('Optional section layout overrides'),
  themesSupported: z.array(z.string()).optional().describe('Theme names this system supports'),
  quickReference: z.array(z.object({
    title: z.string(),
    columns: z.array(z.string()).optional(),
    rows: z.array(z.array(z.string())),
    note: z.string().optional(),
  })).optional().describe('At-the-table cheat-sheet cards'),
  identityFields: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['text', 'textarea']).optional(),
  })).optional().describe('Identity fields shown on the sheet, keyed into character.metadata'),
  itemFields: z.object({
    weapon: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), type: z.enum(['text','number']).optional() })).optional(),
    armor: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), type: z.enum(['text','number']).optional() })).optional(),
    hiddenBuiltIns: z.object({
      // Enumerated rather than z.string(): the hide-list is matched with
      // `!includes(id)`, so a typo silently SHOWS a field the ruleset meant to
      // drop, with nothing to indicate why. The valid ids live in types/system
      // beside the components that check them.
      weapon: z.array(z.enum(WEAPON_BUILT_IN_FIELD_IDS)).optional(),
      armor: z.array(z.enum(ARMOR_BUILT_IN_FIELD_IDS)).optional(),
    }).optional(),
  }).optional().describe('Extra per-item fields, plus built-ins this system does not use'),
  // `resolution` and `currency` used to be declared here. Both had zero readers
  // — the authoritative values are `engine.resolution` and `engine.currency`,
  // and nothing ever consulted the JSON copies. A schema field an author is
  // invited to fill in and that the app then ignores is worse than no field:
  // it reads as configuration and behaves as a comment. If either needs to
  // become data, wire the consumer in the same change that re-adds the field.
  terms: z.object({
    abilities: z.string().optional(),
    spells: z.string().optional(),
    magicResource: z.string().optional(),
    healthResource: z.string().optional(),
    roleFallback: z.string().optional(),
  }).optional().describe('Overrides for system vocabulary; omitted keys use engine defaults'),
  // Mirrors the full SystemLabels surface (engine/types.ts) so EVERY label can
  // be renamed from system.json, not just these first four — Zod strips
  // unlisted keys, so a previously-missing key (participantHealth, memento,
  // the dashboard-card titles, …) was silently dropped before reaching the
  // engine merge, quietly breaking the "renaming vocabulary needs no code" promise.
  labels: z.object({
    abilitiesScreen: z.string().nullable().optional(),
    resourcesPanel: z.string().optional(),
    attributesPanel: z.string().optional(),
    encumbrance: z.string().optional(),
    participantHealth: z.string().optional(),
    creatureHealth: z.string().optional(),
    creatureArmor: z.string().optional(),
    creatureMovement: z.string().optional(),
    conditionExamples: z.string().optional(),
    encounterTagExamples: z.string().optional(),
    locationExample: z.string().optional(),
    armorFeatures: z.string().optional(),
    memento: z.string().nullable().optional(),
    tinyItems: z.string().nullable().optional(),
    vitalsPanel: z.string().optional(),
    derivedPanel: z.string().optional(),
    conditionsPanel: z.string().optional(),
    readyGearPanel: z.string().optional(),
    damageHealPanel: z.string().optional(),
    quickReferencePanel: z.string().optional(),
    storyBankPanel: z.string().optional(),
  }).optional().describe('Overrides for panel/screen titles; abilitiesScreen null hides that tab'),
  // Declarative display arrays; when present each REPLACES the engine adapter
  // default wholesale (see getEngine). Ids are persisted, so keep them stable.
  logActions: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).optional(),
  outcomes: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    tone: z.enum(['success', 'failure', 'critical', 'fumble']).optional(),
  })).optional(),
  rollModifiers: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).optional(),
  timeUnits: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), abbrev: z.string().min(1) })).optional(),
  routePlanner: z.object({
    label: z.string().min(1),
    distanceFieldId: z.string().min(1).optional(),
    // id and label are required on every route planner field; type is optional.
    fields: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      type: z.enum(['text', 'textarea', 'number']).optional(),
    })),
  }).optional().describe('Per-system route/travel planner (e.g. Traveller Jump Route)'),
}).superRefine((def, ctx) => {
  // Cross-reference integrity: without these, a typo'd id (e.g. a skill linked
  // to a non-existent attribute) passes validation and then silently misbehaves
  // at runtime (DM resolves to 0, attribute map collision), which is the worst
  // failure mode for a hand-edited or community-authored system.json.
  const attrIds = def.attributes.map(a => a.id);
  const resIds = def.resources.map(r => r.id);
  const skillIds = def.skillCategories.flatMap(c => c.skills.map(s => s.id));
  const attrSet = new Set(attrIds);

  const flagDupes = (ids: string[], kind: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate ${kind} id "${id}"` });
      seen.add(id);
    }
  };
  flagDupes(attrIds, 'attribute');
  flagDupes(resIds, 'resource');
  flagDupes(skillIds, 'skill');

  // A groupId that resolves to nothing would silently drop the skill out of its
  // speciality group — the group action would simply skip it, which is exactly
  // the failure a hand-edited system.json produces and never notices.
  const groupIds = (def.skillGroups ?? []).map(g => g.id);
  const groupSet = new Set(groupIds);
  flagDupes(groupIds, 'skill group');
  for (const cat of def.skillCategories) {
    for (const s of cat.skills) {
      if (s.groupId && !groupSet.has(s.groupId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Skill "${s.id}" belongs to unknown group "${s.groupId}"` });
      }
    }
  }
  for (const id of groupIds) {
    if (!def.skillCategories.some(c => c.skills.some(s => s.groupId === id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Skill group "${id}" has no member skills` });
    }
  }

  for (const r of def.resources) {
    if (r.derivedFrom && !attrSet.has(r.derivedFrom)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Resource "${r.id}" derivedFrom unknown attribute "${r.derivedFrom}"` });
    }
  }
  for (const c of def.conditions) {
    if (c.linkedAttributeId && !attrSet.has(c.linkedAttributeId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Condition "${c.id}" linked to unknown attribute "${c.linkedAttributeId}"` });
    }
  }
  for (const cat of def.skillCategories) {
    for (const s of cat.skills) {
      if (s.linkedAttributeId && !attrSet.has(s.linkedAttributeId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Skill "${s.id}" linked to unknown attribute "${s.linkedAttributeId}"` });
      }
    }
  }
  for (const a of def.attributes) {
    if (a.min > a.max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Attribute "${a.id}" has min > max` });
    }
  }
});

export type SystemDefinitionSchema = z.infer<typeof systemDefinitionSchema>;
