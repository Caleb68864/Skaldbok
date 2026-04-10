# Phase Spec — SS-08 · KB Screen + Routing

**Run:** `2026-04-07T00-01-30-design-doc`
**Sub-spec:** SS-08
**Phase:** 3 — Discovery
**Priority:** 7/10

---

## Dependency Order

> ⚠️ **Depends on SS-04, SS-06, and SS-07 being completed first.**
> `KnowledgeBaseProvider` (SS-04), `NoteReader` (SS-06), and `VaultBrowser` (SS-07) must all exist before this screen can compose them.

---

## Intent

Create `src/screens/KnowledgeBaseScreen.tsx` as the root screen for the knowledge base at `/kb`. Add routes `/kb` and `/kb/:nodeId` to `src/routes/index.tsx`. The screen wraps children in `<KnowledgeBaseProvider>` and renders either the `VaultBrowser` (list view at `/kb`) or `NoteReader` (detail view at `/kb/:nodeId`) based on the route.

---

## Files to Create

| File | Exports |
|---|---|
| `src/screens/KnowledgeBaseScreen.tsx` | `KnowledgeBaseScreen` (default export) |

## Files to Modify

| File | Change |
|---|---|
| `src/routes/index.tsx` | Add `/kb` and `/kb/:nodeId` routes inside ShellLayout, before the catch-all `'*'` |

---

## Implementation Steps

### Step 1 — Read `src/routes/index.tsx`

Before modifying, read the current routes file to understand the existing routing structure (ShellLayout parent, existing route children, the catch-all `'*'` redirect).

### Step 2 — Create `src/screens/KnowledgeBaseScreen.tsx`

```typescript
import { useParams, useSearchParams } from 'react-router-dom';
import { KnowledgeBaseProvider } from '../features/kb/KnowledgeBaseContext';
import { VaultBrowser } from '../features/kb/VaultBrowser';
import { NoteReader } from '../features/kb/NoteReader';
import { bulkRebuildGraph } from '../features/kb/linkSyncEngine';
import { db } from '../storage/db/client';
import { useCampaignContext } from '../features/campaign/CampaignContext';

export default function KnowledgeBaseScreen() {
  const { nodeId } = useParams<{ nodeId?: string }>();
  const { activeCampaign: campaign } = useCampaignContext();
  const [isBuilding, setIsBuilding] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // On mount: check for migration_kb_graph_v1 metadata key
  // If absent: run bulkRebuildGraph with loading indicator
  useEffect(() => {
    async function checkAndRebuild() {
      if (!campaign?.id) return;
      const meta = await db.table('metadata').where('key').equals('migration_kb_graph_v1').first().catch(() => null);
      if (!meta) {
        setIsBuilding(true);
        await bulkRebuildGraph(campaign.id).catch(err => {
          if (import.meta.env.DEV) console.warn('[KBScreen] bulkRebuildGraph failed', err);
        });
        setIsBuilding(false);
      }
      setIsReady(true);
    }
    checkAndRebuild();
  }, [campaign?.id]);

  if (!campaign) {
    return <div>No active campaign.</div>;
  }

  return (
    <KnowledgeBaseProvider campaignId={campaign.id}>
      {isBuilding && (
        <div className="/* loading indicator */">Building knowledge graph...</div>
      )}
      {!isBuilding && isReady && (
        nodeId
          ? <NoteReader noteId={nodeId} />
          : <VaultBrowser campaignId={campaign.id} />
      )}
      {!isBuilding && !isReady && null /* brief flicker before ready */}
    </KnowledgeBaseProvider>
  );
}
```

#### Empty State for Not-Found Node

In `NoteReader` (SS-06), if the note is not found, it renders "Note not found" — this satisfies AC-8. Confirm that behavior is handled in SS-06 and does not crash here.

### Step 3 — Modify `src/routes/index.tsx`

Read the current file, then add two new routes as children of the `ShellLayout` route, **before the catch-all `'*'`**:

```typescript
import KnowledgeBaseScreen from '../screens/KnowledgeBaseScreen';

// Inside the ShellLayout children array, before the '*' catch-all:
{ path: '/kb', element: <KnowledgeBaseScreen /> },
{ path: '/kb/:nodeId', element: <KnowledgeBaseScreen /> },
```

Ensure:
- Both routes are children of the ShellLayout route (bottom nav and campaign header remain visible).
- The catch-all `'*'` redirect to `/character/sheet` (or wherever it currently points) remains AFTER the new routes and is NOT modified.

---

## Acceptance Criteria

1. `npm run build` succeeds with zero TypeScript errors.
2. Navigating to `/kb` renders the `VaultBrowser` with all campaign notes visible.
3. Navigating to `/kb/{noteId}` renders the `NoteReader` for that note.
4. Both routes are wrapped in `ShellLayout` (bottom nav visible, campaign header visible).
5. On first KB screen visit (no `migration_kb_graph_v1` metadata), a "Building knowledge graph..." loading indicator is shown while `bulkRebuildGraph` runs. Notes are visible after rebuild completes.
6. On subsequent visits, the loading indicator is skipped.
7. The catch-all `'*'` redirect remains and does not match `/kb`.
8. Navigating to `/kb/nonexistent-id` shows a "Note not found" empty state (not a crash).

---

## Verification Commands

```bash
# TypeScript build check
npm run build

# (Manual) Test in browser:
# 1. Navigate to /kb — confirm VaultBrowser renders
# 2. Navigate to /kb/{existingNoteId} — confirm NoteReader renders
# 3. Confirm: bottom nav is visible at both routes
# 4. Navigate to /kb/{nonexistentId} — confirm "Note not found" message (no crash)
# 5. Clear IndexedDB, reload, navigate to /kb — confirm "Building knowledge graph..." appears
# 6. After rebuild completes, navigate to /kb again — confirm loading indicator is skipped
# 7. Confirm catch-all still redirects unknown routes to /character/sheet (or existing target)
```

---

## Constraints / Notes

- `KnowledgeBaseProvider` must wrap both `VaultBrowser` and `NoteReader` so all KB context hooks are available.
- The `useActiveCampaign()` hook (or equivalent) pattern should match what's already used in other screens — read `src/screens/` for examples before implementing.
- The `metadata` table is accessed via `db.table('metadata')` — verify this table exists in the current Dexie schema before using it. If the table is not named `metadata`, check `client.ts` for the correct name.
- Do not add KB to the bottom nav (`src/components/shell/BottomNav.tsx`) — KB uses a separate FAB/nav (per spec). Only add routes; do not modify BottomNav.
- Correctness over speed. No shell commands. Cross-platform.
