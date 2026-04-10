---
type: phase-spec
master_spec: "docs/specs/2026-03-30-universal-note-model.md"
sub_spec: 1
title: "Simplify Note Type System"
dependencies: []
date: 2026-03-30
---

# Sub-Spec 1: Simplify Note Type System

## Shared Context

**Project:** Skaldbok -- Dragonbane TTRPG companion PWA (React 19, TypeScript, Vite, Dexie v4, TipTap, Zod)

**Codebase conventions:**
- Repositories: try/catch + Zod `safeParse` on every read. Follow `campaignRepository.ts` as template.
- IDs: `generateId()` from `src/utils/ids.ts`. Timestamps: `nowISO()` from `src/utils/dates.ts`.
- No tests exist. Verification is `tsc --noEmit` + `npm run build` + grep checks.

**Constraints:**
- Must NOT break existing stored notes (base schema is strictly looser -- no migration needed)
- Must NOT modify attachment system, export format, or UI behavior
- Must NOT require Dexie schema version bump (escalate if needed)

## Scope

Replace the 9-type Zod discriminated union in `types/note.ts` with a single `baseNoteSchema`. Move type-specific schemas to `types/noteValidators.ts` as opt-in utilities. Update `noteRepository.ts` to validate with the base schema only. Fix import in `CombatTimeline.tsx`.

## Codebase Analysis

### Files Requiring Changes (4 files)

1. **`src/types/note.ts`** -- REWRITE. Currently exports a discriminated union (`noteSchema`) with 9 type-specific schemas, `CombatEvent` type, `CombatTypeData` type, `combatTypeDataSchema`, `Note` type, and `NoteType` type. Replace with single `baseNoteSchema` + `NOTE_TYPES` const + simplified exports.

2. **`src/types/noteValidators.ts`** -- NEW FILE. Move `combatEventSchema`, `combatTypeDataSchema`, `CombatEvent`, `CombatTypeData` here. Add validator functions for all 9 note types.

3. **`src/storage/repositories/noteRepository.ts`** -- UPDATE. Line 2 imports `noteSchema` (the discriminated union). Change to import `baseNoteSchema`. Lines 11, 27, 45 use `noteSchema.safeParse()` -- change to `baseNoteSchema.safeParse()`.

4. **`src/features/combat/CombatTimeline.tsx`** -- UPDATE IMPORT. Line 10: `import type { CombatEvent, CombatTypeData } from '../../types/note'` → change to `import type { CombatEvent, CombatTypeData } from '../../types/noteValidators'`.

### Files Already Compatible (no changes needed)

These files import `Note` type or use `note.type` as a string comparison. All remain compatible because:
- `Note` type still has all the same base fields
- `note.type` is `string` which accepts the literal comparisons (`=== 'npc'`, `=== 'combat'`, etc.)
- No code relies on discriminated union type narrowing for `typeData` access
- CombatTimeline uses explicit `as CombatTypeData` cast (line 64), not discriminated union narrowing

Compatible files:
- `src/storage/db/client.ts` -- `Note` type import only
- `src/features/notes/useNoteActions.ts` -- `Note` type + `note.type === 'npc'` string comparison. Deletion cascade (lines 77-84) already handles attachments + entity links.
- `src/screens/NotesScreen.tsx` -- `Note` type + `n.type === 'npc'` etc.
- `src/features/notes/NoteItem.tsx` -- `Note` type only
- `src/features/notes/LinkNoteDrawer.tsx` -- `Note` type + `note.type !== 'generic'`
- `src/features/notes/QuickNPCDrawer.tsx` -- creates with `type: 'npc'`, `typeData: { role, affiliation }` (string literal assignable to `string`, typeData assignable to `unknown`)
- `src/features/notes/QuickNoteDrawer.tsx` -- creates with `type: 'generic'`
- `src/features/notes/QuickLocationDrawer.tsx` -- creates with `type: 'location'`
- `src/screens/SessionScreen.tsx` -- creates combat notes with `type: 'combat'`
- `src/features/session/SessionQuickActions.tsx` -- filters by `n.type === 'npc'`
- `src/features/session/useSessionLog.ts` -- uses `type: 'skill-check' | 'generic'` literal
- `src/features/export/useExportActions.ts` -- `Note` type only
- `src/utils/export/renderNote.ts` -- `note.type`, `note.body`, base fields only
- `src/utils/export/renderSession.ts`, `renderCampaignIndex.ts`, `renderAttachmentSidecar.ts` -- `Note` type only

## Implementation Steps

### Step 1: Rewrite `src/types/note.ts`

Replace the entire file content. The new file should contain:

**Keep from current file:**
- `NoteStatus` type (`'active' | 'archived'`)

**New content:**
- `const NOTE_TYPES = ['generic', 'npc', 'combat', 'location', 'loot', 'rumor', 'quote', 'skill-check', 'recap'] as const`
- `type NoteType = (typeof NOTE_TYPES)[number]`
- `baseNoteSchema` with fields: `id: z.string()`, `campaignId: z.string()`, `sessionId: z.string().optional()`, `title: z.string()`, `body: z.unknown()`, `type: z.string()`, `typeData: z.unknown().optional()`, `status: z.enum(['active', 'archived'])`, `pinned: z.boolean()`, `tags: z.array(z.string()).optional()`, `schemaVersion: z.number()`, `createdAt: z.string()`, `updatedAt: z.string()`
- `type Note = z.infer<typeof baseNoteSchema>`
- Export: `baseNoteSchema`, `Note`, `NoteType`, `NoteStatus`, `NOTE_TYPES`

**Remove:**
- All 9 type-specific schemas (genericNoteSchema, npcNoteSchema, combatNoteSchema, etc.)
- The `noteSchema` discriminated union
- `combatEventSchema`, `combatTypeDataSchema`, `CombatEvent`, `CombatTypeData` (these move to noteValidators.ts)
- All `baseNoteFields` object (inline into `baseNoteSchema` instead)

**Verification:**
```bash
npx tsc --noEmit 2>&1 | head -50
```
Expect: TypeScript errors in files that imported `noteSchema`, `CombatEvent`, `CombatTypeData` from this file. This is expected -- we fix them in subsequent steps.

### Step 2: Create `src/types/noteValidators.ts`

New file with:

**Combat types (moved from note.ts):**
- `combatEventSchema` (exact copy from current note.ts lines 5-16)
- `CombatEvent` type
- `combatTypeDataSchema` (exact copy from current note.ts lines 20-31)
- `CombatTypeData` type

**Validator functions for all 9 types:**
Each validator takes `unknown` and returns the typed data or `null`:

```typescript
export function validateCombatData(data: unknown): CombatTypeData | null {
  const parsed = combatTypeDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
```

For the simple types, define inline schemas:
- `npcTypeDataSchema = z.object({ role: z.string().optional(), affiliation: z.string().optional() })`
- `locationTypeDataSchema = z.object({ locationType: z.string().optional(), region: z.string().optional() })`
- `lootTypeDataSchema = z.object({ quantity: z.number().optional(), value: z.string().optional(), holder: z.string().optional() })`
- `rumorTypeDataSchema = z.object({ source: z.string().optional(), threadStatus: z.enum(['open', 'confirmed', 'debunked']).optional() })`
- `quoteTypeDataSchema = z.object({ speaker: z.string().optional() })`
- `skillCheckTypeDataSchema = z.object({ skill: z.string().optional(), result: z.enum(['success', 'failure', 'dragon', 'demon']).optional(), character: z.string().optional() })`
- `genericTypeDataSchema = z.object({}).optional()` (passthrough)
- `recapTypeDataSchema = z.object({}).optional()` (passthrough)

Each gets a corresponding `validateXxxData(data: unknown): XxxTypeData | null` function.

Export all schemas, types, and validator functions.

**Verification:**
```bash
npx tsc --noEmit 2>&1 | head -50
```
Expect: errors should reduce (CombatTimeline import still broken). The new file itself should have no errors.

### Step 3: Update `src/storage/repositories/noteRepository.ts`

Change line 2:
- FROM: `import { noteSchema } from '../../types/note';`
- TO: `import { baseNoteSchema } from '../../types/note';`

Change all 3 occurrences of `noteSchema.safeParse` to `baseNoteSchema.safeParse`:
- Line 11: `const parsed = baseNoteSchema.safeParse(record);`
- Line 27: `const parsed = baseNoteSchema.safeParse(record);`
- Line 45: `const parsed = baseNoteSchema.safeParse(record);`

**Verification:**
```bash
npx tsc --noEmit 2>&1 | head -30
```
Expect: noteRepository errors resolved. CombatTimeline import still broken.

### Step 4: Update `src/features/combat/CombatTimeline.tsx` import

Change line 10:
- FROM: `import type { CombatEvent, CombatTypeData } from '../../types/note';`
- TO: `import type { CombatEvent, CombatTypeData } from '../../types/noteValidators';`

**Verification:**
```bash
npx tsc --noEmit 2>&1 | head -30
```
Expect: zero errors. If errors remain, they indicate unexpected consumers of the old types.

### Step 5: Full build verification

```bash
npx tsc --noEmit && echo "TSC OK" || echo "TSC FAILED"
npm run build && echo "BUILD OK" || echo "BUILD FAILED"
```

Both must succeed.

### Step 6: Run acceptance criteria checks

```bash
# baseNoteSchema exists
grep -c "baseNoteSchema" src/types/note.ts

# NOTE_TYPES exists
grep -c "NOTE_TYPES" src/types/note.ts

# noteValidators has combat validator
grep -c "validateCombatData" src/types/noteValidators.ts

# No discriminated union remains
grep -c "discriminatedUnion" src/types/note.ts

# noteRepository uses baseNoteSchema
grep -c "baseNoteSchema" src/storage/repositories/noteRepository.ts

# Deletion cascade preserved (already exists)
grep -c "deleteAttachmentsByNote\|deleteLinksForNote" src/features/notes/useNoteActions.ts
```

Expected: baseNoteSchema > 0, NOTE_TYPES > 0, validateCombatData > 0, discriminatedUnion = 0, baseNoteSchema in repo > 0, cascade >= 2.

## Interface Contract

### Provides (for Sub-Spec 2)

- `Note` type from `src/types/note.ts` -- base note type with `type: string`, `typeData: unknown`, `body: unknown`
- `baseNoteSchema` from `src/types/note.ts` -- Zod schema for validation
- `NoteType` string literal union from `src/types/note.ts` -- for UI convenience
- `NOTE_TYPES` const array from `src/types/note.ts` -- for iteration

### Requires

Nothing. This sub-spec has no dependencies.

## Patterns to Follow

- `campaignRepository.ts` -- try/catch + safeParse pattern for noteRepository
- `types/entityLink.ts` -- simple Zod schema pattern for baseNoteSchema (single object, no union)
- `types/attachment.ts` -- reference for how other type files are structured in this project
