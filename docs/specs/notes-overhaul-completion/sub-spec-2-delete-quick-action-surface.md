---
sub_spec_id: SS-02
phase: run
depends_on: ['SS-01']
dispatch: factory
---

# Sub-Spec 2 — Delete the quick-action surface

## Scope

Remove the chip/drawer capture surface entirely. **This is a deletion sub-spec:
no behaviour is reimplemented anywhere.** Every action being deleted already has
a home — damage/heal on the character sheet and Play Dashboard, NPC creation in
the Bestiary, encounters on the Session screen, and everything narrative
(quote, rumor, loot, shopping, camp, travel) is now written into the log and
promoted afterward.

## Sizing note

This sub-spec touches 10 files, above the usual 1-3 heuristic. **Do not split
it.** The deletion is atomic: any partial split leaves an intermediate state
where `tsc -b` fails on orphaned imports, which is worse than the file count.

## Files

- **Files (delete):**
  - `src/features/session/SessionQuickActions.tsx`
  - `src/features/session/quickLog/QuickLogPCTray.tsx`
  - `src/features/session/quickActions/QuickNpcAction.tsx`
  - `src/features/session/quickActions/AttachToControl.tsx`
  - `src/features/session/actions/LootDrawer.tsx`
  - `src/features/session/actions/QuoteDrawer.tsx`
  - `src/features/session/actions/RumorDrawer.tsx`
  - `src/features/session/actions/ShoppingDrawer.tsx`
  - `src/features/session/actions/SkillCheckDrawer.tsx`
- **Files (modify):**
  - `src/features/session/SessionTimelinePanel.tsx`

## Decisions

- **Kept, do not delete:** `src/features/session/actions/SkillCheckEditDrawer.tsx`
  and `src/features/session/actions/formatSkillCheckTitle.ts`.
  `src/features/notes/NotesGrid.tsx:297` and `src/screens/SessionScreen.tsx:779`
  both open the edit drawer for skill-check notes that auto-logging still
  produces, and `formatSkillCheckTitle` is used by `useSessionLog`. Deleting
  either strips the only edit path for those notes.
- **Path note (run 65fd36c0 defect):** the two callers do **not** live under
  `src/features/session/`. Cite them only by full repo-relative path —
  `src/features/notes/NotesGrid.tsx` and `src/screens/SessionScreen.tsx`. A
  generated check in the first factory run guessed
  `src/features/session/NotesGrid.tsx`, which does not exist, and deferred this
  sub-spec on a false negative after the work was already correct.
- **Directories:** delete the listed *files* only. Do not remove the
  `quickLog/` or `quickActions/` directories as a unit — if either ends up
  empty, removing it is fine, but never delete an unlisted file that lands there.
- **`SessionTimelinePanel` changes are removal-only.** Drop the
  `AttachToValue` import (line 13), the `onSelectionContextChange` prop from the
  props type (line 25) and its destructuring (line 82), and the three
  `useCallback`s that call it (lines ~216-257). **No caller passes this prop** —
  verified by grep across `src/` — so removing it changes no behaviour. If a
  callback's body does other work besides calling `onSelectionContextChange`,
  preserve that work; only the notification is being removed.

## Implementation Steps

### Step 1. Confirm SS-01 landed

```bash
grep -c "SessionQuickActions" src/components/shell/GlobalFAB.tsx
```

Expect `0`. If non-zero, SS-01 has not completed — stop and report; deleting now
would break the build.

### Step 2. Confirm the orphan claims before deleting

```bash
grep -rn "LootDrawer\|QuoteDrawer\|RumorDrawer\|ShoppingDrawer\|SkillCheckDrawer" src/ | grep -v "^src/features/session/actions/" | grep -v SkillCheckEditDrawer
```

Expect no output — the five action drawers are already unreferenced. If anything
appears, stop and report rather than deleting a live file.

### Step 3. Delete the nine files

```bash
git rm src/features/session/SessionQuickActions.tsx \
       src/features/session/quickLog/QuickLogPCTray.tsx \
       src/features/session/quickActions/QuickNpcAction.tsx \
       src/features/session/quickActions/AttachToControl.tsx \
       src/features/session/actions/LootDrawer.tsx \
       src/features/session/actions/QuoteDrawer.tsx \
       src/features/session/actions/RumorDrawer.tsx \
       src/features/session/actions/ShoppingDrawer.tsx \
       src/features/session/actions/SkillCheckDrawer.tsx
```

### Step 4. Unwind SessionTimelinePanel

Remove the `AttachToValue` import, the `onSelectionContextChange` prop and its
three call sites, per the Decisions above.

### Step 5. Build — this is the real test

```bash
npm run build
```

`tsc -b` is the safety net for this entire sub-spec. Any orphaned import
surfaces here. Fix by removing the dangling reference, **never** by restoring a
deleted file.

### Step 6. Confirm nothing survived

```bash
grep -rn "SessionQuickActions\|QuickLogPCTray\|QuickNpcAction\|AttachToControl\|resolveAttach\|AttachToValue" src/
grep -rn "renderSkillPicker\|renderSpellPicker\|renderAbilityPicker\|TAG_OPTIONS\|REST_TYPES" src/
```

Both expect no output.

### Step 7. Tests

```bash
npm test
```

Expect exit 0 with no count change — no test references any deleted symbol
(verified: `grep -rln` over `*.test.ts*` returns nothing).

### Step 8. Commit

```bash
git add -A src/features/session
git commit -m "refactor(session): delete the quick-action chip and drawer surface [factory-managed]"
```

## Interface Contracts

### SessionQuickActions (deleted)

- Direction: Sub-spec 1 → Sub-spec 2
- Owner: Sub-spec 2
- Shape: requires `GlobalFAB` to no longer import
  `features/session/SessionQuickActions`. Verified by Step 1.

## Verification Commands

```bash
npm run build
npm test
grep -rn "SessionQuickActions\|QuickLogPCTray\|QuickNpcAction\|AttachToControl" src/
test -f src/features/session/actions/SkillCheckEditDrawer.tsx
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| SessionQuickActions deleted | [MECHANICAL] | `test ! -e src/features/session/SessionQuickActions.tsx \|\| (echo "FAIL: SessionQuickActions.tsx still exists" && exit 1)` |
| QuickLogPCTray deleted | [MECHANICAL] | `test ! -e src/features/session/quickLog/QuickLogPCTray.tsx \|\| (echo "FAIL: QuickLogPCTray.tsx still exists" && exit 1)` |
| QuickNpcAction deleted | [MECHANICAL] | `test ! -e src/features/session/quickActions/QuickNpcAction.tsx \|\| (echo "FAIL: QuickNpcAction.tsx still exists" && exit 1)` |
| AttachToControl deleted | [MECHANICAL] | `test ! -e src/features/session/quickActions/AttachToControl.tsx \|\| (echo "FAIL: AttachToControl.tsx still exists" && exit 1)` |
| Five action drawers deleted | [MECHANICAL] | `for f in Loot Quote Rumor Shopping SkillCheck; do test ! -e "src/features/session/actions/${f}Drawer.tsx" \|\| (echo "FAIL: ${f}Drawer.tsx still exists" && exit 1); done` |
| No references to deleted symbols | [MECHANICAL] | `! grep -rqn "SessionQuickActions\|QuickLogPCTray\|QuickNpcAction\|AttachToControl\|resolveAttach\|AttachToValue" src/ \|\| (echo "FAIL: references to deleted symbols remain" && exit 1)` |
| Dead render helpers gone | [MECHANICAL] | `! grep -rqn "renderSkillPicker\|renderSpellPicker\|renderAbilityPicker\|TAG_OPTIONS\|REST_TYPES" src/ \|\| (echo "FAIL: dead render helpers remain" && exit 1)` |
| SkillCheckEditDrawer kept | [STRUCTURAL] | `test -f src/features/session/actions/SkillCheckEditDrawer.tsx \|\| (echo "FAIL: SkillCheckEditDrawer.tsx was deleted" && exit 1)` |
| formatSkillCheckTitle kept | [STRUCTURAL] | `test -f src/features/session/actions/formatSkillCheckTitle.ts \|\| (echo "FAIL: formatSkillCheckTitle.ts was deleted" && exit 1)` |
| SkillCheckEditDrawer still reachable from NotesGrid | [STRUCTURAL] | `grep -q "SkillCheckEditDrawer" src/features/notes/NotesGrid.tsx \|\| (echo "FAIL: NotesGrid no longer imports SkillCheckEditDrawer" && exit 1)` |
| SkillCheckEditDrawer still reachable from SessionScreen | [STRUCTURAL] | `grep -q "SkillCheckEditDrawer" src/screens/SessionScreen.tsx \|\| (echo "FAIL: SessionScreen no longer imports SkillCheckEditDrawer" && exit 1)` |
| Timeline panel prop removed | [STRUCTURAL] | `! grep -q "onSelectionContextChange" src/features/session/SessionTimelinePanel.tsx \|\| (echo "FAIL: onSelectionContextChange still declared" && exit 1)` |
| Project builds | [MECHANICAL] | `npm run build \|\| (echo "FAIL: npm run build failed" && exit 1)` |
| Tests pass | [MECHANICAL] | `npm test \|\| (echo "FAIL: npm test failed" && exit 1)` |
