# Phase Spec: SS-03 — HeroicAbilityPanel — Interactive Ability Activation with WP Deduction

## Dependency Order
**Dependencies:** SS-01 (HeroicAbility type fields for wpCost, requirementSkillId, requirementSkillLevel)
**Depended on by:** SS-04, SS-07

## Scope
Create a new panel component that displays heroic abilities as action cards with interactive "Activate" buttons that deduct WP, check skill requirements, and handle edge cases (insufficient WP, unmet requirements, passive abilities).

## Files to Modify
- `src/components/panels/HeroicAbilityPanel.tsx` (NEW)
- `src/theme/theme.css` (add styles for ability cards, activation buttons, requirement badges)

## Implementation Steps

1. Create `src/components/panels/HeroicAbilityPanel.tsx`:
   - Import character context (ActiveCharacterContext) for character data and `updateCharacter`.
   - Import toast notification system for activation feedback.
   - Read `character.heroicAbilities` array.
   - For each ability, render an action card:
     - Name, WP cost display, one-line summary (`ability.summary`).
     - Determine if passive: `wpCost === 0` or `wpCost === undefined` → no Activate button.
     - For active abilities, render "Activate" button.

2. Implement activation logic:
   - On tap "Activate":
     - Check `character.resources.wp.current >= ability.wpCost`. If not, button should already be disabled.
     - Check skill requirement if `ability.requirementSkillId` is set:
       - Look up character's skill value for that skill ID.
       - If `requirementSkillLevel` is undefined, default threshold to 12.
       - If skill not found in character, treat as requirement not met.
       - If requirement not met, show confirmation dialog: "Requirement not met. Activate anyway?"
       - Only proceed on confirmation.
     - Deduct `ability.wpCost` from `character.resources.wp.current` via `updateCharacter()`.
     - Show toast: "Activated {name}! (-{cost} WP)".

3. Implement disable logic:
   - "Activate" button disabled (grayed out) when `character.resources.wp.current < ability.wpCost`.

4. Implement skill requirement badges:
   - When `ability.requirementSkillId` is set, show green badge if skill meets threshold, red badge otherwise.

5. Implement edit mode:
   - "Add" button opens a drawer editor for creating/editing/deleting heroic abilities.
   - Drawer fields: name, summary, wpCost (number), requirement (text description), requirementSkillId (dropdown from character/system skills), requirementSkillLevel (number).
   - Follow existing drawer editor pattern from Magic screen.

6. Handle empty state:
   - When no heroic abilities exist: "No heroic abilities. Add them in edit mode."

7. Add styles to `src/theme/theme.css`:
   - Ability card layout, Activate button (enabled/disabled states).
   - Requirement badges (green/red).
   - Passive ability styling (no button, subtle presentation).
   - All interactive elements >= 44px touch targets.
   - All three themes render correctly.

## Acceptance Criteria

| # | Type | Criterion | REQ |
|---|------|-----------|-----|
| 1 | STRUCTURAL | Panel reads `character.heroicAbilities` and renders each as an action card: name, WP cost, one-line summary. | REQ-015 |
| 2 | BEHAVIORAL | Tapping "Activate" deducts `ability.wpCost` from `character.resources.wp.current` via `updateCharacter()`. Toast shown: "Activated {name}! (-{cost} WP)". | REQ-016, REQ-030 |
| 3 | BEHAVIORAL | "Activate" button is disabled (grayed styling, non-interactive) when `character.resources.wp.current < ability.wpCost`. | REQ-017 |
| 4 | BEHAVIORAL | When `ability.requirementSkillId` is set, shows green/red status badge based on whether character's skill value meets `requirementSkillLevel`. | REQ-018 |
| 5 | BEHAVIORAL | When skill requirement is not met but WP is sufficient, tapping "Activate" shows confirmation dialog: "Requirement not met. Activate anyway?" Only proceeds on confirmation. | REQ-019 |
| 6 | BEHAVIORAL | In edit mode, "Add" button opens drawer editor for creating/editing/deleting heroic abilities with fields: name, summary, wpCost, requirement, requirementSkillId, requirementSkillLevel. | REQ-020 |
| 7 | STRUCTURAL | Passive abilities (`wpCost === 0` or `wpCost` undefined) display name and summary without an "Activate" button. | REQ-021 |
| 8 | STRUCTURAL | When no heroic abilities exist, shows empty state: "No heroic abilities. Add them in edit mode." | REQ-033 |
| 9 | BEHAVIORAL | Multiple activations in the same session are unrestricted. | REQ-016 |
| 10 | BEHAVIORAL | WP deduction flows through ActiveCharacterContext and triggers autosave. Changes reflected on other screens without manual refresh. | REQ-030 |
| 11 | STRUCTURAL | All interactive elements (Activate buttons, Add button, drawer controls) have >= 44px touch targets. | REQ-028 |

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Verify file exists
ls src/components/panels/HeroicAbilityPanel.tsx

# Verify component stays under 400 lines
wc -l src/components/panels/HeroicAbilityPanel.tsx

# Build check
npx vite build
```

## Edge Cases
- No heroic abilities → empty state message.
- WP at 0 → all active abilities grayed out; passive abilities shown normally.
- Skill requirement not met → warning badge + confirmation dialog; button still tappable.
- Multiple activations same round → no restriction.
- WP would go below 0 → button disabled, cannot over-deduct.
- `wpCost` undefined → treated as passive (no Activate button).
- `requirementSkillId` not found in character skills → treated as requirement not met (red badge), confirmation dialog still allows activation.
- `requirementSkillLevel` undefined but `requirementSkillId` set → default threshold to 12.
- `wpCost` explicitly 0 → passive, no Activate button.

## Constraints
- This panel does NOT own the WP display (that's the Resources panel). It only deducts WP.
- The drawer editor pattern should match the existing Magic screen's drawer.
- No new npm dependencies.
- No `any` type.
