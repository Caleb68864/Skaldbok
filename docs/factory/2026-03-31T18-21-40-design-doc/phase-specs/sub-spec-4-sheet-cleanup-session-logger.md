---
type: phase-spec
master_spec: "docs/factory/2026-03-31T18-21-40-design-doc/spec.md"
sub_spec_number: 4
title: "Character Sheet Cleanup and Session Logger Enhancements"
date: 2026-03-31
dependencies: ["sub-spec 1", "sub-spec 2"]
---

# Sub-Spec 4: Character Sheet Cleanup and Session Logger Enhancements

Refined from spec.md — Factory Run 2026-03-31T18-21-40-design-doc.

## Scope

Ensure death rolls are visible on SheetScreen when HP=0 (they are currently only on CombatScreen). Add session logging to rest actions on SheetScreen. Implement dragon/demon mark triple-click cycle on Skills page (currently only toggles dragon mark on/off). Add "no campaign" guard toast to ManagePartyDrawer. Extend `useSessionLog` with coin change debouncing using a ref-based buffer with ~3-5 second window.

Key existing code:
- `SheetScreen.tsx` (~400 lines): Has rest actions with modals (Round/Stretch/Shift). Has HP/WP resource trackers. Does NOT have death rolls section — that is only on `CombatScreen.tsx` (lines 160-230).
- `CombatScreen.tsx` (lines 44-84): Death roll logic with `updateDeathRolls()` and `updateDeathSuccesses()` functions, plus `logDeathRoll` from `useSessionLog`.
- `SkillsScreen.tsx` (line 45-57): `toggleDragonMark()` function toggles `dragonMarked` boolean on/off. Needs to become a 3-state cycle: unmarked -> dragon -> demon -> clear.
- `ManagePartyDrawer.tsx` (line 32): `handleAddMember` silently returns when `!activeCampaign`. Needs toast.
- `useSessionLog.ts` (96 lines): Returns `{ logToSession, logSkillCheck, logSpellCast, logAbilityUse, logHPChange, logDeathRoll }`. Needs new `logCoinChange` with debounce and `logRest`.

## Interface Contracts

### Provides
- Updated `SheetScreen.tsx` with death rolls section (visible when HP=0).
- Updated `SheetScreen.tsx` rest actions that log to session via `useSessionLog`.
- Updated `SkillsScreen.tsx` with 3-state dragon/demon mark cycle.
- Updated `ManagePartyDrawer.tsx` with no-campaign toast guard.
- Updated `useSessionLog.ts` with `logCoinChange(characterName, coinType, delta)` debounced function and `logRest(characterName, restType, outcome)`.

### Requires
- From sub-spec 1: CombatScreen no longer routed (so death rolls must be on SheetScreen).
- From sub-spec 2: `useSessionLog` may be extended (no blocking dependency — just extending the same file).

### Shared State
- `useSessionLog` is a shared hook used by SheetScreen, CombatScreen (deprecated), SessionQuickActions, and action drawers.
- Character data via `useActiveCharacter()` context.

## Implementation Steps

### Step 1: Add death rolls to SheetScreen
- **File:** `src/screens/SheetScreen.tsx` (modify)
- **Action:** modify
- **Pattern:** Follow `src/screens/CombatScreen.tsx` lines 160-230 for death roll UI. Use `SectionPanel` wrapper with "Death Rolls" title.
- **Changes:**
  1. Add death roll resource reads: `const deathRolls = character.resources['deathRolls'] ?? { current: 0, max: 3 }; const deathSuccesses = character.resources['deathSuccesses'] ?? { current: 0, max: 3 };`
  2. Add `const isDown = hp.current === 0;` (hp is already available on SheetScreen line 80).
  3. Add `logDeathRoll` from `useSessionLog()` destructuring (already imported at line 21).
  4. Add `updateDeathRolls` and `updateDeathSuccesses` functions following CombatScreen pattern (lines 70-84).
  5. Add `resetDeathRolls` function.
  6. Add death rolls UI section (conditionally rendered when `isDown`) inside a `SectionPanel`. Copy the death rolls rendering from CombatScreen lines 199-230 (failure/success dot buttons with click handlers).
  7. Place this section after the Resources `SectionPanel` in the panel order.

### Step 2: Wire rest actions to session logger
- **File:** `src/screens/SheetScreen.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Destructure `logRest` from `useSessionLog()` (will be added in Step 4).
  2. In `confirmRoundRest()`: after applying rest and showing toast, call `logRest(character.name, 'Round Rest', \`Recovered ${result.recovered} WP\`)`.
  3. In `confirmStretchRest()`: after applying rest, call `logRest(character.name, 'Stretch Rest', parts.join(' '))` where `parts` is the summary already built.
  4. In `confirmShiftRest()` (if it exists): call `logRest(character.name, 'Shift Rest', 'Fully recovered')`.

### Step 3: Implement dragon/demon mark triple-click cycle
- **File:** `src/screens/SkillsScreen.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Replace `toggleDragonMark(skillId)` function with `cycleSkillMark(skillId)`.
  2. New logic: Read current state from `character.skills[skillId]`:
     - If `dragonMarked` is falsy and `demonMarked` is falsy: set `dragonMarked: true, demonMarked: false` (dragon state).
     - If `dragonMarked` is true: set `dragonMarked: false, demonMarked: true` (demon state).
     - If `demonMarked` is true: set `dragonMarked: false, demonMarked: false` (clear state).
  3. Note: `CharacterSkill` type may need a `demonMarked` field. Check `src/types/character.ts` — if it does not exist, add it as optional boolean.
  4. Update the visual rendering in `SkillList` component to show distinct icons/colors for dragon (gold/amber), demon (red), and clear (default).
  5. The click handler in `SkillList` that currently calls `toggleDragonMark` should call `cycleSkillMark` instead.

### Step 4: Add logRest and logCoinChange to useSessionLog
- **File:** `src/features/session/useSessionLog.ts` (modify)
- **Action:** modify
- **Changes:**
  1. Add `logRest` callback:
     ```typescript
     const logRest = useCallback(async (characterName: string, restType: string, outcome: string) => {
       await logToSession(`${characterName}: ${restType} — ${outcome}`);
     }, [logToSession]);
     ```
  2. Add coin change debouncing:
     - Add `useRef` import.
     - Create a ref-based buffer: `const coinBuffer = useRef<{ character: string; changes: Record<string, number>; timer: ReturnType<typeof setTimeout> | null }>({ character: '', changes: {}, timer: null });`
     - Add `flushCoinBuffer` function that reads the buffer, creates a single log entry with net changes, and clears the buffer.
     - Add `logCoinChange(characterName: string, coinType: 'gold' | 'silver' | 'copper', delta: number)`:
       a. If buffer character differs from characterName, flush first.
       b. Accumulate delta into `coinBuffer.current.changes[coinType]`.
       c. Clear existing timer, set new 3-second timer to flush.
     - Add cleanup effect: `useEffect(() => () => { flushCoinBuffer(); }, [])` to flush on unmount.
     - Add effect watching `activeSession` — flush when session becomes null.
  3. Add `logRest` and `logCoinChange` to the returned object.

### Step 5: Add no-campaign toast guard to ManagePartyDrawer
- **File:** `src/features/campaign/ManagePartyDrawer.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. At the top of the component (after hooks), add:
     ```typescript
     if (!activeCampaign) {
       showToast('Create a campaign first');
       onClose();
       return null;
     }
     ```
  2. Alternative approach: guard in `ShellLayout.tsx` before opening the drawer. But since `ManagePartyDrawer` already has `const { activeCampaign } = useCampaignContext()`, adding the guard there is simpler.
  3. Use `useEffect` to handle the toast + close rather than in render body (to avoid calling hooks conditionally):
     ```typescript
     useEffect(() => {
       if (!activeCampaign) {
         showToast('Create a campaign first');
         onClose();
       }
     }, [activeCampaign, showToast, onClose]);
     if (!activeCampaign) return null;
     ```

### Step 6: Add demonMarked to CharacterSkill type (if needed)
- **File:** `src/types/character.ts` (modify, if needed)
- **Action:** modify (conditional)
- **Changes:**
  1. Check if `CharacterSkill` interface has a `demonMarked` field.
  2. If not, add `demonMarked?: boolean;` as an optional field.
  3. This is backward-compatible — existing data without the field will default to `undefined`/falsy.

### Step 7: Verify TypeScript compilation
- **Run:** `npx tsc --noEmit`
- **Expected:** Zero errors.

### Step 8: Commit
- **Stage:** `git add src/screens/SheetScreen.tsx src/screens/SkillsScreen.tsx src/features/campaign/ManagePartyDrawer.tsx src/features/session/useSessionLog.ts src/types/character.ts`
- **Message:** `feat: sheet cleanup — death rolls, rest logging, skill marks, coin debounce`

## Acceptance Criteria

- `[BEHAVIORAL]` Death rolls section is visible on SheetScreen when character HP is 0, with failure/success tracking. (REQ-020)
- `[BEHAVIORAL]` Dragon/demon mark on Skills page cycles: unmarked -> dragon -> demon -> clear on successive clicks. Distinct visual for each state. (REQ-023)
- `[BEHAVIORAL]` Opening Manage Party with no campaign shows toast "Create a campaign first" instead of silently opening an empty drawer. (REQ-024)
- `[STRUCTURAL]` useSessionLog exports a `logCoinChange` function with debounce buffer (~3-5 seconds). (REQ-022)
- `[MECHANICAL]` `npx tsc --noEmit` passes with no errors. (REQ-028)

## Verification Commands

- **Build:** `npx tsc --noEmit`
- **Tests:** No test framework detected — skip TDD steps, implement directly.
- **Acceptance:**
  - Grep `SheetScreen.tsx` for `deathRolls` and `isDown` — verify death roll section exists.
  - Grep `SheetScreen.tsx` for `logRest` — verify rest actions call session logger.
  - Grep `SkillsScreen.tsx` for `cycleSkillMark` or `demonMarked` — verify 3-state cycle.
  - Grep `ManagePartyDrawer.tsx` for `Create a campaign first` toast message.
  - Grep `useSessionLog.ts` for `logCoinChange` and `coinBuffer` — verify debounce implementation.
  - Grep `useSessionLog.ts` for `flushCoinBuffer` and timer cleanup.

## Patterns to Follow

- `src/screens/CombatScreen.tsx` (lines 44-84, 160-230): Death roll logic and UI to replicate on SheetScreen.
- `src/features/session/useSessionLog.ts`: Existing hook to extend with new functions.
- `src/screens/SheetScreen.tsx` (lines 115-179): Existing rest action modal pattern.
- `src/components/primitives/SectionPanel.tsx`: Collapsible section panel used throughout the app.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/screens/SheetScreen.tsx` | Modify | Add death rolls section, wire rest to session logger |
| `src/screens/SkillsScreen.tsx` | Modify | Dragon/demon mark triple-click cycle |
| `src/features/campaign/ManagePartyDrawer.tsx` | Modify | Add no-campaign toast guard |
| `src/features/session/useSessionLog.ts` | Modify | Add logRest, logCoinChange with debounce |
| `src/types/character.ts` | Modify | Add demonMarked field to CharacterSkill (if needed) |
