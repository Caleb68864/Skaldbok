import { z } from 'zod';

// ── Combat schemas (moved from note.ts) ─────────────────────────

export const combatEventSchema = z.object({
  id: z.string(),
  type: z.enum(['attack', 'spell', 'ability', 'damage', 'heal', 'condition', 'note', 'round-separator']),
  description: z.string().optional(),
  actorName: z.string().optional(),
  actorId: z.string().optional(),
  targetName: z.string().optional(),
  label: z.string().optional(),
  value: z.string().optional(),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type CombatEvent = z.infer<typeof combatEventSchema>;

export const combatTypeDataSchema = z.object({
  rounds: z.array(z.object({
    roundNumber: z.number(),
    events: z.array(combatEventSchema),
  })),
  participants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['pc', 'npc', 'monster']),
    linkedCharacterId: z.string().optional(),
  })),
});

export type CombatTypeData = z.infer<typeof combatTypeDataSchema>;

// ── Type-specific schemas ────────────────────────────────────────

export const genericTypeDataSchema = z.object({});

export const npcTypeDataSchema = z.object({
  role: z.string().optional(),
  affiliation: z.string().optional(),
});

export const locationTypeDataSchema = z.object({
  locationType: z.string().optional(),
  region: z.string().optional(),
});

export const lootTypeDataSchema = z.object({
  quantity: z.number().optional(),
  value: z.string().optional(),
  holder: z.string().optional(),
});

export const rumorTypeDataSchema = z.object({
  source: z.string().optional(),
  threadStatus: z.enum(['open', 'confirmed', 'debunked']).optional(),
});

export const quoteTypeDataSchema = z.object({
  speaker: z.string().optional(),
});

export const skillCheckTypeDataSchema = z.object({
  skill: z.string().optional(),
  result: z.enum(['success', 'failure', 'dragon', 'demon']).optional(),
  character: z.string().optional(),
});

export const recapTypeDataSchema = z.object({});

// ── Validator functions ──────────────────────────────────────────

export function validateGenericData(data: unknown): z.infer<typeof genericTypeDataSchema> | null {
  const parsed = genericTypeDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validateNpcData(data: unknown): z.infer<typeof npcTypeDataSchema> | null {
  const parsed = npcTypeDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validateCombatData(data: unknown): CombatTypeData | null {
  const parsed = combatTypeDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validateLocationData(data: unknown): z.infer<typeof locationTypeDataSchema> | null {
  const parsed = locationTypeDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validateLootData(data: unknown): z.infer<typeof lootTypeDataSchema> | null {
  const parsed = lootTypeDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validateRumorData(data: unknown): z.infer<typeof rumorTypeDataSchema> | null {
  const parsed = rumorTypeDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validateQuoteData(data: unknown): z.infer<typeof quoteTypeDataSchema> | null {
  const parsed = quoteTypeDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validateSkillCheckData(data: unknown): z.infer<typeof skillCheckTypeDataSchema> | null {
  const parsed = skillCheckTypeDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function validateRecapData(data: unknown): z.infer<typeof recapTypeDataSchema> | null {
  const parsed = recapTypeDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
