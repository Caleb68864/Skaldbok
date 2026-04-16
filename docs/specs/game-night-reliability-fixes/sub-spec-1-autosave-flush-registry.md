---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 1
title: "autosaveFlush registry module"
dependencies: []
phase: 1
---

# Sub-Spec 1: `autosaveFlush` Registry Module

## Scope

Create a shared flush registry at `src/features/persistence/autosaveFlush.ts`. Debounced-save hooks register a flush fn; lifecycle operations (`endSession`, `clearCharacter`, etc.) call `flushAll()` to wait for pending writes before mutating state.

## Files

- `src/features/persistence/autosaveFlush.ts` (new)
- `src/features/persistence/autosaveFlush.test.ts` (new, if project has tests — check first)

## Interface Contracts

### `registerFlush`
- Direction: Sub-spec 1 → Sub-spec 2 (useAutosave), Sub-spec 3 (NoteEditor), Sub-spec 6 (CombatEncounterView)
- Owner: Sub-spec 1
- Shape: `registerFlush(fn: () => Promise<void>): { id: string; unregister: () => void }`

### `flushAll`
- Direction: Sub-spec 1 → Sub-spec 6 (all lifecycle consumers)
- Owner: Sub-spec 1
- Shape: `flushAll(): Promise<PromiseSettledResult<void>[]>`

## Implementation Steps

1. **Check for existing test infra.** `git grep -l "\.test\.\|__tests__" src/features/ | head -5` to see if the project uses co-located `*.test.ts` or a `__tests__/` folder. Mirror the existing convention. If no tests exist in `src/features/`, skip the test file for now and rely on downstream sub-specs' behavioral tests.

2. **Create the module skeleton.** `src/features/persistence/autosaveFlush.ts`:
   - Module-level `Map<string, () => Promise<void>>` named `registry`.
   - Import `generateId` from `../../utils/ids`.
   - Export `registerFlush(fn): { id, unregister }` — generates id, sets `registry.set(id, fn)`, returns `{ id, unregister: () => registry.delete(id) }`.
   - Export `flushAll(): Promise<PromiseSettledResult<void>[]>` — snapshots `Array.from(registry.values())`, calls each, wraps with `Promise.allSettled`, returns the result.
   - Top-of-file docstring (3-5 lines) explains the *why*: "Lifecycle operations like `endSession`, `clearCharacter`, and `deleteCharacter` need deterministic waits for pending debounced writes before mutating state. This registry is the single mechanism that makes that possible. Consumers register on mount and unregister on cleanup."

3. **Build check.** `npm run build` → exit 0.

4. **Commit.** Message: `feat(persistence): add autosaveFlush registry for lifecycle flush coordination`

## Verification Commands

```bash
# Build check
npm run build

# Module exists
test -f src/features/persistence/autosaveFlush.ts || echo "FAIL: module missing"

# Exports present
grep -q "export function registerFlush\|export const registerFlush" src/features/persistence/autosaveFlush.ts
grep -q "export function flushAll\|export const flushAll\|export async function flushAll" src/features/persistence/autosaveFlush.ts

# Docstring at top-of-file
head -20 src/features/persistence/autosaveFlush.ts | grep -q "registry\|lifecycle\|flush"
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| File exists and exports registerFlush/flushAll | [STRUCTURAL] | `test -f src/features/persistence/autosaveFlush.ts \|\| (echo "FAIL: module missing" && exit 1)` |
| Top-of-file docstring explains *why* | [STRUCTURAL] | `head -20 src/features/persistence/autosaveFlush.ts \| grep -qi "lifecycle\|endSession\|registry" \|\| (echo "FAIL: missing why-docstring" && exit 1)` |
| registerFlush signature returns { id, unregister } | [STRUCTURAL] | `grep -q "unregister" src/features/persistence/autosaveFlush.ts \|\| (echo "FAIL: registerFlush not returning unregister" && exit 1)` |
| flushAll uses Promise.allSettled | [STRUCTURAL] | `grep -q "allSettled" src/features/persistence/autosaveFlush.ts \|\| (echo "FAIL: flushAll not using allSettled" && exit 1)` |
| Registry snapshotted at flushAll entry (no late-unregister issue) | [STRUCTURAL] | `grep -q "Array\.from\|\.\.\.registry\|registry\.values" src/features/persistence/autosaveFlush.ts \|\| (echo "FAIL: registry not snapshotted" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
