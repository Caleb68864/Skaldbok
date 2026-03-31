---
date: 2026-03-30
topic: "Scaldbok integration into Skaldmark — notes-first session journaling"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-03-30
tags:
  - design
  - scaldbok
  - architecture
  - dragonbane
---

# Scaldbok Integration — Design

## Summary

Integrate the Scaldbok notes-first session journaling system into the existing Skaldmark character sheet PWA. The app transitions from a character-centric tool to a campaign-centric one where characters live inside campaigns, sessions scope all note capture, and every note exports cleanly to an Obsidian vault. The architecture uses a foundation-first approach: rebuild the navigation shell and Dexie schema once, then build all features on top.

## Approach Selected

**Foundation-First, Then Features (Approach C).** The app has no existing users and a soft deadline of 2026-04-18. This allows restructuring the navigation, schema, and state management correctly once, then building all Scaldbok phases rapidly on the solid foundation without mid-stream rework.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Navigation model | Campaign wraps characters | Campaign is the top-level container. Characters live inside campaigns. |
| Bottom nav | 4 tabs: Session, Notes, Character, More | Combat merged into Session tab. Export/Profile into Settings. |
| First-run behavior | Graceful degradation | Character features work without a campaign. Session/Notes prompt to create one. |
| Build approach | Foundation-first | No users to protect, so restructure everything correctly once. |
| Export priority | First-class (early build) | Export to Obsidian is the killer feature. Without it, notes are trapped. |
| Note storage | Single `notes` table with `typeData` JSON | All 9 note types in one table, type-specific fields in a JSON column. |
| Rich text editor | Tiptap (ProseMirror-based) | Native @-mention support, markdown I/O, vim mode extension available. |
| Zip library | JSZip | Standard, acceptable bundle size. |

## Architecture

```
+---------------------------------------------------------+
|  Campaign Context Header (persistent)                    |
|  [Ashes of the Fen] . Session 7 . Makander              |
+---------------------------------------------------------+
|                                                          |
|              Active Screen Content                       |
|                                                          |
|  (Session / Notes / Character / More)                    |
|                                                          |
+---------------------------------------------------------+
|  Bottom Nav                                              |
|  [Session]  [Notes]  [Character]  [More]                 |
+---------------------------------------------------------+

State Architecture:
+--------------------+
|  CampaignContext    | <-- active campaign, session, party, character
|  (React Context)   |     cascading context chain
+--------+-----------+
         | provides context to all tabs
         v
+--------------------+     +--------------------+
|  Dexie Database    |-----|  Export Service     |
|  (IndexedDB)       |     |  (Markdown + YAML) |
|                    |     |                    |
|  campaigns         |     |  Renders notes     |
|  sessions          |     |  to .md files      |
|  notes             |     |  with front matter |
|  entityLinks       |     |  and wiki-links    |
|  parties           |     |                    |
|  partyMembers      |     |  Delivers via      |
|  characters (existing)   |  share/download/   |
|  referenceNotes (existing)|  clipboard        |
|  appSettings (existing)  |                    |
+--------------------+     +--------------------+
```

## Components

### 1. CampaignContext (new React context)

**Owns:** Active campaign, active session, active party, active character resolution.

- Hydrates from Dexie on app load (find active campaign, resolve its party/character/session)
- Provides `activeCampaign`, `activeSession`, `activeParty`, `activeCharacter` to all consumers
- Exposes actions: `startSession()`, `endSession()`, `setActiveCampaign()`, `setActiveCharacter()`
- Auto-generates session titles on start
- Enforces single-active-session guard

**Does NOT own:** Note creation, EntityLink creation, export.

**Relationship to existing AppStateContext:** CampaignContext **wraps** AppStateContext (does not replace it). AppStateContext continues to manage character-level concerns: theme, play/edit mode, ephemeral session state (boon/bane overrides). CampaignContext adds the campaign/session/party layer on top. State ownership:

| State | Owner | Notes |
|-------|-------|-------|
| `activeCharacterId` | AppStateContext (existing) | Character selection is independent of campaigns |
| `theme`, `mode` | AppStateContext (existing) | App-level preferences |
| `boon/bane overrides` | AppStateContext (existing) | Ephemeral per-play-session |
| `activeCampaign` | CampaignContext (new) | Campaign selection |
| `activeSession` | CampaignContext (new) | Session lifecycle |
| `activeParty` | CampaignContext (new) | Party for the active campaign |
| `activeCharacterInCampaign` | CampaignContext (new) | Which character is playing in this campaign (may differ from the character being viewed) |

### 2. Dexie Schema (v3 migration)

New tables added in one migration:

| Table | Indexed Fields | Purpose |
|-------|---------------|---------|
| `campaigns` | `id, status, updatedAt` | Campaign records |
| `sessions` | `id, campaignId, status, date` | Session records |
| `notes` | `id, campaignId, sessionId, type, status, pinned` | All 9 note types in one table |
| `entityLinks` | `id, fromEntityType, fromEntityId, toEntityType, toEntityId, relationshipType` | The linking layer |
| `parties` | `id, campaignId` | Party rosters |
| `partyMembers` | `id, partyId, linkedCharacterId` | Party membership |

Existing tables untouched: `characters`, `systems`, `appSettings`, `referenceNotes`, `metadata`.

All 9 note types share one `notes` table. Type-specific fields (loot's `quantity`, rumor's `threadStatus`, etc.) live in a `typeData` JSON column. This avoids 9 separate tables while keeping queries simple via the `type` index.

**Compound indexes for EntityLinks:** The `entityLinks` table must use Dexie compound index syntax for hot-path queries:
- `[fromEntityId+relationshipType]` — finding all links from a given entity of a given type (e.g., all notes a session contains)
- `[toEntityId+relationshipType]` — reverse lookups (e.g., finding all sessions an NPC appears in)

**Dexie schema string:** `'id, [fromEntityId+relationshipType], [toEntityId+relationshipType], fromEntityType, toEntityType'`

**Zod validation:** Define Zod schemas for all new record types. Use discriminated union on `note.type` to validate `typeData` shape. Validate on read from Dexie (repository layer) — this catches corruption from any source. Schemas go in `src/types/` alongside the TypeScript interfaces:
- `campaignSchema`, `sessionSchema`, `noteSchema` (with discriminated union for `typeData`)
- `entityLinkSchema`, `partySchema`, `partyMemberSchema`

### 3. useNoteActions() hook (note service layer)

**Implements as:** `src/features/notes/useNoteActions.ts` — follows the existing hooks-as-services pattern (like `useCharacterActions()`).

**Owns:** CRUD for all note types, auto-linking behavior, @-mention parsing.

- Creates notes with automatic `campaignId`/`sessionId` from CampaignContext
- Auto-creates EntityLinks on save (session -> note `contains`, NPC `introduced_in`)
- Parses mention nodes from ProseMirror JSON body, creates `related_to` EntityLinks
- Deduplicates links (never creates duplicate EntityLinks)
- Cascades deletes (note deletion cleans up EntityLinks)
- Returns: `{ createNote, updateNote, deleteNote, linkNote, pinNote, unpinNote }`

**Supporting repository:** `src/storage/repositories/noteRepository.ts` (pure async functions, same pattern as `characterRepository.ts`). Also `entityLinkRepository.ts` and `campaignRepository.ts`, `sessionRepository.ts`, `partyRepository.ts`.

### 4. Export utilities (pure functions)

**Implements as:** `src/utils/export/` — pure utility functions, NOT a hook (no React state dependency). Takes data in, returns markdown strings out.

- `renderNoteToMarkdown(note, entityLinks, allNotes)` -> markdown string with YAML front matter
- `renderSessionBundle(session, linkedNotes, entityLinks)` -> `Map<filename, markdown>`
- `renderCampaignIndex(campaign, sessions, npcs, openRumors)` -> markdown string
- `resolveWikiLinks(prosemirrorJson, allNotes)` -> markdown body with `[[wiki-links]]`
- `generateFilename(note)` -> slug-based filename
- `bundleToZip(files: Map<string, string>)` -> Blob (uses JSZip)

**Delivery utilities** in `src/utils/export/delivery.ts`:
- `shareFile(blob, filename)` — `navigator.share()` with fallback to download
- `copyToClipboard(markdown)` — `navigator.clipboard.writeText()`
- `downloadBlob(blob, filename)` — Blob download trigger

### 5. Navigation Shell (rebuilt)

- **Campaign header** -- persistent bar showing active campaign name, session status, active character. Tappable to open campaign selector.
- **Bottom nav** -- 4 tabs: Session, Notes, Character, More
- **Character sub-nav** -- horizontal pill bar within Character tab: Sheet / Skills / Gear / Magic
- **Session sub-sections** -- Session tab internally manages: session overview, combat tracker, party view

**Graceful degradation:** Without an active campaign, Session and Notes tabs show a prompt card: "Create a campaign to get started." Character tab works independently.

**Campaign-less character behavior:** Characters are fully independent of campaigns. Users can create, edit, view, and manage characters without any campaign existing. The Character tab, character library, and all character CRUD work identically whether a campaign exists or not. Characters are linked to campaigns only through the Party model (a party member references a character via `linkedCharacterId`). Creating a campaign does not adopt existing characters — they must be explicitly added to a party. This preserves the current app's character-first workflow.

### 6. Combat Integration (merged into Session tab)

- Start combat from Session tab -> creates a combat note, auto-links to session
- Participant selection from party + session NPCs
- Event timeline logging (attack, spell, ability, damage, heal, condition, note)
- Round tracking
- Heroic ability picker for linked characters
- **Spell picker:** pulls from all party members' known spells, grouped by character. Quick-add button for spells not on any sheet.
- **WP display:** ability/spell picker shows remaining WP. Abilities costing more than available WP are dimmed but visible — can't select without override.

The existing combat screen's character-level features (weapon rack, quick-equip, HP/WP tracking) stay on the Character tab. The Session tab's combat is the event journal.

### 7. Tiptap Editor (note body editing)

- Tiptap (ProseMirror-based) for all note body fields
- `@tiptap/extension-mention` for @-mention linking with typeahead
- **Storage format: ProseMirror JSON** — the note `body` field stores Tiptap's native ProseMirror JSON document. This is the lossless source of truth. The editor renders it as rich text in-app. Markdown is an **export-only** format — the ExportService serializes ProseMirror JSON to markdown with `[[wiki-links]]` at export time. No lossy round-trip.
- Mention nodes in ProseMirror JSON store the note ID and display title. The ExportService resolves these to `[[Title]]` wiki-links. If the referenced note is deleted, the mention node remains in the JSON but exports as plain text.
- Vim mode toggle via `@tiptap/extension-vim-keymap`, configurable in Settings

## Data Flow

### Creating a Note

```
User taps "Quick NPC" on Notes hub
  |
  v
NoteService.createNote({ type: "npc", title: "Sir Talos", ... })
  |
  +-- Reads CampaignContext: campaignId, sessionId
  +-- Writes to Dexie `notes` table
  +-- Auto-creates EntityLinks: session -> note (introduced_in, contains)
  +-- Returns the note record
  |
  v
Notes hub re-renders with Sir Talos in the NPC section
```

### Starting a Session

```
User taps "Start Session"
  |
  v
CampaignContext.startSession()
  |
  +-- Guards: active session exists? -> prompt to end it
  +-- Reads campaign: activePartyId, activeCharacterId
  +-- Writes to Dexie `sessions` table (status: "active")
  +-- Updates context state -> activeSession is now set
  +-- Session tab shows recap card from previous session
```

### Exporting a Session Bundle

```
User taps "Export Session + Notes"
  |
  v
ExportService.exportSessionBundle(sessionId)
  |
  +-- Reads session record
  +-- Queries EntityLinks (contains, linked_to, appears_in)
  +-- Reads all linked note records
  +-- For each note: YAML front matter + markdown body + wiki-links
  +-- For NPCs: queries ALL sessions (not just this one)
  +-- Bundles into .zip via JSZip
  +-- Triggers download or navigator.share()
```

## Error Handling

### Export on mobile Safari / PWA

`navigator.share()` may not support `.zip` files on all devices. Detect share API capabilities. Fall back to Blob download. Always offer "Copy as Markdown" for single notes.

### Large campaign data in IndexedDB

All queries scope to active campaign via indexed `campaignId`. EntityLink queries use compound index on `(fromEntityId, relationshipType)`. No full-table scans.

### Stale active session

On app launch, if an active session exists and `startedAt` is more than 24 hours ago, prompt: "You have an open session from [date]. End it or continue?" Don't auto-end.

### Deleted notes with inbound @-mentions

In-app: mention chip shows as plain text (greyed out). On export: plain text without `[[brackets]]`. EntityLink cleanup: `related_to` link deleted when target note is deleted.

### NPC linked to multiple sessions

NPC note's `sessionId` points to the session where it was created. EntityLinks track all other sessions (`appears_in`). Export builds the full `sessions[]` list from EntityLinks.

### No active campaign

Character tab works fully. Session and Notes tabs show campaign creation prompt card. CampaignContext provides null values; services guard against null.

## Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| 1 | Reference notes migration | No existing notes to migrate. New notes use `type: "generic"` in the unified `notes` table. `referenceNotes` table can be dropped. |
| 2 | Spell casting in combat | Spell picker pulls from all party members' known spells, grouped by character. Quick-add button for missing spells. |
| 3 | WP display in ability picker | Show remaining WP. Dim/gray abilities costing more than available WP. Still visible but not selectable without override. |
| 4 | Zip library | JSZip confirmed. Standard library, acceptable size. |
| 5 | @-mention UX | Tiptap (ProseMirror-based) rich text editor with native @-mention extension. Vim mode toggle available in Settings. |

## Approaches Considered

### Approach A: Big Bang Migration

Restructure the entire app around the campaign model in one coordinated effort. All tabs ship together, schema expands in one migration, routing rebuilt entirely.

**Not selected because:** Huge scope with no incremental progress. High risk of breaking existing features during restructuring. With no users to protect, the foundation-first approach gets the same architectural cleanliness without the all-or-nothing risk.

### Approach B: Incremental Layering (Phase-Aligned)

Follow the spec phases as literal build phases. Each phase is a deployable, usable state. Add one layer at a time.

**Not selected because:** With no existing users and a soft deadline, the incremental approach adds unnecessary routing and schema refactors along the way. Foundation-first avoids that churn.

### Approach C: Foundation-First, Then Features (Selected)

Build the architectural foundation (nav shell, full Dexie schema, campaign context, EntityLink system) first. Then build all user-facing features rapidly on the solid base.

**Selected because:** No users to disrupt. Soft deadline allows doing infrastructure right once. Features build faster on a complete foundation with no mid-stream rework.

## Build Order

Priority ordering reflects that **export to Obsidian is the killer feature**:

### Stage 1: Foundation
- [ ] Rebuild navigation shell (4-tab bottom nav, campaign header, character sub-tabs)
- [ ] Dexie v3 migration (all 6 new tables)
- [ ] CampaignContext provider
- [ ] NoteService with auto-linking
- [ ] ExportService (pure function layer)
- [ ] Tiptap editor integration with @-mention support
- [ ] Migrate existing character screens into Character sub-tab

### Stage 2: Core Features (target: April 18)
- [ ] Phase 1: Campaign CRUD, session start/stop, active context chain
- [ ] Phase 2: Party model, member management, active character assignment
- [ ] Phase 3: Notes hub, Quick Note, Quick NPC, Link Note, EntityLinks
- [ ] Phase 5: Export — single note, session, session+notes, all notes, clipboard copy
- [ ] Phase 4: Combat event timeline in Session tab, heroic ability picker, spell picker

### Stage 3: Enhancements (post first game)
- [ ] Phase 3a: Loot, Rumor, Location note types, pinned notes, session recap, post-session review
- [ ] Phase 3b: Skill check log, quick quote, relationship labels, NPC frequency tracking
- [ ] Phase 5 polish: Campaign index file, full zip bundling, share sheet integration

## Definition of Done

### Stage 1: Foundation — Done When:
- [ ] 4-tab bottom nav renders (Session, Notes, Character, More)
- [ ] Character sub-tabs render existing Sheet/Skills/Gear/Magic/Combat screens without regression
- [ ] Campaign header renders (shows "No campaign" when none exists)
- [ ] Dexie v3 migration creates all 6 new tables with correct indexes (including compound indexes on entityLinks)
- [ ] Zod schemas exist for all new record types with discriminated union on note.type
- [ ] CampaignContext wraps AppStateContext, provides null values when no campaign exists
- [ ] Session and Notes tabs show "Create a campaign to get started" prompt when no campaign
- [ ] Character tab works identically to current app (no campaign dependency)
- [ ] Tiptap renders in a test component with @-mention extension functional
- [ ] noteRepository, entityLinkRepository, campaignRepository, sessionRepository, partyRepository all pass basic CRUD tests
- [ ] Export utility `renderNoteToMarkdown()` produces correct YAML front matter + body for a generic note

### Stage 2: Core Features — Done When:
- [ ] All Phase 1 acceptance criteria pass (from Campaign & Session Foundation spec)
- [ ] All Phase 2 acceptance criteria pass (from Party & Character Assignment spec)
- [ ] All Phase 3 acceptance criteria pass (from Notes Hub, Quick Notes & Linking spec)
- [ ] Single note export produces correct .md file with YAML front matter
- [ ] Session export produces correct .md file with linkedNotes references
- [ ] Session+notes export produces .zip bundle with working wiki-links across files
- [ ] "Copy as Markdown" copies full rendered markdown to clipboard
- [ ] Combat event timeline logs events by round in Session tab
- [ ] Heroic ability picker shows abilities from linked character sheet
- [ ] Spell picker shows spells from party character sheets with quick-add

### Stage 3: Enhancements — Done When:
- [ ] All Phase 3a acceptance criteria pass (from Notes Enhancements spec)
- [ ] All Phase 3b acceptance criteria pass (from Notes Enhancements Round 2 spec)
- [ ] Campaign index file generates correctly for full export
- [ ] All 9 note types export with correct type-specific YAML front matter

## Commander's Intent

**Desired End State:** A mobile-first PWA where a Dragonbane player can start a session with one tap, capture NPCs/notes/combat events in under 5 seconds each, end the session, and export everything to an Obsidian vault as interlinked markdown files — without the app ever competing with the game for attention.

**Purpose:** The user (Caleb) plays Dragonbane and wants a structured field journal that captures fast during play and produces rich, linked Obsidian notes afterward. The character sheet already exists — this integration adds the session journaling and export layer that makes the app a complete gameplay companion.

**Constraints:**
- MUST follow Dragonbane-only design — no multi-system abstractions, no configurable skill lists
- MUST preserve existing character sheet functionality — Character tab works with or without a campaign
- MUST store note bodies as ProseMirror JSON — markdown is export-only
- MUST export valid Obsidian-compatible markdown with YAML front matter matching the shapes defined in the Phase 5 spec
- MUST use inline CSS with CSS variables (no CSS-in-JS libraries, no imported stylesheets in components)
- MUST use named exports only (no default exports)
- MUST follow hooks-as-services pattern for stateful operations, pure functions for stateless transformations
- MUST NOT enforce Dragonbane rules (no hit calculation, no initiative enforcement, no spell validation)
- MUST NOT require a campaign to use character features
- MUST NOT require typing to complete primary quick-capture actions — tap targets, chips, pickers over text fields

**Freedoms:**
- The implementing agent MAY choose component internal structure, prop naming, and state management within components
- The implementing agent MAY choose the Tiptap extensions beyond mention and vim-keymap
- The implementing agent MAY choose how to structure sub-navigation within tabs (pills, swipeable, etc.)
- The implementing agent MAY add loading/error states as needed following the existing mounted-flag pattern
- The implementing agent MAY organize files within the established folder structure conventions

## Execution Guidance

**Observe (signals to monitor during implementation):**
- TypeScript compiler: zero errors required before moving to next component
- Dexie operations: verify reads/writes work in browser dev tools IndexedDB inspector
- Tiptap mention round-trip: insert mention → save → reload → verify mention node intact in ProseMirror JSON
- Export output: visually inspect generated markdown against the Phase 5 spec examples
- Touch targets: verify all primary actions have minimum 44x44px tap area
- Existing screens: after Character tab migration, verify Sheet/Skills/Gear/Magic/Combat render correctly

**Orient (context to maintain):**
- Follow existing repository pattern: pure async functions in `src/storage/repositories/`, NOT classes
- Follow existing hook pattern: `use<Feature>Actions()` returning `{ actionFn1, actionFn2 }` in `src/features/`
- Follow existing context pattern: interface + createContext(null) + Provider + useHook with null-check throw
- Follow existing type pattern: interfaces in `src/types/`, extend `Timestamped` and `Versioned` base types
- Follow existing error pattern: try-catch in repos with descriptive messages, mounted flag in effects, toast for UI errors
- CSS variables are defined in `src/theme/theme.css` — use existing tokens, add new ones there if needed
- All components use inline `style={{}}` with CSS variables — no className styling except where existing code uses it

**Escalate When:**
- A new npm dependency is needed beyond Tiptap, JSZip, and their direct sub-packages
- The Dexie schema needs changes beyond what's defined in this plan
- The 4-tab navigation structure needs modification
- Any Phase spec acceptance criteria seems contradictory or impossible to implement
- Tiptap mention extension doesn't support the required behavior (storing note ID + title in node attrs)
- Export output doesn't match the Phase 5 spec examples and the discrepancy can't be resolved

**Shortcuts (apply without deliberation):**
- Use `generateId()` from `src/utils/ids.ts` for all new record IDs
- Use `nowISO()` from `src/utils/dates.ts` for all timestamps
- Use `db` from `src/storage/db/client.ts` for all Dexie access
- Use `showToast()` from `useToast()` for all user-facing error notifications
- Place new repositories in `src/storage/repositories/<domain>Repository.ts`
- Place new hooks in `src/features/<domain>/use<Feature>.ts`
- Place new types in `src/types/<domain>.ts`
- Place new screens in `src/screens/<Name>Screen.tsx`
- Place new components in `src/components/<category>/`
- Use the `Card` primitive from `src/components/primitives/Card.tsx` for note cards
- Use the `Modal` and `Drawer` primitives for bottom sheets and overlays
- Use the `Button` primitive with variant props for all action buttons

## Decision Authority

**Agent decides autonomously:**
- File and folder placement within established conventions
- Component internal implementation (props, state, rendering logic)
- CSS variable usage and inline styling choices
- Hook internal implementation details
- Repository query patterns and Dexie usage
- Tiptap extension configuration details
- Error message wording
- Loading state and skeleton UI implementation
- Test file structure and test case design

**Agent recommends, human approves:**
- Adding npm dependencies beyond Tiptap + JSZip
- Changes to Dexie schema beyond what's defined
- Changes to the 4-tab navigation structure
- Deviations from the Phase spec data models or acceptance criteria
- New React contexts beyond CampaignContext
- How existing character screens are restructured for the Character sub-tab
- Bottom sheet vs. modal vs. full-screen decisions for note creation flows

**Human decides:**
- Scope changes (adding/removing note types, changing export formats)
- UX design decisions affecting touch-first principles
- Any changes to Obsidian export format (YAML front matter shapes are contracts)
- Whether to add additional Tiptap features beyond mentions and vim mode
- Performance trade-offs if they arise (e.g., lazy loading strategies)

## War-Game Results

**Most Likely Failure:** Tiptap ProseMirror JSON mention nodes not surviving save/reload cycle. **Mitigation:** Store ProseMirror JSON natively in Dexie (no markdown conversion). Verify the round-trip (insert mention → save to Dexie → reload from Dexie → verify mention node attrs contain noteId and title) as a Stage 1 acceptance test before building any features on top.

**Scale Stress:** N/A at current scope. Single user, hundreds of notes at most. Dexie handles this trivially. EntityLink compound indexes prevent the only potential hot-path slowdown.

**Dependency Risk:** Tiptap is the highest-risk dependency. If a version breaks the mention extension or vim mode, it blocks note body editing. **Mitigation:** Pin Tiptap versions in package.json. The core note system (title, type-specific fields, EntityLinks) works without Tiptap — body editing is the only feature that depends on it. Quick-capture flows (Quick Note, Quick NPC) can function with a plain textarea fallback if Tiptap fails.

**6-Month Maintenance:** Plan is readable and well-structured. Component responsibilities are clear. Zod schemas on the `typeData` discriminated union provide compile-time + runtime safety for type-specific note fields, making future note type modifications safe. The ProseMirror JSON storage format means the body is always lossless — export rendering can evolve without re-processing stored data.

## Evaluation Metadata

- Evaluated: 2026-03-30
- Cynefin Domain: Complicated (depth matches — thorough design with approach comparison)
- Critical Gaps Found: 2 (2 resolved)
- Important Gaps Found: 4 (4 resolved)
- Suggestions: 3 (3 incorporated)

**Changes applied during evaluation:**
- Resolved CampaignContext/AppStateContext relationship: CampaignContext wraps AppStateContext with explicit state ownership table
- Added Zod schema requirement for all new data models with discriminated union on note.type
- Converted NoteService to `useNoteActions()` hook and ExportService to pure utility functions — matches codebase conventions
- Changed note body storage from markdown to ProseMirror JSON — markdown is export-only, no lossy round-trip
- Specified Dexie compound index syntax for EntityLinks hot-path queries
- Added campaign-less character behavior spec: characters are fully independent of campaigns
- Added Definition of Done with testable criteria for all three stages
- Added Commander's Intent, Execution Guidance, Decision Authority, War-Game Results sections

## Next Steps

- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-30-scaldbok-integration-design.md`)
- [ ] Evaluate Tiptap bundle size and confirm vim mode extension compatibility
- [ ] Drop the existing `referenceNotes` table in the v3 migration (no data to migrate)
