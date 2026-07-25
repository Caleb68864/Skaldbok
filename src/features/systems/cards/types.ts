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

export type CardGuard = z.infer<typeof cardGuardSchema>;
export type CardEntry = z.infer<typeof cardEntrySchema>;
export type GridRegion = z.infer<typeof gridRegionSchema>;
export type Region = z.infer<typeof regionSchema>;
export type SurfaceLayout = z.infer<typeof surfaceLayoutSchema>;
export type SheetTemplate = z.infer<typeof sheetTemplateSchema>;
export type ComponentDefinition = z.infer<typeof componentDefinitionSchema>;
