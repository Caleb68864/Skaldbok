# Phase Spec: SS-07 — End-of-Session Modal (New)

## Dependencies
- **SS-04** (Dragon Marks) — depends on `dragonMarked` field on skills and `advancementChecks` on character record being available.

## Objective
Create a multi-step End-of-Session Modal implementing the Dragonbane advancement flow: session checklist -> bonus roll assignment -> roll-through -> summary.

## Requirements Covered
REQ-022, REQ-023, REQ-024, REQ-025, REQ-027

## Files to Modify
- `src/components/modals/EndOfSessionModal.tsx` — **NEW FILE** — multi-step advancement wizard
- Hamburger menu component — add "End of Session" trigger
- `src/theme/theme.css` — modal step styles, checklist, summary

## Acceptance Criteria
1. `[STRUCTURAL]` The modal is triggered from a hamburger menu option and/or a button on SheetScreen/CombatScreen.
2. `[STRUCTURAL]` Step 1 (Session Checklist) presents checkboxes for Dragonbane session events (combat participation, explored new location, role-played weakness, used heroic ability). Each checked = 1 bonus roll.
3. `[STRUCTURAL]` Step 2 (Assign Bonus Rolls) presents a list of skills (trained-first filter, show-all toggle) where the player assigns each bonus roll to a skill.
4. `[STRUCTURAL]` Step 3 (Roll Through) presents each dragon-marked + bonus skill one at a time, showing skill name, current value, and target ("roll above 14 on d20"). Two buttons: Pass and Fail.
5. `[BEHAVIORAL]` Pass increments `skill.value` by 1 and clears the dragon mark. Fail clears the dragon mark only.
6. `[BEHAVIORAL]` A skill at value 18 (maximum) that appears in the roll-through auto-skips with a message "Already at maximum".
7. `[STRUCTURAL]` Step 4 (Summary) shows which skills advanced and by how much. "Done" button clears all dragon marks and advancement checks.
8. `[BEHAVIORAL]` If no marks exist and no session checks are checked, the modal shows "Nothing to advance this session".
9. `[BEHAVIORAL]` Dragon marks persist in IndexedDB, so if the app closes mid-advancement, the user can re-trigger the modal later.
10. `[BEHAVIORAL]` Bonus rolls assigned to already-marked skills are valid (one roll covers both).
11. `[STRUCTURAL]` All buttons and checkboxes have >= 44px touch targets.
12. `[BEHAVIORAL]` Skill value changes persist to IndexedDB immediately upon Pass.

## Implementation Steps

1. **Create EndOfSessionModal component** (`src/components/modals/EndOfSessionModal.tsx`):
   - Internal state: `step` (1-4), `sessionChecks`, `bonusAssignments`, `rollResults`.
   - Accept character data and skill list as props or via context.

2. **Step 1 — Session Checklist**:
   - Render checkboxes for: combat participation, explored new location, role-played weakness, used heroic ability.
   - Count checked items = number of bonus advancement rolls.
   - "Next" button (disabled if nothing to advance and no marks exist — show "Nothing to advance" message instead).

3. **Step 2 — Assign Bonus Rolls**:
   - Show N assignment slots (one per checked session event).
   - Each slot is a skill picker: show trained skills first, with "Show All" toggle.
   - Already-marked skills are valid targets (bonus + mark = one roll).
   - "Next" button proceeds to roll-through.

4. **Step 3 — Roll Through**:
   - Collect union of dragon-marked skills + bonus-assigned skills (deduplicated).
   - Present one skill at a time: skill name, current value, target number ("roll above {value} on d20").
   - Two buttons: "Pass" and "Fail".
   - Pass: increment `skill.value` by 1, clear `dragonMarked`, persist to IndexedDB immediately. Record result.
   - Fail: clear `dragonMarked` only. Record result.
   - Skill at value 18: auto-skip with "Already at maximum" message.
   - Auto-advance to next skill after each action.

5. **Step 4 — Summary**:
   - List each skill that was rolled, showing: advanced or not, new value.
   - "Done" button: clears all remaining dragon marks and advancement checks, closes modal.

6. **Handle empty state**: If no marks and no session checks, show "Nothing to advance this session" with Close button.

7. **Add hamburger menu trigger**: Add "End of Session" option to hamburger menu that opens the modal.

8. **Add CSS**: Styles for modal steps, checklist, skill picker, roll-through cards, summary in `theme.css`.

## Edge Cases
- No marks + no session checks: show "Nothing to advance this session" with Close button.
- Skill at value 18 (max): auto-skip with "Already at maximum" message.
- App closed mid-advancement: dragon marks persist in IndexedDB, user can re-trigger modal.
- Bonus roll assigned to already-marked skill: valid, one roll covers both.
- Rapid Pass/Fail tapping: state updates are synchronous, React batches correctly.
- All buttons and checkboxes >= 44px touch targets.

## Constraints
- New file `EndOfSessionModal.tsx`.
- Multi-step wizard uses internal component state for step tracking.
- Must handle empty advancement gracefully.
- No new npm dependencies.
- Component must not exceed 400 lines.
- Skill value changes persist immediately to IndexedDB.
- Reuse existing modal patterns if available.

## Verification Commands
```bash
# Build check
npx vite build

# Verify new file exists
ls src/components/modals/EndOfSessionModal.tsx

# Verify 4-step structure
grep -r "step.*1\|step.*2\|step.*3\|step.*4\|Session Checklist\|Assign.*Bonus\|Roll.*Through\|Summary" src/components/modals/EndOfSessionModal.tsx

# Verify hamburger menu trigger
grep -r "End.*Session\|EndOfSession" src/components/layout/

# Verify Pass/Fail logic
grep -r "Pass\|Fail\|increment\|dragonMarked" src/components/modals/EndOfSessionModal.tsx

# Verify touch targets in CSS
grep -r "44px\|min-height.*44\|min-width.*44" src/theme/theme.css
```
