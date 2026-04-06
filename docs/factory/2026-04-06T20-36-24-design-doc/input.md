---
date: 2026-04-06
topic: "Bestiary, Encounters, and Campaign Import/Export — Unified Design"
author: Caleb Bennett
status: draft
tags:
  - design
  - creature-templates
  - encounters
  - bestiary
  - import-export
  - campaign
---

# Bestiary, Encounters, and Campaign Import/Export -- Unified Design

## Summary

A single coordinated feature set that introduces creature templates (campaign-scoped bestiary), generalized encounters (combat/social/exploration), and JSON-based import/export for campaigns, sessions, and characters — all sharing one Dexie v6 migration and a unified bundle format. Creature templates store Dragonbane stat blocks; encounters group participants and auto-link notes; import/export bundles include all entity types from day one. The bundle format replaces the old `.skaldbok.json` character export.

## Approach Selected

**Feature-Led with Shared Preamble:** A shared infrastructure layer (Dexie v6, bundle format, entity link conventions) built once, then two feature tracks (Bestiary & Encounters, Import/Export) that build on it. This maps cleanly to parallel `/forge` sub-specs while eliminating duplication.

Combined from two individual evaluated designs:
- `2026-04-06-campaign-session-import-export-design.md` (status: evaluated)
- `2026-04-06-creature-templates-and-encounters-design.md` (status: evaluated)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED INFRASTRUCTURE                         │
│                                                                  │
│  Dexie v6 Schema          Bundle Format v1         Entity Links  │
│  ┌─────────────────┐      ┌──────────────────┐     (existing)    │
│  │ notes (+visibility)│   │ BundleEnvelope   │                   │
│  │ creatureTemplates │    │ + all entity     │     New types:    │
│  │ encounters        │    │   arrays incl.   │     'encounter'   │
│  │ (migration logic) │    │   creatures &    │     'creature'    │
│  └─────────────────┘      │   encounters     │                   │
│                            └──────────────────┘                  │
├─────────────────────────────────────────────────────────────────┤
│  FEATURE A: Bestiary & Encounters                                │
│                                                                  │
│  CreatureTemplate repo ──> Bestiary UI                           │
│  Encounter repo ──> Encounter UI (combat/social/exploration)     │
│  Note auto-linking ──> Entity links                              │
│  Combat timeline migration ──> Encounter entities                │
│  NPC note migration ──> Creature templates                       │
├─────────────────────────────────────────────────────────────────┤
│  FEATURE B: Import/Export                                        │
│                                                                  │
│  Scope Collectors ──> Privacy Filter ──> Bundle Serializer       │
│  Bundle Parser ──> Import Preview UI ──> Merge Engine            │
│  Handles: campaigns, sessions, characters,                       │
│           creature templates, encounters                         │
└─────────────────────────────────────────────────────────────────┘
```

**Key integration points:**
1. Bundle format includes `creatureTemplates` and `encounters` arrays from day one
2. Scope collectors for session/campaign exports gather encounters + creature templates alongside notes/characters
3. Merge engine processing order: Campaign → Sessions → Parties → Members → Characters → Creature Templates → Encounters → Notes → Entity Links → Attachments
4. Dexie v6 is a single migration: new tables + `visibility` on notes + combat/NPC note migration
5. Entity links gain `'encounter'` and `'creature'` as entity types (free-string field, no schema change)

---

## Shared Infrastructure Components

### Dexie v6 Schema (`storage/db/client.ts`)

Single version bump handling all schema changes:
- Adds `creatureTemplates` table: `'id, campaignId, category, status, name'`
- Adds `encounters` table: `'id, sessionId, campaignId, type, status'`
- Adds `visibility` index to notes: `'id, campaignId, sessionId, type, status, pinned, visibility'`
- Runs combat note → encounter migration
- Runs NPC note → creature template migration
- Sets migration flags (`migration_v6_combat`, `migration_v6_npc`) so each runs once

### Bundle Format (`types/bundle.ts`)

```
BundleEnvelope {
  version: 1
  type: 'character' | 'session' | 'campaign'
  exportedAt: ISO string
  exportedBy?: string
  system: 'dragonbane'
  contentHash?: string           // SHA-256 of JSON.stringify(contents)
  contents: {
    campaign?: Campaign
    sessions?: Session[]
    parties?: Party[]
    partyMembers?: PartyMember[]
    characters?: CharacterRecord[]
    creatureTemplates?: CreatureTemplate[]
    encounters?: Encounter[]
    notes?: Note[]
    entityLinks?: EntityLink[]
    attachments?: AttachmentMeta[]  // metadata + base64 blob data
  }
}
```

File extension: `.skaldmark.json` (replaces old `.skaldbok.json` for character exports).

---

## Feature A: Bestiary & Encounters

### Creature Template

**Owns:** The canonical Dragonbane stat block for a creature type.
**Fields:**
- `id`, `campaignId` (required — campaign-scoped)
- `name`, `description` (rich text / Tiptap JSON document)
- `category`: `'monster'` | `'npc'` | `'animal'`
- `role?`, `affiliation?` (for NPCs, migrated from NPC note type)
- `stats`: `{ hp: number, armor: number, movement: number }`
- `attacks`: `Array<{ name, damage, range, skill, special? }>`
- `abilities`: `Array<{ name, description }>`
- `skills`: `Array<{ name, value }>` (only the relevant ones)
- `tags`: string[] (for searching — "undead", "humanoid", etc.)
- `imageUrl?`: optional portrait/token
- `status`: `'active'` | `'archived'`
- Timestamps (`createdAt`, `updatedAt`), `schemaVersion`

**Does NOT own:** Instance state (current HP, conditions in a fight).

### Encounter

**Owns:** The grouping of participants and encounter context.
**Fields:**
- `id`, `sessionId`, `campaignId`
- `title` (e.g., "Goblin Ambush", "Meeting Siur Talos")
- `type`: `'combat'` | `'social'` | `'exploration'` (fixed enum)
- `status`: `'active'` | `'ended'`
- `startedAt`, `endedAt?`
- `participants`: `Array<EncounterParticipant>` (inline)
- `combatData?`: `{ currentRound, events[] }` — only for combat-type encounters
- Timestamps, `schemaVersion`

**Does NOT own:** Notes. Notes link to encounters via entity links.

### Encounter Participant (inline in Encounter)

**Owns:** Instance state of a creature or character within an encounter.
**Fields:**
- `id` (within the encounter)
- `name` (display name, e.g., "Goblin #1")
- `type`: `'pc'` | `'npc'` | `'monster'`
- `linkedCreatureId?` — points to Creature Template
- `linkedCharacterId?` — points to Character Record (for PCs)
- `instanceState`: `{ currentHp?, conditions?: string[], notes?: string }`
- `sortOrder` (initiative/display ordering)

### Bestiary Screen (`features/bestiary/` + `screens/BestiaryScreen.tsx`)

Campaign-scoped CRUD UI for creature templates. Search, filter by category/tags, browse. Tap to view/edit stat blocks. "Add to Encounter" action when an encounter is active.

### Encounter UI (`features/encounters/`)

- Creating/managing encounters, adding participants (from bestiary, party, or quick-create)
- For `combat` type: renders combat timeline with participants panel (migrated from CombatTimeline.tsx)
- For `social`/`exploration` type: participant list + linked notes feed
- Stat drawer: tap a participant to view template stats + edit instance state

### Feature A Data Flow

**Creating a Creature Template:**
Bestiary screen → stat block form → `creatureTemplateRepository.create()` → IndexedDB `creatureTemplates`

**Starting an Encounter:**
Session screen → "New Encounter" → pick type + title → `encounterRepository.create()` → linked to active session via `sessionId`

**Adding Participants:**
- **From Bestiary:** search templates → select → participant spawned with `linkedCreatureId`, instance state initialized from template stats
- **From Party:** select PC → participant with `linkedCharacterId`
- **Quick-create:** name + key stats inline → creates creature template AND participant in one step

**Recording Stats Mid-Encounter:**
Tap participant → stat drawer → template stats (read-only) + editable instance state (currentHp, conditions) → update encounter record. Target: < 3 taps to record a stat like armor.

**Notes During Encounter:**
Note created while encounter is active → auto-linked via entity links (`encounter` → `note`, relationship `contains`) → note also linked to session

**Searching / Exporting Later:**
Filter notes by encounter. Browse encounter history in session/campaign. Export includes participant stat blocks + linked notes.

### Feature A Acceptance Criteria

1. **Bestiary CRUD:** A user can create, view, edit, and archive creature templates from a Bestiary screen. Each template stores name, HP, armor, movement, attacks, abilities, skills, and tags.
2. **Quick-create from encounter:** A user can tap a participant in an encounter, type a stat (e.g., armor: 6), and have it create/update the linked creature template in < 3 taps.
3. **Encounter creation:** A user can start an encounter (combat, social, or exploration) from the session screen, give it a title, and add participants from the bestiary, party, or quick-create.
4. **Combat encounters:** Combat-type encounters render the combat timeline with the existing event system (rounds, events, initiative). Participants show linked creature stats in a stat drawer.
5. **Non-combat encounters:** Social/exploration encounters show a participant list and linked notes feed.
6. **Note auto-linking:** Notes created while an encounter is active are automatically linked to that encounter via entity links. They appear in the encounter's linked notes list.
7. **Encounter history:** Past encounters are browsable from the session screen with their participants and linked notes.
8. **Migration complete:** All existing combat notes are migrated to combat-type encounters. All existing NPC notes are migrated to creature templates with `category: 'npc'`. Original data preserved as archived until verified.
9. **NPC note type deprecated:** The `'npc'` note type is removed from the new-note UI. Existing NPC notes are accessible as archived but no new ones can be created.
10. **Bestiary navigation:** The Bestiary is accessible from the session screen (when a campaign is active) and from the main navigation.

---

## Feature B: Import/Export

### Scope Collectors (`utils/export/collectors.ts`)

**Owns:** Determining which entities to include per export type.

- **`collectCharacterBundle(characterId)`** — character record + notes linked via entity links + those notes' entity links + attachments
  - Entity link traversal: include notes where `fromEntityId = characterId` OR `toEntityId = characterId`, regardless of `relationshipType`
- **`collectSessionBundle(sessionId)`** — session + notes + active party + party members + linked characters + character-linked notes + **encounters with that sessionId** + **creature templates referenced by encounter participants** + entity links + attachments
- **`collectCampaignBundle(campaignId)`** — everything: campaign + all sessions + all parties/members + all notes + all characters + **all creature templates** + **all encounters** + all entity links + all attachments

### Privacy Filter (`utils/export/privacyFilter.ts`)

Walks `contents.notes`, removes `visibility === 'private'`, then removes entity links and attachments that referenced removed notes. Export UI offers checkbox: "Include private notes (visible to recipient)".

Notes schema addition: `visibility: 'public' | 'private'` (default `'public'`).

### Bundle Parser + Validator (`utils/import/bundleParser.ts`)

JSON parsing, envelope validation, per-entity Zod validation (including creature template and encounter schemas). Returns `ParsedBundle` with per-entity validation errors. Supports partial import (skip invalid entities). Detects legacy `.skaldbok.json` character files (bare CharacterRecord without envelope).

### Merge Engine (`utils/import/mergeEngine.ts`)

**Rules:**
- Same ID exists locally: compare `updatedAt` — keep newer. Identical timestamps: skip.
- ID doesn't exist locally: insert as-is.
- Re-parenting: set `campaignId` on all imported entities to target campaign. Preserve `sessionId` if session is in bundle; clear if not.
- Party merge: link party members to existing local characters by ID. Import missing characters first.
- Creature template merge: by ID like all other entities.
- Encounter merge: by ID. Participant `linkedCreatureId` references must resolve (template imported first in processing order).
- Selective import: only process entities the user checked in preview UI.
- Returns `MergeReport: { inserted, updated, skipped, errors[] }`

**Processing order:** Campaign → Sessions → Parties → Party Members → Characters → Creature Templates → Encounters → Notes → Entity Links → Attachments (foreign keys resolve correctly).

### Import Preview UI (`components/import/ImportPreview.tsx`)

Shows: bundle type, entity counts per type (including creature templates and encounters), validation warnings, conflict list (entities with different `updatedAt` than local). Checkboxes per entity group for selective import. User confirms or cancels.

### Import Targeting Rules

- **Campaign import:** the campaign in the bundle IS the target. Same ID locally = merge. No ID match = create.
- **Session import:** user selects target campaign in preview UI. Session imported under that campaign.
- **Character import:** optionally select target campaign. No campaign = standalone import.

### Feature B Data Flow

**Export:**
1. User taps "Export" on character / session / campaign
2. Scope Collector queries IndexedDB for all related entities (including creature templates + encounters for session/campaign)
3. Privacy Filter removes private notes + orphaned links/attachments (unless opted in)
4. Bundle Serializer wraps in envelope, converts attachment Blobs to base64
5. File download: `{slug}.skaldmark.json`

**Import:**
1. User taps "Import" → file picker (`.skaldmark.json` or legacy `.skaldbok.json`)
2. Bundle Parser reads JSON, validates envelope + entities
3. Import Preview UI renders entity counts, conflicts, checkboxes
4. User selects target campaign (for session/character imports), checks/unchecks entities, confirms
5. Merge Engine processes entities in FK order, deduplicating by ID
6. MergeReport shown as toast: "Imported 8 new, updated 3, skipped 1"

### Feature B Acceptance Criteria

**Character Export/Import:**
- Produces valid `.skaldmark.json` containing the character, all entity-linked notes (minus private), and their attachments as base64
- Re-importing into an empty campaign produces identical entities
- Same ID + newer `updatedAt` = update; identical = skip

**Session Export/Import:**
- Includes session, notes, party, characters, encounters, creature templates, entity links, attachments
- Re-import into a different campaign creates all entities under target campaign
- Dedup works correctly (N inserts, M updates-or-skips, zero duplicates)

**Campaign Export/Import:**
- Includes all sessions, notes, parties, characters, creature templates, encounters, entity links, attachments
- Re-import into fresh app recreates full campaign with all relationships intact

**Privacy:**
- Default export excludes notes with `visibility === 'private'`
- Opt-in toggle includes all notes regardless
- Privacy filter also removes entity links and attachments referencing stripped private notes

**Merge Dedup:**
- Same ID + newer `updatedAt` = update
- Same ID + identical `updatedAt` = skip
- Same ID + older `updatedAt` = skip (keep local)
- No ID match = insert

---

## Error Handling

### Shared Infrastructure

**Dexie v6 Migration Failure:** Migration runs inside upgrade handler. Failure aborts entire upgrade, app stays on v5, original data untouched. Migration flags ensure idempotency. Rollback: archived notes preserved, clear flags + delete migrated entities to re-run.

**Entity Link Types:** Free-string `fromEntityType`/`toEntityType` — adding `'encounter'` and `'creature'` needs no schema change. Verify no whitelist in `entityLinkRepository.ts`.

### Feature A Errors

**Orphaned participants on template deletion:** Soft-delete/archive templates. Participants retain `linkedCreatureId`.

**Encounter left active across sessions:** On session end, prompt to end active encounters or carry over. Auto-end as fallback.

**Quick-create naming conflicts:** Prompt "Link to existing or create new?" Auto-suffix if creating new.

**Combat timeline migration:** Highest-risk change. Build encounter data layer first, migrate timeline last. Keep original `CombatTimeline.tsx` until new version verified.

### Feature B Errors

**Parse/Validation:** Invalid JSON aborts. Zod failures shown per-entity in Import Preview. Partial import supported.

**Version mismatch:** `version > current` aborts with upgrade prompt. `version < current` applies migration transforms.

**Large files / attachments:** Warn at 20MB total attachment size during export. No hard limit. Process attachments last. Individual decode failures: skip, log, continue.

**Integrity:** `contentHash` mismatch warns in Import Preview (non-blocking).

**Target campaign missing:** Session/character import requires target campaign. No campaigns → prompt to create.

### Cross-Feature Edge Cases

**Importing encounters without creature templates:** If participant `linkedCreatureId` references are unresolvable (not in bundle, not local), merge engine logs warning but doesn't fail — participant retains inline `instanceState`.

**Exporting after partial migration:** Exports include both archived notes and new encounter entities. Bundle handles gracefully. Import deduplicates by ID.

---

## Open Questions

All resolved:
1. **Auto-damage calculation:** Deferred to future design.
2. **Encounter types extensible?** Starting fixed (`combat`/`social`/`exploration`). Revisit later.
3. **Bundle versioning strategy:** Version bump with migration transforms on import.

---

## Migration Details

### Combat Note Migration (Dexie v6)

1. Read all notes with `type: 'combat'`
2. For each, create an `encounter` record: `type: 'combat'`, `sessionId` from note, `campaignId` from note, `title` from note title, `combatData` from `typeData.rounds` and `typeData.events`, `participants` from `typeData.participants`
3. Create entity links from the new encounter to the original note
4. Mark original combat notes as `status: 'archived'` (do NOT delete)
5. Set flag `migration_v6_combat: true`

### NPC Note Migration (Dexie v6)

1. Read all notes with `type: 'npc'`
2. For each, create a `creatureTemplate` record: `category: 'npc'`, `name` from note title, `description` from note body, `role` from `typeData.role`, `affiliation` from `typeData.affiliation`, `campaignId` from note
3. Attachments remain linked to archived note (not migrated to template)
4. Mark original NPC notes as `status: 'archived'` (do NOT delete)
5. Set flag `migration_v6_npc: true`

### NPC Note Type Removal — Impact Analysis

Files affected:
- `src/types/noteValidators.ts` — Keep `npcTypeDataSchema` for migration parsing
- `src/features/notes/QuickNoteDrawer.tsx` — Remove NPC from type picker
- `src/features/notes/NotesGrid.tsx` — Update type filter to exclude/archive NPC
- `src/features/notes/NoteItem.tsx` — NPC-specific rendering
- `src/screens/NoteEditorScreen.tsx` — NPC-specific editor fields
- `src/features/notes/useNoteActions.ts` — NPC-specific entity linking
- `src/types/note.ts` — Keep `'npc'` in const/schema for backward compat, remove from UI pickers

---

## Approaches Considered

### For Bestiary & Encounters:
- **Approach A: Single Creature Entity + Combat Integration** — Simpler but doesn't handle multiple identical creatures with different HP. Rejected.
- **Approach B: Enriched Combat Participants** — No new entity, expanded inline stats. No standalone bestiary, poor reuse. Rejected.
- **Approach C: Creature Templates + Encounter Instances (Selected)** — Two-tier model. Selected for clean separation and bestiary support.

### For Import/Export:
- **Approach A: ID-Based Merge (Selected, blended with C)** — Simple JSON bundles with ID dedup. Selected for predictability.
- **Approach B: Bundle with Origin Tracking** — `originId` for cross-system dedup. Rejected — unnecessary for stable UUIDs.
- **Approach C: Layered Export with Note Ownership (Partially selected)** — Character-scoping adopted via entity links instead of new schema fields.

### For Combining:
- **Infrastructure-First Layers** — Clean but large upfront invisible work.
- **Feature-Led with Shared Preamble (Selected)** — Shared infra defined once, two feature chapters. Maps to parallel sub-specs.
- **Encounter-Centric Unification** — Natural narrative but distorts import/export scope.

---

## Commander's Intent

**Desired End State:** Skaldmark has a campaign-scoped bestiary, generalized encounters, and full import/export — all built on shared infrastructure. Players export/import campaigns, sessions, and characters as `.skaldmark.json` bundles that include creature templates and encounters. Creature stats persist across encounters. Notes auto-link to encounters. The combat timeline lives inside encounter entities. Private notes are excluded from exports by default.

**Purpose:** Enable fast stat recording at the table (especially armor), searchable encounter history, and portable game state sharing between players and groups.

**Constraints:**
- MUST NOT modify existing repository function signatures
- MUST NOT change Dexie schema without proper migration in `client.ts`
- MUST NOT add new npm dependencies without human approval
- MUST NOT modify existing Zod schemas in `types/` — only extend them (add optional fields)
- MUST follow existing module-export repository pattern (not classes)
- MUST use `safeParse()` for bundle validation at the import boundary
- MUST return `ImportResult`-style result objects from import functions (not throw)
- MUST use existing `shareFile`/download patterns from `utils/export/delivery.ts`
- MUST support legacy `.skaldbok.json` character files on import
- MUST use campaign-scoped creature templates (no global bestiary)
- MUST preserve all existing combat/NPC note data through migration (archive, don't delete)
- MUST use existing entity link system for encounter-note relationships
- MUST NOT add new note types — encounters replace combat/NPC notes

**Freedoms:**
- MAY choose internal helper function naming and decomposition
- MAY decide file organization within `utils/import/`, `utils/export/`, `components/import/`
- MAY decide component decomposition within UI features
- MAY choose error message wording for toasts
- MAY choose test file organization and test case design
- MAY choose stat block form layout and field ordering
- MAY choose drawer/modal UX for quick-create flow
- MAY decide whether creature description uses Tiptap rich text or plain text

## Execution Guidance

**Observe (signals to monitor):**
- TypeScript compiler errors after each file change
- Zod schema validation — `visibility` field doesn't break existing note reads
- Dexie migration runs cleanly, existing data preserved
- Bundle round-trip: export → import → verify entities match
- Combat timeline still renders after migration
- Entity links correctly associate encounters with notes
- App builds and runs (`npm run build`)

**Orient (codebase conventions):**
- `src/utils/importExport.ts` — template for `ImportResult` pattern
- `src/storage/repositories/noteRepository.ts` — template for new repositories
- `src/utils/migrations.ts` — template for bundle version migration
- `src/features/export/useExportActions.ts` — template for hook-level error handling
- `src/storage/db/client.ts` — Dexie v6 schema home
- `src/types/campaign.ts` — template for `z.object` + `z.infer` pattern
- `src/components/primitives/Modal.tsx`, `Drawer.tsx` — UI primitives
- `cn()` from `src/lib/utils.ts` for class merging

**Shortcuts (apply without deliberation):**
- All repositories are stateless async functions, not classes
- Zod `safeParse` with `console.warn` on validation failure, return undefined
- `useCallback` on all hook-returned functions
- `status: 'active' | 'archived'` pattern for soft-delete
- `generateId()` from `src/utils/ids.ts` for IDs
- `nowISO()` from `src/utils/dates.ts` for timestamps
- New export utilities in `src/utils/export/`, import in `src/utils/import/`
- New React components in `src/components/import/`
- Bestiary feature in `src/features/bestiary/`, encounters in `src/features/encounters/`

**Escalate When:**
- New npm dependency seems needed
- Database schema changes beyond plan are needed
- Entity link traversal produces unexpected results
- Changes to existing public component props or hook return types needed
- Combat timeline migration requires changing `CombatTimeline.tsx`'s interface
- NPC note type removal breaks imports in more than 3 files

## Decision Authority

**Agent Decides Autonomously:**
- File/folder organization within feature directories
- Internal function naming and decomposition
- Test organization and test case design
- Error message wording for toasts
- Helper function extraction within components
- Bundle envelope field ordering
- Stat block form layout and field ordering
- `console.info` log message formatting

**Agent Recommends, Human Approves:**
- Dexie v6 schema and migration definition
- New Zod schemas (BundleEnvelope, CreatureTemplate, Encounter)
- Entity link traversal implementation details
- Import Preview UI layout and interaction flow
- Combat timeline migration approach (rewire vs. rebuild)
- NPC note deprecation — which files change and how
- Quick-create UX flow
- Bestiary screen navigation placement
- Attachment size warning threshold (suggested: 20MB)
- Refactoring existing export utilities

**Human Decides:**
- Scope changes
- Changes to existing Note/Character/Session type schemas
- New npm dependencies
- Changes to existing repository function signatures
- Whether to add new note types or encounter sub-types
- Export format for encounter data
- UX decisions not covered by this plan

## War-Game Results

**Most Likely Failure:** Combat timeline migration. `CombatTimeline.tsx` reads `typeData` from notes. Rewiring to encounter entities is highest-risk. **Mitigation:** Build encounter system first. Migrate timeline last. Keep original until new version verified.

**Second Failure Mode:** Merge engine entity ordering. A partial bundle (e.g., session export without campaign) may reference a parent that doesn't exist locally. **Mitigation:** Processing order defined. Missing `campaignId` set to user-selected target. Missing `sessionId` preserved if in bundle, cleared if not.

**Scale Stress:** Long campaign (50+ sessions, hundreds of notes, dozens of attachments, many encounters) produces large file. Linear processing. Main risk: memory pressure from base64 attachments. **Mitigation:** 20MB attachment warning. Process attachments last.

**Dependency Risk:** Dexie, Zod, Web Crypto API — all stable. Entity link free-string types — verify no whitelist.

**6-Month Maintenance:** Clean component boundaries. Template/instance split is intuitive. Acceptance criteria make correctness verifiable. Main concern: entity link traversal may include unexpected notes if new relationship types added — document in code.

## Delivery Order

Build in this order to minimize risk and enable incremental verification:

1. **Shared: Types and schemas** — `creatureTemplate.ts`, `encounter.ts`, `bundle.ts` with Zod schemas
2. **Shared: Database layer** — Dexie v6 (new tables + visibility + migration), repositories for creature templates and encounters
3. **Feature A: Bestiary** — CRUD UI, screen, navigation entry point
4. **Feature A: Encounters** — Creation, participants, note auto-linking, non-combat views
5. **Feature A: Combat encounters** — Migrate combat timeline into encounter context
6. **Feature A: NPC deprecation** — Remove from new-note UI, update type filters
7. **Feature B: Export** — Bundle format, scope collectors (all entity types), privacy filter, file delivery
8. **Feature B: Import** — Bundle parser, import preview UI, merge engine
9. **Integration: End-to-end** — Export → import round-trip verification with all entity types

Each phase should be verifiable independently before the next begins.

## Next Steps
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-04-06-bestiary-encounters-and-import-export-design.md`)
- [ ] Phase 1: Define Zod schemas for CreatureTemplate, Encounter, EncounterParticipant, BundleEnvelope
- [ ] Phase 2: Dexie v6 migration + repositories
- [ ] Phase 3-6: Bestiary & Encounter feature build
- [ ] Phase 7-8: Import/Export feature build
- [ ] Phase 9: Integration testing and round-trip verification
