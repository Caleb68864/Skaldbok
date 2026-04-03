# Phase Spec — SS-06: Rest Expiry Integration

**Run:** 2026-04-03T21-00-59-design-doc
**Sub-Spec ID:** SS-06
**Priority:** P2
**Dependency:** ⚠️ Requires the following to be complete first:
- **SS-01** — `TempModifier` type must exist
- **SS-05** — `BuffChipBar` and modifier CRUD handlers must be wired into SheetScreen

**Effort:** ~60 min

---

## Objective

Before applying a Round, Stretch, or Shift rest, check whether any active `tempModifiers` have a matching duration. If found, show a confirmation modal listing the expiring effects with two choices: "Remove & Rest" (removes them, then applies rest) or "Keep & Rest" (skips removal, applies rest). Both paths continue with the normal rest flow. Session log receives an entry for removed modifiers.

---

## Files to Modify

- `src/screens/SheetScreen.tsx` — add expiry check state and modal to the existing rest flow
- `src/utils/restActions.ts` — add `logModifierExpiry()` to session log if needed (agent decision)

---

## Implementation Steps

### Step 1 — Read existing rest flow

Read `src/screens/SheetScreen.tsx` fully (you may already have done this in SS-05) and identify:
- Where `roundRestOpen`, `stretchRestOpen`, `shiftRestOpen` (or equivalent) state booleans live
- How the rest modals are triggered (what buttons open them, what functions apply the rest)
- How `useSessionLog()` is used — what methods are available (e.g., `logRest`, `log`, etc.)
- The existing `Modal` primitive at `src/components/primitives/Modal.tsx` — read it to understand props

Also read `src/utils/restActions.ts` if rest logic is extracted there.

### Step 2 — Add expiry check state

Add to SheetScreen local state:

```typescript
const [expiryCheck, setExpiryCheck] = useState<{
  restType: 'round' | 'stretch' | 'shift';
  expiring: TempModifier[];
} | null>(null);
```

### Step 3 — Duration matching map

```typescript
const REST_DURATION_MAP: Record<'round' | 'stretch' | 'shift', TempModifier['duration']> = {
  round:   'round',
  stretch: 'stretch',
  shift:   'shift',
};
```

### Step 4 — Intercept the rest trigger

The existing flow has the user tap a rest button → rest modal or action fires. Add an intermediate check **before** the rest modal opens:

Create a `handleRestWithExpiryCheck` function for each rest type (or a single function parameterized by rest type):

```typescript
const handleRestWithExpiryCheck = (restType: 'round' | 'stretch' | 'shift') => {
  const matchingDuration = REST_DURATION_MAP[restType];
  const expiring = (character.tempModifiers ?? []).filter(
    m => m.duration === matchingDuration
  );

  if (expiring.length > 0) {
    // Show expiry check modal first
    setExpiryCheck({ restType, expiring });
  } else {
    // No matching modifiers — proceed with existing rest flow unchanged
    openRestModal(restType);   // call whatever currently opens the rest modal
  }
};
```

Replace the rest button `onClick` handlers (or wherever the rest action is triggered) with calls to `handleRestWithExpiryCheck('round')`, etc.

**Important:** Only intercept the button/trigger — the rest application logic itself must remain unchanged.

### Step 5 — "Remove & Rest" handler

```typescript
const handleRemoveAndRest = () => {
  if (!expiryCheck) return;
  const { restType, expiring } = expiryCheck;

  // Remove expiring modifiers
  const remainingModifiers = (character.tempModifiers ?? []).filter(
    m => m.duration !== REST_DURATION_MAP[restType]
  );
  updateCharacter({ tempModifiers: remainingModifiers });

  // Log each removed modifier to session log
  expiring.forEach(mod => {
    logModifierExpiry(mod.label, restType);   // see Step 7
  });

  // Close expiry modal and proceed with rest
  setExpiryCheck(null);
  openRestModal(restType);
};
```

### Step 6 — "Keep & Rest" handler

```typescript
const handleKeepAndRest = () => {
  if (!expiryCheck) return;
  const { restType } = expiryCheck;

  // No modifier removal — just proceed with rest
  setExpiryCheck(null);
  openRestModal(restType);
};
```

### Step 7 — Session log for modifier expiry

Check what methods `useSessionLog()` exposes. Options (agent decides):

- **Option A:** If `logRest()` exists and accepts optional metadata, pass modifier info there
- **Option B:** If there's a generic `log(entry)` function, use it to log `"[modifier.label] expired (${restType} rest)"`
- **Option C:** Add `logModifierExpiry(label: string, restType: string)` to `useSessionLog` hook — within agent authority

Keep the log entry concise and scannable: `"Power Fist expired (round rest)"` is a good format.

### Step 8 — Expiry check modal JSX

Add this modal to SheetScreen's render tree (alongside existing rest modals):

```tsx
<Modal
  open={expiryCheck !== null}
  onClose={() => setExpiryCheck(null)}
  title="Modifiers Expiring"
>
  <p>The following modifiers will expire after this rest:</p>
  <ul>
    {expiryCheck?.expiring.map(mod => (
      <li key={mod.id}>
        <strong>{mod.label}</strong>
        {' — '}
        {mod.effects.map(e => `${e.stat.toUpperCase()} ${e.delta >= 0 ? '+' : ''}${e.delta}`).join(', ')}
      </li>
    ))}
  </ul>
  <button
    onClick={handleRemoveAndRest}
    style={{ minHeight: 48 }}
  >
    Remove &amp; Rest
  </button>
  <button
    onClick={handleKeepAndRest}
    style={{ minHeight: 48 }}
  >
    Keep &amp; Rest
  </button>
</Modal>
```

Use the existing `Modal` primitive — adjust props to match what `src/components/primitives/Modal.tsx` actually accepts.

---

## Duration Rules

| Rest Type | Modifier durations that trigger the expiry check |
|-----------|--------------------------------------------------|
| Round Rest | `'round'` only |
| Stretch Rest | `'stretch'` only |
| Shift Rest | `'shift'` only |
| Any rest | `'scene'` — **NEVER auto-prompted** |
| Any rest | `'permanent'` — **NEVER auto-prompted** |

---

## Constraints

- Do **NOT** change the rest application logic itself — only intercept the trigger
- The existing rest flow when no matching modifiers exist must be **completely unchanged** (no new modal, no delay)
- `'scene'` and `'permanent'` modifiers must **never** appear in the expiry check
- Use the existing `Modal` primitive — do not create a new modal component
- All buttons in the modal must meet 48px touch target requirement

---

## Acceptance Criteria

- [ ] Round Rest: shows expiry dialog if any `duration === 'round'` modifiers are active
- [ ] Stretch Rest: shows expiry dialog if any `duration === 'stretch'` modifiers are active
- [ ] Shift Rest: shows expiry dialog if any `duration === 'shift'` modifiers are active
- [ ] "Remove & Rest": removes matched modifiers from `tempModifiers`, then proceeds with rest normally
- [ ] "Keep & Rest": skips removal, proceeds with rest normally
- [ ] Existing rest flow is **completely unchanged** when no matching modifiers exist (no dialog, no interruption)
- [ ] `'scene'` and `'permanent'` modifiers are **never** shown in expiry dialog
- [ ] Removed modifiers are logged to session log (concise format: `"[label] expired ([restType] rest)"`)
- [ ] Uses existing `Modal` primitive from `src/components/primitives/Modal.tsx`
- [ ] All buttons in expiry modal meet 48px minimum touch target
- [ ] `tsc --noEmit` passes after this change

---

## Verification Steps

1. Run `tsc --noEmit` — expect zero errors
2. Add a "Round" duration modifier → trigger Round Rest → expiry dialog appears listing that modifier
3. Choose "Remove & Rest" → modifier removed, rest applied, session log contains entry
4. Add a "Scene" duration modifier → trigger Round Rest → NO expiry dialog (scene modifier excluded)
5. Add a "Round" modifier → trigger Stretch Rest → NO expiry dialog (wrong duration match)
6. With no active modifiers → trigger any rest → rest proceeds immediately, no dialog
7. Choose "Keep & Rest" → modifier remains in chip bar, rest applied normally

---

## Notes for Worker Agent

- Read `src/components/primitives/Modal.tsx` before implementing the modal JSX — `onClose`, `open`, `title` may differ.
- The phrase "openRestModal(restType)" in the implementation steps is pseudocode — you need to find the actual function/state setter that triggers the existing rest modal. It may be `setRoundRestOpen(true)` or similar.
- If the rest action is applied immediately (no confirmation modal — just a function call), then "open rest modal" means "call the rest function." Adapt accordingly.
- Session log: prefer the simplest approach that doesn't require new external deps. A `console.log` fallback is not acceptable — it must actually appear in the session log visible to the user.
