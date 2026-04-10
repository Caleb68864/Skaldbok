# Pre-Flight Report — 2026-03-31T18-21-40-design-doc

**Date:** 2026-03-31 19:30
**Phase Specs Analyzed:** 5
**Status:** ADVISORY_ONLY

## Summary

All 5 sub-specs are structurally sound and target files that exist in the codebase as described. No critical blocking issues were found. The interface contracts between sub-specs are consistent, dependency ordering is correct, and the files targeted for modification contain the code patterns referenced by each phase spec. Six advisory issues were identified — primarily around type extensions, incomplete extraction scope, and a missing settings field that must be added but presents no blocking risk.

## Critical Issues

No critical issues found.

## Advisory Issues

### ADV-1: AppSettings type lacks `showOtherSessionNotes` field
- **Sub-Spec:** 3 — Notes Overhaul
- **Type:** missing type field
- **Detail:** Sub-spec 3, Step 1 instructs the agent to "Read/write preference from appSettings using useAppState(). Store as showOtherSessionNotes keyed by campaignId." However, the `AppSettings` interface in `src/types/settings.ts` (line 13-23) does not have a `showOtherSessionNotes` field. The agent will need to add this field (e.g., `showOtherSessionNotes?: Record<string, boolean>`) to the `AppSettings` interface, and may also need to update the `useAppSettings` persistence layer accordingly.
- **Recommendation:** The sub-spec 3 implementation step should explicitly call out adding `showOtherSessionNotes` to `AppSettings` in `src/types/settings.ts` as a required file modification. This is backward-compatible (optional field) but the file is not listed in the sub-spec 3 Files table. The agent should handle this, but flagging for awareness.

### ADV-2: Sub-spec 2 extraction scope underspecified — 14 action types exist, only 5-6 named
- **Sub-Spec:** 2 — Global FAB and Action Drawer Extraction
- **Type:** scope clarity
- **Detail:** `SessionQuickActions.tsx` contains 14 action types (skill, spell, ability, condition, rest, damage, death, camp, travel, quote, rumor, shopping, encounter, loot). Sub-spec 2 names only 5 drawer files to create: SkillCheckDrawer, ShoppingDrawer, LootDrawer, QuoteDrawer, RumorDrawer (plus SpellCastDrawer as "optional"). The acceptance criterion says "at least 3 action drawer components exist under `src/features/session/actions/`" which is achievable, but the remaining 8-9 action types will stay inline in `SessionQuickActions.tsx`, meaning the file will still be large after refactoring.
- **Recommendation:** This is acceptable per the acceptance criteria. The agent should extract the named 5 drawers and leave the rest inline. The file will shrink significantly but not fully. No blocking concern.

### ADV-3: `demonMarked` field addition noted but conditional step may confuse agent
- **Sub-Spec:** 4 — Character Sheet Cleanup
- **Type:** convention
- **Detail:** Sub-spec 4, Step 6 says "Add demonMarked to CharacterSkill type (if needed)" and marks the action as "modify (conditional)". The field definitively does NOT exist in `CharacterSkill` (verified: `src/types/character.ts` line 12-16 has only `value`, `trained`, `dragonMarked?`). The "if needed" conditional language may cause the agent to skip verification and proceed without adding it, or waste time checking. It should be stated definitively.
- **Recommendation:** The agent will need to add `demonMarked?: boolean` to `CharacterSkill`. This is a non-blocking concern — the agent will discover the need during implementation of Step 3.

### ADV-4: Sub-spec 1 Shopping action replacement is more extensive than described
- **Sub-Spec:** 1 — Session UX Core
- **Type:** efficiency
- **Detail:** Sub-spec 1, Step 3 says to "Replace the simple shopItem/shopCost text inputs in the Shopping drawer with three CounterControl steppers." The current Shopping flow (lines 1010-1100 of `SessionQuickActions.tsx`) also includes a buy/sell toggle and a Log button with item name input. The step correctly notes keeping `shopAction` but doesn't mention whether the item name input (`shopItem`) should be retained alongside the coin steppers. The spec says "Gold/Silver/Copper steppers with quantity and calculated total" but the current UX also logs an item name.
- **Recommendation:** The agent should retain the `shopItem` text input for item name alongside the new coin CounterControls. The coin fields replace `shopCost` (free-text cost), not the item name. This is a minor clarity issue the agent can resolve at implementation time.

### ADV-5: ManagePartyDrawer guard placement requires careful hook ordering
- **Sub-Spec:** 4 — Character Sheet Cleanup
- **Type:** convention
- **Detail:** Sub-spec 4, Step 5 provides two approaches: a direct early return in render body (violates Rules of Hooks) and a `useEffect`-based approach. The spec correctly identifies the `useEffect` approach as the right one (Step 5, item 3). However, the guard renders `null` when `!activeCampaign`, and the drawer is already opened by `ShellLayout` setting `showManageParty=true`. The `useEffect` will fire, call `onClose()`, and render `null` for one frame before closing. This is functionally fine but produces a brief flash.
- **Recommendation:** An alternative is to guard in `ShellLayout.tsx` before opening the drawer (check `activeCampaign` before `setShowManageParty(true)`). Either approach works; the flash is negligible on mobile. No blocking concern.

### ADV-6: Sub-spec 3 Notes Grid on SessionScreen will significantly increase file size
- **Sub-Spec:** 3 — Notes Overhaul
- **Type:** efficiency
- **Detail:** `SessionScreen.tsx` is currently 401 lines. Adding a Notes Grid section with filter controls, search, type chips, tag filters, and a "show other sessions" toggle will likely push it well past 500 lines. The spec's escalation trigger says "Component being modified exceeds 500 lines and changes risk breaking existing behavior."
- **Recommendation:** The agent should consider extracting the Notes Grid into a separate component (e.g., `src/features/notes/NotesGrid.tsx`) and importing it into `SessionScreen`. This keeps `SessionScreen` under the threshold. Not blocking, but the agent should be aware of the escalation trigger.

## File Conflict Map

| File | Sub-Specs Touching | Conflict Risk |
|------|-------------------|---------------|
| `src/features/session/SessionQuickActions.tsx` | 1, 2 | low — sub-spec 1 modifies first (extract PartyPicker, add coin calculator), then sub-spec 2 extracts drawers. Sequential dependency enforced. |
| `src/routes/index.tsx` | 1, 3 | low — sub-spec 1 removes combat route and adds /notes redirect. Sub-spec 3 adds /note/:id/edit routes. Sequential dependency enforced. |
| `src/components/shell/ShellLayout.tsx` | 2 | none — only sub-spec 2 modifies (adds GlobalFAB). |
| `src/screens/SheetScreen.tsx` | 4 | none — only sub-spec 4 modifies. |
| `src/features/session/useSessionLog.ts` | 4 | none — only sub-spec 4 modifies. |
| `src/screens/SessionScreen.tsx` | 3 | none — only sub-spec 3 modifies. |
| `src/components/notes/TiptapNoteEditor.tsx` | 3 | none — only sub-spec 3 modifies. |
| `src/components/notes/TagPicker.tsx` | 3 | none — only sub-spec 3 modifies. |
| `src/utils/export/delivery.ts` | 5 | none — only sub-spec 5 modifies. |
| `src/types/character.ts` | 4 | none — only sub-spec 4 modifies. |
| `src/types/settings.ts` | 3 (implicit) | none — only sub-spec 3 needs to extend AppSettings. |

## Interface Contract Verification

| Provider (Sub-Spec) | Consumer (Sub-Spec) | Contract | Status |
|---------------------|---------------------|----------|--------|
| 1 | 2 | `PartyPicker` component at `src/components/fields/PartyPicker.tsx` with props `{ members, selected, onSelect, multiSelect }` and `ResolvedMember` type | MATCH — sub-spec 1 extracts with exact props from existing code (lines 99-184), sub-spec 2 imports with matching prop interface. |
| 1 | 3 | Route `/notes` redirects to `/session?view=notes`; BottomNav no longer shows Notes tab | MATCH — sub-spec 1 Step 6 adds redirect, sub-spec 3 relies on this redirect being present. |
| 1 | 4 | CombatScreen no longer routed (death rolls must move to SheetScreen) | MATCH — sub-spec 1 Step 6 removes combat route, sub-spec 4 Step 1 adds death rolls to SheetScreen. |
| 2 | 4 | `useSessionLog` extended (sub-spec 4 adds `logCoinChange`/`logRest`) | MATCH — no conflict. Sub-spec 2 does not modify `useSessionLog.ts`; sub-spec 4 extends it. The dependency is correctly ordered (sub-spec 4 runs after sub-spec 2). |
| 4 | (internal) | `logRest` function available when SheetScreen rest actions call it | MATCH — sub-spec 4 Step 4 adds `logRest` to `useSessionLog`, and Step 2 calls it from `SheetScreen`. Both are in the same sub-spec, so ordering is within agent control. |

## Verdict

ADVISORY_ONLY: 6 advisory issues noted but no blockers. Proceed with awareness.
