# Phase Spec — SS-10: Export Delivery — Single / Session / Bundle (Phase 5)

```yaml
sub-spec: SS-10
title: Export Delivery
stage: 2
priority: P0
score: 92
depends-on: SS-02, SS-04, SS-05, SS-07, SS-09
run: 2026-03-31T01-23-45-design-doc
```

> **Dependency Order:** Requires **SS-02** (types), **SS-04** (note/session repositories — to fetch data for export), **SS-05** (all export utility functions — `renderNoteToMarkdown`, `renderSessionBundle`, `bundleToZip`, `shareFile`, `copyToClipboard`, `downloadBlob`), **SS-07** (session lifecycle — session must exist to export), and **SS-09** (Notes Hub — export actions surface in the notes/session UI). This sub-spec wires the export utilities to the UI.

---

## Intent

Deliver working export in three flavors before Stage 2 ships. Export is the killer feature; a session with no export path is a dead end.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-S10-01 | Single note export: "Export Note" action on any note calls `renderNoteToMarkdown()`; result is delivered via `shareFile()` or `copyToClipboard()`; produced markdown file has correct YAML front matter per AC-S5-02; wiki-links resolve to `[[Title]]` for all intact @-mentions. |
| AC-S10-02 | Session export (.md file): "Export Session" action on ended/active session; produces one .md file: session index with `linkedNotes: [...]` in YAML; delivered via `shareFile()`. |
| AC-S10-03 | Session + notes bundle (.zip): "Export Session + Notes" action produces a .zip via `bundleToZip()`; zip contains: session index .md + one .md per linked note; all wiki-links across files resolve correctly; delivered via `shareFile()` with Blob download fallback. |
| AC-S10-04 | "Copy as Markdown" copies single note markdown to clipboard via `copyToClipboard()`. Shows success toast. |
| AC-S10-05 | On mobile Safari / PWA, if `navigator.share()` does not support `.zip` Blob, the app falls back to Blob download without crashing. |
| AC-S10-06 | No TypeScript errors in export delivery and screen files. |

---

## Implementation Steps

### 1. Create `src/features/export/useExportActions.ts`

A hook that orchestrates data fetching + export utility calls.

```ts
export function useExportActions() {
  const { activeCampaign, activeSession } = useCampaignContext();
  const { showToast } = useToast();

  const exportNote = async (noteId: string) => { ... };
  const exportSessionMarkdown = async (sessionId: string) => { ... };
  const exportSessionBundle = async (sessionId: string) => { ... };
  const copyNoteAsMarkdown = async (noteId: string) => { ... };

  return { exportNote, exportSessionMarkdown, exportSessionBundle, copyNoteAsMarkdown };
}
```

#### `exportNote(noteId)`:
1. Fetch note: `const note = await getNoteById(noteId)`
2. Fetch entity links: `const links = await getLinksFrom(noteId, 'introduced_in')` + other relevant links
3. Fetch all notes in campaign for wiki-link resolution: `const allNotes = await getNotesByCampaign(activeCampaign!.id)`
4. Call: `const markdown = renderNoteToMarkdown(note, links, allNotes)`
5. Create Blob: `new Blob([markdown], { type: 'text/markdown' })`
6. Call: `await shareFile(blob, generateFilename(note))`
7. On error: `showToast('Export failed')`

#### `exportSessionMarkdown(sessionId)`:
1. Fetch session: `const session = await getSessionById(sessionId)`
2. Fetch linked notes: query `entityLinks` where `fromEntityId === sessionId` and `relationshipType === 'contains'`, then fetch each note by `toEntityId`
3. Fetch entity links for all notes
4. Call: `renderSessionBundle(session, linkedNotes, entityLinks)` → returns `Map<filename, markdown>`
5. Extract session index file (first entry or entry named by session)
6. Create Blob from session markdown: `new Blob([sessionMarkdown], { type: 'text/markdown' })`
7. Call: `await shareFile(blob, sessionFilename)`

#### `exportSessionBundle(sessionId)`:
1. Same data fetching as `exportSessionMarkdown`
2. Call: `const filesMap = renderSessionBundle(session, linkedNotes, entityLinks)`
3. Call: `const zipBlob = await bundleToZip(filesMap)`
4. Call: `await shareFile(zipBlob, `${generateFilename({ title: session.title, id: session.id }).replace('.md', '')}.zip`)`
   - `shareFile` already handles `navigator.share()` fallback to `downloadBlob()` (AC-S10-05)

#### `copyNoteAsMarkdown(noteId)`:
1. Same data fetching as `exportNote`
2. Call: `const markdown = renderNoteToMarkdown(note, links, allNotes)`
3. Call: `await copyToClipboard(markdown)`
4. `showToast('Copied to clipboard ✓')` on success
5. On error: `showToast('Copy failed')`

### 2. Add export actions to Note item UI

**In `src/features/notes/NoteItem.tsx`** (create this component or add to existing notes UI):

Each note in the Notes hub should have a context menu or swipe action with:
- "Export Note" → calls `exportNote(note.id)`
- "Copy as Markdown" → calls `copyNoteAsMarkdown(note.id)`
- "Pin / Unpin" → calls `pinNote` / `unpinNote`

Implementation options (agent chooses):
- A "…" overflow button revealing action sheet
- Long-press to reveal actions
- Inline small icon buttons

Minimum: export action must be reachable in ≤ 2 taps from the notes hub.

### 3. Add export actions to Session Tab

**In `src/screens/SessionScreen.tsx`** (from SS-07), when a session exists (active or ended):

```tsx
<div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
  <button
    onClick={() => exportSessionMarkdown(session.id)}
    style={{ minHeight: 44, minWidth: 44 }}
  >
    Export Session
  </button>
  <button
    onClick={() => exportSessionBundle(session.id)}
    style={{ minHeight: 44, minWidth: 44 }}
  >
    Export Session + Notes (ZIP)
  </button>
</div>
```

Display these buttons for:
- The currently active session
- Ended sessions (show in a "Past Sessions" list or on the session detail view)

### 4. Past sessions list in Session Tab

For AC-S10-02 to be reachable on ended sessions:
- Below the current session status, show a collapsible "Past Sessions" list
- Each past session row has: title, date, "Export .md" and "Export .zip" buttons
- Fetch via `sessionRepository.getSessionsByCampaign(activeCampaign.id)` filtered to `status === 'ended'`

### 5. Verify wiki-link resolution in bundle (AC-S10-03)

The wiki-link resolution happens inside `renderSessionBundle` → `renderNoteToMarkdown` → `resolveWikiLinks`. Verify:
- Note A mentions Note B via a mention node
- Both are in the session bundle
- Note A's export contains `[[Note B Title]]`
- Note B's file exists in the zip (filename matches)

This is validated manually during Stage 2 sign-off.

---

## Verification Commands

```
# TypeScript check
npx tsc --noEmit

# Manual flow verification (AC-S10-01 through AC-S10-06):
# 1. Create a note with a @-mention of another note → save
# 2. Tap "Export Note" on that note
#    → share sheet opens OR file download triggers
#    → open exported .md in text editor
#    → confirm: starts with ---, contains title:, type:, wiki-links as [[Title]]
# 3. Create session, add some notes
# 4. Tap "Export Session" → .md file shared/downloaded, contains linkedNotes: [...] in YAML
# 5. Tap "Export Session + Notes (ZIP)" → .zip file downloaded/shared
#    → unzip → confirm: session .md + one .md per note, wiki-links resolved
# 6. Tap "Copy as Markdown" on a note → clipboard contains markdown → toast "Copied to clipboard ✓"
# 7. On mobile Safari (or simulate): verify .zip export triggers download fallback, no crash
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Create** | `src/features/export/useExportActions.ts` |
| **Create** | `src/features/notes/NoteItem.tsx` (or modify existing note list item) |
| **Modify** | `src/screens/SessionScreen.tsx` — add export buttons + past sessions list |

---

## Cross-Cutting Constraints (apply to this sub-spec)

- `XC-01` Zero TypeScript errors
- `XC-04` Named exports only
- `XC-05` Hook returns `{ fn1, fn2 }` — no array returns
- `XC-06` `showToast()` for user-facing feedback (success and error)
- `XC-07` JSZip is pre-approved; no other new packages without escalation
