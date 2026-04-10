# Phase Spec — SS-07 · Vault Browser

**Run:** `2026-04-07T00-01-30-design-doc`
**Sub-spec:** SS-07
**Phase:** 3 — Discovery
**Priority:** 7/10

---

## Dependency Order

> ⚠️ **Depends on SS-01, SS-02, SS-03, and SS-04 being completed first.**
> The KB repositories (SS-02) provide node data. The KB context (SS-04) provides search hooks. SS-03 ensures data is populated when notes are saved.

---

## Intent

Create `src/features/kb/VaultBrowser.tsx` as a reusable component that replaces `NotesGrid` in the Session screen and serves as the primary view on the full `/kb` screen. Accepts filter props (`sessionId`, `typeFilter`, `compact`) to work in both contexts with zero duplication.

Category tabs: People, Places, Loot, Rumors, All (maps to note types: character/npc, location, loot, generic/rumors, all).

---

## Files to Create

| File | Exports |
|---|---|
| `src/features/kb/VaultBrowser.tsx` | `VaultBrowser` component |
| `src/features/kb/VaultCard.tsx` | `VaultCard` — scannable card: title, type badge, metadata snippet, tag chips, link count |

## Files to Modify

| File | Change |
|---|---|
| `src/screens/SessionScreen.tsx` | Replace `<NotesGrid campaignId={...} activeSessionId={...} />` with `<VaultBrowser campaignId={...} sessionId={activeSession?.id} compact />` |

> **IMPORTANT:** Do NOT delete `NotesGrid.tsx`. Keep the file for rollback safety. Only replace its usage in `SessionScreen.tsx`.

---

## Implementation Steps

### Step 1 — Define Props Interface

```typescript
interface VaultBrowserProps {
  campaignId: string;
  sessionId?: string;     // if set, filter to session-scoped notes; compact mode implied
  typeFilter?: string;    // pre-filter by node type ('note' | 'character' | 'location' | etc.)
  compact?: boolean;      // hides category sidebar, shows "Open Knowledge Base" link
}
```

### Step 2 — Create `src/features/kb/VaultCard.tsx`

```typescript
interface VaultCardProps {
  node: KBNode;
  linkCount: number;      // from kb_edges where fromId === node.id
  onClick: () => void;
}

export function VaultCard({ node, linkCount, onClick }: VaultCardProps) {
  // Render using existing Card primitive from src/components/primitives/
  // Display:
  //   - Title: node.label
  //   - Type badge: node.type (use a colored Chip component)
  //   - Tag chips: if node has associated tags (from kb_edges of type 'descriptor')
  //   - Link count: "{linkCount} links"
  //   - Metadata snippet: node.updatedAt formatted as relative time
  // On tap: calls onClick()
}
```

Use existing `Card`, `Chip` primitives from `src/components/primitives/`. Do NOT introduce custom styled elements.

### Step 3 — Create `src/features/kb/VaultBrowser.tsx`

```typescript
export function VaultBrowser({ campaignId, sessionId, typeFilter, compact }: VaultBrowserProps) {
  // STATE:
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200); // use a debounce hook
  const navigate = useNavigate();

  // DATA:
  // If sessionId is set, load notes for that session via getNotesBySession(sessionId)
  // then resolve their kb_nodes. Merge campaign + shared nodes per ASM-13.
  // If no sessionId, load all nodes via getNodesByCampaign(campaignId) + getSharedNodes()

  // SEARCH:
  // Use useKBSearch(debouncedQuery, campaignId) from useKBSearch.ts
  // When query is empty, show all nodes (filtered by activeTab/typeFilter)
  // When query is non-empty, show search results

  // CATEGORY TABS (full mode only):
  // People → type: 'character'
  // Places → type: 'location'
  // Loot → type: 'item'
  // Rumors → type: 'note' (or a 'rumors' subtype if it exists)
  // All → no type filter

  // VIRTUALIZATION:
  // For > 50 items, implement infinite scroll or windowing
  // Use a simple slice-based approach: render 50 at a time, load more on scroll

  // LINK COUNTS:
  // For each displayed node, fetch edge count via getEdgesFromNode(node.id)
  // Cache these counts to avoid repeated Dexie queries

  return (
    <div>
      {/* Search input */}
      <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." />

      {/* Category tabs (full mode only) */}
      {!compact && (
        <TabBar tabs={['All', 'People', 'Places', 'Loot', 'Rumors']} active={activeTab} onChange={setActiveTab} />
      )}

      {/* "Open Knowledge Base" link (compact mode only) */}
      {compact && (
        <button onClick={() => navigate('/kb')}>Open Knowledge Base →</button>
      )}

      {/* Tag filter chips */}
      {/* ... */}

      {/* Node card list */}
      {filteredNodes.map(node => (
        <VaultCard
          key={node.id}
          node={node}
          linkCount={linkCounts[node.id] ?? 0}
          onClick={() => navigate(`/kb/${node.id}`)}
        />
      ))}
    </div>
  );
}
```

### Step 4 — Modify `src/screens/SessionScreen.tsx`

1. Read the file to find the current `<NotesGrid ... />` usage.
2. Replace it with:
   ```typescript
   <VaultBrowser campaignId={campaignId} sessionId={activeSession?.id} compact />
   ```
3. Add the import for `VaultBrowser` at the top.
4. Do NOT remove the `NotesGrid` import if it's used elsewhere in the file. Only remove the import if it's only used in this one place. Leave the `NotesGrid.tsx` file itself untouched.

---

## Acceptance Criteria

1. `npm run build` succeeds with zero TypeScript errors.
2. In compact mode (`compact={true}` + `sessionId` set), `VaultBrowser` shows only notes from the given session, hides the category sidebar, and displays a "Open Knowledge Base" link.
3. In full mode (`/kb`, no sessionId), `VaultBrowser` shows category tabs and all campaign notes.
4. `VaultCard` displays: note title, type badge, tag chips, and link count (from `kb_edges` where `fromId === node.id`).
5. Unified search via `useKBSearch` updates the card list in real-time (debounced 200ms).
6. Card list virtualizes at 50 items (infinite scroll or windowing) — no performance regression on 500-note campaigns.
7. Tapping a card navigates to `/kb/{nodeId}`.
8. Tag filter chips filter the displayed cards by tag.
9. The Session screen renders correctly with `VaultBrowser` replacing `NotesGrid`. Existing note creation flow (FAB → NoteEditorScreen) is unaffected.
10. `NotesGrid` is NOT deleted — the component file remains. Only its usage in `SessionScreen.tsx` is replaced.

---

## Verification Commands

```bash
# TypeScript build check
npm run build

# (Manual) Test in browser:
# 1. Open Session screen — confirm VaultBrowser shows (compact mode)
# 2. Confirm: only session notes are visible (not all campaign notes)
# 3. Confirm: "Open Knowledge Base" link appears and navigates to /kb
# 4. Confirm: note creation FAB still works
# 5. Navigate to /kb — confirm VaultBrowser shows in full mode
# 6. Confirm: category tabs (People, Places, Loot, Rumors, All) are visible
# 7. Type in search box — confirm results update with 200ms debounce
# 8. Tap a VaultCard — confirm navigation to /kb/{nodeId}
```

---

## Constraints / Notes

- ASM-9: NotesGrid → VaultBrowser feature parity risk. Keep NotesGrid file; replace by reference in SessionScreen only.
- The existing note creation FAB in SessionScreen must remain functional — do not modify FAB behavior.
- Use existing primitives (`Card`, `Chip`, `Button`) from `src/components/primitives/`.
- `useKnowledgeBase()` hooks are available if `VaultBrowser` is rendered inside `<KnowledgeBaseProvider>`. If used in SessionScreen (outside a provider), the search functionality can degrade gracefully (fall back to simple title filter via `getNotesBySession` + in-memory filter). Prefer wrapping SessionScreen's note section in a `<KnowledgeBaseProvider>` if the dependency is acceptable; otherwise degrade gracefully.
- Correctness over speed. No shell commands. Cross-platform.
