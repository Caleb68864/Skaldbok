# Phase Spec — SS-15: Coin Change Batching / Debounce
**Sub-Spec:** SPEC-B4-2
**Issue:** #8
**Batch:** 4 — Feedback & Guards
**Dependency:** SS-12 (`useSessionLogger` hook with `logCoinChange`) MUST be complete before implementing this spec.

---

## Intent
Rapid coin-tap sequences (e.g., gold +10 fast) produce a single session log entry with the net change, not 10 separate entries. Ending the session flushes any buffered coin events before the session closes.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Read & modify | Coin change UI components — Shopping action drawer (in `src/features/session/actions/ShoppingDrawer.tsx` after SS-03 extraction) and character sheet coin fields (search for coin/gold/silver/copper input in `src/features/character/`) |
| Reference | `src/features/session/useSessionLogger.ts` (from SS-12) — `logCoinChange()` and `flushPending()` |
| Reference | `src/features/campaign/CampaignContext.tsx` — `endSession()` or equivalent session-end hook |

---

## Implementation Steps

1. **Read** each coin change UI component to understand how coin changes are currently fired (onChange events, stepper callbacks, etc.).
2. **Replace** any direct Dexie write for coin change logging with a call to `useSessionLogger().logCoinChange(characterId, delta)` on each tap/change event.
   - Each individual tap passes its delta (e.g., `{ gold: 1, silver: 0, copper: 0 }`).
   - The debounce logic inside `useSessionLogger` accumulates these into a single net-change entry.
3. **Verify** the debounce window in `useSessionLogger` is 3–5 seconds (default 4 seconds as set in SS-12). Adjust via a named constant if needed.
4. **Wire session-end flush**: find where `endSession()` (or equivalent) is called in `CampaignContext` or the session end UI. Ensure `flushPending()` is called before the session record is closed. Options:
   - Call `flushPending()` in the session-end handler before calling `endSession()`.
   - Or add a callback/event in `CampaignContext` that components can register to flush before session ends.
5. Confirm the log entry format written on flush: `"{CharacterName} gained/lost {net} gold [silver] [copper]"` as a single note entry.

---

## Acceptance Criteria

- [ ] **B4-2-AC1:** Tapping gold up 10 times rapidly produces a single session log entry with the net change.
- [ ] **B4-2-AC2:** Ending a session while coins are buffered flushes the buffer before the session closes.

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
- Functional pattern — no classes.

---

## Escalation Triggers

Pause and request human input if:
- `CampaignContext.endSession()` does not provide a hook or callback mechanism to flush before closing, and adding one would require significant refactoring.
