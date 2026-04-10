# Spec: In-App Knowledge Base — Obsidian-Like Note Reading Experience

**Run:** `2026-04-07T00-01-30-design-doc`
**Branch:** `2026/04/06-2036-caleb-feat-2026-04-06-bestiary-encounters-and-import-export-d`
**Input doc:** `docs/plans/2026-04-06-knowledge-base-design.md`
**Date scored:** 2026-04-07
**Status:** Ready for factory

---

## Commander's Intent

Transform Skaldmark from a write-only note capture tool into a self-sufficient knowledge base. Every note, character, NPC, location, and tag becomes a discoverable, linkable node. Users can tap a name in any note and land on its page. The Obsidian export workflow continues to work but is no longer required for reading.

**Must haves:** IndexedDB only, fully offline PWA, Obsidian export backward-compat, graph is always derived data (rebuildable), wikilink resolution < 50ms.
**Must nots:** No backend, no cloud, no data deletion during migration, no modification of Dexie versions 1–6.

---

## Intent Hierarchy

```
L1 — MISSION
  Transform notes from capture-only → first-class knowledge base

L2 — PHASED GOALS
  Phase 1: Queryable entity graph in IndexedDB (foundation for everything)
  Phase 2: Wikilinks + reading experience (creation + navigation of links)
  Phase 3: Discovery (Vault Browser + Command Palette)
  Phase 4: Visual exploration (Graph View)

L3 — COMPONENTS
  Graph Store (Dexie v7 tables: kb_nodes, kb_edges)
  Link Sync Engine (parse → diff → write edges on every note save)
  KB Repositories (kbNodeRepository, kbEdgeRepository)
  Knowledge Base Context (hooks: backlinks, forward links, search, resolve)
  Wikilink Tiptap Extension ([[double bracket]] → inline node)
  Note Reader (read-mode, clickable links, backlinks panel)
  Vault Browser (replaces NotesGrid; session-compact + full-KB modes)
  KB Screen + Routing (/kb route, KnowledgeBaseScreen)
  Command Palette (FAB → fuzzy search overlay → navigate)
  Graph View (d3-force + d3-zoom + Canvas 2D)

L4 — CROSS-CUTTING CONSTRAINTS
  All DB access via singleton `db` from src/storage/db/client.ts
  Repository functions exported at module level (not classes)
  IDs via generateId() (src/utils/ids.ts)
  Timestamps via nowISO() (src/utils/dates.ts)
  Zod validation on DB READ, not write
  Context: createContext(null) + consumer throws if null
  No settings.debugMode → gate debug logs behind import.meta.env.DEV
  Tiptap: align all @tiptap/* packages to ^2.27.2 before wikilink work
```

---

## Verified File Inventory

All paths below have been confirmed via Glob/Grep before inclusion.

| Artifact | Verified Path | Status |
|---|---|---|
| DB client | `src/storage/db/client.ts` | ✅ exists, v6 latest |
| Note repository | `src/storage/repositories/noteRepository.ts` | ✅ exports: `getNoteById`, `getNotesByCampaign`, `getNotesBySession`, `createNote`, `updateNote`, `deleteNote` |
| Reference note repo | `src/storage/repositories/referenceNoteRepository.ts` | ✅ exports: `getAll`, `save`, `remove` |
| Note type | `src/types/note.ts` → `baseNoteSchema` | ✅ confirmed; **no `scope` field** → must add in SS-01 |
| AppSettings type | `src/types/settings.ts` → `AppSettings` | ✅ confirmed; **no `debugMode` field** → use `import.meta.env.DEV` |
| Descriptor extension | `src/features/notes/descriptorMentionExtension.ts` | ✅ Mention.extend() + PluginKey pattern |
| renderNoteToMarkdown | `src/utils/export/renderNote.ts` | ✅ confirmed signature |
| NotesGrid | `src/features/notes/NotesGrid.tsx` | ✅ props: `campaignId`, `activeSessionId` |
| AppStateContext | `src/context/AppStateContext.tsx` | ✅ createContext(null) + throws hook pattern |
| CampaignContext | `src/features/campaign/CampaignContext.tsx` | ✅ context pattern to follow |
| generateId | `src/utils/ids.ts` | ✅ `export function generateId()` |
| nowISO | `src/utils/dates.ts` | ✅ `export function nowISO()` |
| Routes | `src/routes/index.tsx` | ✅ add `/kb` and `/kb/:nodeId` here |
| BottomNav | `src/components/shell/BottomNav.tsx` | ✅ 3 tabs; KB uses separate FAB/nav |
| Screens dir | `src/screens/` | ✅ add `KnowledgeBaseScreen.tsx` here |
| Features dir | `src/features/` | ✅ add `src/features/kb/` subtree |
| Primitives | `src/components/primitives/` | ✅ Card, Button, Drawer, Modal, Chip, SectionPanel |

---

## Sub-Specifications

### SS-01 · Graph Store Schema + Dexie v7 + scope field
**Phase:** 1 — Foundation
**Priority score:** 10/10 (everything else depends on this)
**Risk:** Medium — touches `baseNoteSchema` which has 7 call sites; contains referenceNote migration

#### Intent
Add `kb_nodes` and `kb_edges` tables to the Dexie schema (version 7). Add a `scope` field to the notes index so shared notes can be queried. Migrate existing `referenceNotes` rows into the `notes` table with `scope: 'shared'` and `type: 'reference'` inside the version 7 upgrade block. Add `scope` to `baseNoteSchema` in `src/types/note.ts`.

#### Files to Create
*(none — this sub-spec only modifies existing files)*

#### Files to Modify
| File | Change |
|---|---|
| `src/storage/db/client.ts` | Add `version(7)` block; declare `kb_nodes`, `kb_edges` tables with indexes; extend `notes` index with `scope`; migrate referenceNotes; add `KBNode` and `KBEdge` interface types |
| `src/types/note.ts` | Add `scope: z.enum(['campaign', 'shared']).optional().default('campaign')` to `baseNoteSchema` |

#### Acceptance Criteria
1. `npm run build` succeeds with zero TypeScript errors after this change.
2. On first app load after upgrade, Dexie auto-migrates to version 7 without error.
3. `db.kb_nodes` and `db.kb_edges` are accessible as typed `Table<>` properties on `SkaldbokDatabase`.
4. The `notes` table index string includes `scope` (verify in client.ts version 7 stores declaration).
5. Every existing `ReferenceNote` row in `referenceNotes` is copied to `notes` with `scope: 'shared'` and `type: 'reference'` during the upgrade. Guard runs only once (metadata key `migration_v7_ref_notes`).
6. `baseNoteSchema` parses an object with `scope: 'shared'` without error. Omitting `scope` parses successfully (defaults to `'campaign'`).
7. `getNotesByCampaign` in `noteRepository.ts` continues to work unmodified (scope field is optional/backward-compatible).
8. Existing Dexie version 1–6 blocks are NOT modified.

#### Dependencies
None — this is the foundation block.

#### Notes / Assumptions
- `KBNode` and `KBEdge` TypeScript interfaces should be co-located in `src/storage/db/client.ts` alongside `ReferenceNote` (or extracted to `src/types/kb.ts`). Either is acceptable.
- The version 7 `.stores()` call must re-declare ALL existing tables whose index strings change (only `notes` changes). Other tables can be omitted.
- ASM-13: Dexie cannot do `WHERE campaignId=X OR scope='shared'` in one query — two queries merged client-side is acceptable. Implement in repository layer, not in Dexie index.
- ASM-3: `AppSettings.debugMode` does not exist. All debug logging in this feature must be gated behind `import.meta.env.DEV`.

---

### SS-02 · KB Repositories (kbNodeRepository + kbEdgeRepository)
**Phase:** 1 — Foundation
**Priority score:** 9/10
**Risk:** Low — follows established noteRepository.ts pattern exactly

#### Intent
Create two new repository modules following the `noteRepository.ts` module pattern. Both use the singleton `db` from `src/storage/db/client.ts`, export async functions (not classes), and validate on read via Zod.

#### Files to Create
| File | Exports |
|---|---|
| `src/storage/repositories/kbNodeRepository.ts` | `getNodeById`, `getNodesByType`, `getNodesByCampaign`, `getNodeByLabel`, `upsertNode`, `deleteNode`, `deleteNodesBySource` |
| `src/storage/repositories/kbEdgeRepository.ts` | `getEdgesFromNode`, `getEdgesToNode`, `getEdgesByCampaign`, `upsertEdge`, `deleteEdge`, `deleteEdgesFromNode`, `deleteEdgesToNode` |

#### Files to Modify
*(none)*

#### Acceptance Criteria
1. `npm run build` succeeds with zero TypeScript errors.
2. `getNodeByLabel(label, campaignId)` performs a case-insensitive lookup using Dexie's `equalsIgnoreCase()` (or `.where('label').equalsIgnoreCase(label)`). Must resolve in < 50ms for a 500-node dataset (single indexed lookup, not a table scan).
3. `getNodesByCampaign(campaignId)` returns campaign-scoped nodes. A separate `getSharedNodes()` function returns nodes where `scope === 'shared'`. Callers merge the two results client-side (per ASM-13).
4. `upsertNode(node)` uses `db.kb_nodes.put(node)` — idempotent, safe to call repeatedly.
5. `deleteEdgesFromNode(nodeId)` removes all edges where `fromId === nodeId` (for node delete cascades).
6. `deleteEdgesToNode(nodeId)` removes all edges where `toId === nodeId`.
7. All functions are exported at module level (not as class methods).
8. Each function throws a descriptive `Error` (not a silent failure) if Dexie throws.

#### Dependencies
- SS-01 (Dexie schema must define `kb_nodes` and `kb_edges` tables before repositories can use them)

---

### SS-03 · Link Sync Engine
**Phase:** 1 — Foundation
**Priority score:** 9/10
**Risk:** Medium — Tiptap JSON structure must be parsed correctly; partial failures must not corrupt note data

#### Intent
Create `src/features/kb/linkSyncEngine.ts` as a module of exported async functions. The engine parses Tiptap JSON from note bodies, extracts `[[wikilinks]]`, `@mentions`, and `#descriptor` references, diffs against existing edges, and updates `kb_nodes` / `kb_edges` in IndexedDB. It also handles bulk migration (populate entire graph from scratch) and character node sync.

The engine runs AFTER the note save completes. If the sync fails, the note data is safe. The engine is idempotent — re-running produces identical results.

#### Files to Create
| File | Exports |
|---|---|
| `src/features/kb/linkSyncEngine.ts` | `syncNote(noteId)`, `deleteNoteNode(noteId)`, `syncCharacter(characterId)`, `bulkRebuildGraph(campaignId)` |
| `src/features/kb/tiptapParser.ts` | `extractLinksFromTiptapJSON(json): ExtractedLinks` — recursive tree walker returning `{ wikilinks: string[], mentions: string[], descriptors: string[] }` |

#### Files to Modify
| File | Change |
|---|---|
| `src/storage/repositories/noteRepository.ts` | After `updateNote()` writes successfully, call `linkSyncEngine.syncNote(id)` in a fire-and-forget pattern (no await, no throw propagation to caller) |
| `src/storage/repositories/noteRepository.ts` | After `createNote()` writes successfully, call `linkSyncEngine.syncNote(note.id)` fire-and-forget |
| `src/storage/repositories/noteRepository.ts` | After `deleteNote()` writes successfully, call `linkSyncEngine.deleteNoteNode(id)` fire-and-forget |

#### Acceptance Criteria
1. `npm run build` succeeds with zero TypeScript errors.
2. `extractLinksFromTiptapJSON` correctly extracts:
   - Wikilink atom nodes (`{ type: 'wikiLink', attrs: { id, label } }`) into `wikilinks` array
   - Mention atom nodes (`{ type: 'mention', attrs: { id, label } }`) into `mentions` array
   - DescriptorMention nodes (`{ type: 'descriptorMention', attrs: { id, label } }`) into `descriptors` array
   - Recursively walks `content` arrays at any depth
3. `syncNote(noteId)` creates a `kb_nodes` entry for the note (type `'note'`, label = note title).
4. For each wikilink in the note body, `syncNote` resolves the target via `getNodeByLabel` and either:
   - Creates a `kb_edges` entry to the resolved node
   - Or creates an `'unresolved'` placeholder `kb_node` if no match exists
5. On re-sync, stale edges (links removed from note body) are deleted. No orphan edges remain.
6. `deleteNoteNode(noteId)` removes the node and all edges where `fromId === noteId` or `toId === noteId`.
7. `bulkRebuildGraph(campaignId)` reads all active notes for the campaign, calls `syncNote` for each, then writes metadata key `migration_kb_graph_v1` on completion.
8. If `syncNote` throws internally, it catches the error, logs `console.warn` with the note ID and error, and does NOT propagate (note save is unaffected).
9. Unknown Tiptap node types encountered during parsing are skipped with a `console.warn` (not thrown).
10. In `import.meta.env.DEV` mode, logs edges added/removed per sync and sync duration in ms via `console.debug`.
11. A note saved in the editor (autosave) results in `kb_nodes` and `kb_edges` being populated in IndexedDB (verifiable via DevTools > Application > IndexedDB).

#### Dependencies
- SS-01, SS-02

---

### SS-04 · Knowledge Base Context + Hooks
**Phase:** 1 — Foundation
**Priority score:** 8/10
**Risk:** Low — pure React context over confirmed Dexie queries

#### Intent
Create `src/features/kb/KnowledgeBaseContext.tsx` following the `CampaignContext.tsx` pattern (`createContext(null)` + consumer hook that throws if null). The context provides all graph query hooks to the component tree below `KnowledgeBaseProvider`.

Install `minisearch` as a dependency if not already present (check `package.json`). Create `src/features/kb/useKBSearch.ts` as the unified MiniSearch index.

#### Files to Create
| File | Exports |
|---|---|
| `src/features/kb/KnowledgeBaseContext.tsx` | `KnowledgeBaseProvider`, `useKnowledgeBase` (throws if null), `KnowledgeBaseContextValue` |
| `src/features/kb/useKBSearch.ts` | `useKBSearch(query: string): KBNode[]` — MiniSearch over all nodes |

#### Key Hooks (implemented inside KnowledgeBaseContext)
| Hook | Description |
|---|---|
| `useBacklinks(nodeId)` | All `kb_edges` where `toId === nodeId` |
| `useForwardLinks(nodeId)` | All `kb_edges` where `fromId === nodeId` |
| `useGraphNeighbors(nodeId, depth?)` | BFS traversal; default depth=1 |
| `useNodesByType(campaignId, type)` | All nodes of a given type for campaign |
| `useResolveWikilink(label)` | `getNodeByLabel` — single indexed Dexie lookup |

#### Files to Modify
*(none — context wraps children via provider)*

#### Acceptance Criteria
1. `npm run build` succeeds with zero TypeScript errors.
2. `useKnowledgeBase()` called outside a `<KnowledgeBaseProvider>` throws `Error: useKnowledgeBase must be used within KnowledgeBaseProvider`.
3. `useBacklinks('note-id-with-links')` returns an array of `KBEdge` objects where `toId === 'note-id-with-links'`.
4. `useResolveWikilink('Bjorn the Bold')` performs a single Dexie `equalsIgnoreCase` lookup (not a full table scan) and returns the matching node or `undefined`.
5. `useKBSearch('bjorn')` returns fuzzy-matched nodes from MiniSearch (case-insensitive, partial-match).
6. MiniSearch index is rebuilt asynchronously on provider mount using `addAllAsync` with `chunkSize: 200` (non-blocking).
7. `useGraphNeighbors(nodeId, depth=2)` returns nodes reachable within 2 hops (BFS across `kb_edges`). Completes in < 50ms for a 500-node / 2500-edge dataset.

#### Dependencies
- SS-01, SS-02, SS-03

---

### SS-05 · Wikilink Tiptap Extension
**Phase:** 2 — Wikilinks + Reading
**Priority score:** 8/10
**Risk:** Medium — ASM-6 (Tiptap version mismatch must be resolved first); ASM-4 (InputRule for atom nodes needs validation)

#### Pre-condition
Before implementing this sub-spec, align all `@tiptap/*` packages to `^2.27.2` in `package.json` and run `npm install`. Verify `@tiptap/suggestion` is listed as an explicit dependency (currently transitive only).

#### Intent
Create a Tiptap `Node.create()` extension for `[[double bracket]]` wikilinks, following the pattern in `src/features/notes/descriptorMentionExtension.ts`. The extension uses `@tiptap/suggestion` with `char: '[['`, renders as an inline atom chip via `ReactNodeViewRenderer`, and includes an `InputRule` for typed `[[Page Name]]` without autocomplete.

#### Files to Create
| File | Exports |
|---|---|
| `src/features/notes/wikilinkExtension.ts` | `WikiLinkPluginKey`, `WikiLink` (the Tiptap Node extension) |
| `src/features/notes/WikiLinkComponent.tsx` | `WikiLinkComponent` — React node view renderer for the inline chip |
| `src/features/notes/WikiLinkList.tsx` | `WikiLinkList` — autocomplete dropdown for suggestion results |

#### Files to Modify
| File | Change |
|---|---|
| `package.json` | Align all `@tiptap/*` to `^2.27.2`; add `@tiptap/suggestion` as explicit dependency |
| `src/utils/export/renderNote.ts` | Handle `wikiLink` node type in `renderNoteToMarkdown` — render as `[[label]]` in Obsidian markdown output |

#### Extension Spec
```
name: 'wikiLink'
group: 'inline'
inline: true
atom: true
priority: 101
attrs: { id: string, label: string }
HTMLAttributes: { 'data-id': id, 'data-label': label, class: 'wiki-link' }
suggestion:
  char: '[['
  allowSpaces: true
  pluginKey: WikiLinkPluginKey
InputRule: /\[\[([^\]]+)\]\]$/ → convert to wikiLink node with label = capture group 1
PasteRule: same regex, same conversion
Unresolved: if node.id === 'unresolved', apply 'wiki-link--unresolved' CSS class (dimmed/red)
```

#### Acceptance Criteria
1. `npm run build` succeeds with zero TypeScript errors (all @tiptap/* aligned to ^2.27.2).
2. Typing `[[` in `TiptapNoteEditor` triggers the wikilink autocomplete dropdown with existing note titles as suggestions.
3. Selecting a suggestion inserts an inline wikilink chip showing the note title.
4. Typing `[[Page Name]]` (complete with closing brackets, no autocomplete) converts to a wikilink node via InputRule.
5. Pasting `[[Page Name]]` converts to a wikilink node via PasteRule.
6. A wikilink to a non-existent note renders with a distinct "unresolved" visual style (dimmed or red).
7. `renderNoteToMarkdown` converts a note containing wikiLink nodes to `[[label]]` Obsidian-compatible markdown without errors.
8. The `@tiptap/suggestion` package appears as an explicit (not transitive) entry in `package.json`.
9. `WikiLinkPluginKey` uses a distinct `PluginKey` name (`'wikiLink'`) separate from `DescriptorMentionPluginKey` (`'descriptorMention'`) and the `@mention` plugin key.
10. Existing `@mention` and `#descriptor` functionality is unaffected.

#### Dependencies
- SS-01, SS-02, SS-03 (link sync must handle `wikiLink` node type from Tiptap JSON)

---

### SS-06 · Note Reader
**Phase:** 2 — Wikilinks + Reading
**Priority score:** 8/10
**Risk:** Low — read-only Tiptap render with routing hooks

#### Intent
Create `src/features/kb/NoteReader.tsx` as a component (not a screen — embedded within the KB screen). Renders Tiptap content read-only with tappable wikilinks, @mentions, and #descriptors. Shows a backlinks panel and forward links summary at the bottom. Provides inline peek cards on link tap and an "Edit" button to switch to `NoteEditorScreen`.

Navigation target: when a wikilink is tapped, navigate to `/kb/{nodeId}`. If the note doesn't exist yet, prompt "Create note?".

#### Files to Create
| File | Exports |
|---|---|
| `src/features/kb/NoteReader.tsx` | `NoteReader` — main read-mode component |
| `src/features/kb/BacklinksPanel.tsx` | `BacklinksPanel` — lists all nodes linking to current node |
| `src/features/kb/PeekCard.tsx` | `PeekCard` — inline preview card (title, type badge, snippet, Open button) |

#### Files to Modify
*(none — NoteReader is new; editing still uses NoteEditorScreen via navigation)*

#### NoteReader Props
```typescript
interface NoteReaderProps {
  noteId: string;
}
```

#### Acceptance Criteria
1. `npm run build` succeeds with zero TypeScript errors.
2. `NoteReader` renders the Tiptap document body of the given note in read-only mode (no cursor, no editing).
3. Wikilink nodes render as tappable styled links (not raw `[[text]]` strings).
4. Tapping a resolved wikilink navigates to `/kb/{targetNodeId}`.
5. Tapping an unresolved wikilink shows a prompt: "Note not found. Create it?" — confirming creates the note and navigates to it.
6. `BacklinksPanel` at the bottom shows all notes that link to the current note (uses `useBacklinks(noteId)` from KB context).
7. Forward links summary shows all wikilinks from this note (uses `useForwardLinks(noteId)`).
8. Tapping a link shows a `PeekCard` with: note title, type badge, first ~100 chars of text content, and an "Open" button.
9. "Edit" button navigates to `/note/{noteId}/edit` (existing `NoteEditorScreen` route).
10. Attachment gallery renders if the note has attachments (read from `attachmentRepository`).

#### Dependencies
- SS-01, SS-02, SS-04, SS-05

---

### SS-07 · Vault Browser
**Phase:** 3 — Discovery
**Priority score:** 7/10
**Risk:** Medium — replaces NotesGrid; must preserve all existing session-scoped note behaviors

#### Intent
Create `src/features/kb/VaultBrowser.tsx` as a reusable component that replaces `NotesGrid` in the Session screen and serves as the primary view on the full `/kb` screen. Accepts filter props (`sessionId`, `typeFilter`, `compact`) to work in both contexts with zero duplication.

Category tabs: People, Places, Loot, Rumors, All (maps to note types: character/npc, location, loot, generic/rumors, all).

#### Files to Create
| File | Exports |
|---|---|
| `src/features/kb/VaultBrowser.tsx` | `VaultBrowser` component |
| `src/features/kb/VaultCard.tsx` | `VaultCard` — scannable card: title, type badge, metadata snippet, tag chips, link count |

#### VaultBrowser Props
```typescript
interface VaultBrowserProps {
  campaignId: string;
  sessionId?: string;     // if set, filter to session; compact mode implied
  typeFilter?: string;    // pre-filter by node type
  compact?: boolean;      // hides category sidebar, shows "Open full KB" link
}
```

#### Files to Modify
| File | Change |
|---|---|
| `src/screens/SessionScreen.tsx` | Replace `<NotesGrid campaignId={...} activeSessionId={...} />` with `<VaultBrowser campaignId={...} sessionId={activeSession?.id} compact />` |

#### Acceptance Criteria
1. `npm run build` succeeds with zero TypeScript errors.
2. In compact mode (`compact={true}` + `sessionId` set), `VaultBrowser` shows only notes from the given session, hides the category sidebar, and displays a "Open Knowledge Base" link.
3. In full mode (`/kb`, no sessionId), `VaultBrowser` shows category tabs and all campaign notes.
4. `VaultCard` displays: note title, type badge, tag chips, and link count (from `kb_edges` where `fromId === node.id`).
5. Unified search via `useKBSearch` updates the card list in real-time (debounced 200ms).
6. Card list virtualizes at 50 items (infinite scroll or windowing) — no performance regression on 500-note campaigns.
7. Tapping a card navigates to `/kb/{nodeId}`.
8. Tag filter chips filter the displayed cards by tag.
9. The Session screen renders correctly with `VaultBrowser` replacing `NotesGrid`. Existing note creation flow (FAB → NoteEditorScreen) is unaffected.
10. `NotesGrid` is NOT deleted in this sub-spec — it is replaced by reference in SessionScreen only. The component file remains for rollback safety until VaultBrowser is confirmed stable (human decision to delete).

#### Dependencies
- SS-01, SS-02, SS-03, SS-04

---

### SS-08 · KB Screen + Routing
**Phase:** 3 — Discovery
**Priority score:** 7/10
**Risk:** Low — new screen + two new routes added to confirmed routing pattern

#### Intent
Create `src/screens/KnowledgeBaseScreen.tsx` as the root screen for the knowledge base at `/kb`. Add routes `/kb` and `/kb/:nodeId` to `src/routes/index.tsx`. The screen wraps children in `<KnowledgeBaseProvider>` and renders either the `VaultBrowser` (list view at `/kb`) or `NoteReader` (detail view at `/kb/:nodeId`) based on the route.

#### Files to Create
| File | Exports |
|---|---|
| `src/screens/KnowledgeBaseScreen.tsx` | `KnowledgeBaseScreen` (default export) |

#### Files to Modify
| File | Change |
|---|---|
| `src/routes/index.tsx` | Add `{ path: '/kb', element: <KnowledgeBaseScreen /> }` and `{ path: '/kb/:nodeId', element: <KnowledgeBaseScreen /> }` as children of the ShellLayout route, before the catch-all `'*'` |

#### Screen Behavior
- `/kb` → renders `<KnowledgeBaseProvider><VaultBrowser campaignId={...} /></KnowledgeBaseProvider>`
- `/kb/:nodeId` → renders `<KnowledgeBaseProvider><NoteReader noteId={nodeId} /></KnowledgeBaseProvider>`
- `KnowledgeBaseProvider` wraps both views so KB context is available to all sub-components
- On first load: checks for `migration_kb_graph_v1` metadata key; if absent, triggers `bulkRebuildGraph` with a loading indicator

#### Acceptance Criteria
1. `npm run build` succeeds with zero TypeScript errors.
2. Navigating to `/kb` renders the `VaultBrowser` with all campaign notes visible.
3. Navigating to `/kb/{noteId}` renders the `NoteReader` for that note.
4. Both routes are wrapped in `ShellLayout` (bottom nav visible, campaign header visible).
5. On first KB screen visit (no `migration_kb_graph_v1` metadata), a "Building knowledge graph..." loading indicator is shown while `bulkRebuildGraph` runs. Notes are visible after rebuild completes.
6. On subsequent visits, the loading indicator is skipped.
7. The catch-all `'*'` redirect to `/character/sheet` remains and does not match `/kb`.
8. Navigating to `/kb/nonexistent-id` shows a "Note not found" empty state (not a crash).

#### Dependencies
- SS-04, SS-06, SS-07

---

### SS-09 · Command Palette
**Phase:** 3 — Discovery
**Priority score:** 6/10
**Risk:** Low — overlay component; no data model changes

#### Intent
Create a full-screen search overlay accessible from anywhere in the app. Triggered by a floating action button (FAB-style, placed in `ShellLayout` or at KB screen level — human decision on placement; implementation uses a portal/overlay pattern). Auto-focused search input, fuzzy search across all `kb_nodes`, tap to navigate.

**Note to implementer:** FAB placement and icon are human-approved decisions. Implement the command palette as a component that can be triggered by a prop/callback from the parent; leave FAB integration as a secondary step that the human approves.

#### Files to Create
| File | Exports |
|---|---|
| `src/features/kb/CommandPalette.tsx` | `CommandPalette` — full-screen overlay component |
| `src/features/kb/useCommandPalette.ts` | `useCommandPalette()` — `{ isOpen, open, close }` state hook |

#### CommandPalette Props
```typescript
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
}
```

#### Acceptance Criteria
1. `npm run build` succeeds with zero TypeScript errors.
2. When `isOpen={true}`, the palette renders as a full-screen overlay with auto-focused search input.
3. Typing in the search input shows matching `kb_nodes` (title + type badge + last-updated) within 100ms.
4. Search handles typos and partial matches (fuzzy via MiniSearch).
5. Tapping a result navigates to `/kb/{nodeId}` and calls `onClose`.
6. Tapping the overlay background calls `onClose`.
7. Swipe-down gesture on mobile dismisses the palette (calls `onClose`).
8. Supported quick actions displayed in empty/initial state: "New note" (→ `/note/new`), "Graph view" (→ `/kb?view=graph`), "Export all".
9. The palette is rendered via a React portal to avoid z-index conflicts with ShellLayout.
10. `useCommandPalette` hook correctly initializes `isOpen: false` and toggles via `open()` / `close()`.

#### Dependencies
- SS-04, SS-08

---

### SS-10 · Graph View
**Phase:** 4 — Visualization
**Priority score:** 5/10 (can be deferred to next release)
**Risk:** Medium — d3 packages must be added; Canvas 2D + touch interactions are complex

#### Pre-condition
Add to `package.json`: `d3-force`, `d3-zoom`, `d3-selection` (runtime); `@types/d3-force`, `@types/d3-zoom`, `@types/d3-selection` (devDependencies). Human must approve this npm change before implementation.

#### Intent
Create `src/features/kb/GraphView.tsx` using d3-force (layout), d3-zoom (touch/camera), and Canvas 2D (rendering). No react-force-graph, no sigma.js, no cytoscape.js. The view is accessible from the KB screen via `?view=graph` query param or from a "Graph" button.

#### Files to Create
| File | Exports |
|---|---|
| `src/features/kb/GraphView.tsx` | `GraphView` component |
| `src/features/kb/graphRenderer.ts` | `renderGraph(canvas, nodes, edges, transform)` — pure Canvas 2D render function |

#### GraphView Props
```typescript
interface GraphViewProps {
  campaignId: string;
  centeredNodeId?: string; // if set, centers and highlights this node on mount
}
```

#### Acceptance Criteria
1. `npm run build` succeeds with zero TypeScript errors after adding d3 packages.
2. `GraphView` renders a Canvas element that fills its container.
3. Nodes are rendered as colored circles, color-coded by `kb_node.type` (note=blue, character=green, location=brown, item=gold, tag=gray, unresolved=red).
4. Edges are rendered as lines between nodes.
5. Tag nodes are hidden by default; a "Show tags" toggle reveals them.
6. d3-zoom handles: pinch-to-zoom, one-finger pan, mouse wheel zoom. No custom touch handling needed.
7. Tapping a node (via `pointerup` + inverse transform to graph coords) navigates to `/kb/{nodeId}`.
8. When `centeredNodeId` is provided, the graph opens centered on that node with depth-1 neighbors visible.
9. For > 200 nodes, default filter to nodes with ≥ 2 connections; a "Show all nodes" toggle reveals leaf nodes.
10. Filter panel allows toggling node types on/off (re-filter data arrays, restart d3 simulation).
11. Force simulation uses: `forceLink` (edges), `forceManyBody` (repulsion), `forceCenter` (canvas midpoint).
12. Opening graph from a specific note (e.g., from NoteReader's "Graph" button) shows that note centered with its neighbors visible.

#### Dependencies
- SS-01, SS-02, SS-04, SS-08

---

## Delivery Order

Build sub-specs strictly in this sequence. Each phase is independently testable before proceeding:

```
Phase 1 (Foundation):
  SS-01 → SS-02 → SS-03 → SS-04
  Checkpoint: create a note with [[wikilinks]] → verify kb_nodes/kb_edges in DevTools IndexedDB

Phase 2 (Wikilinks + Reading):
  SS-05 → SS-06
  Checkpoint: tap [[link]] in Note Reader → navigate to target note

Phase 3 (Discovery):
  SS-07 → SS-08 → SS-09
  Checkpoint: search NPC by partial name in Command Palette → navigate in < 2 taps

Phase 4 (Visualization):
  SS-10
  Checkpoint: open graph from note with 3+ links → see note centered with neighbors
```

---

## Escalation Triggers

Stop and request human review if:
- Any `@tiptap/*` version alignment causes peer-dep conflicts that can't be resolved without removing existing extensions
- `baseNoteSchema` scope field causes TypeScript errors in more than the expected 7 call sites
- `bulkRebuildGraph` on a real campaign dataset takes > 5 seconds (reconsider lazy-per-note strategy)
- `renderNoteToMarkdown` changes affect existing export tests or integration behavior
- Any new npm dependency beyond `d3-force`, `d3-zoom`, `d3-selection`, `@tiptap/suggestion`, and `minisearch` is needed
- Scope changes (removing Graph View from this release, adding new entity types, etc.)

---

## Risk Register

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| ASM-3 | `settings.debugMode` doesn't exist | Low | Use `import.meta.env.DEV` — confirmed in SS-03 |
| ASM-6 | Tiptap version mismatch (3 pkgs at 2.11.7, 23 at 2.27.2) | Medium | Align all to ^2.27.2 in SS-05 pre-condition |
| ASM-7 | `baseNoteSchema` scope ripple | Medium | SS-01 adds optional field with default; backward-compat |
| ASM-13 | Dexie OR query limitation | Medium | Two-query merge in SS-02 repositories |
| ASM-9 | NotesGrid → VaultBrowser feature parity | Medium | Keep NotesGrid file; replace by reference in SessionScreen only |
| ASM-4 | InputRule creating atom nodes | Medium | Validate in SS-05 proof-of-concept before full impl |
| SCALE | Graph View 500+ nodes on tablet | Medium | Default depth=1, 2+ connection filter in SS-10 |
| SYNC | Link Sync Engine falls out of sync | Medium | `updatedAt` staleness check + "Rebuild Graph" in Settings |

---

## Acceptance Criteria Summary (All Sub-Specs)

| SS | Title | Criteria Count | Key Signal |
|---|---|---|---|
| SS-01 | Graph Store + Schema | 8 | Dexie v7 migrates; baseNoteSchema accepts scope |
| SS-02 | KB Repositories | 8 | getNodeByLabel < 50ms; upsertNode idempotent |
| SS-03 | Link Sync Engine | 11 | Note save → edges in IndexedDB; sync is fire-and-forget |
| SS-04 | KB Context + Hooks | 7 | useResolveWikilink < 50ms; MiniSearch non-blocking |
| SS-05 | Wikilink Extension | 10 | [[ triggers autocomplete; renderNote exports [[label]] |
| SS-06 | Note Reader | 10 | Tap link → navigate; backlinks panel populated |
| SS-07 | Vault Browser | 10 | Replaces NotesGrid in Session; compact + full modes |
| SS-08 | KB Screen + Routing | 8 | /kb and /kb/:nodeId routes work within ShellLayout |
| SS-09 | Command Palette | 10 | Search → navigate in < 2 taps; portal rendering |
| SS-10 | Graph View | 12 | d3 touch works; node coloring; centered-node mode |
| **Total** | | **94** | |

---

## Scoring

| Sub-Spec | Priority | Complexity | Risk | Phase | Score |
|---|---|---|---|---|---|
| SS-01 · Graph Store + Schema | 10 | Medium | Medium | 1 | **10** |
| SS-02 · KB Repositories | 9 | Low | Low | 1 | **9** |
| SS-03 · Link Sync Engine | 9 | High | Medium | 1 | **9** |
| SS-04 · KB Context + Hooks | 8 | Medium | Low | 1 | **8** |
| SS-05 · Wikilink Extension | 8 | High | Medium | 2 | **8** |
| SS-06 · Note Reader | 8 | Medium | Low | 2 | **8** |
| SS-07 · Vault Browser | 7 | Medium | Medium | 3 | **7** |
| SS-08 · KB Screen + Routing | 7 | Low | Low | 3 | **7** |
| SS-09 · Command Palette | 6 | Medium | Low | 3 | **6** |
| SS-10 · Graph View | 5 | High | Medium | 4 | **5** |

*Score = priority × deliverability; higher = build first*
