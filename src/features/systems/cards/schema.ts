import { z } from 'zod';

export const cardGuardSchema = z.enum([
  'always',
  'hasMagic',
  'hasRest',
  'hasDamageTrack',
  'hasCurrency',
  'hasStoryBank',
]);

const cardEntryObjectSchema = z.object({
  card: z.string().min(1).describe('Card component name to render'),
  props: z.record(z.string(), z.unknown()).optional().describe('Props passed to the card'),
  when: cardGuardSchema.optional().describe('Guard gating whether this card renders'),
});

export const cardEntrySchema: z.ZodType<string | z.infer<typeof cardEntryObjectSchema>> = z.union([
  z.string().min(1),
  cardEntryObjectSchema,
]);

/**
 * A grid-row region: its cards lay out in a CSS grid whose `columns` maps to
 * `grid-template-columns`. Each cell is itself a vertical stack of card entries,
 * so a two-column region can hold two independent card stacks side by side.
 */
export const gridRegionSchema = z.object({
  columns: z.string().min(1).optional().describe('CSS grid-template-columns for this region row'),
  cells: z.array(z.array(cardEntrySchema)).describe('Grid cells; each cell is a vertical stack of card entries'),
});

/**
 * A region is either a bare `CardEntry[]` (a full-width column stack — the legacy
 * form) or a `{ columns, cells }` grid row. The two originals reduce to a mix of
 * both, giving pixel-parity without a system-specific branch in the screen.
 */
export const regionSchema = z.union([
  z.array(cardEntrySchema),
  gridRegionSchema,
]);

export const surfaceLayoutSchema = z.object({
  layout: z.string().min(1).optional().describe('Optional layout identifier for this surface'),
  regions: z.array(regionSchema).describe('Regions: a full-width stack (array) or a grid row ({columns, cells})'),
});

export const sheetTemplateSchema = z.object({
  version: z.number().int().positive().describe('Template schema version'),
  play: surfaceLayoutSchema.optional().describe('Play-surface layout'),
  sheet: surfaceLayoutSchema.optional().describe('Sheet-surface layout'),
  print: surfaceLayoutSchema.optional().describe('Print-surface layout'),
});

const propSlotSchema = z.object({
  $prop: z.string().min(1).describe('Name of the component prop this slot resolves to'),
});

const componentCardEntryObjectSchema = z.object({
  card: z.string().min(1).describe('Card component name to render'),
  props: z.record(z.string(), propSlotSchema).optional().describe('Named-slot prop references only — no raw expressions'),
  when: cardGuardSchema.optional(),
});

const componentCardEntrySchema = z.union([z.string().min(1), componentCardEntryObjectSchema]);

export const componentDefinitionSchema = z.object({
  name: z.string().min(1).describe('Component name, referenced by CardEntry.card'),
  props: z.array(z.string().min(1)).optional().describe('Names of props this component accepts'),
  body: z.array(componentCardEntrySchema).describe('Card entries making up this component'),
});
