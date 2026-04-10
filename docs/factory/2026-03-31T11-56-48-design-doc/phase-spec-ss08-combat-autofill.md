# Phase Spec — SS-08: Combat Event Form Auto-Fill

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 2 (Features + Key UX)
**Item:** 8 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** Tier 1 items (SS-01 through SS-04) should be complete before starting Tier 2 items. SS-05 through SS-08 may be implemented concurrently within Tier 2.

---

## Intent

Reduce friction when logging combat events by pre-filling the "Actor" field with the active character's name and pre-filling "Label" with a sensible default derived from the selected event type. Both fields remain fully overridable by the user.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/features/combat/CombatTimeline.tsx` | Modify — pre-fill Actor and Label fields on form mount / event type change |

> No other files should be modified. If any other file requires changes, escalate to human before proceeding.

---

## Implementation Steps

1. **Read** `src/features/combat/CombatTimeline.tsx` in full before writing any code.
2. **Identify:**
   - The combat event form (the form used to log a new event to the timeline).
   - The "Actor" field (text input or select).
   - The "Label" field (text input or similar).
   - The event type selector/field.
   - How `ActiveCharacterContext` (or equivalent) is currently used or imported.
3. **Pre-fill "Actor" field:**
   - Read the active character's display name from `ActiveCharacterContext`.
   - Set the "Actor" field's default/initial value to the active character name on form mount.
   - Use controlled component pattern: initialize the `actor` state variable to `activeCharacter.name` (or equivalent).
4. **Pre-fill "Label" field based on event type:**
   - Define a mapping from event type to default label, e.g.:
     ```ts
     const DEFAULT_LABELS: Record<string, string> = {
       attack: 'Attack',
       defend: 'Defend',
       damage: 'Damage',
       // ... add others as appropriate for the existing event type enum/union
     }
     ```
   - On form mount and on event type change: set `label` state to `DEFAULT_LABELS[eventType] ?? ''`.
   - Use a `useEffect` that depends on the event type value to update the label when the type changes.
5. **Overridability:**
   - Both fields use controlled component pattern (`value` + `onChange`).
   - User edits update the state directly — pre-fills are only set as initial values or on type change, not on every render.
   - On submit: persist exactly what is in the form state (user's current values, not defaults).
6. Run `tsc -b` — fix all type errors before committing.
7. Spot-check at 360px viewport: open combat event form, verify Actor and Label are pre-filled. Change event type, verify Label updates. Override both fields, submit, verify persisted values match the override.
8. Commit with a descriptive message referencing Item 8.

---

## Acceptance Criteria

- [ ] **AC8.1** — "Actor" field is pre-filled with the active character's name when the combat event form opens.
- [ ] **AC8.2** — "Label" field is pre-filled based on the selected event type when the form opens.
- [ ] **AC8.3** — User can override both pre-filled values before submitting.
- [ ] **AC8.4** — Submitting the form persists the user's entered values (not the defaults if overridden).
- [ ] **AC8.5** — `tsc -b` reports zero new type errors after this change.

---

## Verification Commands

```bash
# Type-check
tsc -b
```

**Manual spot-check checklist (360px viewport):**
- [ ] Open combat event form → "Actor" shows active character name.
- [ ] Open combat event form → "Label" shows default label for current event type.
- [ ] Change event type → "Label" updates to match new type default.
- [ ] Clear and retype "Actor" → changed value persists on submit.
- [ ] Clear and retype "Label" → changed value persists on submit.
- [ ] Submit with defaults untouched → default values are saved correctly.

---

## Constraints (Never Violate)

- No Dexie schema version bump.
- No new npm dependencies.
- No changes to the `CombatTimeline` prop interface (escalate if needed).
- All inline styles must use `var(--color-*)` CSS custom properties (no raw hex/rgb).
- Touch targets ≥ 44×44px on all form elements.

---

## Shortcuts

- Use `ActiveCharacterContext` (already available in the session/combat context tree).
- Commit after this item for bisectability.
