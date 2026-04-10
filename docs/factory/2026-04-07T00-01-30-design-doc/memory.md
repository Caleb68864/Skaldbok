
<!-- MISSION: DO NOT COMPACT -->
Project: forge-factory
Run: 2026-04-07T00-01-30-design-doc
Phase: run
Objective: Implement and verify sub-specs per acceptance criteria
Constraints: Correctness over speed. No shell commands. Cross-platform.
<!-- MISSION: DO NOT COMPACT -->

## Project Conventions

- **Framework:** React 19 + TypeScript + Vite + Tailwind CSS 4 + Dexie (IndexedDB)
- **DB singleton:** `db` from `src/storage/db/client.ts`
- **Repository pattern:** Exported async functions (not classes), Zod validation on read
- **IDs:** `generateId()` from `src/utils/ids.ts`
- **Timestamps:** `nowISO()` from `src/utils/dates.ts`
- **Context pattern:** `createContext(null)` + consumer hook that throws if null (see CampaignContext.tsx)
- **Debug logging:** Gate behind `import.meta.env.DEV` (no `settings.debugMode`)
- **Existing Tiptap packages:** `@tiptap/extension-link@^2.27.2`, `@tiptap/extension-mention@^2.11.7`, `@tiptap/react@^2.11.7`, `@tiptap/starter-kit@^2.11.7`
- **MiniSearch:** Already in package.json at `^7.2.0`
- **Routing:** `react-router-dom@^7.4.1`, routes in `src/routes/index.tsx`
- **Primitives:** `src/components/primitives/` (Card, Button, Drawer, Modal, Chip, SectionPanel)
- **Current Dexie version:** 6 (versions 1-6 defined in client.ts)

## Build & Test Commands

- Build: `npm run build`
- Test: not configured
- Dev: `npm run dev`

## Stage Outputs

### Stage 3: Prep
- 10 phase specs created (SS-01 through SS-10)
- Preflight fixes applied:
  1. SS-01: Added `[campaignId+type]` compound index to `kb_nodes` table
  2. SS-10: Fixed tag filtering logic - checks `showTags` before `visibleTypes` for tag-type nodes

### Wave 1 Changes
- Files created: none
- Files modified: src/storage/db/client.ts, src/types/note.ts
- Key interfaces/exports: KBNode, KBEdge interfaces exported from client.ts; scope field added to baseNoteSchema (optional, no default to preserve backward compat at type level)

### Wave 2 Changes
- Files created: src/storage/repositories/kbNodeRepository.ts, src/storage/repositories/kbEdgeRepository.ts, src/features/kb/tiptapParser.ts, src/features/kb/linkSyncEngine.ts
- Files modified: src/storage/repositories/noteRepository.ts
- Key interfaces/exports: getNodeById, getNodesByType, getNodesByCampaign, getSharedNodes, getNodeByLabel, upsertNode, deleteNode, deleteNodesBySource (kbNodeRepository); getEdgesFromNode, getEdgesToNode, getEdgesByCampaign, upsertEdge, deleteEdge, deleteEdgesFromNode, deleteEdgesToNode (kbEdgeRepository); extractLinksFromTiptapJSON (tiptapParser); syncNote, deleteNoteNode, syncCharacter, bulkRebuildGraph (linkSyncEngine)

### Wave 3 Changes
- Files created: src/features/kb/KnowledgeBaseContext.tsx, src/features/kb/useKBSearch.ts
- Files modified: none
- Key interfaces/exports: KnowledgeBaseProvider, useKnowledgeBase, KnowledgeBaseContextValue, useBacklinks, useForwardLinks, useGraphNeighbors (KnowledgeBaseContext); useKBSearch (useKBSearch)

### Wave 4 Changes
- Files created: src/features/notes/wikilinkExtension.ts, src/features/notes/WikiLinkComponent.tsx, src/features/notes/WikiLinkList.tsx, src/features/kb/VaultBrowser.tsx, src/features/kb/VaultCard.tsx, src/screens/KnowledgeBaseScreen.tsx
- Files modified: package.json (tiptap alignment + @tiptap/suggestion), src/utils/export/resolveWikiLinks.ts (wikiLink + descriptorMention cases), src/components/notes/TiptapNoteEditor.tsx (WikiLink extension added), src/screens/SessionScreen.tsx (NotesGrid -> VaultBrowser), src/routes/index.tsx (/kb and /kb/:nodeId routes)
- Key interfaces/exports: WikiLink, WikiLinkPluginKey (wikilinkExtension); WikiLinkComponent; WikiLinkList; VaultBrowser; VaultCard; KnowledgeBaseScreen (default export)

### Wave 5 Changes
- Files created: src/features/kb/NoteReader.tsx, src/features/kb/BacklinksPanel.tsx, src/features/kb/PeekCard.tsx, src/features/kb/CommandPalette.tsx, src/features/kb/useCommandPalette.ts
- Files modified: src/screens/KnowledgeBaseScreen.tsx (NoteReader integration, graph view placeholder, useSearchParams)
- Key interfaces/exports: NoteReader, BacklinksPanel, PeekCard, CommandPalette, useCommandPalette

### Wave 6 Changes
- Files created: src/features/kb/GraphView.tsx, src/features/kb/graphRenderer.ts
- Files modified: package.json (d3-force, d3-zoom, d3-selection + types), src/screens/KnowledgeBaseScreen.tsx (GraphView integration)
- Key interfaces/exports: GraphView, renderGraph, GraphNode, GraphEdge

### Stage 4: Run
- Sub-specs executed: 10
- Results: 10 PASS, 0 PARTIAL, 0 FAIL
- Waves: 6
- Files changed:
  - Modified: src/storage/db/client.ts, src/types/note.ts, src/storage/repositories/noteRepository.ts, package.json, src/utils/export/resolveWikiLinks.ts, src/components/notes/TiptapNoteEditor.tsx, src/screens/SessionScreen.tsx, src/routes/index.tsx, src/screens/KnowledgeBaseScreen.tsx
  - Created: src/storage/repositories/kbNodeRepository.ts, src/storage/repositories/kbEdgeRepository.ts, src/features/kb/tiptapParser.ts, src/features/kb/linkSyncEngine.ts, src/features/kb/KnowledgeBaseContext.tsx, src/features/kb/useKBSearch.ts, src/features/notes/wikilinkExtension.ts, src/features/notes/WikiLinkComponent.tsx, src/features/notes/WikiLinkList.tsx, src/features/kb/VaultBrowser.tsx, src/features/kb/VaultCard.tsx, src/features/kb/NoteReader.tsx, src/features/kb/BacklinksPanel.tsx, src/features/kb/PeekCard.tsx, src/features/kb/CommandPalette.tsx, src/features/kb/useCommandPalette.ts, src/features/kb/GraphView.tsx, src/features/kb/graphRenderer.ts
- Issues: none

### Stage 5: Verify
- Artifact: verify-report.md
- Overall result: PARTIAL
- Spec compliance: PARTIAL -- 94 criteria checked, 90 passed, 4 failed
- Code quality: PARTIAL -- 10 findings (0 CRITICAL, 4 IMPORTANT)
- Integration: PARTIAL -- 5 findings (0 CRITICAL, 1 IMPORTANT)
- Key issues: Wikilink suggestion/autocomplete plugin not wired to extension (SS-05-2/3); PeekCard trigger never called (SS-06-8)

## Issues Log

