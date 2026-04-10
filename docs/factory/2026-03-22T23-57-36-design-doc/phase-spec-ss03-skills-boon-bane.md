# Phase Spec: SS-03 — SkillsScreen Boon/Bane Controls and Session State

## Dependencies
- **SS-09** (AppStateContext Session State Extension) — depends on `sessionState`, `setGlobalBoonBane()`, and `setSkillOverride()` being available in AppStateContext. **Must be completed first.**

## Objective
Add global boon/bane selector, per-skill overrides, condition-driven auto-bane, adjusted probability display, and attribute tags to SkillsScreen. Create probability calculation utility.

## Requirements Covered
REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-026

## Files to Modify
- `src/screens/SkillsScreen.tsx` — global selector, per-skill overrides, probability display, attribute tags, auto-bane logic
- `src/utils/boonBane.ts` — **NEW FILE** — pure probability calculation functions
- `src/theme/theme.css` — styles for boon/bane selector, attribute tags, probability display

## Acceptance Criteria
1. `[STRUCTURAL]` A three-segment control (Boon / Normal / Bane) is rendered at the top of the skills list, controlling `sessionState.globalBoonBane`.
2. `[BEHAVIORAL]` Tapping a segment sets `sessionState.globalBoonBane` to `'boon'`, `'none'`, or `'bane'`. State persists across screen navigation but not app restart.
3. `[BEHAVIORAL]` Tapping the boon/bane area on a skill row cycles through: boon -> bane -> inherit-global. Per-skill overrides are stored in `sessionState.skillOverrides[skillId]`.
4. `[STRUCTURAL]` Each skill row displays the adjusted probability when boon or bane is effective. Format: "Swords 14 AGL — 14% (26% with boon)".
5. `[BEHAVIORAL]` Boon probability is calculated as `P = 1 - (1 - value/20)^2`. Bane probability is calculated as `P = (value/20)^2`.
6. `[BEHAVIORAL]` If a skill's linked attribute has its condition active (e.g., Dazed -> AGL skills), auto-bane is applied. Boon + auto-bane = normal. Bane + auto-bane = single bane (no stacking).
7. `[STRUCTURAL]` Each skill row displays a small attribute tag (STR, AGL, INT, etc.) next to the skill name.
8. `[STRUCTURAL]` `AppStateContext` gains a `sessionState` object with `globalBoonBane` and `skillOverrides` (provided by SS-09).
9. `[BEHAVIORAL]` Skill value 1 (Dragon roll) displays adjusted % but notes "auto-success" in the display.
10. `[STRUCTURAL]` The global selector and per-skill overrides have >= 44px touch targets.

## Implementation Steps

1. **Create boon/bane utility** (`src/utils/boonBane.ts`):
   - `calcNormalProb(value: number): number` — returns `value / 20` (as percentage).
   - `calcBoonProb(value: number): number` — returns `1 - (1 - value/20)^2` (as percentage).
   - `calcBaneProb(value: number): number` — returns `(value/20)^2` (as percentage).
   - `resolveEffectiveBoonBane(global, skillOverride, hasAutoConditionBane): 'boon' | 'none' | 'bane'` — resolves the effective state considering auto-bane cancellation rules.
   - All functions are pure, no side effects.

2. **Add global boon/bane selector** to SkillsScreen:
   - Three-segment control at top of skills list.
   - Each segment calls `setGlobalBoonBane()` from AppStateContext.
   - Active segment visually highlighted.
   - Touch targets >= 44px.

3. **Add per-skill boon/bane override**:
   - Tappable area on each skill row cycles: boon -> bane -> undefined (inherit).
   - Calls `setSkillOverride(skillId, value)`.
   - Visual indicator showing override state.

4. **Add adjusted probability display**:
   - For each skill, compute effective boon/bane state via `resolveEffectiveBoonBane()`.
   - Display base probability and adjusted probability in format: "Swords 14 AGL — 14% (26% with boon)".
   - For skill value 1: append "auto-success" note.

5. **Implement condition-driven auto-bane**:
   - Check if the skill's linked attribute has an active condition (from character state).
   - Apply auto-bane logic: boon + auto-bane = normal, bane + auto-bane = single bane.

6. **Add attribute tags**:
   - Small tag (STR, AGL, INT, etc.) next to each skill name.
   - Styled via CSS custom properties for theme compatibility.

7. **Add CSS**: Styles for `.boon-bane-selector`, `.attribute-tag`, `.probability-display` in `theme.css`.

## Edge Cases
- Skill value 1 (Dragon roll): display adjusted % but note "auto-success".
- Skill value 20: bane shows very low probability — display honestly.
- Condition auto-bane + manual bane: single bane (no double-bane).
- Condition auto-bane + manual boon: cancel to normal.
- Theme switch: all new UI adapts via CSS custom properties.
- Session state across screen flips: persists in AppStateContext.

## Constraints
- Session state must NOT be persisted to IndexedDB or localStorage.
- Probability calculation is a pure function in a utility file.
- No changes to existing `settings` state shape — `sessionState` is a sibling.
- No new npm dependencies.
- Component must not exceed 400 lines.

## Verification Commands
```bash
# Build check
npx vite build

# Verify new utility file
ls src/utils/boonBane.ts

# Verify probability functions
grep -r "calcBoonProb\|calcBaneProb\|resolveEffective" src/utils/boonBane.ts

# Verify global selector in SkillsScreen
grep -r "globalBoonBane\|boon-bane-selector" src/screens/SkillsScreen.tsx

# Verify attribute tags
grep -r "attribute-tag\|STR\|AGL\|INT" src/screens/SkillsScreen.tsx

# Verify session state usage
grep -r "sessionState\|setGlobalBoonBane\|setSkillOverride" src/screens/SkillsScreen.tsx
```
