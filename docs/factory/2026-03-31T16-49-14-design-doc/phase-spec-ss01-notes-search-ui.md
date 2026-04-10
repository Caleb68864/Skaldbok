# Phase Spec — SS-01: Notes Screen Search UI (SR-02)

**Run:** 2026-03-31T16-49-14-design-doc
**Sub-Spec:** SS-01
**Scenario:** SR-02
**Severity:** FAIL
**Score Weight:** 1 / 3
**Dependency:** None — implement independently.

---

## Context

`useNoteSearch` is a fully-functional MiniSearch wrapper with field weighting
(`title:2`, `tags:1.5`, `body:1`) and fuzzy/prefix matching. It is **not**
imported or invoked anywhere in the UI. The Notes screen has no search input.
This sub-spec surfaces that existing infrastructure in the UI.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/screens/NotesScreen.tsx` | Add search input, import hook, wire state |
| `src/features/notes/useNoteSearch.ts` | **Read-only** — do NOT modify |

---

## Implementation Steps

1. **Read `src/features/notes/useNoteSearch.ts`** to understand its public API
   (`rebuildIndex`, `search`, return shape) before touching `NotesScreen.tsx`.

2. **Read `src/screens/NotesScreen.tsx`** in full to understand the current
   structure: how notes are grouped, where the action bar lives, what imports
   already exist.

3. **Import `useNoteSearch`** at the top of `NotesScreen.tsx`:
   ```typescript
   import { useNoteSearch } from '../features/notes/useNoteSearch';
   ```

4. **Add state** inside the component:
   ```typescript
   const [query, setQuery] = useState('');
   const [debouncedQuery, setDebouncedQuery] = useState('');
   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   ```

5. **Call the hook** at component level:
   ```typescript
   const { rebuildIndex, search } = useNoteSearch();
   ```

6. **Rebuild the index** whenever the full flat note list changes:
   ```typescript
   useEffect(() => {
     rebuildIndex(allNotes); // use whatever variable holds the flat note array
   }, [allNotes]);
   ```

7. **Wire debounce** on the input's `onChange`:
   ```typescript
   function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
     const value = e.target.value;
     setQuery(value);
     if (debounceRef.current) clearTimeout(debounceRef.current);
     debounceRef.current = setTimeout(() => {
       setDebouncedQuery(value);
     }, 200);
   }
   ```
   Clean up in a `useEffect` return to avoid leaks.

8. **Compute search results:**
   ```typescript
   const searchResults = debouncedQuery.trim() ? search(debouncedQuery) : null;
   ```

9. **Render the search input** in the action bar area (before or after existing
   buttons — do not remove any existing buttons):
   ```tsx
   <input
     type="text"
     placeholder="Search notes…"
     value={query}
     onChange={handleQueryChange}
   />
   ```
   Use an existing `Input` primitive if one exists in the codebase.

10. **Conditionally render note list:**
    - When `searchResults` is `null` (empty query): render existing grouped sections unchanged.
    - When `searchResults` is a non-empty array: render a flat list of matched notes.
    - When `searchResults` is an empty array: render a "No results" message.

    Example:
    ```tsx
    {searchResults === null ? (
      <GroupedNoteList ... />
    ) : searchResults.length === 0 ? (
      <p>No results</p>
    ) : (
      <FlatNoteList notes={searchResults} />
    )}
    ```

11. **Verify TypeScript:** run `npx tsc --noEmit` mentally / confirm no new type
    errors before marking complete.

12. **Verify build:** confirm `npm run build` succeeds.

---

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| SR-02-AC-1 | A text input is rendered and visible on the Notes screen | Visual / DOM query |
| SR-02-AC-2 | Typing a term that matches a note title/tag/body causes that note to appear and non-matching notes to be hidden | Functional test |
| SR-02-AC-3 | Clearing the input (empty string) restores the full grouped note list | Functional test |
| SR-02-AC-4 | When search returns zero results, a "No results" (or equivalent) message is displayed | DOM assertion |
| SR-02-AC-5 | `npx tsc --noEmit` exits 0 | CI gate |
| SR-02-AC-6 | `npm run build` exits 0 | CI gate |

---

## Verification Commands

```bash
npx tsc --noEmit
npm run build
```

For manual/E2E verification, reference the holdout test plan:
`docs/tests/2026-03-31-skaldmark-full-coverage/.holdout/SR-02-minisearch-fulltext.md`

---

## Constraints

- Do **not** modify `src/features/notes/useNoteSearch.ts` — only consume its public API.
- Debounce must use `setTimeout` / `useRef` — no external debounce libraries.
- Cross-platform: no OS-specific file paths or line endings.
- TypeScript strict mode must remain satisfied (`npx tsc --noEmit` exits 0).
- All existing action bar buttons (Quick Note, Quick NPC, Location, Link Note) must remain intact.
