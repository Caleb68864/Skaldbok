---
date: 2026-03-30
topic: "Universal note model -- simplify from 9 discriminated types to one base schema with opt-in validators, attachments table, MiniSearch"
author: Caleb Bennett
status: draft
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
│  │  notes table                           │  │
│  │  id, campaignId, sessionId, type,      │  │
│  │  title, body, status, pinned, tags,    │  │
│  │  attachmentIds, typeData, timestamps   │  │
│  ├────────────────────────────────────────┤  │
│  │  attachments table                     │  │
│  │  id, noteId, filename, mimeType,       │  │
│  │  blob, createdAt                       │  │
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
- Add `attachmentIds: z.array(z.string()).optional()` to the base schema
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

### 4. `storage/repositories/attachmentRepository.ts` -- Attachment CRUD (new file)

- Separate Dexie table: `attachments` with schema `id, noteId, filename, mimeType, blob, createdAt`
- `getAttachmentsByNote(noteId)` -- returns metadata only (no blob) for list views
- `getAttachmentBlob(id)` -- returns full blob for rendering
- `createAttachment(noteId, file)` -- stores blob, returns id to add to note's `attachmentIds`
- `deleteAttachment(id)` -- removes blob record
- Keeps image data out of the notes table so note reads stay fast

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

### Image attachments

Images stored in a separate `attachments` Dexie table (`id, noteId, filename, mimeType, blob, createdAt`). Notes reference attachment IDs via `attachmentIds: string[]` on the base schema. Attachments are loaded lazily -- list views never touch blob data. This keeps note reads fast regardless of how many images are attached.

### Searching notes

On campaign load, `useNoteSearch` builds a MiniSearch index by extracting plain text from each note's ProseMirror JSON body. The index lives in memory only -- no stored plaintext field. On note create/update/delete, the index is updated incrementally. Search queries return ranked results with match metadata for highlighting. Filtering by type, tags, pinned status can be combined with full-text search via MiniSearch's `filter` option.

## Error Handling

- **Existing data migration:** Current notes already have `type` and `typeData` fields -- they're already compatible. Base schema is strictly looser. No data migration needed. Version bump only if indexes change.
- **Invalid typeData on read:** Validator returns null, UI shows graceful fallback. Handles corrupt data, schema evolution, and notes created before a validator existed.
- **Unknown note types:** `type: z.string()` means any type is valid. List views render fine. Detail views without a matching component show title + body with "Unknown type" badge.
- **typeData shape disagreement:** If a drawer constructs one shape but the validator later expects more fields, old notes get null from the validator and fall back gracefully.

## Resolved Decisions

1. **Image attachments** -- Separate `attachments` Dexie table with blob storage. Notes reference via `attachmentIds: string[]` on the base schema. Blobs loaded lazily on detail view only.
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

## Next Steps

- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-30-universal-note-model-design.md`)
- [ ] Add `minisearch` to package.json dependencies
- [ ] Dexie version bump (v3 → v4) to add `attachments` table and `attachmentIds` field
