# Phase Spec: SS-09 — AppStateContext Session State Extension

## Dependencies
- **None** — This is a foundational sub-spec. SS-03 (SkillsScreen Boon/Bane) depends on this.

## Objective
Extend `AppStateContext` with an ephemeral `sessionState` object for boon/bane tracking. This state lives in-memory only and resets on app restart.

## Requirements Covered
REQ-026

## Files to Modify
- `src/context/AppStateContext.tsx` — add `sessionState`, updater functions, TypeScript types
- `src/types/settings.ts` (or equivalent type file) — define `SessionState` type

## Acceptance Criteria
1. `[STRUCTURAL]` `AppStateContext` exposes `sessionState` with shape: `{ globalBoonBane: 'boon' | 'none' | 'bane', skillOverrides: Record<string, 'boon' | 'bane' | undefined> }`.
2. `[BEHAVIORAL]` `sessionState` is initialized to `{ globalBoonBane: 'none', skillOverrides: {} }` on app start.
3. `[BEHAVIORAL]` `sessionState` is NOT persisted to IndexedDB, localStorage, or any storage — it lives only in React state.
4. `[STRUCTURAL]` Context exposes `setGlobalBoonBane(value)` and `setSkillOverride(skillId, value)` updater functions.
5. `[BEHAVIORAL]` Existing consumers of `AppStateContext` are not broken — the `settings` shape and all existing functions remain unchanged.
6. `[STRUCTURAL]` TypeScript types are properly defined for `SessionState` and exported.

## Implementation Steps

1. **Define SessionState type**:
   - In appropriate types file (e.g., `src/types/settings.ts` or inline in AppStateContext):
   ```typescript
   export type BoonBaneState = 'boon' | 'none' | 'bane';

   export interface SessionState {
     globalBoonBane: BoonBaneState;
     skillOverrides: Record<string, 'boon' | 'bane' | undefined>;
   }
   ```

2. **Extend AppStateContext**:
   - Add `sessionState: SessionState` to the context value type.
   - Add `setGlobalBoonBane: (value: BoonBaneState) => void` to context value type.
   - Add `setSkillOverride: (skillId: string, value: 'boon' | 'bane' | undefined) => void` to context value type.

3. **Initialize in provider**:
   - Add `useState<SessionState>` with initial value `{ globalBoonBane: 'none', skillOverrides: {} }`.
   - This state is NOT included in any persistence/save logic.

4. **Implement updater functions**:
   - `setGlobalBoonBane`: updates `sessionState.globalBoonBane`.
   - `setSkillOverride`: updates `sessionState.skillOverrides[skillId]` — set value or delete key if undefined.

5. **Expose in context value**:
   - Add `sessionState`, `setGlobalBoonBane`, `setSkillOverride` to the context provider value object.
   - Ensure existing properties are unchanged.

6. **Verify no persistence leaks**:
   - Confirm `sessionState` is NOT referenced in any IndexedDB save, localStorage write, or Dexie operation.

## Edge Cases
- App restart: sessionState resets to defaults (by design — in-memory only).
- Screen navigation: sessionState persists because it lives in AppStateContext (React context survives navigation).
- Existing consumers: no breaking changes — sessionState is additive.
- Theme switch during session: no effect on sessionState.

## Constraints
- Minimal changes to existing context — `sessionState` is a sibling to `settings`, not nested inside it.
- No changes to existing `settings` state shape.
- No new npm dependencies.
- TypeScript types properly defined and exported.
- Must NOT persist to any storage.

## Verification Commands
```bash
# Build check
npx vite build

# Verify SessionState type
grep -r "SessionState\|BoonBaneState\|globalBoonBane\|skillOverrides" src/types/
grep -r "SessionState\|BoonBaneState\|globalBoonBane\|skillOverrides" src/context/AppStateContext.tsx

# Verify updater functions
grep -r "setGlobalBoonBane\|setSkillOverride" src/context/AppStateContext.tsx

# Verify no persistence of sessionState
grep -r "sessionState" src/context/AppStateContext.tsx

# Verify existing settings unchanged (spot check)
grep -r "settings" src/context/AppStateContext.tsx
```
