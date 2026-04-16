---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 3
title: "NoteEditor pendingUpdatesRef + bus registration"
dependencies: [1]
phase: 1
---

# Sub-Spec 3: NoteEditor `pendingUpdatesRef` + Bus Registration

## Scope

Rework `src/screens/NoteEditorScreen.tsx` to track pending edits in a ref so both the debounce timer and the flush-bus callback can replay them. Fix the root bug at lines 158-162 where the current unmount effect clears the timer but never fires a final save, causing notes to drop on any fast navigation.

## Files

- `src/screens/NoteEditorScreen.tsx` (modified)

## Interface Contracts

### Consumes `registerFlush` (from Sub-spec 1)
- Implements contract from Sub-spec 1

## Implementation Steps

1. **Read the current file.** Key lines to understand:
   - Line 142-155: `scheduleAutosave(updates)` — the current debounce closure captures `updates` at call time.
   - Lines 157-162: `useEffect` cleanup only clears the timer, never saves.
   - The `handleTitleChange`, `handleBodyChange`, etc. handlers call `scheduleAutosave({ title: newTitle })` etc.

2. **Introduce `pendingUpdatesRef`.** After existing `useRef` calls, add:
   ```ts
   const pendingUpdatesRef = useRef<Partial<Note>>({});
   ```

3. **Rewrite `scheduleAutosave`.** Remove the `updates` parameter. The handlers now merge updates into the ref directly, then call the (param-less) scheduler:
   ```ts
   const scheduleAutosave = useCallback(() => {
     if (!note) return;
     if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
     saveTimerRef.current = setTimeout(async () => {
       if (!pendingUpdatesRef.current || Object.keys(pendingUpdatesRef.current).length === 0) return;
       setSaving(true);
       try {
         await updateNote(note.id, pendingUpdatesRef.current);
         pendingUpdatesRef.current = {};
       } catch (e) {
         console.error('NoteEditorScreen: autosave failed', e);
       } finally {
         setSaving(false);
       }
     }, 800);
   }, [note]);
   ```

4. **Update every `handle*Change`.** Each handler writes into `pendingUpdatesRef.current` alongside `setState`, then calls `scheduleAutosave()` (no args):
   ```ts
   const handleTitleChange = (newTitle: string) => {
     setTitle(newTitle);
     pendingUpdatesRef.current = { ...pendingUpdatesRef.current, title: newTitle };
     scheduleAutosave();
   };
   // Same pattern for handleBodyChange, handleTagsChange, handleTypeChange
   ```

5. **Add the flush-bus registration + unmount flush — register ONCE, read state by ref.** To honor SS-2's stability contract (register once on mount with empty deps), the flush closure reads the current note via a ref, not via closed-over state. Add a `noteRef` that tracks the current note:
   ```ts
   const noteRef = useRef<Note | null>(null);

   // Keep noteRef in sync with note state (existing setNote calls remain — no changes needed,
   // just add a small effect that mirrors state into the ref):
   useEffect(() => {
     noteRef.current = note;
   }, [note]);

   // Register once, read from refs at flush time:
   useEffect(() => {
     const flush = async () => {
       if (saveTimerRef.current) {
         clearTimeout(saveTimerRef.current);
         saveTimerRef.current = null;
       }
       const currentNote = noteRef.current;
       const pending = pendingUpdatesRef.current;
       if (currentNote && pending && Object.keys(pending).length > 0) {
         try {
           await updateNote(currentNote.id, pending);
           pendingUpdatesRef.current = {};
         } catch (e) {
           console.error('NoteEditorScreen: flush failed', e);
         }
       }
     };
     const { unregister } = registerFlush(flush);
     return () => {
       unregister();
       // Unmount also awaits a final flush — navigation between screens saves pending edits.
       flush();
     };
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
   ```
   This mirrors SS-2's stability contract exactly: register once, read everything state-dependent via refs at flush time.

6. **Add import.** Top of file: `import { registerFlush } from '../features/persistence/autosaveFlush';`.

7. **Remove the old cleanup-only effect** (the one at lines 157-162 in the original file) — its job is now subsumed by step 5.

8. **Build check.** `npm run build` → exit 0.

9. **Commit.** Message: `fix(notes): persist pending edits via ref + flush bus registration`

## Verification Commands

```bash
npm run build

# pendingUpdatesRef exists
grep -q "pendingUpdatesRef" src/screens/NoteEditorScreen.tsx

# Bus registration exists
grep -q "registerFlush(" src/screens/NoteEditorScreen.tsx

# Unmount cleanup calls flush
grep -B2 "return () => {" src/screens/NoteEditorScreen.tsx | grep -q "flush\(\)\|unregister\(\)"
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| pendingUpdatesRef declared | [STRUCTURAL] | `grep -q "pendingUpdatesRef" src/screens/NoteEditorScreen.tsx \|\| (echo "FAIL: pendingUpdatesRef missing" && exit 1)` |
| Registers with flush bus | [STRUCTURAL] | `grep -q "registerFlush(" src/screens/NoteEditorScreen.tsx \|\| (echo "FAIL: not registered with bus" && exit 1)` |
| noteRef declared for stable flush access | [STRUCTURAL] | `grep -q "noteRef" src/screens/NoteEditorScreen.tsx \|\| (echo "FAIL: noteRef missing; flush closure would use stale state" && exit 1)` |
| Handlers merge into ref not pass updates | [STRUCTURAL] | `grep -q "pendingUpdatesRef.current = { ...pendingUpdatesRef.current" src/screens/NoteEditorScreen.tsx \|\| (echo "FAIL: handlers not merging into ref" && exit 1)` |
| Imports registerFlush | [STRUCTURAL] | `grep -q "from '../features/persistence/autosaveFlush'" src/screens/NoteEditorScreen.tsx \|\| (echo "FAIL: import missing" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
