# Phase Spec — SS-02: Coin Calculator Widget
**Sub-Spec:** SPEC-B1-2
**Issue:** #3
**Batch:** 1 — Session UX Core
**Dependency:** None (can run in parallel with SS-01)

---

## Intent
Replace the plain text cost field in the Shopping quick action with a structured coin picker that computes totals in real time and normalizes denominations.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Create (new component) | `src/features/session/actions/CoinCalculator.tsx` |
| Modify | `src/features/session/SessionQuickActions.tsx` (Shopping drawer section) |
| Reference (do not break) | `src/components/primitives/CounterControl.tsx` |

---

## Implementation Steps

1. **Read** `src/components/primitives/CounterControl.tsx` to understand its props API (min, max, step, value, onChange).
2. **Create** `src/features/session/actions/CoinCalculator.tsx`:
   - `CounterControl` for **Quantity** (min 1)
   - `CounterControl` for **Gold** (min 0)
   - `CounterControl` for **Silver** (min 0)
   - `CounterControl` for **Copper** (min 0)
   - Computed total display string: `"{qty}x {g}g {s}s {c}c = {total_g}g {total_s}s {total_c}c"`
   - Normalization: 50 copper → 1 silver; 10 silver → 1 gold (apply after each stepper change)
   - Expose prop: `onChange: (value: { gold: number; silver: number; copper: number }) => void`
   - CoinCalculator does **NOT** deduct coins itself — caller (Shopping action) owns that logic.
3. **Replace** the plain cost input in the Shopping quick action drawer (inside `SessionQuickActions.tsx`) with `<CoinCalculator onChange={...} />`.
4. Wire the `onChange` callback so the Shopping action receives the total coin value to deduct.

---

## Acceptance Criteria

- [ ] **B1-2-AC1:** Shopping quick action shows Gold, Silver, Copper steppers and a Quantity stepper.
- [ ] **B1-2-AC2:** Total calculation updates in real time and normalizes coin denominations (50c → 1s, 10s → 1g).
- [ ] **B1-2-AC3:** CoinCalculator does NOT deduct coins itself — Shopping action owns that logic.

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit
```

---

## Cross-Cutting Constraints

- No new npm dependencies.
- No Dexie schema version bump.
- All CSS via CSS variables — no hardcoded colors.
- All touch targets ≥ 44 px.

---

## Escalation Triggers

Pause and request human input if:
- `CounterControl` does not support the required `min`/`max`/`step` props and cannot be extended without risk of breaking other usages.
