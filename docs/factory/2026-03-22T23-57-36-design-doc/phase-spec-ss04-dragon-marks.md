# Phase Spec: SS-04 — SkillsScreen Dragon Marks and Advancement Tracking

## Dependencies
- **None** — Type extensions are additive. SS-07 (End-of-Session Modal) depends on this sub-spec.

## Objective
Add dragon mark toggle per skill row with visual feedback and count badge. Extend character types with `dragonMarked` field per skill and `advancementChecks` on `CharacterRecord`.

## Requirements Covered
REQ-012, REQ-027

## Files to Modify
- `src/screens/SkillsScreen.tsx` — dragon mark toggle icon, gold highlight, count badge
- `src/types/character.ts` (or equivalent) — add `dragonMarked` to skill type, add `advancementChecks` to character record
- `src/theme/theme.css` — gold highlight styles, count badge

## Acceptance Criteria
1. `[STRUCTURAL]` Each skill row has a dragon mark toggle icon. Marked skills receive a gold highlight.
2. `[BEHAVIORAL]` Tapping the dragon icon in play mode toggles `skill.dragonMarked` (persisted to IndexedDB).
3. `[BEHAVIORAL]` In edit mode, the dragon mark toggle is hidden or disabled (marks are a play-mode action).
4. `[STRUCTURAL]` A count badge near the top of the skills list shows the number of marked skills (e.g., "4 marked").
5. `[BEHAVIORAL]` Dragon marks persist across app restarts via IndexedDB.
6. `[STRUCTURAL]` The `CharacterSkill` type gains an optional `dragonMarked: boolean` field.
7. `[STRUCTURAL]` The `CharacterRecord` type gains an `advancementChecks` object for session event tracking.
8. `[BEHAVIORAL]` Skill at value 18 (maximum) can still be marked but is flagged during advancement (see SS-07).

## Implementation Steps

1. **Extend types**:
   - Add `dragonMarked?: boolean` to the `CharacterSkill` type/interface.
   - Add `advancementChecks?: { combat?: boolean; explore?: boolean; weakness?: boolean; heroic?: boolean }` to `CharacterRecord`.
   - These are optional fields — backward compatible with existing data.

2. **Add dragon mark toggle to skill rows**:
   - Render a dragon/flame icon button on each skill row.
   - In play mode: tapping toggles `skill.dragonMarked` and persists to IndexedDB.
   - In edit mode: toggle is hidden or disabled.
   - Use a Unicode character, emoji, or inline SVG for the dragon icon (no new dependencies).

3. **Apply gold highlight**:
   - When `skill.dragonMarked === true`, apply `.dragon-marked` CSS class to the skill row.
   - Gold highlight uses `var(--color-gold)` for theme compatibility.

4. **Add count badge**:
   - Near the top of the skills list, display a badge showing count of marked skills (e.g., "4 marked").
   - Only show badge when count > 0.

5. **Add CSS**: Styles for `.dragon-marked`, `.dragon-mark-toggle`, `.dragon-count-badge` in `theme.css`. Gold highlight via `var(--color-gold)`. Ensure all three themes render correctly.

## Edge Cases
- Skill at value 18 (maximum): can still be marked. Flagged during advancement in SS-07.
- Rapid dragon mark toggling: each tap is a synchronous state update. React batches correctly.
- Dragon mark toggle touch target >= 44px.
- All three themes render gold highlight correctly.

## Constraints
- Dragon mark toggle touch target >= 44px.
- Gold highlight uses `var(--color-gold)`.
- No new npm dependencies.
- Persists via IndexedDB through existing character update patterns.

## Verification Commands
```bash
# Build check
npx vite build

# Verify type extensions
grep -r "dragonMarked" src/types/
grep -r "advancementChecks" src/types/

# Verify dragon mark UI in SkillsScreen
grep -r "dragonMarked\|dragon-mark\|dragon-count" src/screens/SkillsScreen.tsx

# Verify gold highlight styles
grep -r "dragon-marked\|color-gold" src/theme/theme.css

# Verify IndexedDB persistence
grep -r "dragonMarked" src/screens/SkillsScreen.tsx
```
