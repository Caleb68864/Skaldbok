import { z } from 'zod';

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
      weapon: z.array(z.string()).optional(),
      armor: z.array(z.string()).optional(),
    }).optional(),
  }).optional().describe('Extra per-item fields, plus built-ins this system does not use'),
  resolution: z.enum(['d20-roll-under', '2d6-plus', 'trait-die-vs-tn']).optional().describe('Core resolution mechanic'),
  currency: z.object({
    label: z.string().min(1),
    abbr: z.string().min(1),
    mode: z.enum(['coins', 'single']),
  }).optional().describe('Currency display configuration'),
  terms: z.object({
    abilities: z.string().optional(),
    spells: z.string().optional(),
    magicResource: z.string().optional(),
    healthResource: z.string().optional(),
    roleFallback: z.string().optional(),
  }).optional().describe('Overrides for system vocabulary; omitted keys use engine defaults'),
  labels: z.object({
    abilitiesScreen: z.string().nullable().optional(),
    resourcesPanel: z.string().optional(),
    attributesPanel: z.string().optional(),
    encumbrance: z.string().optional(),
  }).optional().describe('Overrides for panel/screen titles; abilitiesScreen null hides that tab'),
});

export type SystemDefinitionSchema = z.infer<typeof systemDefinitionSchema>;
