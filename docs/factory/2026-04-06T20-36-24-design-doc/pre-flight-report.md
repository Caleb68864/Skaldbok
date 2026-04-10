# Pre-Flight Report — 2026-04-06T20-36-24-design-doc

**Date:** 2026-04-06 21:05
**Phase Specs Analyzed:** 19
**Status:** CRITICAL_ISSUES

## Summary

Analysis of all 19 phase specs against the live codebase reveals 8 critical issues and 10 advisory issues. The most impactful critical issue is that `CombatTimeline.tsx` is a self-contained component that loads data internally from a note ID -- it does NOT accept participants/rounds/events as props, making the SS-07 adapter approach impossible without modifying the component (which violates a stated constraint). Several repository method names used in phase specs do not match the actual codebase exports, and the `characterRecordSchema` is in `schemas/` not `src/types/`, which will cause import failures in `bundle.ts`. The Dexie migration references a `meta` table which exists but uses a `MetadataRecord` interface with `{id, key, value}` -- the migration code uses `.get('key')` which will fail because `meta` is the table name but the primary key is `id`, not `key`.

## Critical Issues

### CRIT-1: CombatTimeline accepts combatNoteId, not encounter data props
- **Sub-Spec:** SS-07 — Combat Encounter View (Timeline Migration)
- **Type:** interface mismatch
- **Detail:** `src/features/combat/CombatTimeline.tsx` (NOT `src/components/combat/CombatTimeline.tsx` as stated in the spec) defines `CombatTimelineProps = { combatNoteId: string; onClose: () => void }`. The component internally calls `getNoteById(combatNoteId)` to load note data and calls `noteRepository.updateNote(combatNoteId, ...)` to persist changes. It does NOT accept `participants`, `currentRound`, or `events` as props. The SS-07 plan to build a thin adapter wrapper that maps encounter data to CombatTimeline props is fundamentally impossible without rewriting CombatTimeline.
- **Impact:** SS-07 cannot be implemented as written. The CombatEncounterView wrapper cannot pass encounter data to CombatTimeline via props -- the component ignores external data and loads its own. This also means the escalation trigger in SS-07 ("STOP if CombatTimeline.tsx requires ANY prop change") will fire immediately.
- **Suggested Fix:** Rewrite SS-07 to either: (a) refactor CombatTimeline to accept data via props (breaking the "do not modify" constraint, which requires escalation approval), or (b) create an entirely new CombatEncounterTimeline component that reads from encounter entities instead of notes, reusing lower-level UI pieces from CombatTimeline. Option (b) is safer and avoids the constraint violation.

### CRIT-2: CombatTimeline file path is wrong in spec and phase spec
- **Sub-Spec:** SS-07 — Combat Encounter View
- **Type:** missing file
- **Detail:** The spec and SS-07 reference `src/components/combat/CombatTimeline.tsx`. The actual file is at `src/features/combat/CombatTimeline.tsx`. The `src/components/combat/` directory does not exist.
- **Impact:** The import in SS-07's `CombatEncounterView.tsx` (`import { CombatTimeline } from '../../components/combat/CombatTimeline'`) will fail to compile.
- **Suggested Fix:** Update the file path in SS-07 to `src/features/combat/CombatTimeline.tsx`. All imports must use `../../features/combat/CombatTimeline`.

### CRIT-3: Dexie migration uses wrong meta table access pattern
- **Sub-Spec:** SS-01 — Dexie v6 Schema Migration
- **Type:** implementation step references code that won't work
- **Detail:** SS-01 migration code does `await tx.table('meta').get('migration_v6_combat')`. The existing `metadata` table (version 2) has schema `'id, &key'` with a `MetadataRecord` interface `{id: string, key: string, value: string}`. There is no table called `meta` -- it is called `metadata`. Additionally, `.get('migration_v6_combat')` would look up by primary key `id`, not by the `key` field. The correct pattern would be: `await tx.table('metadata').where('key').equals('migration_v6_combat').first()`.
- **Impact:** The migration guard will fail: either the table name is wrong (Dexie error) or the lookup returns undefined (migration re-runs every time, duplicating encounter/template records).
- **Suggested Fix:** In SS-01, change all references from `tx.table('meta')` to `tx.table('metadata')`, and change `.get('key')` to `.where('key').equals('key').first()`. For the put operation, generate an `id` via `generateId()` (or use a deterministic ID like the key name itself).

### CRIT-4: Repository method names in collectors don't match actual exports
- **Sub-Spec:** SS-09 — Scope Collectors
- **Type:** interface mismatch
- **Detail:** SS-09 references these method names that do NOT exist in the codebase:
  - `noteRepository.listBySession(sessionId)` -- actual name is `getNotesBySession(sessionId)`
  - `noteRepository.listByCampaign(campaignId)` -- actual name is `getNotesByCampaign(campaignId)`
  - `noteRepository.getById(id)` -- actual name is `getNoteById(id)`
  - `sessionRepository.getById(id)` -- actual name is `getSessionById(id)`
  - `sessionRepository.listByCampaign(campaignId)` -- actual name is `getSessionsByCampaign(campaignId)`
  - `campaignRepository.getById(id)` -- actual name is `getCampaignById(id)`
  - `characterRepository.getById(id)` -- actual name is `getById(id)` (this one is correct)
  - `entityLinkRepository.listByEntity(type, id, direction)` -- this function does NOT exist. The actual functions are `getLinksFrom(fromEntityId, relationshipType)` and `getLinksTo(toEntityId, relationshipType)`. There is no generic `listByEntity` function.
  - `partyRepository.listBySession(sessionId)` -- does NOT exist. Only `getPartyByCampaign(campaignId)` exists.
  - `partyMemberRepository.listByParty(partyId)` -- actual name is `getPartyMembers(partyId)` (exported from `partyRepository.ts`, not a separate file).
  - `attachmentRepository.listByNote(noteId)` -- actual name is `getAttachmentsByNote(noteId)`
  - `attachmentRepository.getById(id)` -- does NOT exist.
- **Impact:** SS-09, SS-13, and SS-15 will fail to compile. Every collector and the merge engine reference nonexistent functions.
- **Suggested Fix:** Update all phase specs (SS-09, SS-13, SS-15) to use the correct function names from each repository. The entity link query pattern needs a complete rethink since `listByEntity` does not exist -- collectors must call `getLinksFrom` and `getLinksTo` separately and combine results.

### CRIT-5: characterRecordSchema is in schemas/ not src/types/
- **Sub-Spec:** SS-02 — Zod Type Schemas (bundle.ts)
- **Type:** missing file / wrong import path
- **Detail:** SS-02's `bundle.ts` imports `characterRecordSchema` from `./character` (i.e., `src/types/character`). The actual `characterRecordSchema` is exported from `schemas/character.schema.ts`, not from `src/types/`. The `src/types/` directory has a `CharacterRecord` type but it is likely imported from the schema file, not co-located. The import `import { characterRecordSchema } from './character'` will fail.
- **Impact:** `bundle.ts` will not compile. The bundleEnvelopeSchema cannot reference characterRecordSchema without the correct import path.
- **Suggested Fix:** Update SS-02 to import `characterRecordSchema` from `../../schemas/character.schema` (relative to `src/types/bundle.ts`). Also verify all other schema imports (`partyMemberSchema` -- does a separate `partyMember` type file exist? It does not; both `partySchema` and `partyMemberSchema` are in `src/types/party.ts`).

### CRIT-6: No partyMember.ts type file -- schemas are in party.ts
- **Sub-Spec:** SS-02 — Zod Type Schemas (bundle.ts)
- **Type:** missing file
- **Detail:** SS-02's `bundle.ts` imports `import { partyMemberSchema } from './partyMember'`. There is no `src/types/partyMember.ts` file. Both `partySchema` and `partyMemberSchema` are exported from `src/types/party.ts`.
- **Impact:** `bundle.ts` will not compile due to missing module.
- **Suggested Fix:** Change the import to `import { partyMemberSchema } from './party'`.

### CRIT-7: No attachmentMetaSchema exists -- schema is named attachmentSchema
- **Sub-Spec:** SS-02 — Zod Type Schemas (bundle.ts)
- **Type:** interface mismatch
- **Detail:** SS-02's `bundle.ts` imports `attachmentMetaSchema` from `./attachment`. The actual export is `attachmentSchema` (not `attachmentMetaSchema`). Additionally, the `attachmentSchema` includes a `blob: z.instanceof(Blob)` field which will fail Zod `safeParse` when the attachment is serialized to JSON (Blob cannot be JSON-serialized). This means using `attachmentSchema` directly in `bundleContentsSchema` will cause validation failures on import since the blob will have been converted to base64.
- **Impact:** Import statement fails; even with corrected name, round-trip validation will fail because serialized attachments contain a base64 string, not a Blob.
- **Suggested Fix:** Rename import to `attachmentSchema`. For bundle purposes, create an `attachmentBundleSchema` that replaces the `blob` field with an optional `data: z.string()` + `encoding: z.literal('base64')` for the serialized representation, or use `.omit({ blob: true })` and extend.

### CRIT-8: NPC noteValidators.ts has no hp/armor/movement fields -- migration will produce empty stats
- **Sub-Spec:** SS-01 — Dexie v6 Schema Migration
- **Type:** implementation step references data that doesn't exist
- **Detail:** The NPC note migration in SS-01 reads `note.typeData?.hp`, `note.typeData?.armor`, `note.typeData?.movement`. However, `npcTypeDataSchema` in `src/types/noteValidators.ts` only defines `{ role?: string, affiliation?: string }`. There are no `hp`, `armor`, or `movement` fields in the NPC type data. The migration will produce creature templates with `stats: { hp: 0, armor: 0, movement: 0 }` for every NPC note.
- **Impact:** Migrated creature templates will have zero/empty stats, defeating the purpose of preserving NPC data. Similarly, `attacks`, `abilities`, and `skills` are not in `npcTypeDataSchema` and will default to empty arrays.
- **Suggested Fix:** Update SS-01 to acknowledge that NPC notes in the current schema only contain `role` and `affiliation` in `typeData`. The migration should map `note.typeData?.role` and `note.typeData?.affiliation` to the template, and set stats/attacks/abilities/skills to their zero/empty defaults with a comment noting these were not present in the original NPC note format. Alternatively, check if the note `body` (Tiptap JSON) contains stat information that should be preserved as the template `description`.

## Advisory Issues

### ADV-1: SS-04 repository import path for generateId/nowISO is wrong
- **Sub-Spec:** SS-04 — Repositories
- **Type:** convention
- **Detail:** SS-04 imports `generateId` and `nowISO` from `'../../utils/id'`. The actual files are `src/utils/ids.ts` (plural) and `src/utils/dates.ts` (separate file). The correct imports are `import { generateId } from '../../utils/ids'` and `import { nowISO } from '../../utils/dates'`.
- **Recommendation:** SS-04 instructs the agent to "match import paths for db, generateId, nowISO to existing repository patterns" which should self-correct, but the example code will cause confusion if followed literally.

### ADV-2: SS-04 update() throws instead of returning undefined
- **Sub-Spec:** SS-04 — Repositories
- **Type:** convention
- **Detail:** The spec says "No repository function throws" but SS-04's `update()` and `updateParticipant()` implementations throw `new Error('not found')` when the entity is missing. This contradicts the acceptance criterion.
- **Recommendation:** Change `update()` to return `undefined` or a result-style return instead of throwing, consistent with the spec constraint.

### ADV-3: SS-02 note.ts visibility field ordering
- **Sub-Spec:** SS-02 — Zod Type Schemas
- **Type:** convention
- **Detail:** The spec says to add `visibility: z.enum(['public', 'private']).default('public').optional()`. In Zod, `.default('public').optional()` creates a different type than `.optional().default('public')`. With `.default('public').optional()`, the inferred type is `string | undefined` (the default applies when the value is missing from input, but the TS type still includes undefined). This may cause confusing type behavior. The existing `baseNoteSchema` is named `baseNoteSchema`, not `noteSchema` as the spec references.
- **Recommendation:** Consider using just `.default('public')` (without `.optional()`) so the TS type is always `'public' | 'private'`, never undefined. Also note the schema is `baseNoteSchema` not `noteSchema`.

### ADV-4: QuickNoteDrawer does not have a type picker to remove 'npc' from
- **Sub-Spec:** SS-08 — NPC Note Deprecation
- **Type:** convention
- **Detail:** `QuickNoteDrawer.tsx` always creates notes with `type: 'generic'` hardcoded (line 117). There is no type picker or `NOTE_TYPES` array in this component. The NPC type is never selectable from this drawer. SS-08 may need to look elsewhere for the type picker -- possibly `NoteEditorScreen.tsx` or another component.
- **Recommendation:** SS-08 should audit `NoteEditorScreen.tsx` and the note creation flow more broadly to find where NPC type selection actually occurs, rather than modifying QuickNoteDrawer which has no picker. The `NOTE_TYPES` constant in `src/types/note.ts` (line 17) is the source of truth.

### ADV-5: SS-09 partyRepository has no listBySession
- **Sub-Spec:** SS-09 — Scope Collectors
- **Type:** efficiency
- **Detail:** `collectSessionBundle` calls `partyRepository.listBySession(sessionId)`. This function doesn't exist. The only party lookup is `getPartyByCampaign(campaignId)`. To get the party for a session, the collector must first resolve the session's `campaignId`, then call `getPartyByCampaign(campaignId)`.
- **Recommendation:** Adjust the session collector to use `getPartyByCampaign(session.campaignId)` and wrap the single result in an array.

### ADV-6: Attachment schema has Blob field -- cannot round-trip through JSON
- **Sub-Spec:** SS-11 — Bundle Serializer
- **Type:** efficiency
- **Detail:** The `attachmentSchema` includes `blob: z.instanceof(Blob)`. After serialization to base64, the schema will no longer validate on import because the field becomes a string. SS-11 attempts to handle this with `convertAttachmentsToBase64` but the resulting object won't pass `attachmentSchema.safeParse()` during import (SS-12/SS-13).
- **Recommendation:** Define a separate `attachmentBundleSchema` (or use `.omit()/.extend()`) for the serialized form used in bundles. The import parser should use this bundle-specific schema, not the storage schema.

### ADV-7: No useCampaigns hook exists for ImportPreview CampaignSelector
- **Sub-Spec:** SS-14 — Import Preview UI
- **Type:** missing reference
- **Detail:** SS-14 references `useCampaigns()` hook for the CampaignSelector component. No such hook exists in the codebase. The campaign list can be obtained via `campaignRepository.getAllCampaigns()` or through `useCampaignContext()`.
- **Recommendation:** SS-14 agent should use `getAllCampaigns()` from `campaignRepository` in a `useEffect` or create a minimal inline hook, rather than relying on a nonexistent `useCampaigns()`.

### ADV-8: useExportActions uses hook-based pattern with CampaignContext
- **Sub-Spec:** SS-15 — Hook Integration
- **Type:** convention
- **Detail:** The existing `useExportActions` hook depends on `useCampaignContext()` and `useToast()`. SS-15's new export functions (`exportCharacter`, `exportSession`, `exportCampaign`) accept IDs as parameters rather than using context. This is fine but the toast utility is accessed via `showToast` from `useToast()` (not `toast.error`/`toast.success` as SS-15 code shows).
- **Recommendation:** Adjust SS-15 toast calls from `toast.error(...)` / `toast.success(...)` to `showToast(...)` to match the existing pattern.

### ADV-9: delivery.ts shareFile expects a Blob, not a string
- **Sub-Spec:** SS-11 — Bundle Serializer
- **Type:** interface mismatch (non-blocking)
- **Detail:** SS-11's `deliverBundle` calls `deliverFile(filename, json, 'application/json')` but the actual `delivery.ts` exports `shareFile(blob: Blob, filename: string)` -- it expects a `Blob`, not a raw string. The serializer must create a Blob from the JSON string before calling `shareFile`.
- **Recommendation:** Update SS-11 to create `new Blob([json], { type: 'application/json' })` and pass it to `shareFile(blob, filename)`.

### ADV-10: SS-13 merge engine uses db.table().put() for imports but repositories don't expose this
- **Sub-Spec:** SS-13 — Merge Engine
- **Type:** efficiency
- **Detail:** SS-13 correctly notes that `insertEntity` should use `db.table(tableName).put(entity)` to preserve imported IDs (since repository `create()` functions auto-generate IDs). However, this means the merge engine will bypass repository validation and use raw Dexie table access. This is the correct approach but it introduces a code pattern inconsistency. The `getEntityById` function in the merge engine references repository functions like `campaignRepository.getById` which doesn't exist (it's `getCampaignById`).
- **Recommendation:** Document that the merge engine intentionally uses raw `db.table().put()` for inserts. Fix all repository function name references per CRIT-4.

## File Conflict Map

| File | Sub-Specs Touching | Conflict Risk |
|------|-------------------|---------------|
| `src/storage/db/client.ts` | SS-01 | none |
| `src/types/note.ts` | SS-02, SS-08 | LOW — SS-02 adds field, SS-08 verifies only |
| `src/storage/repositories/entityLinkRepository.ts` | SS-03 | none (comment only) |
| `src/features/notes/QuickNoteDrawer.tsx` | SS-08 | none (may not need changes -- see ADV-4) |
| `src/features/notes/NotesGrid.tsx` | SS-08 | none |
| `src/screens/NoteEditorScreen.tsx` | SS-08 | none |
| `src/features/notes/useNoteActions.ts` | SS-06, SS-08 | LOW — SS-06 adds auto-link logic, SS-08 verifies only |
| `src/features/export/useExportActions.ts` | SS-15 | LOW — additive only |
| `src/screens/SessionScreen.tsx` | SS-05, SS-06, SS-07 | HIGH — three sub-specs add UI to this screen |
| `src/routes/index.tsx` | SS-05 | LOW — additive route |

## Interface Contract Verification

| Provider (Sub-Spec) | Consumer (Sub-Spec) | Contract | Status |
|---------------------|---------------------|----------|--------|
| SS-02 (creatureTemplate types) | SS-04 (repositories) | `CreatureTemplate` type | MATCH |
| SS-02 (encounter types) | SS-04 (repositories) | `Encounter`, `EncounterParticipant` types | MATCH |
| SS-02 (bundle types) | SS-09, SS-10, SS-11, SS-12, SS-13 | `BundleContents`, `BundleEnvelope` types | MISMATCH — `attachmentMetaSchema` name wrong, `characterRecordSchema` path wrong, `partyMemberSchema` path wrong |
| SS-01 (Dexie v6 tables) | SS-04 (repositories) | `creatureTemplates`, `encounters` tables exist | MATCH (assuming SS-01 runs first) |
| SS-04 (repositories) | SS-05, SS-06, SS-09, SS-13 | Repository CRUD exports | MISMATCH — consumer specs use wrong function names |
| SS-07 (CombatEncounterView) | CombatTimeline.tsx | Props: participants, rounds, events | MISMATCH — CombatTimeline expects `combatNoteId`, not data props |
| SS-09 (collectors) | SS-11 (serializer) | `BundleContents` shape | MATCH |
| SS-10 (privacy filter) | SS-11 (serializer) | Pure function `applyPrivacyFilter` | MATCH |
| SS-12 (parser) | SS-13 (merge engine) | `ParsedBundleResult`, `BundleEnvelope` | MATCH |
| SS-12 (parser) | SS-14 (import preview) | `ValidationWarning[]` | MATCH |
| SS-13 (merge engine) | SS-14 (import preview) | `MergeOptions`, `MergeReport` types | MATCH |
| SS-14 (import preview) | SS-15 (hook integration) | `ImportPreview` component props | MATCH |
| entityLinkRepository (existing) | SS-06, SS-09 | `listByEntity(type, id, direction)` | MISMATCH — function does not exist; actual API is `getLinksFrom`/`getLinksTo` |

## Verdict

CRITICAL_ISSUES: 8 critical issues must be resolved before proceeding. The most impactful are CRIT-1 (CombatTimeline interface mismatch requiring an architectural decision), CRIT-3 (Dexie migration will silently fail), CRIT-4 (wrong repository method names across multiple specs), and CRIT-5/6/7 (bundle.ts import paths and schema names). All critical issues require phase spec amendments before agents can execute successfully.
