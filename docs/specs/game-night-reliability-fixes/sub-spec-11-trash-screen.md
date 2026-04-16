---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 11
title: "TrashScreen + route + read-path audit"
dependencies: [10]
phase: 3
tag: "[INTEGRATION]"
---

# Sub-Spec 11: TrashScreen + Route + Read-Path Audit `[INTEGRATION]`

## Scope

Add a dedicated surface at `/bestiary/trash` for listing and restoring soft-deleted creature templates. Close the loop on Phase 3 by auditing every `db.creatureTemplates` read path to ensure `excludeDeleted` coverage (outside migration code, which legitimately uses `tx.table`).

## Files

- `src/screens/TrashScreen.tsx` (new)
- `src/routes/index.tsx` (modified — add object-form route entry)
- Any audit fixes in existing readers (identified by the grep step below)

## Interface Contracts

### Consumes `getDeleted` (from Sub-spec 10)
- Implements contract from Sub-spec 10
- Call site: `TrashScreen` initial load + post-restore refresh

### Consumes `restore` (existing API on Sub-spec 10)
- Call site: Restore button handler

## Implementation Steps

1. **Audit existing read paths first.** Run:
   ```bash
   git grep -n "db.creatureTemplates\." src/ -- ':!src/storage/db/'
   ```
   For every hit, confirm the caller either uses `excludeDeleted` from `src/utils/softDelete.ts` or passes `includeDeleted: true` explicitly. The Phase 2 red-team flagged this already; fix any bare calls before creating the new screen.

2. **Create `TrashScreen`.** `src/screens/TrashScreen.tsx`:
   ```tsx
   import { useEffect, useState } from 'react';
   import { useNavigate } from 'react-router-dom';
   import * as creatureTemplateRepository from '../storage/repositories/creatureTemplateRepository';
   import type { CreatureTemplate } from '../types/creatureTemplate';

   export default function TrashScreen() {
     const navigate = useNavigate();
     const [loading, setLoading] = useState(true);
     const [deleted, setDeleted] = useState<CreatureTemplate[]>([]);

     async function refresh() {
       setLoading(true);
       const rows = await creatureTemplateRepository.getDeleted();
       setDeleted(rows);
       setLoading(false);
     }

     useEffect(() => {
       refresh();
     }, []);

     async function handleRestore(id: string) {
       await creatureTemplateRepository.restore(id);
       await refresh();
     }

     if (loading) {
       return <div className="p-4">Loading deleted creatures…</div>;
     }

     if (deleted.length === 0) {
       return (
         <div className="p-4">
           <button onClick={() => navigate('/bestiary')}>← Back to Bestiary</button>
           <div className="mt-6 p-6 border rounded text-center text-gray-500">
             Nothing deleted. Deleted creatures show up here with a Restore button.
           </div>
         </div>
       );
     }

     return (
       <div className="p-4">
         <div className="flex items-center justify-between mb-4">
           <button onClick={() => navigate('/bestiary')}>← Back to Bestiary</button>
           <h1 className="text-xl font-semibold">Deleted Creatures</h1>
         </div>
         <ul className="space-y-2">
           {deleted.map(c => (
             <li key={c.id} className="flex items-center justify-between p-3 border rounded">
               <div>
                 <div className="font-medium">{c.name}</div>
                 {c.deletedAt && (
                   <div className="text-xs text-gray-500">Deleted {new Date(c.deletedAt).toLocaleString()}</div>
                 )}
               </div>
               <button onClick={() => handleRestore(c.id)}>Restore</button>
             </li>
           ))}
         </ul>
       </div>
     );
   }
   ```
   Adapt Tailwind classes / button component to match the project's UI conventions — the above uses minimal styling. If the project has a standard `<Button>` primitive, use it. If headers/back-buttons follow a common pattern (e.g., `SettingsScreen` layout), mirror that.

3. **Add the route.** Open `src/routes/index.tsx`. Find the existing `/bestiary` entry (around line 76):
   ```ts
   { path: '/bestiary', element: <BestiaryScreenRoute /> },
   ```
   Add **immediately after**:
   ```ts
   { path: '/bestiary/trash', element: <TrashScreen /> },
   ```
   Add the import at the top:
   ```ts
   import TrashScreen from '../screens/TrashScreen';
   ```

4. **Build check.** `npm run build` → exit 0.

5. **Read-path audit (confirm the grep is clean).** After the audit fixes in step 1:
   ```bash
   git grep -n "db.creatureTemplates\." src/ -- ':!src/storage/db/'
   ```
   Every hit should use `excludeDeleted` or pass `includeDeleted: true`. Bare calls are failures.

6. **End-to-end smoke.** Seed DB with a `status='archived'` creature + two `represents` edges → reload (triggers v9 migration per SS-9) → navigate to `/bestiary/trash` → creature listed → click Restore → verify in DevTools: creature and both edges have `deletedAt=null` (`undefined` is fine), the Trash list is now empty, and the creature reappears in `/bestiary`.

7. **Commit.** Message: `feat(bestiary): add Trash screen and /bestiary/trash route for soft-delete restore`

## Verification Commands

```bash
npm run build
npx --yes --package playwright node output/playwright/session_smoke.cjs

# TrashScreen exists
test -f src/screens/TrashScreen.tsx

# Route wired in object-form (NOT JSX)
grep -q "path: '/bestiary/trash'" src/routes/index.tsx

# Import present
grep -q "import TrashScreen" src/routes/index.tsx

# Read-path audit (no bare calls outside storage/db)
# Allow any line that has excludeDeleted or includeDeleted; fail only on bare hits.
git grep -n "db.creatureTemplates\." src/ -- ':!src/storage/db/' | grep -vE "excludeDeleted|includeDeleted" || echo "AUDIT: OK"
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| TrashScreen file exists | [STRUCTURAL] | `test -f src/screens/TrashScreen.tsx \|\| (echo "FAIL: TrashScreen missing" && exit 1)` |
| Route entry added in object form | [STRUCTURAL] | `grep -q "path: '/bestiary/trash'" src/routes/index.tsx \|\| (echo "FAIL: /bestiary/trash route not registered" && exit 1)` |
| TrashScreen imports into router | [STRUCTURAL] | `grep -q "import TrashScreen" src/routes/index.tsx \|\| (echo "FAIL: TrashScreen import missing" && exit 1)` |
| TrashScreen uses getDeleted | [STRUCTURAL] | `grep -q "creatureTemplateRepository.getDeleted" src/screens/TrashScreen.tsx \|\| (echo "FAIL: TrashScreen not querying getDeleted" && exit 1)` |
| TrashScreen calls restore on action | [STRUCTURAL] | `grep -q "creatureTemplateRepository.restore" src/screens/TrashScreen.tsx \|\| (echo "FAIL: Restore button not wired" && exit 1)` |
| Empty state + loading state present | [STRUCTURAL] | `grep -q "Nothing deleted" src/screens/TrashScreen.tsx && grep -q "Loading" src/screens/TrashScreen.tsx \|\| (echo "FAIL: empty or loading state missing" && exit 1)` |
| Read-path audit clean | [MECHANICAL] | `test -z "$(git grep -n 'db.creatureTemplates\\.' src/ -- ':!src/storage/db/' \| grep -vE 'excludeDeleted\|includeDeleted')" \|\| (echo "FAIL: bare db.creatureTemplates callers without filter" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Playwright session smoke passes | [MECHANICAL] | `npx --yes --package playwright node output/playwright/session_smoke.cjs 2>&1 \| tail -3 \| grep -q "SESSION_SMOKE_PASS" \|\| (echo "FAIL: session smoke regression" && exit 1)` |
