# Phase Spec — SS-05: Notes Grid in Session Screen
**Sub-Spec:** SPEC-B2-1
**Issues:** #4, #15
**Batch:** 2 — Notes Overhaul
**Dependency:** SS-07 (Tiptap Quick Note Fix) should be verified first as a Tiptap/React 19 canary. SS-06 (NoteEditorPage) should exist before this spec taps note card navigation — implement SS-06 in parallel or immediately before this spec.

---

## Intent
Merge the standalone Notes tab into the Session screen as a filterable Notes Grid section. Notes from other sessions are hidden by default but togglable. The `/notes` URL redirects to the session-based view.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Modify | `src/features/session/SessionScreen.tsx` (or equivalent session root) |
| Create | `src/features/notes/NotesGrid.tsx` |
| Modify | `src/routes/index.tsx` — add `/notes` redirect |
| Reference | `src/storage/repositories/noteRepository.ts` — existing query functions |
| Reference | App settings in Dexie — persist "show other sessions" toggle per campaign |

---

## Implementation Steps

1. **Read** `src/features/session/SessionScreen.tsx` to understand the existing tab/section structure.
2. **Read** `src/storage/repositories/noteRepository.ts` to understand available query functions and return shapes.
3. **Create** `src/features/notes/NotesGrid.tsx`:
   - Card layout using the existing `Card` component.
   - Filters exposed in the UI:
     - Note **type** (dropdown/chips)
     - **Tags** (multi-select)
     - **Session** (current session vs all)
     - **Text search** (MiniSearch already wired — use existing search integration)
   - Sort options: by date desc (default), name, type.
   - **"Show notes from other sessions"** toggle:
     - Default: **off** (only current session's notes shown)
     - Persist preference per campaign in `appSettings` (within existing Dexie settings structure — do **not** bump schema version)
   - Tapping a note card → navigate to `/note/:id/edit` (route created in SS-06).
   - **Lazy-load**: wrap in `React.lazy` / `Suspense` so the Session screen's initial render is not blocked.
   - Wrap `NotesGrid` in an `ErrorBoundary` with a simple fallback list (title-only plain list).
4. **Add** Notes Grid as a tab or collapsible section inside `SessionScreen.tsx` alongside the existing session timeline.
5. **Add** route redirect in `src/routes/index.tsx`: `/notes` → `/session?view=notes` (or equivalent redirect mechanism used by the existing router).

---

## Acceptance Criteria

- [ ] **B2-1-AC1:** Session screen has a Notes Grid section/tab showing filterable notes.
- [ ] **B2-1-AC2:** Notes can be filtered by type, tags, session, and searched by text.
- [ ] **B2-1-AC3:** "Show notes from other sessions" toggle works and persists preference per campaign.
- [ ] **B2-1-AC4:** `/notes` URL redirects to `/session?view=notes`.
- [ ] **B2-1-AC5:** Tapping a note card navigates to `/note/:id/edit`.
- [ ] **B2-1-AC6:** Notes Grid is lazy-loaded; Session screen initial render is not degraded.

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
- Storing the "show other sessions" toggle preference requires a new Dexie table or index.
- MiniSearch integration for NotesGrid requires changes to the search index initialization that could affect existing note search.
