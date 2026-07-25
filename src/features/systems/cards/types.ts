import type { z } from 'zod';
import type {
  cardGuardSchema,
  cardEntrySchema,
  gridRegionSchema,
  regionSchema,
  surfaceLayoutSchema,
  sheetTemplateSchema,
  componentDefinitionSchema,
} from './schema';

/** Guard key gating a card's render against the active `SystemEngine` (see `GUARDS`). */
export type CardGuard = z.infer<typeof cardGuardSchema>;
/** A card to render: a bare card-key string, or `{ card, props?, when? }`. */
export type CardEntry = z.infer<typeof cardEntrySchema>;
/** A grid layout row: `{ columns, cells }`, each cell a `CardEntry[]` column. */
export type GridRegion = z.infer<typeof gridRegionSchema>;
/** A layout region: a full-width `CardEntry[]` stack, or a `{ columns, cells }` grid row. */
export type Region = z.infer<typeof regionSchema>;
/** A surface (play/sheet/print) layout: an ordered list of {@link Region}s. */
export type SurfaceLayout = z.infer<typeof surfaceLayoutSchema>;
/** A full sheet template: `version` plus optional play/sheet/print {@link SurfaceLayout}s. */
export type SheetTemplate = z.infer<typeof sheetTemplateSchema>;
/** A reusable community component: `{ name, props?, body }`, expanded via `$prop` slots. */
export type ComponentDefinition = z.infer<typeof componentDefinitionSchema>;
