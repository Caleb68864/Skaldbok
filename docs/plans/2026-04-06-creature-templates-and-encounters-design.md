---
date: 2026-04-06
topic: "Creature Templates, Bestiary, and Encounter System"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-04-06
tags:
  - design
  - creature-templates
  - encounters
  - bestiary
---

# Creature Templates, Bestiary, and Encounter System -- Design

## Summary

Introduce a two-tier creature system (templates + encounter instances) and a generalized encounter entity that replaces combat notes. Creature templates store Dragonbane stat blocks in a campaign-scoped bestiary. Encounters group participants (PCs, NPCs, monsters) and auto-link notes created during them, enabling fast stat recording at the table and searchable encounter history later. Encounters support combat, social, and exploration types -- not just fights.

## Approach Selected

**Approach C: Creature Templates + Encounter Instances.** The template/instance split cleanly separates "what is a goblin" from "how is this goblin doing in this fight." Templates are reusable across encounters within a campaign. Instances track mutable state (current HP, conditions). This was chosen over simpler alternatives because the user wants a full creature library that persists across sessions and an encounter system that works outside of combat.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Bestiary                          │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │  Creature     │  │  Creature     │  (templates)   │
│  │  Template     │  │  Template     │                │
│  │  "Goblin"     │  │  "Siur Talos" │                │
│  └──────┬───────┘  └──────┬───────┘                 │
└─────────┼──────────────────┼────────────────────────┘
          │ spawn            │ link
          ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                   Encounter                          │
│  type: 'combat' | 'social' | 'exploration'          │
│                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│  │ Participant │ │ Participant │ │ Participant │      │
│  │ (instance)  │ │ (instance)  │ │ (PC link)   │     │
│  │ Goblin #1   │ │ Goblin #2   │ │ Viktor      │     │
│  │ HP: 8/12    │ │ HP: 12/12   │ │             │     │
│  └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                      │
│  ┌─ Linked Notes ──────────────────────────────┐    │
│  │ "Viktor attacks Goblin #1"                   │    │
│  │ "Loot: gold ring found on Goblin #2"         │    │
│  │ "Siur Talos reveals the quest hook"          │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
          │
          │ belongs to
          ▼
┌──────────────┐
│   Session    │
└──────────────┘
```

## Components

### Creature Template
**Owns:** The canonical Dragonbane stat block for a creature type.
**Fields:**
- `id`, `campaignId` (required -- campaign-scoped)
- `name`, `description` (rich text / Tiptap JSON document)
- `category`: `'monster'` | `'npc'` | `'animal'`
- `role?`, `affiliation?` (for NPCs, migrated from NPC note type)
- `stats`: `{ hp: number, armor: number, movement: number }`
- `attacks`: `Array<{ name, damage, range, skill, special? }>`
- `abilities`: `Array<{ name, description }>`
- `skills`: `Array<{ name, value }>` (only the relevant ones)
- `tags`: string[] (for searching -- "undead", "humanoid", etc.)
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

### Encounter Participant
**Owns:** Instance state of a creature or character within an encounter.
**Fields:**
- `id` (within the encounter)
- `name` (display name, e.g., "Goblin #1")
- `type`: `'pc'` | `'npc'` | `'monster'`
- `linkedCreatureId?` — points to Creature Template
- `linkedCharacterId?` — points to Character Record (for PCs)
- `instanceState`: `{ currentHp?, conditions?: string[], notes?: string }`
- `sortOrder` (initiative/display ordering)

### Bestiary Screen
Campaign-scoped CRUD UI for creature templates. Search, filter by category/tags, browse. Tap to view/edit stat blocks. "Add to Encounter" action when an encounter is active.

### Encounter UI
- Creating/managing encounters, adding participants (from bestiary, party, or quick-create)
- For `combat` type: renders combat timeline with participants panel (migrated from CombatTimeline.tsx)
- For `social`/`exploration` type: participant list + linked notes feed
- Stat drawer: tap a participant to view template stats + edit instance state

## Data Flow

### Creating a Creature Template
1. Bestiary screen → "New Creature" → stat block form
2. Save → `creatureTemplateRepository.create()` → IndexedDB `creatureTemplates` table

### Starting an Encounter
1. Session screen → "New Encounter" → pick type (combat/social/exploration) + title
2. Encounter created in `encounters` table, linked to active session

### Adding Participants
- **From Bestiary**: search creature templates → select → spawns participant with `linkedCreatureId`
- **From Party**: select PC → spawns participant with `linkedCharacterId`
- **Quick-create**: type name + key stats inline → creates creature template AND participant in one step

### Recording Stats Mid-Encounter
1. Tap participant → stat drawer opens
2. Linked to template: shows template stats (read-only) + editable instance state
3. Quick-created with no template: editable stats → upserts creature template on save
4. Target: < 3 taps to record a stat like armor

### Notes During an Encounter
1. Notes created while encounter is active auto-link via entity links (encounter → note, `contains`)
2. Quick-note drawer shows active encounter context
3. Notes dual-linked: session + encounter

### Searching / Exporting Later
- Filter notes by encounter
- Browse encounter history in session/campaign
- Export: encounter includes participant stat blocks + linked notes

## Acceptance Criteria

The feature is **done** when all of the following are true:

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

## Error Handling

### Orphaned participants on template deletion
Soft-delete/archive creature templates. Participants retain their `linkedCreatureId` and the archived template data remains accessible.

### Encounter left active across sessions
On session end: prompt to end active encounters or carry over. Auto-end as fallback.

### Quick-create naming conflicts
When quick-creating a creature with a name that already exists in the bestiary, prompt: "A creature named 'Goblin' exists — link to it or create new?" Create separate templates, auto-suffix if needed.

### Migration from existing combat notes and NPC notes
Implemented as Dexie version 6 upgrade with the following strategy:

**Combat note migration:**
1. Read all notes with `type: 'combat'`
2. For each, create an `encounter` record: `type: 'combat'`, `sessionId` from note, `campaignId` from note, `title` from note title, `combatData` from `typeData.rounds` and `typeData.events`, `participants` from `typeData.participants`
3. Create entity links from the new encounter to the original note
4. Mark original combat notes as `status: 'archived'` (do NOT delete)
5. Set metadata flag `migration_v6_combat: true` so this runs once

**NPC note migration:**
1. Read all notes with `type: 'npc'`
2. For each, create a `creatureTemplate` record: `category: 'npc'`, `name` from note title, `description` from note body, `role` from `typeData.role`, `affiliation` from `typeData.affiliation`, `campaignId` from note
3. If the NPC note has attachments, they remain linked to the archived note (not migrated to the template)
4. Mark original NPC notes as `status: 'archived'` (do NOT delete)
5. Set metadata flag `migration_v6_npc: true` so this runs once

**Rollback:** Original notes are preserved as archived. If migration produces bad data, archived notes can be restored by clearing the migration flags and re-running.

### Entity link compatibility
The existing `entityLinks` table uses free-string `fromEntityType` and `toEntityType` fields (not an enum). Adding `'encounter'` as an entity type requires no schema change — only adding it to the entity link repository operations. Verify: `entityLinkRepository.ts` does not validate entity types against a whitelist.

## Open Questions

- **Auto-damage calculation (armor subtraction):** Deferred. The stat recording and display infrastructure supports it, but the UX for auto-calculating damage vs. armor is a separate design decision to make later.
- **Encounter types — extensible later?** Starting with fixed enum (`combat`/`social`/`exploration`). Can revisit if users need custom types.

## Approaches Considered

### Approach A: Single Creature Entity + Combat Integration
New `Creature` entity with stat blocks, bestiary screen, direct combat integration. Simpler than the template/instance split but doesn't cleanly handle multiple identical creatures with different HP in the same fight. Rejected because the template/instance model is more correct for the scope.

### Approach B: Enriched Combat Participants
No new entity — expand inline stats on combat participants + optional stat block on NPC notes. Fastest to build but no standalone bestiary, poor reuse across encounters, and doesn't support non-combat encounters. Rejected because the user wants a full creature library and encounters beyond combat.

### Approach C: Creature Templates + Encounter Instances (Selected)
Two-tier model with reusable templates and per-encounter instances. Selected because it cleanly separates canonical data from encounter state, supports the bestiary library, and generalizes encounters beyond combat.

## Resolved Decisions

1. **Creature templates are campaign-scoped** — `campaignId` is required. No global bestiary.
2. **Creature templates subsume NPC notes** — The `'npc'` note type is deprecated. Creatures with `category: 'npc'` replace it. Role and affiliation fields move to the creature template.
3. **Migration is a clean cutover** — Not in production, so existing combat notes and NPC notes are migrated to the new system.
4. **Fixed encounter types** — `'combat'`, `'social'`, `'exploration'` as a fixed enum.

## Commander's Intent

**Desired End State:** Skaldmark has a campaign-scoped bestiary where creature stat blocks are created once and reused across encounters. Encounters are the primary grouping mechanism for linking participants and notes together during play — for combat, social interactions, and exploration alike. The existing combat timeline continues to work but is now housed within encounter entities instead of note typeData.

**Purpose:** Players and GMs need to record creature stats (especially armor) quickly during play and have those stats persist for later encounters. Notes created during any encounter should be searchable and exportable as a group. The current combat-note-only system is too narrow — encounters happen outside of combat too.

**Constraints:**
- MUST use campaign-scoped creature templates (no global bestiary)
- MUST preserve all existing combat note data through migration (archive, don't delete)
- MUST use the existing entity link system for encounter-note relationships
- MUST NOT add new note types — encounters replace the need for typed combat/NPC notes
- MUST NOT change the existing note schema or break non-combat/non-NPC note types
- MUST follow existing codebase patterns (repository functions, Zod schemas, feature folders)

**Freedoms:**
- The implementing agent MAY choose stat block form layout and field ordering
- The implementing agent MAY choose how to render the participant list in non-combat encounters
- The implementing agent MAY choose the drawer/modal UX for the quick-create flow
- The implementing agent MAY choose internal component decomposition within feature folders
- The implementing agent MAY decide whether creature description uses Tiptap rich text or plain text

## Execution Guidance

**Observe (signals to monitor during implementation):**
- TypeScript compiler errors after each component
- App builds and runs successfully after each major piece (`npm run build`)
- Dexie migration runs without errors on app startup
- Existing combat timeline still renders after migration
- Entity links correctly associate encounters with notes

**Orient (codebase conventions to follow):**
- Follow `src/storage/repositories/noteRepository.ts` as the template for `creatureTemplateRepository.ts` and `encounterRepository.ts`
- Define Zod schemas in `src/types/creatureTemplate.ts` and `src/types/encounter.ts` using the `z.object` + `z.infer<typeof schema>` pattern from `src/types/campaign.ts`
- Use `generateId()` from `src/utils/` for IDs and `nowISO()` for timestamps
- Add new Dexie tables in `src/storage/db/client.ts` as `version(6).stores({...})`
- Place bestiary feature code in `src/features/bestiary/`
- Place encounter feature code in `src/features/encounters/`
- Add screens in `src/screens/BestiaryScreen.tsx`
- Use `Modal` from `src/components/primitives/Modal.tsx` and `Drawer` from `src/components/primitives/Drawer.tsx`
- Use `cn()` from `src/lib/utils.ts` for class merging
- Error pattern: try-catch with `showToast()` for user-facing errors, `console.error()` for debugging

**Shortcuts (apply without deliberation):**
- All repositories are stateless async functions, not classes
- Zod `safeParse` with `console.warn` on validation failure, return undefined
- `useCallback` on all hook-returned functions
- JSDoc on all screen components describing layout and features
- `status: 'active' | 'archived'` pattern for soft-delete
- Radix UI primitives wrapped in `src/components/primitives/` or `src/components/ui/`

**Escalate When:**
- The combat timeline migration requires changing `CombatTimeline.tsx`'s component interface (props shape)
- The entity link system needs schema changes (it shouldn't, but verify)
- NPC note type removal breaks imports in more than 3 files
- Any UX layout decision for Bestiary or Encounter screen placement in navigation
- A new external dependency would be needed

## Decision Authority

**Agent Decides Autonomously:**
- Stat block form layout and field ordering
- Participant list rendering in non-combat encounters
- Internal component decomposition within feature folders
- Zod schema field ordering and naming conventions
- Repository method signatures (following existing patterns)
- How to structure the migration within Dexie version(6)

**Agent Recommends, Human Approves:**
- Combat timeline migration approach (rewire existing component vs. rebuild)
- NPC note deprecation — which files change and how
- Quick-create UX flow (modal vs. inline vs. drawer)
- Bestiary screen navigation placement

**Human Decides:**
- Whether to add new note types or encounter sub-types
- Scope changes (e.g., adding auto-damage calculation)
- Any changes to existing public data model (note schema, session schema)
- Export format for encounter data

## War-Game Results

**Most Likely Failure:** Combat timeline migration. `CombatTimeline.tsx` reads `typeData` from notes and updates via `noteRepository.updateNote()`. Rewiring it to read from encounter entities and update via `encounterRepository` is the highest-risk change. **Mitigation:** Build the encounter system and bestiary first. Migrate the combat timeline last, after the data layer is proven. Keep the original `CombatTimeline.tsx` until the new version is verified.

**Scale Stress:** N/A — single-user local app. IndexedDB handles the expected data volumes easily.

**Dependency Risk:** Entity link system must support `'encounter'` as an entity type. The `fromEntityType` and `toEntityType` fields are free strings (not an enum), so this should work without schema changes. **Mitigation:** Verify in `entityLinkRepository.ts` that no whitelist validation exists before building on this assumption.

**6-Month Maintenance:** Good component boundaries. The template/instance split is intuitive. File placement guidance (now included) ensures a developer can find code quickly. The migration is a one-time operation with archived originals as a safety net.

## Delivery Order

Build in this order to minimize risk and enable incremental verification:

1. **Types and schemas** — `creatureTemplate.ts`, `encounter.ts` with Zod schemas
2. **Database layer** — Dexie version(6), repositories for both entities
3. **Bestiary feature** — CRUD UI, screen, navigation entry point
4. **Encounter feature** — Creation, participants, note auto-linking, non-combat views
5. **Combat encounter view** — Migrate combat timeline into encounter context
6. **Migration** — Dexie upgrade handler converting combat notes and NPC notes
7. **NPC note deprecation** — Remove from new-note UI, update type filters

Each phase should be verifiable independently before the next begins.

## NPC Note Type Removal — Impact Analysis

Files affected by deprecating the `'npc'` note type:
- `src/types/noteValidators.ts` — Remove `npcTypeDataSchema` (or keep for migration parsing)
- `src/features/notes/QuickNoteDrawer.tsx` — Remove NPC from type picker options
- `src/features/notes/NotesGrid.tsx` — Update type filter to exclude/archive NPC
- `src/features/notes/NoteItem.tsx` — NPC-specific rendering (role/affiliation display)
- `src/screens/NoteEditorScreen.tsx` — NPC-specific editor fields
- `src/features/notes/useNoteActions.ts` — NPC-specific entity linking logic on create
- `src/types/note.ts` — `NOTE_TYPES` array (remove 'npc' or keep for backward compat)

Strategy: Keep `'npc'` in the `NOTE_TYPES` const and Zod schema for backward compatibility with archived notes, but remove it from all UI type pickers and creation flows.

## Evaluation Metadata
- Evaluated: 2026-04-06
- Cynefin Domain: Complicated
- Critical Gaps Found: 3 (3 resolved)
- Important Gaps Found: 4 (4 resolved)
- Suggestions: 3 (incorporated)

## Next Steps
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-04-06-creature-templates-and-encounters-design.md`)
- [ ] Phase 1: Define Zod schemas for CreatureTemplate, Encounter, EncounterParticipant
- [ ] Phase 2: Add `creatureTemplates` and `encounters` tables to Dexie schema (v6), build repositories
- [ ] Phase 3: Build Bestiary screen UI with CRUD
- [ ] Phase 4: Build Encounter feature — creation, participants, note auto-linking, non-combat views
- [ ] Phase 5: Migrate combat timeline into encounter context
- [ ] Phase 6: Build migration logic for existing combat notes and NPC notes
- [ ] Phase 7: Deprecate NPC note type from creation UI
