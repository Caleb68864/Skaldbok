# Phase Spec — SS-07: Combat Encounter View (Timeline Migration)

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 1.4 — Feature A: Combat Encounter (Timeline Migration)
**Depends on:** SS-06 (Encounter feature), SS-04 (Repositories), SS-01 (Dexie v6 migration) must be completed first.
**Delivery order note:** Step 7 in execution sequence. Only switch session screen routing AFTER verifying this view matches the original.

---

## Objective

Build a new `CombatEncounterView` component for combat-type encounters that reads/writes encounter entities directly. The existing `CombatTimeline.tsx` (at `src/features/combat/CombatTimeline.tsx`) is **self-contained** — it accepts only `combatNoteId: string` and loads/saves data internally via `noteRepository`. It CANNOT be wrapped with an adapter. Instead, build a **new component** that reuses lower-level UI pieces (round display, event cards, participant chips) from the combat feature directory where possible, but reads from encounter entities.

**CRITICAL CONTEXT:** `CombatTimeline.tsx` takes `{ combatNoteId: string; onClose: () => void }` as props. It calls `getNoteById(combatNoteId)` internally and writes back to the note via `noteRepository.updateNote()`. There is NO way to pass encounter data as props. Do NOT attempt to wrap it.

---

## Files to Create

- `src/features/encounters/CombatEncounterView.tsx` — **create new** (reads encounter entity, not note)

## Files to Inspect (for reusable pieces)

- `src/features/combat/CombatTimeline.tsx` — read-only: inspect for reusable sub-components, styling patterns, and UI structure to replicate
- `src/features/combat/` — check for extracted sub-components (event cards, participant chips) that can be imported

---

## Implementation Steps

### Step 1: Inspect `src/features/combat/CombatTimeline.tsx` and sibling files

Read the full combat feature directory. Identify:
- Which sub-components (if any) are extracted and importable
- The visual structure: rounds list, event timeline, participant panel
- How HP tracking, initiative, and conditions are displayed
- The data shapes used internally (even though we won't call the component)

### Step 2: Build `CombatEncounterView.tsx` from scratch

This component takes an `Encounter` (with `type: 'combat'`) and renders a combat interface that reads/writes encounter data via `encounterRepository`. It should mirror the visual structure of CombatTimeline but operate on encounter entities.

```tsx
// src/features/encounters/CombatEncounterView.tsx
import { Encounter, EncounterParticipant } from '../../types/encounter';

interface CombatEncounterViewProps {
  encounter: Encounter;
  onClose: () => void;
}

export function CombatEncounterView({ encounter, onClose }: CombatEncounterViewProps) {
  // Load encounter data from encounterRepository (not noteRepository)
  // Render: participant list with HP/conditions, round counter, event timeline
  // Mutations go through encounterRepository.update()
  // Reuse any extracted sub-components from src/features/combat/ if available
}
```

Key features to implement:
- **Participant list** with name, HP, armor, conditions (reads from encounter.participants[].instanceState)
- **Round counter** (from encounter.combatData.currentRound)
- **Event log** (from encounter.combatData.events)
- **Stat drawer** on participant tap — shows linked creature template stats (read-only) + editable instance state
- **Add participant** action (from bestiary, party, or quick-create)

### Step 3: Integrate into `EncounterScreen.tsx` for combat type

In `EncounterScreen.tsx` (created in SS-06), add a conditional:
```tsx
{encounter.type === 'combat' ? (
  <CombatEncounterView encounter={encounter} onClose={() => navigate(-1)} />
) : (
  // social/exploration view — participant list + notes feed
)}
```

### Step 4: Session screen routing

Route combat encounters through `EncounterScreen → CombatEncounterView`. The old archived combat notes should still tap to the original `CombatTimeline` view (which reads from the note) for backward compatibility.

---

## Important Notes

- Do NOT modify `CombatTimeline.tsx` in any way
- Do NOT attempt to wrap or adapt `CombatTimeline` — it is self-contained with `combatNoteId`
- The correct path is `src/features/combat/CombatTimeline.tsx` (NOT `src/components/combat/`)
- Build a new component that reads encounter entities directly
- Reuse any extracted sub-components from `src/features/combat/` where possible

---

## Verification Commands

```bash
npx tsc --noEmit
npm run build
```

**Manual verification:**
- Migrated combat encounter renders `CombatTimeline` with correct rounds and events
- Participants show linked creature template stats in the participant drawer (from SS-06)
- Original `CombatTimeline.tsx` has zero diff (no file changes)
- Old archived combat notes remain accessible and renderable

---

## Acceptance Criteria

- [ ] Combat-type encounter renders `CombatTimeline` with rounds, events, and participants
- [ ] Participants in combat encounter show linked creature template stats in drawer
- [ ] `CombatTimeline.tsx` component props are unchanged (no interface modification — confirmed by zero diff on that file)
- [ ] Existing combat notes migrated in Dexie v6 render correctly as combat encounters via `CombatEncounterView`
- [ ] Original combat notes remain accessible as archived (can still be viewed)
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- **Critical:** `CombatTimeline.tsx` must not be modified in any way
- Adapt encounter data to match existing props — never the reverse
- If adaption is impossible without prop changes, escalate immediately
- No new npm dependencies
- Use existing UI components for any chrome around `CombatTimeline`
