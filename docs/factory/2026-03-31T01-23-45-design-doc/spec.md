# Forge Spec — Scaldbok Integration into Skaldmark

```yaml
run: 2026-03-31T01-23-45-design-doc
phase: forge
source: docs/plans/2026-03-30-scaldbok-integration-design.md
generated: 2026-03-31
status: ready
score: 91
```

---

## Intent Hierarchy

```
MISSION
  Deliver a mobile-first PWA where a Dragonbane player can start a session
  with one tap, capture NPCs/notes/combat events in under 5 seconds each,
  end the session, and export everything to an Obsidian vault as interlinked
  markdown files — without the app ever competing with the game for attention.

STRATEGIC INTENT
  Transform Skaldmark from a character-centric tool into a campaign-centric
  companion where characters live inside campaigns, sessions scope all note
  capture, and every note exports cleanly to an Obsidian vault.

OPERATIONAL APPROACH
  Foundation-First (Approach C): Build the architectural skeleton once
  (nav shell, Dexie v3 schema, CampaignContext, EntityLink system) then
  layer all user-facing features on the solid base without mid-stream rework.

TACTICAL CONSTRAINTS
  - Dragonbane-only design (no multi-system abstractions)
  - Character tab works with or without a campaign
  - ProseMirror JSON is the note body source of truth; markdown is export-only
  - Inline CSS with CSS variables; no CSS-in-JS, no imported stylesheets
  - Named exports only (no default exports)
  - Hooks-as-services for stateful ops; pure functions for stateless transforms
  - No rule enforcement (no hit calc, no initiative, no spell validation)
  - Tap targets ≥ 44×44 px; quick-capture requires no typing
```

---

## Spec Score: 91 / 100

| Dimension | Score | Notes |
|-----------|-------|-------|
| Clarity of intent | 10/10 | Commander's Intent + Decision Authority fully specified |
| Acceptance criteria completeness | 9/10 | Stage 1 & 2 DoD thorough; Stage 3 partially delegated to sub-specs |
| Architectural coherence | 10/10 | Ownership table, context chain, repository pattern all explicit |
| Risk identification | 9/10 | War-game results cover top risks; bundle size TBD |
| Build order fidelity | 9/10 | Stages sequenced correctly; export-first priority called out |
| Constraint precision | 10/10 | Must/must-not list is implementable and unambiguous |
| Freedom grants | 9/10 | Agent autonomy well-scoped; escalation triggers defined |
| Data model completeness | 9/10 | Zod discriminated union required; `typeData` shapes left to sub-specs |
| Test coverage guidance | 8/10 | CRUD pass criteria given; no specific assertion examples |
| Cross-cutting concerns | 8/10 | Error handling solid; no offline/sync strategy needed (single user) |

---

## Sub-Spec Index

| # | Sub-Spec | Stage | Priority | Score |
|---|----------|-------|----------|-------|
| S1 | Navigation Shell Rebuild | 1 | P0 | 94 |
| S2 | Dexie v3 Schema Migration | 1 | P0 | 96 |
| S3 | CampaignContext Provider | 1 | P0 | 93 |
| S4 | Note Repositories & useNoteActions | 1 | P0 | 92 |
| S5 | Export Utilities (Pure Functions) | 1 | P0 | 91 |
| S6 | Tiptap Editor Integration | 1 | P1 | 88 |
| S7 | Campaign & Session CRUD (Phase 1) | 2 | P0 | 90 |
| S8 | Party Model & Member Management (Phase 2) | 2 | P1 | 89 |
| S9 | Notes Hub & Quick Capture (Phase 3) | 2 | P0 | 90 |
| S10 | Export Delivery — Single/Session/Bundle (Phase 5) | 2 | P0 | 92 |
| S11 | Combat Event Timeline in Session Tab (Phase 4) | 2 | P1 | 87 |

---

## S1 — Navigation Shell Rebuild

**Score: 94** | Stage 1 | P0

### Intent
Replace the current navigation shell with a 4-tab bottom nav that makes campaign, session, notes, and character access a single tap away. The shell must not introduce any character tab regression.

### Acceptance Criteria

```
AC-S1-01  Four bottom-nav tabs render: Session, Notes, Character, More.
          Each tab is tappable and routes to its respective screen.

AC-S1-02  Campaign header renders as a persistent bar above tab content.
          Shows active campaign name when a campaign is set.
          Shows "No campaign" (or equivalent neutral label) when none exists.
          Tapping the header opens a campaign selector overlay.

AC-S1-03  Character tab renders a horizontal sub-nav (pill bar or equivalent)
          with sections: Sheet / Skills / Gear / Magic.
          Each pill routes to the corresponding existing screen without
          visual regression compared to the pre-migration app.

AC-S1-04  Session tab and Notes tab each show a prompt card when no campaign
          is active: text includes "Create a campaign to get started" or
          semantically equivalent copy.
          Character tab renders fully and independently of campaign state.

AC-S1-05  All primary tab-bar tap targets are ≥ 44 × 44 px (verified by
          visual inspection or computed style check in dev tools).

AC-S1-06  No TypeScript compiler errors introduced by shell changes.

AC-S1-07  Existing character sheet screens (Sheet, Skills, Gear, Magic)
          render without console errors after migration into Character sub-tab.
```

### Implementation Notes
- Bottom nav lives at `src/components/shell/BottomNav.tsx`
- Campaign header lives at `src/components/shell/CampaignHeader.tsx`
- Character sub-nav lives at `src/components/shell/CharacterSubNav.tsx`
- Shell layout wraps all screens; existing screen components move, not rewrite
- Use CSS variables for tab highlight color; no hardcoded hex in components

---

## S2 — Dexie v3 Schema Migration

**Score: 96** | Stage 1 | P0

### Intent
Extend the Dexie database in one clean migration that adds all six new tables with correct indexes. Existing tables must be untouched. The schema must be production-correct on first write — migrations are not easily reversible in IndexedDB.

### Acceptance Criteria

```
AC-S2-01  Dexie version increments to 3.
          Upgrade function adds exactly these tables (existing tables unchanged):
            campaigns       — indexed: id, status, updatedAt
            sessions        — indexed: id, campaignId, status, date
            notes           — indexed: id, campaignId, sessionId, type, status, pinned
            entityLinks     — indexed per AC-S2-03
            parties         — indexed: id, campaignId
            partyMembers    — indexed: id, partyId, linkedCharacterId

AC-S2-02  Existing tables are NOT modified, dropped, or re-indexed:
          characters, systems, appSettings, referenceNotes, metadata.
          (referenceNotes intentionally preserved — drop deferred to a future
          migration once data migration path is confirmed.)

AC-S2-03  entityLinks table uses the following Dexie schema string:
          'id, [fromEntityId+relationshipType], [toEntityId+relationshipType],
           fromEntityType, toEntityType'
          Both compound indexes are present and queryable.

AC-S2-04  Zod schemas exist in src/types/ for all new record types:
            campaignSchema
            sessionSchema
            noteSchema  (discriminated union on note.type for typeData)
            entityLinkSchema
            partySchema
            partyMemberSchema
          Each schema matches the TypeScript interface for its domain type.
          noteSchema discriminated union covers at minimum: generic, npc, combat.

AC-S2-05  Repository read functions (AC-S4) validate records against Zod
          schemas on read. A record failing validation logs a warning and
          returns undefined rather than throwing.

AC-S2-06  After running the migration in a browser, IndexedDB inspector shows
          all 6 new object stores with the correct key paths.
          (Verified manually during Stage 1 sign-off.)

AC-S2-07  No TypeScript errors in db schema definition file.
```

### Implementation Notes
- Schema definition lives in `src/storage/db/client.ts` (existing file)
- Version 3 upgrade block adds new stores; do NOT touch version 1 or 2 blocks
- Zod schemas live in `src/types/campaign.ts`, `src/types/session.ts`,
  `src/types/note.ts`, `src/types/entityLink.ts`, `src/types/party.ts`
- TypeScript interfaces extend `Timestamped` and `Versioned` base types
  (follow existing pattern in `src/types/`)
- `noteSchema` uses `z.discriminatedUnion('type', [...])` where each variant
  defines the `typeData` shape for that note type

---

## S3 — CampaignContext Provider

**Score: 93** | Stage 1 | P0

### Intent
Provide a React context that wraps AppStateContext and exposes campaign, session, party, and character-in-campaign state to all consumers. Must hydrate from Dexie on app load, guard single-active-session invariant, and provide null-safe values when no campaign exists.

### Acceptance Criteria

```
AC-S3-01  CampaignContext is created with createContext(null) pattern.
          useCampaignContext() hook throws a descriptive error if called
          outside the provider (matches existing context pattern).

AC-S3-02  Provider hydrates on mount:
          - Reads campaigns from Dexie, finds first with status "active"
          - If found, resolves its active session, party, and activeCharacterId
          - Sets activeCampaign, activeSession, activeParty, activeCharacter
            in context state
          - If no active campaign, all four values are null

AC-S3-03  CampaignContext wraps AppStateContext in the component tree.
          AppStateContext continues to own: activeCharacterId, theme, mode,
          boon/bane overrides.
          CampaignContext owns: activeCampaign, activeSession, activeParty,
          activeCharacterInCampaign.
          No state is duplicated between the two contexts.

AC-S3-04  startSession() action:
          - Guards: if activeSession exists, does NOT create a new one;
            returns an error indicator or throws (caller handles UX)
          - Writes new session record to Dexie (status: "active")
          - Updates activeSession in context state
          - Auto-generates session title (e.g., "Session N — YYYY-MM-DD")

AC-S3-05  endSession() action:
          - Sets activeSession.status to "ended" in Dexie
          - Sets activeSession.endedAt to current ISO timestamp
          - Clears activeSession from context state (set to null)

AC-S3-06  On app launch, if an active session exists with startedAt more than
          24 hours ago:
          - A warning is surfaced to the user (toast or prompt)
          - The session is NOT auto-ended
          - The user is offered "End it" or "Continue" options

AC-S3-07  setActiveCampaign(campaignId) action updates activeCampaign in
          context and re-resolves activeSession and activeParty from Dexie.

AC-S3-08  Context provides null values (not undefined, not thrown errors)
          when no campaign is set. All consumers treat null as "no campaign"
          and degrade gracefully per AC-S1-04.

AC-S3-09  No TypeScript errors in provider or hook files.
```

### Implementation Notes
- Lives at `src/features/campaign/CampaignContext.tsx`
- Follows the interface + createContext(null) + Provider + useHook pattern
- Uses mounted-flag pattern for async Dexie reads (prevent setState after unmount)
- Does NOT own note creation, EntityLink creation, or export logic

---

## S4 — Note Repositories & useNoteActions

**Score: 92** | Stage 1 | P0

### Intent
Provide the full CRUD and auto-linking layer for notes. Repository functions are pure async; the hook is the stateful service layer that reads context and orchestrates operations.

### Acceptance Criteria

```
AC-S4-01  The following repository files exist as pure async functions
          (no classes, no React imports):
            src/storage/repositories/noteRepository.ts
            src/storage/repositories/entityLinkRepository.ts
            src/storage/repositories/campaignRepository.ts
            src/storage/repositories/sessionRepository.ts
            src/storage/repositories/partyRepository.ts

AC-S4-02  noteRepository exposes at minimum:
            getNoteById(id)      → Note | undefined
            getNotesByCampaign(campaignId) → Note[]
            getNotesBySession(sessionId)   → Note[]
            createNote(data)     → Note
            updateNote(id, data) → Note
            deleteNote(id)       → void

AC-S4-03  entityLinkRepository exposes at minimum:
            getLinksFrom(fromEntityId, relationshipType) → EntityLink[]
            getLinksTo(toEntityId, relationshipType)     → EntityLink[]
            createLink(data)     → EntityLink
            deleteLinksForNote(noteId) → void  (cascade helper)

AC-S4-04  All repository reads validate the returned record(s) against the
          corresponding Zod schema (AC-S2-04, AC-S2-05).

AC-S4-05  useNoteActions() hook returns:
            { createNote, updateNote, deleteNote, linkNote, pinNote, unpinNote }
          Each action reads campaignId and sessionId from CampaignContext
          automatically — callers do not pass context IDs.

AC-S4-06  createNote() auto-creates EntityLinks on save:
            session → note  (relationshipType: "contains")
            note → session  (relationshipType: "introduced_in")  [for npc type]
          Links are NOT duplicated if already present (deduplicate check).

AC-S4-07  deleteNote() cascades: calls entityLinkRepository.deleteLinksForNote()
          before deleting the note record.

AC-S4-08  pinNote(noteId) / unpinNote(noteId) toggle note.pinned in Dexie.

AC-S4-09  All repository functions wrap Dexie calls in try-catch and rethrow
          with a descriptive message (e.g., "noteRepository.createNote failed:").

AC-S4-10  useNoteActions() catches repository errors and calls showToast()
          with a user-facing message. It does NOT rethrow to the component.

AC-S4-11  Basic CRUD round-trip passes for each repository:
          create → read back → update → read back → delete → confirm gone.
          (Verified in browser dev tools during Stage 1 sign-off.)
```

### Implementation Notes
- Hook lives at `src/features/notes/useNoteActions.ts`
- Follows `useCharacterActions()` hook pattern
- `generateId()` from `src/utils/ids.ts` for all new IDs
- `nowISO()` from `src/utils/dates.ts` for all timestamps
- `db` from `src/storage/db/client.ts` for all Dexie access

---

## S5 — Export Utilities (Pure Functions)

**Score: 91** | Stage 1 | P0

### Intent
Provide a stateless, testable export layer that converts Dexie records to Obsidian-compatible markdown. No React dependency. Output quality is the killer-feature gate.

### Acceptance Criteria

```
AC-S5-01  All export functions are pure (no side effects, no React imports,
          no Dexie access). They accept data and return strings or Blobs.

AC-S5-02  renderNoteToMarkdown(note, entityLinks, allNotes) returns a string
          containing:
            - YAML front matter block (---) with at minimum:
                title, type, id, campaignId, sessionId, createdAt, updatedAt, tags
            - Markdown body serialized from note.body (ProseMirror JSON)
            - @-mention nodes resolved to [[Note Title]] wiki-links
            - Deleted-note mentions rendered as plain text (no brackets)

AC-S5-03  renderSessionBundle(session, linkedNotes, entityLinks) returns
          Map<filename, markdown> where:
            - One entry is the session index file
            - One entry per linked note exists
            - Filenames are generated by generateFilename(note)
            - No duplicate filenames in the map

AC-S5-04  renderCampaignIndex(campaign, sessions, npcs, openRumors) returns
          a single markdown string with a YAML front matter block and
          sections listing sessions, NPCs, and open rumors.

AC-S5-05  resolveWikiLinks(prosemirrorJson, allNotes) converts ProseMirror
          mention nodes to [[Title]] wiki-links using the note title from
          allNotes. Returns a markdown string.

AC-S5-06  generateFilename(note) returns a slug string suitable as a filesystem
          filename (lowercase, hyphens, no special chars, includes note ID suffix).

AC-S5-07  bundleToZip(files: Map<string, string>) returns a Blob (JSZip).
          All files in the map appear in the zip at the root level.

AC-S5-08  Delivery utilities in src/utils/export/delivery.ts:
            shareFile(blob, filename)  — navigator.share() with Blob download fallback
            copyToClipboard(markdown)  — navigator.clipboard.writeText()
            downloadBlob(blob, filename) — Blob download trigger
          shareFile detects share API capability before calling navigator.share().

AC-S5-09  renderNoteToMarkdown called with a minimal generic note (title,
          type: "generic", empty body) produces a string that:
            - Starts with "---"
            - Contains "title:" in front matter
            - Contains "type: generic" in front matter
            - Ends front matter with "---"
          (Unit-verifiable without browser environment.)

AC-S5-10  No TypeScript errors in export utility files.
```

### Implementation Notes
- Files live under `src/utils/export/`:
  - `renderNote.ts`, `renderSession.ts`, `renderCampaignIndex.ts`
  - `resolveWikiLinks.ts`, `generateFilename.ts`, `bundleToZip.ts`
  - `delivery.ts`
- Use a ProseMirror-to-markdown serializer; if `@tiptap/pm` helpers are available,
  use them — otherwise write a minimal recursive serializer for the node types
  the editor actually emits (paragraph, text, mention, heading, bulletList)
- YAML front matter shapes are a contract — do not invent fields not specified here

---

## S6 — Tiptap Editor Integration

**Score: 88** | Stage 1 | P1

### Intent
Integrate Tiptap as the note body editor with @-mention support for linking to other notes by ID and title. Vim mode is configurable. The editor must survive a save/reload cycle without data loss.

### Acceptance Criteria

```
AC-S6-01  A TiptapNoteEditor component exists at
          src/components/notes/TiptapNoteEditor.tsx.
          It renders a Tiptap editor with StarterKit and the Mention extension.

AC-S6-02  Mention extension is configured with typeahead that:
            - Triggers on "@"
            - Queries existing notes by title prefix from the notes repository
            - Renders a suggestion list of matching note titles
            - On selection, inserts a mention node with attrs: { id, title }

AC-S6-03  Mention round-trip test (verified manually during Stage 1 sign-off):
            1. Open editor, type "@Sir", select "Sir Talos" from typeahead
            2. Save note (body stored as ProseMirror JSON in Dexie)
            3. Reload app
            4. Re-open note — editor renders "Sir Talos" mention chip
            5. ProseMirror JSON in Dexie contains mention node with
               attrs.id and attrs.title both non-empty

AC-S6-04  Vim mode toggle:
            - Setting "vimMode" exists in appSettings (boolean, default false)
            - When true, @tiptap/extension-vim-keymap is active in the editor
            - Toggle is accessible from the Settings screen

AC-S6-05  Editor stores body as ProseMirror JSON object in note.body.
          It does NOT store raw markdown. No markdown-to-ProseMirror
          conversion occurs on load.

AC-S6-06  Editor renders with inline styles using CSS variables.
          No imported stylesheet from Tiptap is used (or, if the default
          Tiptap stylesheet is unavoidable, it is scoped and does not
          override existing theme variables).

AC-S6-07  If Tiptap fails to load (import error), the note creation flow
          falls back to a plain <textarea> for body input.
          Core note metadata (title, type) still saves correctly.

AC-S6-08  No TypeScript errors in editor component file.
```

### Implementation Notes
- Pin Tiptap versions in package.json (exact version, no `^` or `~`)
- Required packages: `@tiptap/react`, `@tiptap/starter-kit`,
  `@tiptap/extension-mention`, `@tiptap/extension-vim-keymap` (lazy import)
- Vim keymap should be dynamically imported to avoid bundle bloat when disabled
- Mention suggestion list uses the `Card` primitive from
  `src/components/primitives/Card.tsx`

---

## S7 — Campaign & Session CRUD (Phase 1)

**Score: 90** | Stage 2 | P0

### Intent
Enable a user to create a campaign, start a session, and end a session from the UI. This is the minimum viable campaign lifecycle.

### Acceptance Criteria

```
AC-S7-01  User can create a campaign from a Campaign Creation screen or modal.
          Required fields: name. Optional: description, system (default: "dragonbane").
          On save, campaign appears in campaign selector in the header.

AC-S7-02  User can set an active campaign by tapping it in the campaign selector.
          CampaignContext.setActiveCampaign() is called; header updates immediately.

AC-S7-03  Session tab shows "Start Session" button when:
          - An active campaign exists
          - No active session exists for that campaign

AC-S7-04  Tapping "Start Session":
          - Creates a session record in Dexie (status: "active")
          - Updates CampaignContext.activeSession
          - Session tab shows session status (title, started time)
          - "Start Session" button is replaced by "End Session" button

AC-S7-05  Tapping "End Session":
          - Prompts for confirmation (modal or drawer)
          - On confirm: sets session.status to "ended", sets session.endedAt
          - CampaignContext.activeSession becomes null
          - Session tab returns to "Start Session" state

AC-S7-06  If a campaign has no active session, the Session tab still renders
          (no blank screen). Shows at minimum: campaign name, last session
          summary or "No sessions yet."

AC-S7-07  Stale session warning fires on app launch per AC-S3-06.

AC-S7-08  No TypeScript errors in Campaign and Session screen files.
```

---

## S8 — Party Model & Member Management (Phase 2)

**Score: 89** | Stage 2 | P1

### Intent
Associate characters with a campaign via a party, and identify which character the user is playing in the active session.

### Acceptance Criteria

```
AC-S8-01  A campaign has one party (created automatically when the campaign
          is created, or on first member add).

AC-S8-02  User can add an existing character to the campaign party from a
          "Manage Party" screen/drawer.
          partyMember record is created with linkedCharacterId set.

AC-S8-03  User can remove a character from the party.
          partyMember record is deleted. Character record is NOT deleted.

AC-S8-04  CampaignContext.activeParty reflects the current party members.
          Party member list is readable from any tab.

AC-S8-05  User can designate which party member is "my character" for the
          active campaign (activeCharacterInCampaign).
          This is stored in the party or campaign record (not in AppStateContext).

AC-S8-06  Character tab continues to work independently of party status.
          A character not in any party is fully editable.

AC-S8-07  No TypeScript errors in Party screen and repository files.
```

---

## S9 — Notes Hub & Quick Capture (Phase 3)

**Score: 90** | Stage 2 | P0

### Intent
Provide the Notes tab as a hub for creating and browsing notes. Quick Note and Quick NPC flows must complete without typing (tap-only for required fields), with optional Tiptap body entry.

### Acceptance Criteria

```
AC-S9-01  Notes tab renders a hub showing notes grouped by type (or a flat
          list with type badges). Requires active campaign to show notes;
          shows prompt card otherwise.

AC-S9-02  "Quick Note" action creates a generic note:
          - Tapping the action opens a creation drawer/modal
          - Required field: title (text input)
          - Optional field: body (Tiptap editor)
          - On save: note appears in hub immediately

AC-S9-03  "Quick NPC" action creates an npc-type note:
          - Tapping the action opens a creation drawer/modal
          - Required field: name (text input, maps to note.title)
          - Optional fields in typeData: role, affiliation, notes (body via Tiptap)
          - On save: NPC appears under NPCs section of hub immediately

AC-S9-04  Notes created via Quick Note / Quick NPC auto-link to active session
          per AC-S4-06.

AC-S9-05  "Link Note" allows associating an existing note with the active session
          (creates an EntityLink with relationshipType "linked_to").
          Existing links are not duplicated.

AC-S9-06  Pinned notes (note.pinned = true) appear in a pinned section at the
          top of the Notes hub.

AC-S9-07  Notes hub shows a count badge per type section when notes exist.

AC-S9-08  All primary action tap targets (Quick Note, Quick NPC, Link Note)
          are ≥ 44 × 44 px.

AC-S9-09  No TypeScript errors in Notes hub and creation component files.
```

---

## S10 — Export Delivery — Single / Session / Bundle (Phase 5)

**Score: 92** | Stage 2 | P0

### Intent
Deliver working export in three flavors before Stage 2 ships. Export is the killer feature; a session with no export path is a dead end.

### Acceptance Criteria

```
AC-S10-01  Single note export:
           - "Export Note" action on any note calls renderNoteToMarkdown()
           - Result is delivered via shareFile() or copyToClipboard()
           - Produced markdown file has correct YAML front matter per AC-S5-02
           - Wiki-links resolve to [[Title]] for all intact @-mentions

AC-S10-02  Session export (.md file):
           - "Export Session" action on ended/active session
           - Produces one .md file: session index with linkedNotes: [...] in YAML
           - Delivered via shareFile()

AC-S10-03  Session + notes bundle (.zip):
           - "Export Session + Notes" action produces a .zip via bundleToZip()
           - Zip contains: session index .md + one .md per linked note
           - All wiki-links across files resolve correctly (note A mentions note B
             → note A's export contains [[Note B Title]] → note B's file exists
             in the zip)
           - Delivered via shareFile() with Blob download fallback

AC-S10-04  "Copy as Markdown" copies single note markdown to clipboard
           via copyToClipboard(). Shows success toast.

AC-S10-05  On mobile Safari / PWA, if navigator.share() does not support
           .zip Blob, the app falls back to Blob download without crashing.

AC-S10-06  No TypeScript errors in export delivery and screen files.
```

---

## S11 — Combat Event Timeline in Session Tab (Phase 4)

**Score: 87** | Stage 2 | P1

### Intent
Add a combat event journal to the Session tab so the DM can log events by round without managing mechanical state. Events are captured fast; rules are NOT enforced.

### Acceptance Criteria

```
AC-S11-01  "Start Combat" button appears in Session tab when a session is active.
           Tapping it creates a combat-type note and auto-links it to the session.

AC-S11-02  Combat view shows:
           - Current round number
           - Event log (reverse chronological or chronological — agent chooses)
           - "Next Round" button

AC-S11-03  Event types available as tap targets (no typing required for type):
           attack, spell, ability, damage, heal, condition, note.
           Each event type has a distinct chip/button in the event entry row.

AC-S11-04  "Next Round" increments round counter and inserts a round-separator
           event in the log.

AC-S11-05  Heroic ability picker:
           - Shows abilities from the active character's sheet
           - Tapping an ability logs an ability event for that character

AC-S11-06  Spell picker:
           - Shows all known spells from party members, grouped by character
           - Remaining WP is shown next to each character's spells
           - Spells that would exceed remaining WP are dimmed but still visible
           - Tapping a spell logs a spell event; WP is NOT auto-deducted
             (no rule enforcement)
           - "Quick-add spell not on sheet" option available

AC-S11-07  Combat note is stored in Dexie as a note with type: "combat".
           typeData contains: { rounds: [...], participants: [...] }

AC-S11-08  No TypeScript errors in combat timeline component files.
```

---

## Cross-Cutting Acceptance Criteria

```
XC-01  ZERO TypeScript compiler errors across all modified/new files
       before any stage is considered complete.

XC-02  All new IDs use generateId() from src/utils/ids.ts.
       All new timestamps use nowISO() from src/utils/dates.ts.
       All Dexie access uses db from src/storage/db/client.ts.

XC-03  All new components use inline style={{}} with CSS variables.
       No new className-based styling unless the existing file already
       uses className (grandfathered pattern).

XC-04  All new exports are named exports. No default exports in any
       new file.

XC-05  All hooks follow the use<Feature>Actions() → { fn1, fn2 } shape.
       No hook returns arrays (no [value, setter] pattern for new hooks).

XC-06  showToast() from useToast() is the only mechanism for surfacing
       errors to the user from hooks and services.

XC-07  No new npm packages are added without escalation approval
       (exception: Tiptap packages and JSZip are pre-approved).

XC-08  The existing character sheet screens (Sheet, Skills, Gear, Magic,
       Combat) render without regression after the navigation shell rebuild.
       Verified by manual smoke-test during Stage 1 sign-off.
```

---

## Escalation Triggers

Halt implementation and surface to Caleb before proceeding if:

1. A new npm dependency is needed beyond Tiptap, JSZip, and their sub-packages.
2. The Dexie schema requires changes beyond what S2 specifies.
3. The 4-tab navigation structure needs modification.
4. Any sub-spec acceptance criterion is contradictory or technically impossible.
5. Tiptap mention extension cannot store both `id` and `title` in node attrs.
6. Export output cannot match the Phase 5 spec markdown shapes.

---

## Build Sequence

```
Stage 1 (Foundation — unblock everything)
  S2 → S3 → S4 → S1 → S5 → S6
  (Schema before context; context before hooks; shell can parallel with hooks)

Stage 2 (Core Features — target 2026-04-18)
  S7 → S8 → S9 → S10 → S11
  (Campaign lifecycle before party; party before notes; notes before export)

Stage 3 (Enhancements — post first game)
  Phase 3a: Loot, Rumor, Location note types; pinned notes; session recap
  Phase 3b: Skill check log, quick quote, relationship labels, NPC frequency
  Phase 5 polish: Campaign index, full zip, share sheet
```

---

## Definition of Done — Stage 1

All of the following must be true before Stage 2 begins:

- [ ] AC-S1-01 through AC-S1-07 pass
- [ ] AC-S2-01 through AC-S2-07 pass
- [ ] AC-S3-01 through AC-S3-09 pass
- [ ] AC-S4-01 through AC-S4-11 pass
- [ ] AC-S5-01 through AC-S5-10 pass
- [ ] AC-S6-01 through AC-S6-08 pass (or S6-07 fallback documented)
- [ ] XC-01 through XC-08 pass
- [ ] Manual smoke-test: existing character sheet screens render without regression
- [ ] Manual smoke-test: Tiptap mention round-trip (AC-S6-03) confirmed in browser

## Definition of Done — Stage 2

All of the following must be true before Stage 3 begins:

- [ ] AC-S7-01 through AC-S7-08 pass
- [ ] AC-S8-01 through AC-S8-07 pass
- [ ] AC-S9-01 through AC-S9-09 pass
- [ ] AC-S10-01 through AC-S10-06 pass
- [ ] AC-S11-01 through AC-S11-08 pass
- [ ] XC-01 through XC-08 continue to pass
- [ ] End-to-end flow: start campaign → start session → create NPC → export session+notes zip → open zip → verify markdown and wiki-links
