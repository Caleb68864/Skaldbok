---
date: 2026-03-30
topic: "Universal note model -- simplify from 9 discriminated types to one base schema with opt-in validators, attachments table, MiniSearch"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-03-30
tags:
  - design
  - universal-note-model
---

# Universal Note Model -- Design

## Summary

Replace the current 9-type Zod discriminated union for notes with a single base schema where `type` is a plain string and `typeData` is an opaque blob. Per-type Zod validators are kept as opt-in utilities that the UI calls when it needs type-safe access to type-specific data. This eliminates schema version bumps for new note types, dramatically simplifies the repository layer, and makes the system trivially extensible. The existing Dexie/IndexedDB storage layer stays -- SQLite offers no benefit for this use case since it runs on the same browser storage underneath. Image attachments get a dedicated table to keep note reads fast. Full-text search uses MiniSearch (~6KB) with an in-memory index built on startup from ProseMirror JSON text extraction.

## Approach Selected

**Approach B: Single Base Schema + Opt-In Type Validators.** Chosen because it gives the simplicity of a universal model without losing the type safety already built into the codebase. Validators become tools you reach for, not gates you pass through on every read.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Dexie / IndexedDB               │
│  ┌────────────────────────────────────────┐  │
│  │  notes table (simplified)              │  │
│  │  id, campaignId, sessionId, type,      │  │
│  │  title, body, status, pinned, tags,    │  │
│  │  typeData (opaque), timestamps         │  │
│  ├────────────────────────────────────────┤  │
│  │  attachments table (already exists)    │  │
│  │  id, noteId, campaignId, filename,     │  │
│  │  mimeType, sizeBytes, blob, createdAt  │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
        │
        ▼
┌──────────────────┐
│  noteRepository   │  ← validates with baseNoteSchema only
│  (CRUD layer)     │     typeData passes through as unknown
└──────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│  UI / Feature layer                       │
│                                           │
│  NoteItem.tsx     → uses base fields only │
│  CombatLog.tsx    → calls validateCombat()│
│  NPCCard.tsx      → calls validateNpc()   │
│  QuickNPCDrawer   → constructs typeData   │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│  Type validators (opt-in)                 │
│                                           │
│  noteValidators.ts                        │
│    combatTypeDataSchema   (existing)      │
│    npcTypeDataSchema      (trivial)       │
│    locationTypeDataSchema (trivial)       │
│    ...etc                                 │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│  Search layer                             │
│                                           │
│  useNoteSearch.ts (hook)                  │
│    MiniSearch index (in-memory)           │
│    extractText(prosemirrorJson) utility   │
│    rebuild on campaign load               │
│    update on note create/update/delete    │
└──────────────────────────────────────────┘
```

The repository layer is type-agnostic. It stores and retrieves notes with `typeData: unknown`. The UI layer is where type-specific validation happens, and only when needed.

## Components

### 1. `types/note.ts` -- Unified Note Type

- Replace the 9-type discriminated union with one `baseNoteSchema`
- `type` becomes `z.string()` -- any string is valid, new types are zero-cost
- `typeData` becomes `z.unknown().optional()` -- opaque at the base level
- Centralize known types: `const NOTE_TYPES = ['generic', 'npc', 'combat', 'location', 'loot', 'rumor', 'quote', 'skill-check', 'recap'] as const` and `type NoteType = (typeof NOTE_TYPES)[number]` -- used for dropdowns, badges, icon mapping. UI convenience, not storage enforcement.
- Attachments are already linked via `noteId` on the attachment record -- no `attachmentIds` field needed on the note schema
- Tags, pinned, status, body (ProseMirror JSON) stay exactly as they are
- Does NOT own validation of typeData contents

### 2. `types/noteValidators.ts` -- Opt-In Type Validators (new file)

- Per-type Zod schemas for `typeData` plus helper functions like `validateCombatData(typeData: unknown): CombatTypeData | null`
- Move existing `combatTypeDataSchema` here
- Add trivial schemas for simple types (npc, location, loot, rumor, quote, skill-check, recap)
- Each validator is standalone -- no coupling to the base Note type
- Exports typed return types: `CombatTypeData`, `NpcTypeData`, etc.

### 3. `storage/repositories/noteRepository.ts` -- Simplified Repository

- Validates reads with `baseNoteSchema` only
- `createNote` accepts `type: string` and `typeData?: unknown`
- Every function gets simpler -- one schema path, not nine
- Does NOT own type-specific validation or business logic

### 4. `storage/repositories/attachmentRepository.ts` -- Already Implemented

- **This already exists.** Dexie v4 adds the `attachments` table. The repository has full CRUD: `createAttachment`, `getAttachmentsByNote`, `getAttachmentsByCampaign`, `deleteAttachment`, `deleteAttachmentsByNote`, `updateAttachmentCaption`.
- Includes image resize/compress via `resizeAndCompress()` utility.
- Export system already handles attachment filenames in markdown output.
- **No changes needed** for the universal note model -- the attachment system is decoupled from note types.

### 5. `features/notes/useNoteSearch.ts` -- MiniSearch Integration (new hook)

- Uses MiniSearch (~6KB gzipped) for in-memory full-text search
- `extractText(prosemirrorJson)` utility: recursively walks ProseMirror node tree, collects text from `text` nodes (~10 lines)
- Index fields: `title` (weight: 2), `bodyText` (weight: 1), `tags` (weight: 1.5)
- Rebuilt on campaign load from all campaign notes
- Updated incrementally on note create/update/delete
- Supports fuzzy matching, prefix search, and filter functions (e.g., `type === 'npc'`)
- Returns ranked results with match info for highlighting

### 6. UI Components

- List views use only base fields -- title, type, tags, pinned. No typeData validation.
- Detail/edit views call the validator: `const npcData = validateNpcData(note.typeData)`
- Creation drawers construct typeData objects matching expected shape and pass to createNote
- Search UI calls `useNoteSearch` hook for full-text + filter queries

## Data Flow

### Creating a note

```
User fills form → Drawer builds typeData: { role: "Innkeeper", affiliation: "Guild" }
  → createNote({ type: "npc", title: "Bram", body: {...}, typeData, campaignId, ... })
  → noteRepository validates base shape, stores as-is
  → typeData stored as opaque JSON blob in IndexedDB
```

### Reading notes for list view

```
getNotesByCampaign(campaignId)
  → Dexie query on campaignId index
  → baseNoteSchema.safeParse each record
  → returns Note[] with typeData: unknown
  → NoteItem renders title, type badge, tags -- typeData never touched
```

### Reading a note for detail view

```
getNoteById(id) → baseNoteSchema.safeParse → Note with typeData: unknown
  → CombatLog calls validateCombatData(note.typeData)
  → valid: render rounds, participants, events
  → null: show "Combat data unavailable" fallback
```

### Adding a new note type

```
1. Pick a type string: "quest"
2. (Optional) Add validator in noteValidators.ts
3. Build UI component
4. Done. No schema bump. No Dexie migration. No repository changes.
```

### Image attachments (already implemented)

The `attachments` Dexie table already exists (v4) with full CRUD in `attachmentRepository.ts`. Notes reference attachments via `noteId` on the attachment record (not `attachmentIds` on the note). The export system already renders attachment filenames in markdown output. **No changes needed for this refactor.**

### Searching notes

On campaign load, `useNoteSearch` builds a MiniSearch index by extracting plain text from each note's ProseMirror JSON body. The index lives in memory only -- no stored plaintext field. On note create/update/delete, the index is updated incrementally. Search queries return ranked results with match metadata for highlighting. Filtering by type, tags, pinned status can be combined with full-text search via MiniSearch's `filter` option.

## Error Handling

- **Existing data migration:** Current notes already have `type` and `typeData` fields -- they're already compatible. Base schema is strictly looser. No data migration needed. Version bump only if indexes change.
- **Invalid typeData on read:** Validator returns null, UI shows graceful fallback. Handles corrupt data, schema evolution, and notes created before a validator existed.
- **Unknown note types:** `type: z.string()` means any type is valid. List views render fine. Detail views without a matching component show title + body with "Unknown type" badge.
- **typeData shape disagreement:** If a drawer constructs one shape but the validator later expects more fields, old notes get null from the validator and fall back gracefully.
- **Note deletion cascade:** Deleting a note MUST cascade to: (1) `deleteAttachmentsByNote(noteId)` -- already exists, (2) `deleteLinksForNote(noteId)` -- already exists, (3) remove from MiniSearch index. The `useNoteActions` hook should orchestrate this cascade.
- **Search index desync:** If the MiniSearch index gets out of sync (browser crash mid-write, direct Dexie manipulation), the recovery path is a full index rebuild on next campaign load. No stored plaintext means the index is always derivable.

## Resolved Decisions

1. **Image attachments** -- Already implemented. Separate `attachments` Dexie table (v4) with full CRUD, image resize/compress, and export support. No changes needed for the universal note model.
2. **NoteType string literals** -- Centralized as `const NOTE_TYPES = [...] as const` in `types/note.ts`. Used for UI (dropdowns, badges, icons) but not enforced at storage layer.
3. **Full-text search** -- MiniSearch library (~6KB). In-memory index built on campaign load by extracting text from ProseMirror JSON. No stored plaintext. Supports fuzzy, prefix, and filtered search.

## Open Questions

None -- all resolved during design discussion.

## Approaches Considered

### Approach A: Single Schema, Metadata Bag
One Note type with `metadata: Record<string, unknown>`. Simplest possible but loses all type safety on type-specific fields. No way to validate combat data without ad-hoc parsing. Rejected because we already have validators and they're worth keeping.

### Approach B: Single Schema + Opt-In Validators (selected)
Simple base model with typeData as unknown. Per-type validators available but not mandatory. Best balance of simplicity and safety. Selected because it preserves existing Zod work as opt-in tools.

### Approach C: Universal Note + Extract Combat
Same simplification for notes but combat moves to its own table/model. Cleaner separation but more migration work and two systems to query. Not needed -- combat can stay as a note type with its validator.

### SQLite Migration (rejected)
SQLite in the browser uses WASM on top of IndexedDB/OPFS -- same storage limits, more complexity, additional bundle size. No benefit for this use case. Dexie stays.

## Commander's Intent

**Desired End State:** The note system uses a single `baseNoteSchema` with `type: string` and `typeData: unknown`. All 9 existing note types remain fully functional. Per-type Zod validators exist as opt-in utilities. MiniSearch provides full-text search across note titles and bodies. The export system produces identical output to before. All existing stored notes remain readable without migration.

**Purpose:** Eliminate schema complexity that slows down adding new note types. Each new note type should require zero Dexie schema changes and zero repository changes -- just a type string, an optional validator, and a UI component.

**Constraints:**
- MUST NOT break existing stored note data -- all notes created before this refactor must remain readable
- MUST NOT change the export markdown format (renderNote.ts output must be identical)
- MUST NOT modify the attachment system (already implemented and working)
- MUST NOT require a Dexie schema version bump for the note model change (the base schema is strictly looser)
- MUST keep Zod validation on every repository read (follow the v3 repository pattern)

**Freedoms:**
- The implementing agent MAY choose how to organize noteValidators.ts internally (one file vs. directory)
- The implementing agent MAY choose MiniSearch configuration (field weights, fuzzy parameters, tokenizer)
- The implementing agent MAY choose whether to update NotesScreen type grouping to be data-driven or leave it hardcoded (recommend deferring)

## Execution Guidance

**Observe (signals to monitor):**
- `tsc --noEmit` must pass after each component change -- this is the primary verification tool
- `npm run build` must succeed before considering work complete
- Manual check: create a note of each type via existing UI, confirm it appears in list view and can be opened

**Orient (codebase conventions to follow):**
- Follow the v3 repository pattern: try/catch wrapper, Zod `safeParse` on every read, `console.warn` for validation failures, `throw new Error('{repoName}.{methodName} failed: ${e}')` for caught exceptions. See `campaignRepository.ts`, `sessionRepository.ts` as templates.
- The `characterRepository.ts` pattern (no Zod, simpler methods) is legacy -- do not follow it.
- All IDs use `generateId()` from `src/utils/ids.ts`. All timestamps use `nowISO()` from `src/utils/dates.ts`.
- React hooks go in `src/features/{domain}/` directories. Utility functions go in `src/utils/`.

**Escalate When:**
- A Dexie schema version bump is needed (currently v4 -- confirm the note index change doesn't require v5)
- The export system (`renderNote.ts`, `useExportActions.ts`) needs changes beyond what `note.type` as a string provides
- Any existing UI component fails to compile after the type change in a non-obvious way

**Shortcuts (apply without deliberation):**
- Use `baseNoteSchema.safeParse()` in noteRepository -- same pattern as all other v3 repos
- Place `noteValidators.ts` in `src/types/` alongside `note.ts`
- Place `useNoteSearch.ts` in `src/features/notes/` alongside existing note hooks
- Use `z.string()` for type, `z.unknown().optional()` for typeData -- do not overthink these

## Decision Authority

**Agent Decides Autonomously:**
- File structure for noteValidators.ts
- Function signatures for validator helpers
- MiniSearch configuration (field weights, fuzzy thresholds, tokenizer)
- extractText() implementation (recursive ProseMirror JSON walker)
- Whether to split noteValidators into multiple files or keep as one
- Internal implementation details within useNoteSearch hook

**Agent Recommends, Human Approves:**
- Whether a Dexie schema version bump is needed (check if note index definition changes)
- Whether to update NotesScreen grouping from hardcoded to data-driven in this PR
- Any changes to the export system beyond confirming compatibility
- Whether to add a `plainText` cache field for performance (recommend against -- MiniSearch indexing is fast enough)

**Human Decides:**
- Adding new note types during this refactor (out of scope)
- Changes to the attachment model (already working)
- Any changes to the export markdown format
- UX changes to how notes are displayed or created

## War-Game Results

**Most Likely Failure:** TypeScript compilation errors. The current `Note` type is a discriminated union. Code that pattern-matches on `note.type` with exhaustive switches will break. Mitigation: keep `NoteType` as a string literal union (`'generic' | 'npc' | ...`) so type narrowing still works in UI code. The agent should run `tsc --noEmit` after changing `types/note.ts` to find all breakage points before proceeding.

**Scale Stress:** N/A. Hundreds of notes per campaign. MiniSearch indexes thousands of documents in milliseconds. Not a concern at this scale.

**Dependency Risk:** MiniSearch (~6KB, well-maintained, MIT license). If abandoned, the search hook is isolated in one file and replaceable with any search library that supports add/remove/search. Low risk.

**Maintenance (6-month check):** Strong. The architecture diagram, component responsibilities, and data flow are well-documented. The separation between base schema and validators is intuitive. A new developer could understand and modify the system from this design doc.

## Evaluation Metadata

- Evaluated: 2026-03-30
- Cynefin Domain: Clear
- Critical Gaps Found: 1 (1 resolved -- attachments already exist)
- Important Gaps Found: 4 (4 resolved -- verification strategy, backward compat constraints, repo pattern guidance, cascade cleanup)
- Suggestions: 3 (noted but not blocking)

## Next Steps

- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-30-universal-note-model-design.md`)
- [ ] Add `minisearch` to package.json dependencies
- [ ] Verify whether note index definition change requires Dexie v5 (may not -- `type` index is already `z.string()` compatible)
