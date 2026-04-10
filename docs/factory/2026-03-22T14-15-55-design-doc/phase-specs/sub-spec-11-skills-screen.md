---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 11
title: "Skills Screen"
date: 2026-03-22
dependencies: ["5", "7", "10"]
---

# Sub-Spec 11: Skills Screen

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Build the Skills screen that merges system skill definitions (from Dragonbane system JSON) with character skill values. Skills are displayed grouped by category. A toggle switches between "relevant-first" (hides skills with value 0 and no trained flag) and "show-all" views. Skill values are editable in Edit Mode and locked in Play Mode.

## Interface Contracts

### Provides
- `src/screens/SkillsScreen.tsx`: Full skills screen component
- `src/components/fields/SkillList.tsx`: Grouped skill list component with `categories`, `characterSkills`, `mode`, `onSkillChange` props
- `src/components/fields/SkillRow.tsx`: Single skill row with `skill: SkillDefinition`, `value: CharacterSkill`, `onChange`, `disabled` props

### Requires
- From sub-spec 5: System definition with `skillCategories` array
- From sub-spec 7: `useActiveCharacter()` for character data, `useAppState()` for system definition and mode
- From sub-spec 10: `useFieldEditable()` or mode from context for disabling fields

### Shared State
- ActiveCharacterContext: reads character skills, updates via `updateCharacter()`

## Implementation Steps

### Step 1: Create SkillRow component
- **File:** `src/components/fields/SkillRow.tsx`
- **Action:** create
- **Changes:** Single row showing:
  - Skill name (from system definition)
  - Trained checkbox (toggle)
  - Value as editable number input (when not disabled) or read-only display
  - Base chance shown in parentheses if skill has one
  - Props: `skillDef: SkillDefinition`, `characterSkill: CharacterSkill | undefined`, `onChange: (value: CharacterSkill) => void`, `disabled: boolean`

### Step 2: Create SkillList component
- **File:** `src/components/fields/SkillList.tsx`
- **Action:** create
- **Changes:** Renders skills grouped by category using `SectionPanel` per category:
  - Props: `categories: SkillCategory[]`, `characterSkills: Record<string, CharacterSkill>`, `onSkillChange: (skillId: string, value: CharacterSkill) => void`, `disabled: boolean`, `filter: 'all' | 'relevant'`
  - When filter is 'relevant', hide skills where `value === 0 && trained === false`
  - Each group header shows category name
  - Each skill renders as a `SkillRow`

### Step 3: Build SkillsScreen
- **File:** `src/screens/SkillsScreen.tsx`
- **Action:** modify (replace placeholder)
- **Changes:**
  - Guard: redirect to /library if no active character
  - Load system definition skill categories
  - Merge with character's skill values (character may have partial skill entries)
  - Filter toggle: `Chip` components for "Relevant" and "All" with local state
  - Render `SkillList` with mode-based disabled state
  - On skill change, call `updateCharacter()` to merge new skill value
  - Skill labels and groupings driven entirely by system JSON

### Step 4: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 5: Commit
- **Stage:** `git add src/screens/SkillsScreen.tsx src/components/fields/SkillList.tsx src/components/fields/SkillRow.tsx`
- **Message:** `feat: skills screen`

## Acceptance Criteria

- `[BEHAVIORAL]` Editing a skill value in Edit Mode and reloading preserves the new value (REQ-025)
- `[BEHAVIORAL]` The relevant-first toggle hides skills with value 0 and no trained flag; show-all displays every system-defined skill (REQ-025)
- `[STRUCTURAL]` Skill labels and groupings are driven by the system JSON, not hardcoded in the component (REQ-025)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Skill editing: Set a skill value in Edit Mode, reload, verify persisted
  - Filter toggle: Click "Relevant" filter, verify untrained/0-value skills hidden; click "All", verify all shown
  - System-driven: Verify skill names match system.json, not hardcoded strings

## Patterns to Follow

- Skills merge pattern: For each skill in system definition, look up `character.skills[skillId]`. If not found, use `{ value: skillDef.baseChance, trained: false }` as default.
- Use `SectionPanel` from sub-spec 2 for collapsible category groups.
- Filter state is local to the screen (not persisted) -- defaults to "relevant".

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/components/fields/SkillRow.tsx | Create | Single skill display/edit row |
| src/components/fields/SkillList.tsx | Create | Grouped skill list with filtering |
| src/screens/SkillsScreen.tsx | Modify | Full skills screen replacing placeholder |
