# Phase Spec — SS-02: Zod Type Schemas

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 0.2 — Shared Infrastructure: Zod Type Schemas
**Depends on:** None — this is a foundational step. Complete first.
**Delivery order note:** This is Step 1 in the execution sequence. All other sub-specs depend on the types defined here.

---

## Objective

Define canonical TypeScript types via Zod for all new entities (`CreatureTemplate`, `Encounter`, `BundleEnvelope`). These schemas enable runtime validation at the import boundary and full type safety throughout the codebase. Also extend the existing `noteSchema` with an optional `visibility` field.

---

## Files to Create / Modify

- `src/types/creatureTemplate.ts` — **create new**
- `src/types/encounter.ts` — **create new**
- `src/types/bundle.ts` — **create new**
- `src/types/note.ts` — **extend only** (add `visibility` optional field — do not modify existing fields)

---

## Implementation Steps

### 1. Create `src/types/creatureTemplate.ts`

```typescript
import { z } from 'zod';

export const creatureTemplateSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  name: z.string(),
  description: z.any().optional(),        // Tiptap JSON or plain string — agent decides
  category: z.enum(['monster', 'npc', 'animal']),
  role: z.string().optional(),
  affiliation: z.string().optional(),
  stats: z.object({
    hp: z.number(),
    armor: z.number(),
    movement: z.number(),
  }),
  attacks: z.array(z.object({
    name: z.string(),
    damage: z.string(),
    range: z.string(),
    skill: z.string(),
    special: z.string().optional(),
  })),
  abilities: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),
  skills: z.array(z.object({
    name: z.string(),
    value: z.number(),
  })),
  tags: z.array(z.string()),
  imageUrl: z.string().optional(),
  status: z.enum(['active', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number(),
});

export type CreatureTemplate = z.infer<typeof creatureTemplateSchema>;
```

### 2. Create `src/types/encounter.ts`

```typescript
import { z } from 'zod';

export const encounterParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['pc', 'npc', 'monster']),
  linkedCreatureId: z.string().optional(),
  linkedCharacterId: z.string().optional(),
  instanceState: z.object({
    currentHp: z.number().optional(),
    conditions: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),
  sortOrder: z.number(),
});

export const encounterSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  campaignId: z.string(),
  title: z.string(),
  type: z.enum(['combat', 'social', 'exploration']),
  status: z.enum(['active', 'ended']),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  participants: z.array(encounterParticipantSchema),
  combatData: z.object({
    currentRound: z.number(),
    events: z.array(z.any()),
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number(),
});

export type Encounter = z.infer<typeof encounterSchema>;
export type EncounterParticipant = z.infer<typeof encounterParticipantSchema>;
```

### 3. Create `src/types/bundle.ts`

Before writing this file, inspect the existing type files to identify the correct import paths for `campaignSchema`, `sessionSchema`, `partySchema`, `partyMemberSchema`, `characterRecordSchema`, `noteSchema`, `entityLinkSchema`, and `attachmentMetaSchema`. Import from their actual locations.

```typescript
import { z } from 'zod';
import { campaignSchema } from './campaign';          // adjust path as needed
import { sessionSchema } from './session';            // adjust path as needed
import { partySchema } from './party';                // adjust path as needed
import { partyMemberSchema } from './party';           // partyMemberSchema is in party.ts, NOT partyMember.ts
import { characterRecordSchema } from '../../schemas/character.schema'; // characterRecordSchema is in schemas/ not src/types/
import { noteSchema } from './note';                  // adjust path as needed — actual name may be baseNoteSchema
import { entityLinkSchema } from './entityLink';      // adjust path as needed
import { attachmentSchema } from './attachment';      // FIXED: actual name is attachmentSchema (not attachmentMetaSchema)
import { creatureTemplateSchema } from './creatureTemplate';
import { encounterSchema } from './encounter';

export const bundleContentsSchema = z.object({
  campaign: campaignSchema.optional(),
  sessions: z.array(sessionSchema).optional(),
  parties: z.array(partySchema).optional(),
  partyMembers: z.array(partyMemberSchema).optional(),
  characters: z.array(characterRecordSchema).optional(),
  creatureTemplates: z.array(creatureTemplateSchema).optional(),
  encounters: z.array(encounterSchema).optional(),
  notes: z.array(noteSchema).optional(),
  entityLinks: z.array(entityLinkSchema).optional(),
  // NOTE: attachmentSchema has a blob: z.instanceof(Blob) field that can't survive JSON.
  // For bundles, create an attachmentBundleSchema using attachmentSchema.omit({ blob: true }).extend({
  //   data: z.string().optional(), encoding: z.literal('base64').optional()
  // })
  attachments: z.array(attachmentSchema.omit({ blob: true }).extend({
    data: z.string().optional(),
    encoding: z.literal('base64').optional(),
  })).optional(),
});

export const bundleEnvelopeSchema = z.object({
  version: z.literal(1),
  type: z.enum(['character', 'session', 'campaign']),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  system: z.literal('dragonbane'),
  contentHash: z.string().optional(),
  contents: bundleContentsSchema,
});

export type BundleContents = z.infer<typeof bundleContentsSchema>;
export type BundleEnvelope = z.infer<typeof bundleEnvelopeSchema>;
```

### 4. Extend `src/types/note.ts` — add `visibility` field only

Locate the existing `noteSchema` in `src/types/note.ts`. Add a single optional field with a default:

```typescript
visibility: z.enum(['public', 'private']).default('public').optional(),
```

**Do NOT modify any other field.** This is an additive-only change. Verify that the `type` enum in `noteSchema` still includes `'npc'` for backward compatibility (do not remove it).

---

## Verification Commands

```bash
# TypeScript compile check — must pass with no errors
npx tsc --noEmit
```

**Manual verification:**
- Import `creatureTemplateSchema` and call `.safeParse({ id: 'x', campaignId: 'c', name: 'Goblin', category: 'monster', stats: { hp: 10, armor: 3, movement: 10 }, attacks: [], abilities: [], skills: [], tags: [], status: 'active', createdAt: '', updatedAt: '', schemaVersion: 1 })` — should return `{ success: true }`.
- Import `encounterSchema` and call `.safeParse({ id: 'x', sessionId: 's', campaignId: 'c', title: 'Fight', type: 'combat', status: 'active', startedAt: '', participants: [], createdAt: '', updatedAt: '', schemaVersion: 1 })` — should return `{ success: true }`.
- Import `bundleEnvelopeSchema` and call `.safeParse({ version: 1, type: 'campaign', exportedAt: '', system: 'dragonbane', contents: {} })` — should return `{ success: true }`.

---

## Acceptance Criteria

- [ ] `src/types/creatureTemplate.ts` compiles without TypeScript errors
- [ ] `src/types/encounter.ts` compiles without TypeScript errors
- [ ] `src/types/bundle.ts` compiles without TypeScript errors
- [ ] `creatureTemplateSchema.safeParse(validObject)` returns `{ success: true }`
- [ ] `encounterSchema.safeParse(validObject)` returns `{ success: true }`
- [ ] `bundleEnvelopeSchema.safeParse(validEnvelope)` returns `{ success: true }`
- [ ] Existing `noteSchema` extended with `visibility: z.enum(['public', 'private']).default('public').optional()` — no existing reads break
- [ ] `'npc'` type remains in `noteSchema` type enum (backward compat — do NOT remove)
- [ ] No existing Zod schemas in `src/types/` are modified (only `note.ts` is touched, and only to add `visibility`)
- [ ] `npx tsc --noEmit` passes with no errors after all three files are created and `note.ts` is extended

---

## Constraints

- No new npm dependencies (Zod is already a project dependency)
- Do not modify any existing type field in `note.ts` — only add `visibility`
- Do not remove `'npc'` from the `noteSchema` type enum
- Adjust import paths in `bundle.ts` to match actual file locations in the project
- All four files must be self-consistent (no circular imports)
