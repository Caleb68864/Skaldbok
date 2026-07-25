import { z } from 'zod';

/**
 * Guard keys a card can be gated on via `when`. Each maps to a predicate over the
 * active `SystemEngine` (see `GUARDS` in guards.ts):
 * - `always` — always render
 * - `hasMagic` — `engine.hasMagic`
 * - `hasRest` — `engine.rest !== null`
 * - `hasDamageTrack` — `engine.damageTrack !== null`
 * - `hasCurrency` — the system defines at least one currency denomination
 * - `hasStoryBank` — always true today (Story Bank is universal)
 */
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
  // Bounded to keep an oversized (or hostile) template from rendering a runaway
  // number of cards — bundled layouts use only a handful.
  cells: z.array(z.array(cardEntrySchema).max(100)).max(50).describe('Grid cells; each cell is a vertical stack of card entries'),
});

/**
 * A region is either a bare `CardEntry[]` (a full-width column stack — the legacy
 * form) or a `{ columns, cells }` grid row. The two originals reduce to a mix of
 * both, giving pixel-parity without a system-specific branch in the screen.
 */
export const regionSchema = z.union([
  z.array(cardEntrySchema).max(100),
  gridRegionSchema,
]);

export const surfaceLayoutSchema = z.object({
  layout: z.string().min(1).optional().describe('Optional layout identifier for this surface'),
  regions: z.array(regionSchema).max(100).describe('Regions: a full-width stack (array) or a grid row ({columns, cells})'),
});

/**
 * A full `sheet.json` template: a `version` plus optional play/sheet/print
 * surfaces. Bump `version` when editing a bundled template so the IndexedDB cache
 * refreshes.
 *
 * @example A minimal sheet.json exercising both region forms + a guarded card:
 * ```jsonc
 * {
 *   "version": 1,
 *   "play": {
 *     "regions": [
 *       ["vitals", "conditions"],                        // full-width stack of two cards
 *       {                                                // two-column grid row
 *         "columns": "2fr 1fr",
 *         "cells": [
 *           [{ "card": "skills" }],
 *           [{ "card": "magic", "when": "hasMagic" }]    // guarded card
 *         ]
 *       },
 *       [{ "card": "tile", "props": { "title": "Speed", "source": "derived:pace" } }]
 *     ]
 *   }
 * }
 * ```
 */
export const sheetTemplateSchema = z.object({
  version: z.number().int().positive().describe('Template schema version'),
  play: surfaceLayoutSchema.optional().describe('Play-surface layout'),
  sheet: surfaceLayoutSchema.optional().describe('Sheet-surface layout'),
  // Reserved / not yet consumed: the print route renders via the hardcoded
  // PrintableSheet component, not this surface. Authoring a `print` block is a
  // no-op today.
  print: surfaceLayoutSchema.optional().describe('Print-surface layout (reserved — not yet rendered)'),
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

/**
 * A reusable community component: a named body of card entries whose props are
 * filled from `$prop` named slots at expansion time.
 *
 * @example A component with a named-slot prop, and how a region invokes it:
 * ```jsonc
 * {
 *   "name": "statTile",
 *   "props": ["label", "path"],
 *   "body": [
 *     { "card": "tile", "props": { "title": { "$prop": "label" }, "source": { "$prop": "path" } } }
 *   ]
 * }
 * // Invoked from a region as:
 * //   { "card": "statTile", "props": { "label": "Pace", "path": "derived:pace" } }
 * ```
 */
export const componentDefinitionSchema = z.object({
  name: z.string().min(1).describe('Component name, referenced by CardEntry.card'),
  props: z.array(z.string().min(1)).optional().describe('Names of props this component accepts'),
  body: z.array(componentCardEntrySchema).max(100).describe('Card entries making up this component'),
});
