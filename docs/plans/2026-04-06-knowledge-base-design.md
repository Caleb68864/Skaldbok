---
date: 2026-04-06
evaluated_date: 2026-04-06
topic: "In-App Knowledge Base — Obsidian-Like Note Reading Experience"
author: Caleb Bennett
status: evaluated
tags:
  - design
  - knowledge-base
  - notes
  - wikilinks
  - graph
---

# In-App Knowledge Base — Design

## Summary

Transform Skaldmark's notes system from a capture-only tool into a first-class knowledge base with Obsidian-like reading, linking, and discovery. Introduces a unified entity graph (notes, characters, NPCs, locations, items, tags as nodes; wikilinks, mentions, descriptors as edges), a vault browser for category-based navigation, a read-mode view with clickable wikilinks and backlinks, a visual graph view, and a command palette for instant note jumping. All data stays in IndexedDB — fully offline, fully local.

## Approach Selected

**Approach B: Knowledge Base — Unified Entity Graph + Vault Browser.** Chosen because the unified graph layer is the foundation that makes wikilinks, backlinks, graph view, and contextual reading all possible without building each as a separate feature. The graph is derived data that can always be rebuilt from notes and characters.

## Technical Reference

See [`docs/reference/kb-technical-reference.md`](../reference/kb-technical-reference.md) for researched API patterns, code examples, and gotchas for every major technical component. Key findings that shaped this design:

- **Wikilink Extension:** Build on Tiptap's Mention pattern + Suggestion utility. `char: '[[' ` works natively. Add InputRule for typed `[[Page Name]]` without autocomplete. Need explicit `@tiptap/suggestion` dependency.
- **JSON Parsing:** Simple recursive tree walker (~15 lines). No library needed. Microseconds per note. Mentions are atom nodes with `{ id, label }` attrs. Links are marks on text nodes, not separate nodes.
- **Dexie Graph:** Compound indexes work as designed. `equalsIgnoreCase()` handles label lookup (English a-z only — defer `labelLower` computed index). BFS depth-2 is ~5-20ms at scale. v7 schema is just new table declarations, no `.upgrade()` needed.
- **Graph Viz:** d3-force + d3-zoom + Canvas 2D (~12-15 KB gzipped). Native touch via d3-zoom. Sigma.js eliminated (broken touch support).
- **MiniSearch:** Single unified index handles heterogeneous types via `extractField`. `boostDocument` for type-based ranking. Use `discard()` not `remove()` for updates. `addAllAsync` with `chunkSize: 200` for non-blocking bulk rebuild.

## Constraints

- **Performance:** Wikilink resolution (`useResolveWikilink`) must complete in < 50ms — it's a single indexed Dexie lookup via `equalsIgnoreCase()`, not a scan
- **Backward compatibility:** Obsidian markdown export must continue to produce valid `[[wikilinks]]` and `@mentions`. The `renderNote.ts` export pipeline (`src/utils/export/renderNote.ts`) must be updated to handle the new `wikiLink` Tiptap node type
- **Storage budget:** Graph store should stay under 5MB for a 500-note campaign. Monitor with `navigator.storage.estimate()` in dev
- **No new backend services:** Everything runs in the browser with IndexedDB. No server, no API, no cloud sync
- **Data integrity:** The graph is derived data — it must NEVER be the source of truth. Notes and characters in their existing stores are authoritative. Graph can always be rebuilt from scratch
- **Existing migrations:** Never modify existing Dexie version 1-6 migration blocks. New work goes in version 7+
- **New dependencies:** `d3-force`, `d3-zoom`, `d3-selection` (+ their `@types/*` devDeps) for Graph View. `@tiptap/suggestion` (explicit, currently transitive) for Wikilink extension. No other new deps.

## Definition of Done (Phased)

### Phase 1: Graph Foundation
- `kb_nodes` and `kb_edges` Dexie tables created (version 7 schema)
- Link Sync Engine populates graph on note create/update/delete
- Bulk migration backfills existing notes, characters, entity links, tags
- **Verifiable:** node count matches note + character + tag count; edge count > 0 for notes with @mentions

### Phase 2: Wikilinks + Reading
- Wikilink Tiptap extension: `[[` triggers autocomplete, renders as styled inline node
- Note Reader view: renders Tiptap content read-only with tappable wikilinks, backlinks panel at bottom
- **Verifiable:** create a note with `[[Some Title]]`, save, open in reader, tap the link, land on the target note

### Phase 3: Discovery
- Vault Browser replaces NotesGrid on Session screen (compact mode) and at `/kb` (full mode)
- Command Palette: FAB trigger, fuzzy search across all nodes, tap to navigate
- **Verifiable:** search for an NPC by partial name in command palette and navigate to it in under 2 taps

### Phase 4: Visualization
- Graph View renders nodes colored by type with edges
- Filter by node type; tag nodes hidden by default with "Show tags" toggle
- Centered-node mode when opened from a specific note
- **Verifiable:** open graph from a note with 3+ links, see the note centered with neighbors visible

## Architecture

```
+-----------------------------------------------------+
|                    UI Layer                          |
|                                                     |
|  +-----------+  +-----------+  +------------------+ |
|  | Note      |  | Vault     |  | Graph View       | |
|  | Reader    |  | Browser   |  | (visual map)     | |
|  | + Editor  |  | (sidebar  |  |                  | |
|  |           |  |  + list)  |  |                  | |
|  +-----+-----+  +-----+-----+  +--------+---------+ |
|        |              |                  |           |
|  +-----+--------------+------------------+--------+ |
|  |           Knowledge Base Context               | |
|  |  (React context providing graph queries,       | |
|  |   backlinks, search, entity resolution)        | |
|  +------------------------+-----------------------+ |
+---------------------------+-------------------------+
                            |
+---------------------------+-------------------------+
|                 Data Layer                           |
|                                                     |
|  +---------------+  +---------------+  +-----------+ |
|  | Notes Store   |  | Graph Store   |  | Search    | |
|  | (Dexie)       |  | (Dexie)      |  | Index     | |
|  |               |  |               |  |(MiniSearch)| |
|  | notes         |  | kb_nodes      |  |           | |
|  | attachments   |  | kb_edges      |  | unified   | |
|  | refNotes      |  |               |  | across    | |
|  |               |  |               |  | all nodes | |
|  +---------------+  +---------------+  +-----------+ |
|                                                     |
|  +------------------------------------------------+ |
|  |          Link Sync Engine                       | |
|  |  (parses Tiptap JSON on save, extracts          | |
|  |   [[wikilinks]] and @mentions, updates          | |
|  |   graph edges, rebuilds search index)           | |
|  +------------------------------------------------+ |
+-----------------------------------------------------+
```

### Key Components

1. **Graph Store** — New Dexie tables (`kb_nodes`, `kb_edges`). Every note, character, NPC, location, item, and tag is a node. Every link is a directed edge with a type label.

2. **Link Sync Engine** — Runs on every note save. Parses Tiptap JSON, extracts wikilinks/mentions/descriptors, diffs against existing edges, writes/removes edges. Idempotent and rebuildable.

3. **Knowledge Base Context** — React context with hooks: `useBacklinks`, `useForwardLinks`, `useGraphNeighbors`, `useNodeSearch`, `useResolveWikilink`.

4. **Vault Browser** — Replaces current NotesGrid (pending discussion on session-scoped filtering). Category tabs, scannable cards, unified search, tag filtering.

5. **Note Reader** — Read-mode view with clickable wikilinks, backlinks panel, forward links, inline peek cards.

6. **Graph View** — Visual force-directed node map, filterable by type, tap-to-navigate.

7. **Wikilink Tiptap Extension** — `[[double bracket]]` syntax with autocomplete, distinct from `@mention`.

8. **Command Palette** — Floating action button or shortcut triggers full-screen search overlay. Fuzzy search across all nodes, instant navigation.

## Components

### Graph Store (Dexie tables)

**Owns:** The canonical relationship graph between all entities.

**`kb_nodes` table:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Same ID as source entity (note ID, character ID, etc.) |
| `type` | string | `'note'`, `'character'`, `'npc'`, `'location'`, `'item'`, `'tag'`, `'unresolved'` |
| `subtype` | string? | For notes: the note type (`generic`, `combat`, `loot`, etc.) |
| `label` | string | Display name (note title, character name, tag text) |
| `campaignId` | string | Scoped to campaign (empty string for shared notes) |
| `scope` | string | `'campaign'` (default) or `'shared'` (visible across all campaigns) |
| `metadata` | object? | Type-specific summary data for preview cards |
| `updatedAt` | string | Last sync timestamp |

Indexes: `[campaignId+type]`, `[campaignId]`, `[scope]`, `label`

**`kb_edges` table:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated |
| `fromId` | string | Source node ID |
| `toId` | string | Target node ID |
| `type` | string | `'wikilink'`, `'mention'`, `'tag'`, `'entity-link'`, `'descriptor'` |
| `sourceContext` | string? | Sentence/paragraph containing the link (for preview) |
| `campaignId` | string | For scoped queries |
| `createdAt` | string | When edge was created |

Indexes: `[fromId]`, `[toId]`, `[campaignId+type]`, `[fromId+toId]`

**Does NOT own:** Note content, character sheets, or game data.

### Link Sync Engine

**Owns:** Keeping graph store in sync with note content and entity data.

- On note save: parse Tiptap JSON -> extract links -> diff against current edges -> add/remove
- On note create: create `kb_nodes` entry
- On note delete: remove node and all connected edges
- On character create/update/delete: sync to `kb_nodes`
- Handles dangling links: `[[wikilink]]` to nonexistent note creates `type: 'unresolved'` placeholder node
- Bulk rebuild: scan all notes + characters, populate graph from scratch
- **Sync timing:** Runs AFTER the note save completes successfully (not in the same Dexie transaction). If sync fails, the note is saved but the graph is stale — `kb_nodes.updatedAt` won't be updated, so the next load will detect staleness and retry
- **Partial failure:** If edge writes partially succeed, the graph is inconsistent for that note but self-healing on next sync. Log `console.warn` on any sync failure for debugging
- **Unknown Tiptap nodes:** When the parser encounters an unrecognized node type in the Tiptap JSON, log `console.warn` with the node type name. Do not throw — skip the node and continue parsing
<!-- Assumption: ASM-3 — settings.debugMode does not exist in AppSettings. Use import.meta.env.DEV or add the field. -->
- **Debug logging:** `console.debug` for: edges added/removed per sync, unresolved wikilinks created, sync duration in ms. Gate behind `settings.debugMode` flag

**Does NOT own:** Rendering, search indexing, or UI decisions.

### Knowledge Base Context (`KnowledgeBaseProvider`)

**Owns:** React-side access to graph, caching, and query hooks.

Key hooks:
- `useBacklinks(nodeId)` — all edges where `toId === nodeId`
- `useForwardLinks(nodeId)` — all edges where `fromId === nodeId`
- `useGraphNeighbors(nodeId, depth?)` — BFS traversal for graph view
- `useNodeSearch(query)` — unified MiniSearch across all node types
- `useNodesByType(campaignId, type)` — filtered node listing
- `useResolveWikilink(label)` — find node by label (case-insensitive)

**Does NOT own:** Graph data (delegates to Dexie), rendering, sync engine.

### Vault Browser (reusable component, replaces NotesGrid)

**Owns:** Browsing, filtering, and discovering notes/entities.

- Category navigation: tabs for People, Places, Loot, Rumors, All, etc.
- Scannable card view: title, type badge, metadata snippet, tag chips, link count
- Unified search via `useNodeSearch`
- Tag filtering, sort by date or link count
- Tap card -> navigate to Note Reader
- **Accepts filter props:** `sessionId`, `typeFilter`, `compact` mode
- **Session screen embedding:** Rendered as `<VaultBrowser sessionId={activeSession.id} compact />` — hides category sidebar, shows "Open full Knowledge Base" link
- **Full KB screen (`/kb`):** Rendered with no pre-applied filters, full sidebar and all features
- One component, two contexts — zero duplication

**Does NOT own:** Note editing, graph rendering, data persistence.

### Note Reader (new view)

**Owns:** Read-mode experience for a single note.

- Renders Tiptap content as read-only HTML
- `[[wikilinks]]` as tappable styled links
- `@mentions` as tappable styled links
- `#descriptors` as tappable tag chips
- Backlinks panel at bottom
- Forward links summary
- Inline preview: tap link -> peek card (title + snippet + type) with "Open"
- "Edit" button to switch to TiptapNoteEditor
- Attachment gallery

**Does NOT own:** Editing, graph data, vault browser.

### Graph View

**Owns:** Visual rendering of knowledge graph.

- **Stack:** d3-force (layout engine) + d3-zoom (touch/camera) + Canvas 2D (rendering). ~12-15 KB gzipped total.
- d3-force: `forceSimulation` + `forceLink` + `forceManyBody` + `forceCenter`
- d3-zoom: native pinch-to-zoom, one-finger pan, mouse wheel — battle-tested touch support
- Canvas 2D render loop: clear canvas, apply transform, draw edges as lines, draw nodes as colored circles, draw labels
- Tap-to-navigate: `pointerup` listener, invert zoom transform to get graph coords, find nearest node within radius
- Center on node: `zoom.transform(selection, d3.zoomIdentity.translate(cx, cy).scale(s))` with transition
- Filter by node type: filter the data arrays and restart simulation
- Nodes colored by type, edges colored by edge type
- Tag nodes hidden by default with "Show tags" toggle
- **Do NOT use:** react-force-graph (too heavy for PWA), sigma.js (broken touch), cytoscape.js (unnecessary weight)

**Does NOT own:** Data queries (uses `useGraphNeighbors`), note content, editing.

**Reference:** See `docs/reference/kb-technical-reference.md` Section 4 for full code patterns.

### Wikilink Tiptap Extension

**Owns:** `[[double bracket]]` syntax in the editor.

- Built on Tiptap's `Node.create()` + `@tiptap/suggestion` — same pattern as the Mention extension
- Inline atom node: `group: 'inline'`, `inline: true`, `atom: true`, `priority: 101`
<!-- Assumption: ASM-1 — No repo code validates that @tiptap/suggestion accepts a two-character trigger. Build a minimal proof-of-concept before full implementation. -->
- Suggestion config: `char: '[[' `, `allowSpaces: true`, `allowedPrefixes: [' ', '\n']`
- Node attrs: `{ id: string, label: string }` stored as `data-id`/`data-label`
- React node view via `ReactNodeViewRenderer` for the inline chip display
<!-- Assumption: ASM-4 — Tiptap InputRule creating atom nodes is less common than marks/wrapping. Validate this regex approach. -->
- InputRule: `/\[\[([^\]]+)\]\]$/` converts typed `[[Page Name]]` to node without autocomplete
- PasteRule: converts pasted `[[Page Name]]` text to nodes
- Non-existent target: creates `'unresolved'` placeholder node (renders dimmed/red)
<!-- Assumption: ASM-6 — Tiptap packages have version pin mismatch (^2.27.2 vs ^2.11.7). Align before adding @tiptap/suggestion. -->
- **Explicit dependency:** `@tiptap/suggestion` must be added to `package.json` (currently transitive)

**Does NOT own:** Graph store, navigation, read-mode rendering.

**Reference:** See `docs/reference/kb-technical-reference.md` Section 1 for full code patterns.

### Command Palette

**Owns:** Instant note/entity jumping from anywhere in the app.

- Triggered by floating action button (always visible) or keyboard shortcut
- Full-screen overlay with auto-focused search input
- Fuzzy + prefix search across all `kb_nodes` labels via MiniSearch
- Results: title, type badge, last-updated
- Tap result -> navigate to `/kb/{nodeId}`
- Supports commands: "New note", "New NPC", "Graph view", "Export all"
- Dismissed by tapping outside or swiping down

**Does NOT own:** Note content, graph data, search implementation.

## Data Flow

### Flow 1: Note Edit -> Graph Sync

1. User edits note in TiptapNoteEditor
2. Autosave triggers (800ms debounce)
3. `noteRepository.updateNote(id, { body, title, tags, ... })`
4. After write: `linkSyncEngine.syncNote(noteId)`
5. Parse Tiptap JSON body: extract `[[wikilinks]]`, `@mentions`, `#descriptors`
6. Read current edges WHERE `fromId === noteId`
7. Diff: new links vs existing edges -> insert/delete edges
8. Update `kb_nodes` entry (label, metadata, updatedAt)
9. Rebuild MiniSearch index entry for this node

### Flow 2: Navigate a Wikilink (Read Mode)

1. User taps `[[Bjorn the Bold]]` in Note Reader
2. `useResolveWikilink("Bjorn the Bold")` queries `kb_nodes` by label
3. Found -> navigate to `/kb/{nodeId}`, load reader view with backlinks + forward links
4. Not found -> prompt "Create note?" -> creates note + resolves dangling edges

### Flow 3: Vault Browser Load

1. Navigate to `/kb`
2. `KnowledgeBaseProvider` loads all nodes for campaign
3. MiniSearch index rebuilt if stale
4. Vault Browser renders: category tabs, card list, search bar
5. Tap card -> navigate to `/kb/{nodeId}`

### Flow 4: Graph View

1. Open Graph View from KB screen or from a note
2. `useGraphNeighbors(centeredNodeId, depth=2)` runs BFS
3. Force-layout positions nodes
4. Canvas 2D renders nodes (colored circles) + edges (lines)
5. Tap node -> navigate to reader

### Flow 5: Dexie Migration (schema) + Graph Population (data)

**Schema migration (Dexie version 7 `.upgrade()`):**
1. Add `kb_nodes` and `kb_edges` table declarations with indexes
2. Extend `notes` table index to include `scope` field
<!-- Assumption: ASM-8 — No evidence of typical referenceNote counts or content sizes. Consider lazy migration if dataset is large. -->
3. Migrate existing `referenceNotes` to the `notes` table with `scope: 'shared'`, `type: 'reference'`. This is small and fast — safe for a Dexie upgrade block
4. Guard with metadata key `migration_v7_ref_notes` (matching existing v6 pattern)

**Graph population (lazy, NOT in Dexie upgrade):**
1. On first KB screen load (or explicit "Rebuild Graph" in Settings)
2. Check metadata key `migration_kb_graph_v1` — if present, skip
3. If absent: bulk sync all notes, characters, entity links, tags into `kb_nodes` and `kb_edges`
4. Write metadata key `migration_kb_graph_v1` on completion
5. This is expensive (reads all notes, parses all bodies) and must not run in Dexie `.upgrade()` — it would block app startup

## Error Handling

### Dangling / Unresolved Wikilinks
- Create placeholder node with `type: 'unresolved'`
- Render as dimmed/red link with "+" icon
- On tap: prompt to create the note
- Garbage-collect unresolved nodes with zero edges on rebuild

### Title Collisions
- `useResolveWikilink` returns all matches
- Multiple matches: show disambiguation popup with type badges and dates
- Editor autocomplete: show type labels to differentiate

### Graph Sync Failures
- Sync runs AFTER note save completes (not in same transaction) — note data is always safe
- Sync is idempotent — re-running produces same result
- Partial edge write failures leave graph inconsistent for that note but self-healing on next sync
- On next load: check `note.updatedAt > node.updatedAt` -> re-sync stale nodes
- `console.warn` on any sync failure for debugging; `console.debug` for normal sync activity (gated behind `settings.debugMode`)
- "Rebuild Graph" button in settings as nuclear option
- Graph store is derived data — always rebuildable from notes + characters
- Consider adding "Graph Health" in Settings: node count vs note count, edge count, orphaned nodes, unresolved wikilinks count

### Large Campaign Performance
- Vault Browser: virtualize card list (50 at a time, infinite scroll)
- Graph View: >200 nodes defaults to 2+ connection filter, "Show all" toggle
- MiniSearch rebuild is async, non-blocking; show stale results with refresh indicator
- Edge queries use Dexie compound indexes — O(log n)

### Command Palette
- Always available via FAB or shortcut
- Fuzzy search handles typos and partial matches
- Empty state: show recent notes and quick actions

### Offline / PWA
- Everything is IndexedDB — fully offline
- No external dependencies for any KB feature
- Service worker caches new screens

## Open Questions

1. **Replace NotesGrid or keep both? RESOLVED:** Replace. The Vault Browser is a reusable component that accepts filter props (`sessionId`, `compact`). The Session screen embeds `<VaultBrowser sessionId={activeSession.id} compact />` — same component, filtered view. Full KB at `/kb` with no pre-applied filters. One component, zero duplication.

2. **Graph View library.** Deprioritized — not core to the initial delivery. Can start with a simple Canvas 2D implementation and upgrade later if needed.

3. **Wikilink syntax decided:** Going with `[[double bracket]]` as a new Tiptap extension, coexisting with `@mention`. Wikilinks are the primary linking mechanism; `@mention` continues to work for backward compatibility.

4. **Tags as graph nodes? RESOLVED:** Yes — tags are full `kb_nodes` (type `'tag'`) with edges to every note carrying that tag. However, tag nodes are **hidden from Graph View by default** behind a "Show tags" toggle to avoid visual noise. In the Vault Browser, tags work as filter chips — you don't open a tag node to browse, you filter by it. Tag node pages exist and are reachable via command palette or direct navigation for backlink queries.

<!-- Assumption: ASM-7 — baseNoteSchema needs scope field added. Audit all note query sites for campaignId filtering before implementing. -->
<!-- Assumption: ASM-13 — Dexie can't do WHERE campaignId=X OR scope='shared' in one query. Requires two queries merged client-side. -->
5. **Reference Notes in the graph? RESOLVED:** Yes — absorb into the unified knowledge graph with a new `scope` field. Notes can be `'campaign'` (default, scoped to one campaign) or `'shared'` (visible across all campaigns). The separate `ReferenceNote` system and `referenceNoteRepository` are deprecated; existing reference notes are migrated into the main notes system with `scope: 'shared'`. Graph queries extend from `WHERE campaignId = X` to `WHERE campaignId = X OR scope = 'shared'`. The bundled Game Reference data (static rules tables) stays separate — it's system data, not user knowledge. The "My Notes" tab on the Reference screen is replaced by the Vault Browser filtered to `scope: 'shared'`.

## Approaches Considered

### Approach A: "Link Layer" — Wikilinks + Backlinks + Read View
Build on existing Tiptap mentions and entity links. Add read-mode, backlinks panel, and clickable wikilinks without a new data model. **Not selected** because: links would be implicit (embedded in Tiptap JSON), requiring scanning all note bodies for backlink queries. No graph visualization. Doesn't unify notes with characters/entities. Too incremental for the stated ambition.

### Approach B: "Knowledge Base" — Unified Entity Graph + Vault Browser (SELECTED)
First-class link graph in IndexedDB. Every entity is a node, every link is an edge. Vault browser, note reader, graph view, command palette. **Selected** because it provides the architectural foundation for all desired features and the graph is derived data that can be rebuilt.

### Approach C: "Session Codex" — Context-Aware TTRPG Reader
Game-concept navigation (People, Places, Loot) with contextual sidebar panels instead of a generic graph. **Not selected** because: less flexible for freeform knowledge, still needs graph infrastructure under the hood, and the game-aware views can be built as views on top of Approach B's graph later.

## Commander's Intent

**Desired End State:** The Skaldmark app has a unified knowledge base where every note, character, NPC, location, and tagged concept is discoverable, linkable, and readable without leaving the app. A player or GM can tap a name in any note and land on its page with backlinks and context. The Obsidian export workflow still works but is no longer the primary way to read notes.

**Purpose:** Notes are currently a write-only tool — useful for capture during sessions but useless for retrieval without exporting to Obsidian and AI massaging. This design makes the app self-sufficient for in-session knowledge browsing, eliminating the export-import-massage cycle.

**Constraints (Must):**
- Must use IndexedDB/Dexie for all storage — no backend, no cloud
- Must preserve existing Obsidian markdown export compatibility
- Must work fully offline as a PWA
- Must not modify existing Dexie version 1-6 migration blocks
- Graph must always be rebuildable from notes + characters (derived data, never source of truth)
- Wikilink resolution must be < 50ms

**Constraints (Must Not):**
- Must not break existing note creation, editing, or autosave workflows
- Must not add external runtime dependencies (no server, no API calls)
- Must not delete user data during migration — archive, never delete

**Freedoms (the implementing agent MAY):**
- Choose any Canvas 2D or lightweight force-layout approach for Graph View
- Choose internal data structures for the Link Sync Engine parser
- Decide MiniSearch configuration (boost weights, fuzzy thresholds)
- Choose Tiptap extension implementation details for the wikilink node
- Decide internal component decomposition within each screen
- Choose whether to use CSS variables or Tailwind tokens for new component styling (existing codebase uses both)

## Execution Guidance

**Observe (signals to monitor during implementation):**
- `npm run build` succeeds with zero TypeScript errors after each component
- Dev server at `https://localhost:4173` renders without console errors
- For Link Sync Engine: create a note with `[[wikilinks]]` and `@mentions`, verify `kb_nodes`/`kb_edges` populated via DevTools > Application > IndexedDB
- For Vault Browser: verify cards render for existing notes after graph migration runs
- For wikilink navigation: tap a link in Note Reader and confirm it routes to the correct note

**Orient (codebase conventions — apply without deliberation):**
- Repositories are module-level exported async functions (NOT classes) in `src/storage/repositories/`
- All DB access goes through the singleton `db` from `src/storage/db/client.ts`
- New Dexie tables are declared in `SkaldbokDatabase` constructor in `client.ts` with a version bump
- Zod schemas validate on READ from DB, not on write
- React contexts use `createContext(null)` + a consumer hook that throws if null (see `src/context/AppStateContext.tsx` for pattern)
- Feature contexts live in `src/features/{feature}/` (see `src/features/campaign/CampaignContext.tsx`)
- IDs generated via `generateId()` from `src/utils/ids.ts`
- Timestamps via `nowISO()` from `src/utils/dates.ts`
- Tiptap extensions follow existing patterns in `src/features/notes/descriptorMentionExtension.ts`
- Screens are default-exported components in `src/screens/`
- Routes defined in `src/components/shell/ShellLayout.tsx`
- UI primitives in `src/components/primitives/` (Card, Button, Drawer, Modal, SectionPanel)
- Tailwind v4 with CSS custom properties (`var(--color-*)`, `var(--space-*)`)
- Dexie migrations use metadata table guards for idempotency (see v6 pattern in `client.ts`)

**Escalate When:**
- A new npm dependency is needed that isn't in `package.json`
- The Note Zod schema (`baseNoteSchema`) needs modification
- UX layout decisions for new screens (Vault Browser card design, Note Reader layout, Command Palette placement)
- Any change to `renderNoteToMarkdown` export pipeline
- Existing Dexie migration blocks need modification
- Scope changes — adding or removing features from this design

**Shortcuts (apply without deliberation):**
- New repository: create `src/storage/repositories/kbNodeRepository.ts` and `kbEdgeRepository.ts` following `noteRepository.ts` pattern
- New context: create `src/features/kb/KnowledgeBaseContext.tsx` following `CampaignContext.tsx` pattern
- New screen: create `src/screens/KnowledgeBaseScreen.tsx` as default export
- Link Sync Engine: create `src/features/kb/linkSyncEngine.ts` as a module of exported functions — use the recursive JSON walker from the technical reference (NOT ProseMirror Node hydration)
- Wikilink extension: create `src/features/notes/wikilinkExtension.ts` using `Node.create()` + `@tiptap/suggestion` — follow the Mention extension pattern, NOT the community `tiptap-wikilink-extension` repo (which bypasses Suggestion)
- Wikilink React views: `src/features/notes/WikiLinkList.tsx` (autocomplete dropdown) + `src/features/notes/WikiLinkComponent.tsx` (inline chip via `ReactNodeViewRenderer`)
- Note Reader: create `src/features/kb/NoteReader.tsx` as a component (not a screen — it's used within KB screen)
- Unified search: create `src/features/kb/useKBSearch.ts` — single MiniSearch index with `extractField` for heterogeneous types, `boostDocument` for type ranking, `discard()` for safe updates
- Graph View: create `src/features/kb/GraphView.tsx` — d3-force for layout, d3-zoom for touch/camera, Canvas 2D for rendering. Do NOT use react-force-graph or sigma.js
- **Read `docs/reference/kb-technical-reference.md` before implementing** — it contains researched code patterns for every component

## Decision Authority

**Agent decides autonomously:**
- File and folder structure for new components
- Internal implementation of Link Sync Engine parser
- Dexie index design within the specified schema
- MiniSearch configuration (boost weights, fuzzy thresholds)
- Graph layout algorithm choice (Canvas 2D vs library)
- Wikilink autocomplete ranking logic
- CSS/Tailwind styling within existing design token system
- Component decomposition within screens
- Error message wording for internal errors
- Test data and verification approach

**Agent recommends, human approves:**
- Vault Browser card layout and visual design
- Command Palette trigger UX (FAB placement, size, icon)
- Note Reader layout (backlinks panel position, preview card design)
- Any new npm dependency additions
- Changes to the Note Zod schema (`baseNoteSchema`)
- Modifications to `renderNoteToMarkdown` export pipeline
- Graph View node sizing, coloring, and interaction model

**Human decides:**
- Scope changes (adding/removing features from this design)
- Whether to deprecate the old NotesGrid before Vault Browser is proven
- Graph View inclusion in MVP vs later phase
- Any changes to existing Dexie migration blocks (v1-v6)
- Public-facing UX patterns (how the command palette is triggered, what the FAB looks like)

## Delivery Order

Build in this order — each phase is independently useful and testable:

1. **Graph Store + Link Sync Engine + Migration** — the foundation everything else depends on
2. **Wikilink Tiptap Extension** — enables creating links before the reader exists (they render as styled inline nodes in the editor)
3. **Note Reader** — the core reading experience with wikilinks and backlinks
4. **Vault Browser** — replaces NotesGrid, provides discovery
5. **Command Palette** — instant navigation from anywhere
6. **Graph View** — visual exploration (can be deferred to a later release if needed)

## War-Game Results

**Most Likely Failure:** Link Sync Engine silently falls out of sync with note content. A Tiptap JSON structure change (from a Tiptap upgrade or unrecognized node type) causes the parser to miss links. The graph shows stale connections. **Mitigation:** Parser logs `console.warn` on unknown node types. Graph is derived data — "Rebuild Graph" button in settings always available. Staleness detection via `updatedAt` comparison triggers auto-resync.

**Scale Stress:** 500 notes x 5 links avg = 2,500 edges + tag edges. Dexie handles this easily. Graph View rendering 500+ nodes on a tablet could lag. **Mitigation:** Default graph depth to 1 (direct neighbors only) on tablets. "2+ connections" filter hides leaf nodes. Vault Browser virtualizes card list.

**Dependency Risk:** Tiptap is the most critical dependency. If Tiptap's JSON schema changes between versions, the Link Sync Engine parser breaks. **Mitigation:** Pin Tiptap version. Test parser against sample documents before upgrading. Parser is defensive — skips unknown nodes rather than crashing.

**6-Month Maintenance:** Strong. Architecture is clearly documented with explicit component boundaries. The "derived data" principle means a new developer can always rebuild the graph if confused. The design doc itself is sufficient for onboarding.

## Evaluation Metadata

- Evaluated: 2026-04-06
- Cynefin Domain: Complicated (plan depth matches — thorough design with approach comparison)
- Critical Gaps Found: 2 (2 resolved)
- Important Gaps Found: 5 (5 resolved)
- Suggestions: 3 (incorporated: phased delivery order, sync engine logging, graph health diagnostic in Settings)

## Assumptions

| ID | Assumption | Severity | Evidence | Action |
|----|-----------|----------|----------|--------|
| ASM-1 | Tiptap Suggestion accepts multi-char `[[` trigger | ~~high~~ info | **confirmed** | ~~validate~~ accept |
| ASM-2 | Dexie equalsIgnoreCase() in v4.0.10 | medium | strongly_supported | validate |
| ASM-3 | settings.debugMode flag exists | low | unsupported | mitigate |
| ASM-4 | InputRule creates atom nodes from regex | medium | partially_supported | validate |
| ASM-5 | renderNoteToMarkdown handles wikiLink node | medium | partially_supported | accept |
| ASM-6 | Tiptap version compatibility when adding suggestion | medium | **confirmed mismatch** — align all to ^2.27.2 | mitigate (5 min) |
| ASM-7 | baseNoteSchema scope field (ripple effect) | ~~high~~ medium | **validated** — 1 repo fn + index change cascades to all 7 sites | accept |
| ASM-8 | ReferenceNote migration safe in upgrade block | medium | weakly_supported | research |
| ASM-9 | NotesGrid fully replaceable by VaultBrowser | medium | partially_supported | validate |
| ASM-10 | d3 packages need adding (acknowledged) | low | confirmed | accept |
| ASM-11 | Node.create() vs Mention.extend() for wikilinks | medium | partially_supported | accept |
| ASM-12 | MiniSearch extractField for heterogeneous types | low | strongly_supported | accept |
| ASM-13 | Dexie OR query for campaignId + scope | medium | weakly_supported | validate |
| ASM-14 | PWA caches new KB routes automatically | low | strongly_supported | accept |

## Known Gaps

- **ASM-3:** `settings.debugMode` does not exist in `AppSettings`. Use `import.meta.env.DEV` or add the field.
- **ASM-6:** Tiptap package.json pins diverge (^2.27.2 vs ^2.11.7). Align before adding @tiptap/suggestion.
- **ASM-13:** Dexie cannot do `WHERE campaignId=X OR scope='shared'` in a single query. Requires two queries merged client-side.

## Validation Needed

1. Build minimal Tiptap editor with `char: '[[' ` to validate ASM-1 (highest risk)
2. Audit all note query sites filtering by campaignId to size ASM-7 ripple effect
3. Prototype Dexie OR query pattern and benchmark for ASM-13
4. Align @tiptap/* versions in package.json for ASM-6
5. Read NotesGrid.tsx to confirm VaultBrowser covers all features for ASM-9

## Risks and Caveats

- ~~**ASM-1 (HIGH):**~~ **VALIDATED** — Tiptap Suggestion fully supports multi-char `char: '[[' `. Source code confirmed: regex escaping handles `[`, query slicing uses `char.length`. No risk.
- ~~**ASM-7 (HIGH):**~~ **VALIDATED, downgraded to MEDIUM** — Only `getNotesByCampaign()` in `noteRepository.ts` needs direct update. 5 critical + 2 high call sites all go through this single function. Update the repo fn + Dexie index = done.
- **ASM-6 (MEDIUM):** **CONFIRMED** — Tiptap packages have version mismatch. 3 packages at 2.11.7, 23 at 2.27.2. Align all package.json pins to ^2.27.2 before starting KB work.
- **ASM-13 (MEDIUM):** Two-query merge pattern for shared notes could impact the 50ms resolution constraint at scale.

Full reports: `docs/plans/2026-04-06-knowledge-base-design-assumptions/`

## Next Steps

- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-04-06-knowledge-base-design.md`)
- [ ] Design the Vault Browser card layout and category taxonomy (human decision — mockup needed)
- [ ] Design the Command Palette trigger UX (human decision — FAB placement and icon)
- [ ] Design the Note Reader layout (human decision — backlinks panel, preview cards)
