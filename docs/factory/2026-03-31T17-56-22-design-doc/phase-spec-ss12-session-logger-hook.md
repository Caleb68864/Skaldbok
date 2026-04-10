# Phase Spec — SS-12: useSessionLogger Hook
**Sub-Spec:** SPEC-B3-2
**Issue:** #7
**Batch:** 3 — Character Sheet Cleanup
**Dependency:** None — implement FIRST in Batch 3. SS-13 (Skills Page) and SS-15 (Coin Change Batching) both depend on this hook.

> ⚠️ **IMPLEMENT THIS SPEC FIRST IN BATCH 3.** SS-13 and SS-15 depend on this hook.

---

## Intent
Centralize all session event creation in a single reusable hook. All screens write events through `useSessionLogger`. The hook is NOT a new Context provider — it composes existing contexts.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Create | `src/features/session/useSessionLogger.ts` |
| Reference | `src/features/campaign/CampaignContext.tsx` — `useCampaign().activeCampaign`, `useCampaign().activeSession` |
| Reference | `src/storage/repositories/noteRepository.ts` — `createNote()` write path |
| Reference | `src/context/ToastContext.tsx` — `useToast()` for error toasts |

---

## Implementation Steps

1. **Read** `src/features/campaign/CampaignContext.tsx` to understand `activeCampaign` and `activeSession` shapes.
2. **Read** `src/storage/repositories/noteRepository.ts` to understand `createNote()` signature and the note data model.
3. **Read** `src/context/ToastContext.tsx` to understand `useToast().showToast(message, variant)`.
4. **Create** `src/features/session/useSessionLogger.ts`:

```ts
// Hook signature (guide — implement to match existing patterns in the codebase)
function useSessionLogger(): {
  logEvent(type: string, data: EventData): Promise<void>;
  logCoinChange(characterId: string, delta: { gold: number; silver: number; copper: number }): void;
  flushPending(): Promise<void>;
}
```

5. **Implement `logEvent`**:
   - Reads `activeSession` from `useCampaign()`.
   - Creates a structured note entry via `noteRepository.createNote()` containing: character name, event type, mechanical outcome, and timestamp.
   - If no active session, shows toast `"No active session"` (warning) and does not write.

6. **Implement `logCoinChange`**:
   - Uses a `useRef` buffer (keyed by `characterId`) to accumulate coin deltas.
   - Uses a `setTimeout` (3–5 second window — agent chooses, pick 4 seconds as default) to debounce rapid calls.
   - Each new call within the debounce window accumulates the delta and resets the timer.
   - On timer fire: calls `flushPending()`.

7. **Implement `flushPending`**:
   - Iterates the buffer, writes one net-change note entry per character via `noteRepository.createNote()`.
   - Clears the buffer and any pending timers.

8. **Add** `useEffect` cleanup in the hook: on unmount, call `flushPending()` to ensure no buffered events are lost when the user navigates away.

9. **Verify** the hook does NOT create a new React Context or Provider — it composes `useCampaign()` and `useToast()` internally.

---

## Acceptance Criteria

- [ ] **B3-2-AC1:** `useSessionLogger` hook is importable from `src/features/session/useSessionLogger.ts`.
- [ ] **B3-2-AC2:** `logEvent` creates a note entry in Dexie with correct type, character, outcome, and timestamp.
- [ ] **B3-2-AC3:** `logCoinChange` buffers rapid calls and writes a single net-change entry after debounce window.
- [ ] **B3-2-AC4:** Navigating away flushes any pending coin events (useEffect cleanup runs `flushPending`).
- [ ] **B3-2-AC5:** Hook does not create a new Context provider.

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
- `noteRepository.createNote()` signature does not support the structured event data shape needed without a Dexie schema change.
