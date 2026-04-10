# Phase Spec: SS-05 — PinnedSkillsPanel

## Dependency Order
**Dependencies:** SS-01 (`uiState.pinnedSkills` type)
**Blocks:** SS-09

## Objective
Create a panel that displays a user-selected set of pinned skills (max 6) with their values and trained status. Supports add/remove via a picker in edit mode.

## Files to Modify
- `src/components/panels/PinnedSkillsPanel.tsx` — **new file**
- `src/theme/theme.css` — add panel-specific styles

## Acceptance Criteria
1. `[STRUCTURAL]` Panel reads `character.uiState.pinnedSkills` (array of skill IDs) and looks up each skill's value and trained status.
2. `[STRUCTURAL]` Each pinned skill displays: skill name, skill value, trained indicator (e.g., checkmark or filled dot).
3. `[BEHAVIORAL]` In edit mode, a "+" button or "Edit Pins" action opens a skill picker showing all system skills with toggle checkboxes.
4. `[BEHAVIORAL]` The picker enforces a maximum of 6 pinned skills. Attempting to add a 7th shows a message: "Maximum 6 pinned skills."
5. `[BEHAVIORAL]` Pinned skill changes persist via `updateCharacter({ uiState: { pinnedSkills: [...] } })`.
6. `[BEHAVIORAL]` If a pinned skill ID no longer exists in the system skill list, it is silently dropped from the displayed list (not an error).
7. `[STRUCTURAL]` When no skills are pinned, edit mode shows: "Pin up to 6 skills for quick reference."
8. `[BEHAVIORAL]` Skills with value 0 and untrained are still shown if pinned (user explicitly chose them).
9. `[STRUCTURAL]` Panel does NOT allow editing skill values — that is the Skills screen's responsibility.
10. `[STRUCTURAL]` Skill picker and "+" button have ≥ 44px touch targets.

## Implementation Steps
1. Create `src/components/panels/PinnedSkillsPanel.tsx`.
2. Import character type, context for `updateCharacter`, and the skill definitions/list from wherever the app defines system skills.
3. Define props or read from context: character data and edit mode flag.
4. Render pinned skills:
   - Read `character.uiState?.pinnedSkills ?? []`.
   - For each pinned skill ID, look up the skill in the character's skill list or system skill definitions.
   - If the skill ID is not found, skip it silently.
   - Display: skill name, skill value (number), trained indicator (checkmark if trained).
5. Empty state:
   - Play mode with no pins: show minimal empty state or hide.
   - Edit mode with no pins: show "Pin up to 6 skills for quick reference."
6. Edit mode picker:
   - Render a "+" button or "Edit Pins" action (≥ 44px touch target).
   - On tap, show a skill picker (modal, dropdown, or inline list) with all system skills.
   - Each skill has a checkbox/toggle. Already-pinned skills are checked.
   - When 6 skills are already pinned, unchecked skills show "Maximum 6 pinned skills." and their toggle is disabled.
   - Toggling a skill updates `pinnedSkills` array and persists via `updateCharacter`.
7. Add CSS to `theme.css`:
   - `.pinned-skills-panel` — card styling, grid or list layout for skills.
   - `.pinned-skill-item` — skill name + value + indicator layout.
   - `.skill-picker` — picker overlay/dropdown styles.
   - Theme-aware via CSS custom properties.
8. Keep file under 400 lines.

## Constraints
- Read-only for skill values. No editing of skill values from this panel.
- Picker can be a modal or inline dropdown — implementer's choice.
- Max 6 is a hard limit enforced in the UI.
- No new npm dependencies.
- Touch targets ≥ 44px on all interactive elements.

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Build succeeds
npx vite build
```

## Verification Checklist
- [ ] `PinnedSkillsPanel.tsx` exists in `src/components/panels/`
- [ ] Reads `uiState.pinnedSkills` and displays matching skills
- [ ] Shows skill name, value, and trained indicator
- [ ] Edit mode shows "+" button or "Edit Pins" action
- [ ] Skill picker shows all system skills with toggles
- [ ] Max 6 enforcement with "Maximum 6 pinned skills." message
- [ ] Changes persist via `updateCharacter`
- [ ] Invalid/missing skill IDs silently dropped
- [ ] Empty state message in edit mode: "Pin up to 6 skills for quick reference."
- [ ] Skills with value 0 still shown if pinned
- [ ] No skill value editing from this panel
- [ ] Touch targets ≥ 44px
- [ ] CSS added to `theme.css` with theme-aware properties
- [ ] File is under 400 lines
- [ ] `npx tsc --noEmit` passes
