---
date: 2026-03-30
status: ready
design_source: docs/plans/2026-03-30-universal-note-model-design.md
---

# Universal Note Model

## Meta

- Project: Skaldbok
- Repo: Skaldmark
- Date: 2026-03-30
- Author: Caleb Bennett
- Quality: 32/35 (outcome: 5, scope: 5, decision_guidance: 5, edges: 4, criteria: 4, decomposition: 4, purpose: 5)
- Status: completed
- Executed: 2026-03-31
- Result: 2/2 sub-specs passed (1 PASS, 1 PARTIAL due to pre-existing build errors)

## Outcome

The note system uses a single `baseNoteSchema` with `type: z.string()` and `typeData: z.unknown().optional()`. All 9 existing note types remain fully functional. Per-type Zod validators exist as opt-in utilities in `noteValidators.ts`. MiniSearch provides in-memory full-text search across note titles and bodies. The export system produces identical markdown output. All existing stored notes remain readable without data migration.

## Intent

**Trade-off hierarchy:**
1. Backward compatibility over clean abstractions -- existing notes must keep working
2. Simplicity over type safety -- fewer schemas wins over compile-time guarantees on typeData
3. Working now over perfect later -- MiniSearch in-memory index is good enough; persistent index is YAGNI

**Decision boundaries:**
- Agent decides autonomously on: file organization, function signatures, MiniSearch config, internal implementation
- Agent escalates: Dexie version bumps, export system changes, NotesScreen UI changes
- Human decides: new note types, attachment model changes, export format changes

## Context

Skaldbok is a Dragonbane TTRPG companion PWA (React 19, TypeScript, Vite, Dexie v4, TipTap/ProseMirror, Zod). The current note system uses a 9-type Zod discriminated union (`noteSchema`) that requires schema changes for every new note type. The attachment system is already implemented (Dexie v4, `attachmentRepository.ts`, export support). No tests exist in the project.

**Codebase conventions:**
- Repositories use try/catch + Zod `safeParse` on every read, `console.warn` for validation failures, `throw new Error('{repoName}.{methodName} failed: ${e}')` for caught exceptions. Follow `campaignRepository.ts` as template (NOT `characterRepository.ts` which is legacy).
- IDs: `generateId()` from `src/utils/ids.ts`. Timestamps: `nowISO()` from `src/utils/dates.ts`.
- React hooks: `src/features/{domain}/`. Utilities: `src/utils/`.

## Requirements

1. `types/note.ts` exports a single `baseNoteSchema` with `type: z.string()`, `typeData: z.unknown().optional()`, and all existing base fields (id, campaignId, sessionId, title, body, status, pinned, tags, schemaVersion, createdAt, updatedAt)
2. `types/note.ts` exports `const NOTE_TYPES = ['generic', 'npc', 'combat', 'location', 'loot', 'rumor', 'quote', 'skill-check', 'recap'] as const` and `type NoteType = (typeof NOTE_TYPES)[number]`
3. `types/noteValidators.ts` exports opt-in validator functions for each type's `typeData` (e.g., `validateCombatData(data: unknown): CombatTypeData | null`)
4. `noteRepository.ts` validates with `baseNoteSchema` only -- no discriminated union
5. MiniSearch index is built on campaign load from ProseMirror JSON text extraction
6. MiniSearch index updates incrementally on note create/update/delete
7. Note deletion cascades to: `deleteAttachmentsByNote()`, `deleteLinksForNote()`, remove from search index
8. Export system (`renderNote.ts`) produces identical output (it only accesses base fields -- confirmed compatible)
9. All existing stored notes remain readable without data migration
10. `tsc --noEmit` passes and `npm run build` succeeds

## Sub-Specs

### Sub-Spec 1: Simplify Note Type System

**Scope:** Replace the 9-type discriminated union with a single base schema and opt-in validators.

**Files:**
- `src/types/note.ts` -- rewrite: replace discriminated union with `baseNoteSchema`
- `src/types/noteValidators.ts` -- new: opt-in validator functions per type
- `src/storage/repositories/noteRepository.ts` -- simplify: validate with `baseNoteSchema` only
- `src/storage/db/client.ts` -- verify: note table type annotation uses new `Note` type (may need import update only)
- `src/features/notes/useNoteActions.ts` -- update: ensure note deletion cascades to attachments, entity links
- Any file that imports `Note` or `NoteType` from `types/note.ts` -- update imports if needed

**Acceptance Criteria:**
- `[MECHANICAL]` `tsc --noEmit` passes with zero errors
- `[MECHANICAL]` `npm run build` succeeds
- `[MECHANICAL]` `grep -c "baseNoteSchema" src/types/note.ts` returns > 0
- `[MECHANICAL]` `grep -c "NOTE_TYPES" src/types/note.ts` returns > 0
- `[MECHANICAL]` `grep -c "validateCombatData" src/types/noteValidators.ts` returns > 0
- `[STRUCTURAL]` `src/types/noteValidators.ts` exists and exports validator functions for all 9 types
- `[STRUCTURAL]` `noteRepository.ts` uses `baseNoteSchema.safeParse` (not the old discriminated union)
- `[STRUCTURAL]` No remaining imports of the old `noteSchema` discriminated union (except in noteValidators.ts if reused internally)
- `[MECHANICAL]` `grep -rn "discriminatedUnion" src/types/note.ts` returns 0 matches

**Dependencies:** none

### Sub-Spec 2: MiniSearch Full-Text Search

**Scope:** Add MiniSearch library, create ProseMirror text extraction utility, create `useNoteSearch` hook.

**Files:**
- `package.json` -- add `minisearch` dependency
- `src/utils/prosemirror.ts` -- new: `extractText(doc: unknown): string` utility
- `src/features/notes/useNoteSearch.ts` -- new: MiniSearch hook with index build, incremental update, search API

**Acceptance Criteria:**
- `[MECHANICAL]` `grep -c "minisearch" package.json` returns > 0
- `[MECHANICAL]` `tsc --noEmit` passes
- `[MECHANICAL]` `npm run build` succeeds
- `[STRUCTURAL]` `src/utils/prosemirror.ts` exists and exports `extractText`
- `[STRUCTURAL]` `src/features/notes/useNoteSearch.ts` exists and exports a hook
- `[MECHANICAL]` `grep -c "MiniSearch" src/features/notes/useNoteSearch.ts` returns > 0
- `[STRUCTURAL]` `useNoteSearch` hook exposes: search function, rebuild function, add/update/remove document methods

**Dependencies:** Sub-Spec 1 (uses the simplified `Note` type)

## Edge Cases

- **Existing notes with discriminated union data:** Already compatible -- base schema is strictly looser than the old discriminated union. No migration needed.
- **Unknown note types:** `type: z.string()` accepts any string. List views render fine (base fields only). Detail views without a matching validator show title + body with fallback.
- **Invalid typeData on validator call:** Validator returns `null`. UI shows graceful fallback (e.g., "Combat data unavailable").
- **typeData schema evolution:** Old notes with fewer fields get `null` from updated validators. Fallback renders. No crash.
- **MiniSearch index desync:** Full rebuild on campaign load is the recovery path. Index is always derivable from stored ProseMirror JSON.
- **Browser crash during note write:** Note may be written but search index not updated. Next campaign load rebuilds the index.

## Out of Scope

- Updating `NotesScreen.tsx` from hardcoded type sections to data-driven grouping (follow-up work)
- Changes to the attachment system (already implemented and working)
- Changes to the export markdown format
- Adding new note types
- Persistent search index or stored plaintext field
- Any UI/UX changes beyond what's needed for TypeScript compilation

## Constraints

**Musts:**
- All existing stored notes must remain readable after the refactor
- Repository layer must validate with Zod `safeParse` on every read (v3 pattern)
- Note deletion must cascade to attachments and entity links
- MiniSearch index must rebuild from scratch on campaign load (recovery path)

**Must-Nots:**
- Must NOT modify the attachment system (`attachmentRepository.ts`, `types/attachment.ts`, Dexie v4 `attachments` table)
- Must NOT change the export markdown format (`renderNote.ts` output must be identical)
- Must NOT require a Dexie schema version bump for the note model change (if possible -- escalate if not)
- Must NOT add UI components or change visual behavior

**Preferences:**
- Prefer following `campaignRepository.ts` patterns over `characterRepository.ts` (legacy)
- Prefer one `noteValidators.ts` file over a directory of files (keep it simple)
- Prefer MiniSearch defaults with field weighting (title: 2, tags: 1.5, body: 1) over complex custom tokenization

**Escalation Triggers:**
- Dexie schema version bump is needed
- Export system needs changes beyond confirming compatibility
- More than 5 files need import updates (signals broader impact than expected)
- Any file outside `src/types/`, `src/storage/`, `src/features/notes/`, `src/utils/` needs changes

## Verification

End-to-end verification after both sub-specs are complete:

1. `[MECHANICAL]` `tsc --noEmit` passes with zero errors
2. `[MECHANICAL]` `npm run build` succeeds with no warnings related to note types
3. `[MECHANICAL]` `grep -rn "discriminatedUnion" src/types/note.ts` returns 0 matches
4. `[MECHANICAL]` `grep -c "baseNoteSchema" src/types/note.ts` returns > 0
5. `[MECHANICAL]` `grep -c "NOTE_TYPES" src/types/note.ts` returns > 0
6. `[MECHANICAL]` `grep -c "minisearch" package.json` returns > 0
7. `[STRUCTURAL]` `src/types/noteValidators.ts` exists with exports for all 9 type validators
8. `[STRUCTURAL]` `src/features/notes/useNoteSearch.ts` exists with MiniSearch integration
9. `[STRUCTURAL]` `src/utils/prosemirror.ts` exists with `extractText` export
10. `[MECHANICAL]` `grep -c "deleteAttachmentsByNote\|deleteLinksForNote" src/features/notes/useNoteActions.ts` returns >= 2

## Phase Specs

Refined by `/forge-prep` on 2026-03-30.

| Sub-Spec | Phase Spec |
|----------|------------|
| 1. Simplify Note Type System | `docs/specs/universal-note-model/sub-spec-1-simplify-note-types.md` |
| 2. MiniSearch Full-Text Search | `docs/specs/universal-note-model/sub-spec-2-minisearch.md` |

Index: `docs/specs/universal-note-model/index.md`
