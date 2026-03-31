import { z } from 'zod';

export type NoteStatus = 'active' | 'archived';

const combatEventSchema = z.object({
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

const baseNoteFields = {
  id: z.string(),
  campaignId: z.string(),
  sessionId: z.string().optional(),
  title: z.string(),
  body: z.unknown(), // ProseMirror JSON object
  status: z.enum(['active', 'archived']),
  pinned: z.boolean(),
  tags: z.array(z.string()).optional(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

const genericNoteSchema = z.object({
  ...baseNoteFields,
  type: z.literal('generic'),
  typeData: z.object({}).optional(),
});

const npcNoteSchema = z.object({
  ...baseNoteFields,
  type: z.literal('npc'),
  typeData: z.object({
    role: z.string().optional(),
    affiliation: z.string().optional(),
  }),
});

const combatNoteSchema = z.object({
  ...baseNoteFields,
  type: z.literal('combat'),
  typeData: combatTypeDataSchema,
});

const locationNoteSchema = z.object({
  ...baseNoteFields,
  type: z.literal('location'),
  typeData: z.object({
    locationType: z.string().optional(),
    region: z.string().optional(),
  }),
});

const lootNoteSchema = z.object({
  ...baseNoteFields,
  type: z.literal('loot'),
  typeData: z.object({
    quantity: z.number().optional(),
    value: z.string().optional(),
    holder: z.string().optional(),
  }),
});

const rumorNoteSchema = z.object({
  ...baseNoteFields,
  type: z.literal('rumor'),
  typeData: z.object({
    source: z.string().optional(),
    threadStatus: z.enum(['open', 'confirmed', 'debunked']).optional(),
  }),
});

const quoteNoteSchema = z.object({
  ...baseNoteFields,
  type: z.literal('quote'),
  typeData: z.object({
    speaker: z.string().optional(),
  }),
});

const skillCheckNoteSchema = z.object({
  ...baseNoteFields,
  type: z.literal('skill-check'),
  typeData: z.object({
    skill: z.string().optional(),
    result: z.enum(['success', 'failure', 'dragon', 'demon']).optional(),
    character: z.string().optional(),
  }),
});

const recapNoteSchema = z.object({
  ...baseNoteFields,
  type: z.literal('recap'),
  typeData: z.object({}).optional(),
});

export const noteSchema = z.discriminatedUnion('type', [
  genericNoteSchema,
  npcNoteSchema,
  combatNoteSchema,
  locationNoteSchema,
  lootNoteSchema,
  rumorNoteSchema,
  quoteNoteSchema,
  skillCheckNoteSchema,
  recapNoteSchema,
]);

export type Note = z.infer<typeof noteSchema>;
export type NoteType = Note['type'];
