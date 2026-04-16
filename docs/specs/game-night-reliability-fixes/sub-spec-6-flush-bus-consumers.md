---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 6
title: "Flush-bus consumer wiring + combat flush"
dependencies: [1, 2, 3]
phase: 1
tag: "[INTEGRATION]"
---

# Sub-Spec 6: Flush-Bus Consumer Wiring + Combat Flush `[INTEGRATION]`

## Scope

Wire `flushAll()` into all four lifecycle operations that mutate session or character state. Register a combat-participant flush so in-flight HP updates land before session-end. This is the sub-spec that actually closes the data-loss loop end-to-end for Phase 1.

## Files

- `src/screens/SessionScreen.tsx` (modified — `confirmEndSession` awaits `flushAll()`, End Session button disabled during flush)
- `src/screens/SettingsScreen.tsx` (modified — document redundant-flush as safe no-op via comment)
- `src/context/ActiveCharacterContext.tsx` (modified — `clearCharacter` awaits `flushAll()` before mutation)
- `src/features/characters/useCharacterActions.ts` (modified — `deleteCharacter` awaits `flushAll()` when deleting non-active character; relies on `clearCharacter`'s flush when deleting active)
- `src/features/encounters/CombatEncounterView.tsx` (modified — registers a flush for in-flight participant update)

## Interface Contracts

### Consumes `flushAll` (from Sub-spec 1)
- Implements contract from Sub-spec 1
- Call sites: `SessionScreen.confirmEndSession`, `SettingsScreen.handleClearAll`, `ActiveCharacterContext.clearCharacter`, `useCharacterActions.deleteCharacter`

### Consumes `registerFlush` (from Sub-spec 1)
- Implements contract from Sub-spec 1
- Call site: `CombatEncounterView.tsx`'s in-flight participant-update tracking

## Implementation Steps

1. **Add `flushAll` imports** to the four lifecycle files:
   - `SessionScreen.tsx`: `import { flushAll } from '../features/persistence/autosaveFlush';`
   - `SettingsScreen.tsx`: same import
   - `ActiveCharacterContext.tsx`: same import
   - `useCharacterActions.ts`: same import

2. **Modify `ActiveCharacterContext.clearCharacter`**:
   ```ts
   const clearCharacter = useCallback(async () => {
     await flushAll();  // New — wait for any pending character autosave
     setCharacterState(null);
     await updateSettings({ activeCharacterId: null });
   }, [updateSettings]);
   ```

3. **Modify `SessionScreen.confirmEndSession`.** Add in-flight state and button disable. The exact shape depends on the existing function; add at minimum:
   ```ts
   const [endingSession, setEndingSession] = useState(false);
   // ...
   async function confirmEndSession() {
     setEndingSession(true);
     try {
       const results = await flushAll();
       const rejected = results.filter(r => r.status === 'rejected');
       if (rejected.length > 0) {
         console.error('[end-session] flush failures:', rejected);
         showToast('Couldn\'t save changes — session not ended. Try again.', 'error');
         return;
       }
       // ... existing endActiveEncounter + endSession calls ...
     } finally {
       setEndingSession(false);
     }
   }
   ```
   Then thread `disabled={endingSession}` into the End Session button. Verify the button's existing JSX — add `disabled` and optionally a loading indicator.

4. **Modify `SettingsScreen.handleClearAll`.** The function already calls `await clearCharacter()` (per today's commit). Since `clearCharacter` now flushes, handleClearAll inherits the flush for free. Add one comment near the clearCharacter call:
   ```ts
   // clearCharacter() above already awaits flushAll(); no double-flush needed here.
   ```

5. **Modify `useCharacterActions.deleteCharacter`**:
   ```ts
   async function deleteCharacter(id: string) {
     if (activeCharacter?.id === id) {
       await clearCharacter();  // clearCharacter flushes internally
     } else {
       await flushAll();  // Non-active character: still flush so a pending autosave for it lands before delete
     }
     await db.partyMembers.where('linkedCharacterId').equals(id).delete();
     await characterRepository.remove(id);
   }
   ```

6. **Register CombatEncounterView's flush.** In `src/features/encounters/CombatEncounterView.tsx`:
   - `encounter` in the snippet below is the same prop/state the component already has in scope — the one used by existing handlers (`handleUpdateParticipantState` at line 107+ already references `encounter.id`). No new prop needed.
   - Add import: `import { registerFlush } from '../persistence/autosaveFlush';` (adjust relative path from the encounters folder; likely `'../../features/persistence/autosaveFlush'`).
   - Add a ref: `const inFlightParticipantUpdateRef = useRef<Promise<void> | null>(null);`.
   - Modify `handleUpdateParticipantState` to store the in-flight promise:
     ```ts
     const handleUpdateParticipantState = async (participantId: string, patch: Partial<EncounterParticipantState>) => {
       const updatePromise = encounterRepository.updateParticipant(encounter.id, participantId, patch);
       inFlightParticipantUpdateRef.current = updatePromise.then(() => { inFlightParticipantUpdateRef.current = null; });
       await updatePromise;
       await refresh();
     };
     ```
   - Add the bus registration effect near the hook's other effects:
     ```ts
     useEffect(() => {
       const { unregister } = registerFlush(async () => {
         if (inFlightParticipantUpdateRef.current) {
           await inFlightParticipantUpdateRef.current;
         }
       });
       return unregister;
     }, []);
     ```

7. **Build check.** `npm run build` → exit 0.

8. **Playwright smoke.** `npx --yes --package playwright node output/playwright/session_smoke.cjs` → `SESSION_SMOKE_PASS`.

9. **Regression probe — the original bug.** Manually: edit a session note, click End Session immediately, reload. Verify the note text persisted. Then: type in a character field, click Clear All Data, confirm DELETE, reload. Verify NO zombie character row.

10. **Commit.** Message: `feat(lifecycle): wire flushAll into session/character lifecycle operations`

## Verification Commands

```bash
npm run build
npx --yes --package playwright node output/playwright/session_smoke.cjs

# All four call sites present
grep -q "await flushAll()" src/screens/SessionScreen.tsx
grep -q "await flushAll()" src/context/ActiveCharacterContext.tsx
grep -q "await flushAll()" src/features/characters/useCharacterActions.ts

# CombatEncounterView registered
grep -q "registerFlush(" src/features/encounters/CombatEncounterView.tsx

# End Session button has disabled wiring
grep -q "endingSession\|isEndingSession" src/screens/SessionScreen.tsx
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| SessionScreen awaits flushAll | [STRUCTURAL] | `grep -q "await flushAll()" src/screens/SessionScreen.tsx \|\| (echo "FAIL: SessionScreen not calling flushAll" && exit 1)` |
| ActiveCharacterContext.clearCharacter awaits flushAll | [STRUCTURAL] | `grep -q "await flushAll()" src/context/ActiveCharacterContext.tsx \|\| (echo "FAIL: clearCharacter not flushing" && exit 1)` |
| useCharacterActions.deleteCharacter awaits flush | [STRUCTURAL] | `grep -q "await flushAll()\|await clearCharacter()" src/features/characters/useCharacterActions.ts \|\| (echo "FAIL: deleteCharacter not flushing" && exit 1)` |
| SettingsScreen comments redundant flush | [STRUCTURAL] | `grep -q "double-flush\|already awaits flushAll" src/screens/SettingsScreen.tsx \|\| (echo "FAIL: SettingsScreen missing flush comment" && exit 1)` |
| CombatEncounterView registered with bus | [STRUCTURAL] | `grep -q "registerFlush(" src/features/encounters/CombatEncounterView.tsx \|\| (echo "FAIL: CombatEncounterView not registered" && exit 1)` |
| End Session button has disabled state | [STRUCTURAL] | `grep -qE "endingSession\|isEndingSession" src/screens/SessionScreen.tsx \|\| (echo "FAIL: End Session button disable state missing" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Playwright session smoke passes | [MECHANICAL] | `npx --yes --package playwright node output/playwright/session_smoke.cjs 2>&1 \| tail -3 \| grep -q "SESSION_SMOKE_PASS" \|\| (echo "FAIL: session smoke regression" && exit 1)` |
