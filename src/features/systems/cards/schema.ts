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

export const surfaceLayoutSchema = z.object({
  layout: z.string().min(1).describe('Layout identifier for this surface'),
  regions: z.array(z.array(cardEntrySchema)).describe('Regions, each a list of card entries'),
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
