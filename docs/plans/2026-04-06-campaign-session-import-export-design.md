---
date: 2026-04-06
topic: "Campaign and session JSON import/export with notes, party, and privacy controls"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-04-06
tags:
  - design
  - campaign-session-import-export
---

# Campaign & Session Import/Export -- Design

## Summary

Add JSON-based import/export for campaigns, sessions, and characters — bundling notes, party state, attachments, and entity links. Players can share session files so absent players catch up, or share full campaign files so new players get all history. Notes support a `visibility` flag (`public`/`private`) so players can exclude metagame information from exports. Import includes a preview UI with selective import and ID-based merge/dedup.

## Acceptance Criteria

### Character Export/Import
- Produces valid `.skaldmark.json` containing the character, all entity-linked notes (minus private), and their attachments as base64
- Re-importing the same file into an empty campaign produces identical entities
- Importing a character that already exists locally (same ID) updates it if `updatedAt` is newer, skips if identical

### Session Export/Import
- Includes session, session notes, active party, party members, linked characters, and character-linked notes
- Re-import into a different campaign creates all entities under the target campaign with correct `campaignId`
- Importing a session where 3 of 10 notes already exist locally results in 7 inserts, 3 updates-or-skips (based on `updatedAt`), zero duplicates

### Campaign Export/Import
- Includes all sessions, notes, parties, characters, entity links, and attachments
- Re-import into a fresh app recreates the full campaign with all relationships intact
- The imported campaign in the bundle IS the target — no user selection needed for campaign-type imports

### Privacy
- Exporting with default settings produces a file containing zero notes where `visibility === 'private'`
- Opting in to "Include private notes" includes all notes regardless of visibility
- Privacy filter also removes entity links and attachments that reference stripped private notes

### Merge Dedup
- Same entity ID + newer `updatedAt` = update local copy
- Same entity ID + identical `updatedAt` = skip (no-op)
- Same entity ID + older `updatedAt` = skip (keep local)
- No entity ID match = insert

### Import Targeting Rules
- **Campaign import:** the campaign in the bundle IS the target. If a campaign with the same ID exists locally, merge into it. If not, create it. No user campaign selection.
- **Session import:** user must select a target campaign in the preview UI. The session is imported under that campaign.
- **Character import:** user may optionally select a target campaign for character-scoped notes. If no campaign selected, character is imported standalone; notes are imported without `campaignId` (orphaned until assigned).

## Approach Selected

**Blend of A (ID-Based Merge) and C (Lightweight Character Scoping):** Simple JSON bundles with ID-based deduplication, using entity links (not a new schema field) to determine which notes travel with a character. Minimal schema additions — only `visibility` on notes.

## Architecture

```
Export Flow:
  UI Trigger --> Scope Collector --> Privacy Filter --> Bundle Serializer --> File Download

Import Flow:
  File Picker --> Bundle Parser --> Zod Validator --> Import Preview UI --> Merge Engine --> IndexedDB
```

**Key components:**
1. **Bundle Format** — typed JSON envelope with version, scope type, and entity arrays
2. **Scope Collectors** — three functions gathering entities for character/session/campaign exports
3. **Privacy Filter** — strips notes with `visibility === 'private'` and their related links/attachments
4. **Bundle Parser + Validator** — reads JSON, validates envelope + entities with existing Zod schemas
5. **Merge Engine** — ID-based dedup with `updatedAt` comparison, re-parenting, ordered upserts
6. **Import Preview UI** — shows contents, conflicts, and allows selective import with checkboxes

**Schema addition:**
- Notes: add `visibility: 'public' | 'private'` (default `'public'`)
- No `characterId` field — character-note relationships derived from entity links at export time

## Components

### 1. Bundle Format (`types/bundle.ts`)
**Owns:** The JSON envelope shape and version.
**Does NOT own:** Individual entity schemas.

```
BundleEnvelope {
  version: 1
  type: 'character' | 'session' | 'campaign'
  exportedAt: ISO string
  exportedBy?: string
  system: 'dragonbane'
  contentHash?: string           // SHA-256 of JSON.stringify(contents) for integrity check
  contents: {
    campaign?: Campaign
    sessions?: Session[]
    parties?: Party[]
    partyMembers?: PartyMember[]
    characters?: CharacterRecord[]
    notes?: Note[]
    entityLinks?: EntityLink[]
    attachments?: AttachmentMeta[]  // metadata + base64 blob data
  }
}
```

File extension: `.skaldmark.json` (replaces old `.skaldbok.json` for character exports).

### 2. Scope Collectors (`utils/export/collectors.ts`)
**Owns:** Determining which entities to include per export type.
**Does NOT own:** Serialization or file I/O.

- **`collectCharacterBundle(characterId)`** — character record + notes linked via entity links + those notes' entity links + attachments
  - **Entity link traversal rule:** include notes where `fromEntityId = characterId` OR `toEntityId = characterId`, regardless of `relationshipType` (cast a wide net — any link between a character and a note means the note is relevant to that character)
- **`collectSessionBundle(sessionId)`** — session + notes with that sessionId + active party + party members + linked characters + character-linked notes for those characters + entity links + attachments
- **`collectCampaignBundle(campaignId)`** — everything: campaign + all sessions + all parties/members + all notes + all referenced characters + all entity links + all attachments

### 3. Privacy Filter (`utils/export/privacyFilter.ts`)
**Owns:** Removing private notes and orphaned references from a collected bundle.

Walks `contents.notes`, removes `visibility === 'private'`, then removes entity links and attachments that referenced removed notes. Export UI offers checkbox: "Include private notes (visible to recipient)".

### 4. Bundle Parser + Validator (`utils/import/bundleParser.ts`)
**Owns:** JSON parsing, envelope validation, per-entity Zod validation.

Returns `ParsedBundle` with per-entity validation errors. Supports partial import (skip invalid entities). Also detects and accepts legacy `.skaldbok.json` character files (bare CharacterRecord without envelope) for backwards compatibility.

### 5. Merge Engine (`utils/import/mergeEngine.ts`)
**Owns:** ID-based dedup, conflict resolution, re-parenting, database upserts.

**Rules:**
- Same ID exists locally: compare `updatedAt` — keep newer. Identical timestamps: skip.
- ID doesn't exist locally: insert as-is.
- Re-parenting: set `campaignId` on notes/sessions/parties to target campaign. Preserve `sessionId` if session is in bundle; clear if not.
- Party merge: link party members to existing local characters by ID. Import missing characters first.
- Selective import: only process entities the user checked in preview UI.
- Returns `MergeReport: { inserted, updated, skipped, errors[] }`

**Processing order:** Campaign -> Sessions -> Parties -> Party Members -> Characters -> Notes -> Entity Links -> Attachments (foreign keys resolve correctly).

### 6. Import Preview UI (`components/import/ImportPreview.tsx`)
**Owns:** Showing bundle contents and collecting user selections before commit.

Shows: bundle type, entity counts per type, validation warnings, conflict list (entities with different `updatedAt` than local). Checkboxes per entity group for selective import. User confirms or cancels.

## Data Flow

### Export

1. User taps "Export" on character / session / campaign
2. Scope Collector queries IndexedDB for all related entities
3. Privacy Filter removes private notes + orphaned links/attachments (unless opted in)
4. Bundle Serializer wraps in envelope, converts attachment Blobs to base64
5. File download triggered: `{slug}.skaldmark.json`

### Import

1. User taps "Import" -> file picker (`.skaldmark.json` or legacy `.skaldbok.json`)
2. Bundle Parser reads JSON, validates envelope + entities
3. Import Preview UI renders entity counts, conflicts, and checkboxes
4. User selects target campaign (for session/character imports), checks/unchecks entities, confirms
5. Merge Engine processes entities in FK order, deduplicating by ID
6. MergeReport shown as toast: "Imported 8 new, updated 3, skipped 1"

### Key Transformations

- **Export: Blob -> base64** for attachment portability in JSON
- **Import: base64 -> Blob** restored to IndexedDB
- **Import: Re-parenting** — `campaignId` overwritten to target campaign
- **Import: Character linking** — party members reference characters by ID; import characters first so links resolve

## Error Handling

### Parse/Validation Errors
- Invalid JSON: "Invalid file — not a valid Skaldmark export." Abort.
- Zod validation failures: shown per-entity in Import Preview. Allow partial import.

### Version Mismatch
- `version > currentVersion`: "Exported from a newer Skaldmark version. Please update." Abort.
- `version < currentVersion`: apply migration transforms.

### Large Files / Attachments
- Base64 inflates ~33%. No hard size limit — let browser handle.
- Progress indicator during import. Process attachments last.
- Individual attachment decode failure: skip, log warning, continue.
- **Attachment size warning:** if total attachment size exceeds 20MB during export, warn the user and offer to export without attachments.

### Integrity
- If `contentHash` is present in the envelope, compute SHA-256 of `JSON.stringify(contents)` and compare. Mismatch → warn "File may be corrupted" in Import Preview (non-blocking — user can proceed).

### Merge Logging
- `console.info` each insert/update/skip during merge with entity type and ID (e.g., `"merge: insert note abc123"`). Useful for debugging without adding infrastructure.

### Target Campaign Missing
- Session/character import: user must select target campaign in preview UI.
- If no campaigns exist: prompt to create one first.

### Merge Conflicts
- ID collision with different `updatedAt`: newer wins.
- ID collision with identical `updatedAt`: skip (no-op).
- All skipped/failed entities reported in MergeReport.

### Privacy
- Filter runs at export time only. Once in a file, it's there.
- Default: private notes excluded. Opt-in toggle labeled clearly.

## Open Questions

Resolved during design:
1. **Replace existing character export?** Yes — new bundle format replaces old `.skaldbok.json`. Legacy files still importable via format detection.
2. **How are character-scoped notes created?** Auto-linked via entity links. No new `characterId` field on notes.
3. **Selective import?** Yes — Import Preview UI has checkboxes per entity group.
4. **Attachment size limits?** No hard limits — browser handles it.

## Approaches Considered

### Approach A: Single JSON Bundle with ID-Based Merge (Selected, blended with C)
Simple JSON bundles, dedup by entity ID, minimal schema changes. Predictable and debuggable.

### Approach B: Bundle with Origin Tracking
Added `originId` for robust dedup across re-IDs + manifest header. Rejected: unnecessary complexity for a TTRPG app where IDs are stable UUIDs.

### Approach C: Layered Export with Note Ownership Model (Partially selected)
Formal `ownerType`/`ownerId` on notes. The character-scoping concept was adopted but implemented via existing entity links instead of new schema fields, keeping it lightweight.

## Commander's Intent

**Desired End State:** Players can export and import campaigns, sessions, and characters as self-contained `.skaldmark.json` files. Importing merges cleanly with existing data (no duplicates). Private notes are excluded by default. The system replaces the existing character-only export and works fully offline.

**Purpose:** Enable players to share game state — absent players catch up via session exports, new players onboard via campaign exports, characters travel between groups with their notes.

**Constraints:**
- MUST NOT modify existing repository function signatures
- MUST NOT change the Dexie schema version without a proper migration in `client.ts`
- MUST NOT add new npm dependencies without human approval
- MUST NOT modify existing Zod schemas in `types/` — only extend them (add optional fields)
- MUST follow the existing module-export repository pattern (not classes)
- MUST use `safeParse()` for bundle validation at the import boundary
- MUST return `ImportResult`-style result objects from import functions (not throw)
- MUST use existing `shareFile`/download patterns from `utils/export/delivery.ts` for export delivery
- MUST support legacy `.skaldbok.json` character files on import (detect by structure)

**Freedoms:**
- The implementing agent MAY choose internal helper function naming and decomposition
- The implementing agent MAY decide file organization within `utils/import/` and `utils/export/`
- The implementing agent MAY decide component decomposition within the ImportPreview UI
- The implementing agent MAY choose error message wording for toasts
- The implementing agent MAY choose test file organization and test case design

## Execution Guidance

**Observe (signals to monitor during implementation):**
- TypeScript compiler errors after each file change
- Zod schema validation — ensure new `visibility` field doesn't break existing note reads
- Dexie migration — verify v6 upgrade runs cleanly and existing data is preserved
- Bundle round-trip: export → import → verify entities match

**Orient (codebase conventions to follow):**
- `src/utils/importExport.ts` — template for the `ImportResult` pattern
- `src/storage/repositories/noteRepository.ts` — template for any new repository queries
- `src/utils/migrations.ts` — template for bundle version migration (version-indexed functions)
- `src/features/export/useExportActions.ts` — template for hook-level error handling (catch + toast)
- `src/storage/db/client.ts` — where to add Dexie v6 schema with `visibility` index on notes

**Escalate When:**
- A new npm dependency seems needed (e.g., for SHA-256 hashing — check if Web Crypto API suffices first)
- Database schema changes beyond adding `visibility` to notes are needed
- The entity link traversal for character-note association produces unexpected results (too many or too few notes)
- Any change to existing public component props or hook return types is needed

**Shortcuts (Apply Without Deliberation):**
- Use `safeParse()` at bundle read boundary, but THROW on critical validation failures (unlike storage reads which silently degrade)
- Call existing repository `create()`/`update()` for all storage writes
- Use `generateId()` from `src/utils/ids.ts` for any new entity IDs
- Use `nowISO()` from `src/utils/dates.ts` for timestamps
- Place new export utilities in `src/utils/export/`, import utilities in `src/utils/import/`
- New React components go in `src/components/import/`
- Dexie schema bump: add `version(6).stores({ notes: 'id, campaignId, sessionId, type, status, pinned, visibility' })` in `client.ts`

## Decision Authority

**Agent Decides Autonomously:**
- File/folder organization within `utils/import/`, `utils/export/`, `components/import/`
- Internal function naming and decomposition
- Test organization and test case design
- Error message wording for toasts
- Helper function extraction within components
- Bundle envelope field ordering
- `console.info` log message formatting for merge operations

**Agent Recommends, Human Approves:**
- Dexie schema version bump (v5 → v6) and migration definition
- New Zod schema for BundleEnvelope
- Entity link traversal implementation details (which relationship types, direction)
- Import Preview UI layout and interaction flow
- Attachment size warning threshold (suggested: 20MB)
- Any refactoring of existing export utilities to share code with new bundle export

**Human Decides:**
- Scope changes (adding sync, conflict resolution UI, etc.)
- Changes to existing Note or Character type schemas beyond `visibility`
- New npm dependencies
- Any changes to existing repository function signatures
- UX decisions for import flow not covered by this plan

## War-Game Results

**Most Likely Failure:** Merge engine processes entities in wrong order, or a partial bundle (e.g., session export without campaign) references a parent that doesn't exist locally. **Mitigation:** Processing order is defined (Campaign → Sessions → Parties → Members → Characters → Notes → Links → Attachments). For partial bundles, missing parent `campaignId` is set to the user-selected target campaign. Missing `sessionId` references are preserved if the session is in the bundle, cleared if not.

**Scale Stress:** A long-running campaign (50+ sessions, hundreds of notes, dozens of attachments) produces a large file. Architecture handles this linearly. Main risk: memory pressure from base64-encoding many large attachments simultaneously. **Mitigation:** Attachment size warning at 20MB threshold during export. Process attachments last during import to show content quickly.

**Dependency Risk:** Design depends on Dexie, Zod, and Web Crypto API (for content hash). All are stable. Biggest risk is Dexie migration API changes. **Mitigation:** The version-indexed migration pattern is standard Dexie approach and unlikely to break.

**Maintenance Assessment (6-month check):** Component boundaries are clear and well-documented. Acceptance criteria make "working correctly" verifiable. The main maintenance concern is entity link traversal — if new relationship types are added later, the "cast a wide net" approach may include unexpected notes in character exports. This is a feature, not a bug, but should be documented in code comments.

## Evaluation Metadata
- Evaluated: 2026-04-06
- Cynefin Domain: Complicated
- Critical Gaps Found: 2 (2 resolved)
- Important Gaps Found: 3 (3 resolved)
- Suggestions: 3 (3 incorporated)

## Next Steps
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-04-06-campaign-session-import-export-design.md`)
- [ ] Add `visibility` field to note schema + migration
- [ ] Define bundle Zod schema
- [ ] Implement scope collectors for all three export types
- [ ] Build import preview UI with selective import
- [ ] Build merge engine with ordered upserts
- [ ] Replace existing character export with new bundle format
- [ ] Add export/import buttons to campaign, session, and character UI screens
