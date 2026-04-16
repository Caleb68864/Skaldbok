---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 2
title: "useAutosave registers with flush bus"
dependencies: [1]
phase: 1
---

# Sub-Spec 2: `useAutosave` Bus Registration

## Scope

Modify `src/hooks/useAutosave.ts` to register its flush callback with the `autosaveFlush` bus on mount and unregister on unmount. Preserve existing debounce and unmount-flush behavior. Document the stable-`saveFn` caller contract.

## Files

- `src/hooks/useAutosave.ts` (modified)

## Interface Contracts

### Consumes `registerFlush` (from Sub-spec 1)
- Implements contract from Sub-spec 1
- Call site: a new `useEffect(() => { const { unregister } = registerFlush(...); return unregister; }, [])` inside the hook.

## Implementation Steps

1. **Read current file state.** Familiarize: the hook already has a `pendingRef` and unmount-flush logic at lines 52-63. The new bus registration layers on top of this — don't remove or restructure the existing logic.

2. **Add import.** At the top: `import { registerFlush } from '../features/persistence/autosaveFlush';`.

3. **Add the bus registration effect.** After the existing debounce `useEffect` and before the unmount-flush effect, insert:

   ```ts
   useEffect(() => {
     const { unregister } = registerFlush(async () => {
       if (pendingRef.current) {
         await saveFn(pendingRef.current);
         pendingRef.current = null;
       }
     });
     return unregister;
     // Register once; the closure reads pendingRef.current (stable ref) at flush time.
     // saveFn must be a stable reference (module-level fn or memoized callback);
     // inline arrows captured here will go stale.
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
   ```

4. **Verify stability comment survives eslint.** Add the `react-hooks/exhaustive-deps` disable comment so the empty-dep `useEffect` doesn't trigger a warning. Same pattern used at line 50 of the same file today.

5. **Build check.** `npm run build` → exit 0. If any consumer using inline-arrow `saveFn` exists, TypeScript will still compile (contract is documented, not enforced).

6. **Commit.** Message: `feat(autosave): register debounced saves with flush bus on mount`

## Verification Commands

```bash
npm run build

# Registration happens once with empty deps
grep -q "registerFlush(" src/hooks/useAutosave.ts

# Stability contract comment present
grep -q "saveFn must be a stable reference\|stable reference (module-level" src/hooks/useAutosave.ts
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Imports registerFlush | [STRUCTURAL] | `grep -q "from '../features/persistence/autosaveFlush'" src/hooks/useAutosave.ts \|\| (echo "FAIL: registerFlush import missing" && exit 1)` |
| Registration effect present | [STRUCTURAL] | `grep -q "registerFlush(" src/hooks/useAutosave.ts \|\| (echo "FAIL: registerFlush not called" && exit 1)` |
| Stability comment in file | [STRUCTURAL] | `grep -q "stable reference" src/hooks/useAutosave.ts \|\| (echo "FAIL: stability contract not documented" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
