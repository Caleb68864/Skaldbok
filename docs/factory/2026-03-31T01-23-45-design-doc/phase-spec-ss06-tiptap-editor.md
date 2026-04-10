# Phase Spec — SS-06: Tiptap Editor Integration

```yaml
sub-spec: SS-06
title: Tiptap Editor Integration
stage: 1
priority: P1
score: 88
depends-on: SS-02, SS-04
run: 2026-03-31T01-23-45-design-doc
```

> **Dependency Order:** Requires **SS-02** (Dexie v3 Schema + Note types) and **SS-04** (Note Repositories — specifically `noteRepository.getNotesByCampaign` for the mention typeahead). SS-09 (Notes Hub) depends on this editor component. Can be implemented in parallel with SS-01, SS-03, SS-05.

---

## Intent

Integrate Tiptap as the note body editor with @-mention support for linking to other notes by ID and title. Vim mode is configurable. The editor must survive a save/reload cycle without data loss.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-S6-01 | A `TiptapNoteEditor` component exists at `src/components/notes/TiptapNoteEditor.tsx`. It renders a Tiptap editor with `StarterKit` and the `Mention` extension. |
| AC-S6-02 | Mention extension is configured with typeahead that: triggers on `"@"`; queries existing notes by title prefix from the notes repository; renders a suggestion list of matching note titles; on selection, inserts a mention node with `attrs: { id, title }`. |
| AC-S6-03 | Mention round-trip test (verified manually during Stage 1 sign-off): (1) Open editor, type `"@Sir"`, select "Sir Talos" from typeahead; (2) Save note (body stored as ProseMirror JSON in Dexie); (3) Reload app; (4) Re-open note — editor renders "Sir Talos" mention chip; (5) ProseMirror JSON in Dexie contains mention node with `attrs.id` and `attrs.title` both non-empty. |
| AC-S6-04 | ~~DEFERRED~~ — Vim mode toggle is deferred to a future sub-spec. `@tiptap/extension-vim-keymap` does not exist on npm. No vim mode in this phase. |
| AC-S6-05 | Editor stores body as **ProseMirror JSON object** in `note.body`. It does NOT store raw markdown. No markdown-to-ProseMirror conversion occurs on load. |
| AC-S6-06 | Editor renders with inline styles using CSS variables. No imported stylesheet from Tiptap is used (or, if unavoidable, it is scoped and does not override existing theme variables). |
| AC-S6-07 | If Tiptap fails to load (import error), the note creation flow falls back to a plain `<textarea>` for body input. Core note metadata (title, type) still saves correctly. |
| AC-S6-08 | No TypeScript errors in editor component file. |

---

## Implementation Steps

### 1. Install required packages

> These are pre-approved (XC-07). Pin exact versions (no `^` or `~`) in `package.json`.

```json
"@tiptap/react": "2.x.x",
"@tiptap/starter-kit": "2.x.x",
"@tiptap/extension-mention": "2.x.x",
// "@tiptap/extension-vim-keymap" — DEFERRED: package does not exist on npm
```

- Determine the current latest stable `2.x` versions and pin them exactly
- `@tiptap/extension-vim-keymap` — DEFERRED: does not exist on npm. Skip vim mode entirely in this phase.

### 2. Create `src/components/notes/TiptapNoteEditor.tsx`

#### Component props interface:

```ts
export interface TiptapNoteEditorProps {
  initialContent: unknown;               // ProseMirror JSON object (or null/undefined for empty)
  onChange: (content: unknown) => void;  // called on every update with ProseMirror JSON
  campaignId: string | null;             // used by mention typeahead query
  placeholder?: string;
}
```

#### Editor setup:

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
// vim keymap: dynamically imported when vimMode is true

export function TiptapNoteEditor({ initialContent, onChange, campaignId, placeholder }: TiptapNoteEditorProps) {
  const [failed, setFailed] = React.useState(false);
  // ... editor setup in try/catch
  if (failed) return <TextareaFallback ... />;
  return <EditorContent editor={editor} style={{ ... }} />;
}
```

#### Mention extension configuration:

```ts
Mention.configure({
  HTMLAttributes: { class: 'mention' },
  suggestion: {
    items: async ({ query }) => {
      if (!campaignId) return [];
      const notes = await getNotesByCampaign(campaignId);
      return notes
        .filter(n => n.title.toLowerCase().startsWith(query.toLowerCase()))
        .slice(0, 10);
    },
    render: () => {
      // Return a suggestion renderer using Card primitive from
      // src/components/primitives/Card.tsx
      // Renders a floating list of note titles
      // Use inline styles; no className-based styles
      ...
    },
  },
})
```

- Mention node attrs must include both `id` and `title`:
  ```ts
  // In the mention node definition or Mention.configure:
  addAttributes() {
    return {
      id: { default: null },
      title: { default: null },
    };
  }
  ```

#### Vim mode — DEFERRED
> `@tiptap/extension-vim-keymap` does not exist on npm. Vim mode is deferred to a future sub-spec once a viable community extension is identified. Do NOT implement vim mode in this phase.

#### ProseMirror JSON storage:

```ts
const editor = useEditor({
  extensions: [...],
  content: initialContent ?? '',
  onUpdate: ({ editor }) => {
    onChange(editor.getJSON());  // Store JSON, never markdown
  },
});
```

#### Fallback component:

```tsx
function TextareaFallback({ onChange, placeholder }: { onChange: (val: string) => void; placeholder?: string }) {
  return (
    <textarea
      placeholder={placeholder ?? 'Write your note...'}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', minHeight: '120px', ... }}
    />
  );
}
```

#### Error boundary / try-catch for AC-S6-07:

```tsx
// Wrap editor initialization in try-catch
try {
  // ... useEditor setup
} catch (e) {
  setFailed(true);
}
```

#### Inline styles:

```tsx
<EditorContent
  editor={editor}
  style={{
    fontFamily: 'var(--font-body)',
    color: 'var(--color-text)',
    background: 'var(--color-surface)',
    padding: '8px',
    minHeight: '120px',
    borderRadius: '4px',
  }}
/>
```

### 3. ~~Add `vimMode` setting~~ — DEFERRED (no viable package)

### 4. ~~Add Vim Mode toggle to Settings screen~~ — DEFERRED

---

## Verification Commands

```
# TypeScript check
npx tsc --noEmit

# Manual round-trip test (AC-S6-03):
# 1. Open app → Notes tab → Create note
# 2. In editor, type "@Sir" → typeahead appears showing notes with "Sir" prefix
# 3. Select "Sir Talos" from list → mention chip inserted
# 4. Save note
# 5. Open DevTools → Application → IndexedDB → notes table
# 6. Inspect saved note.body → confirm mention node with attrs.id and attrs.title

# AC-S6-04 Vim mode:
# 1. Settings → enable Vim Mode toggle
# 2. Return to editor → verify Vim normal/insert mode behavior

# AC-S6-07 fallback:
# 1. Temporarily break a Tiptap import to simulate failure
# 2. Confirm plain textarea renders and note saves with title/type intact
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Create** | `src/components/notes/TiptapNoteEditor.tsx` |
| **Modify** | `src/screens/SettingsScreen.tsx` — add Vim Mode toggle |
| **Modify** | `src/types/` or appSettings schema — add `vimMode: boolean` field |
| **Modify** | `package.json` — add pinned Tiptap dependencies |

---

## Cross-Cutting Constraints (apply to this sub-spec)

- `XC-01` Zero TypeScript errors
- `XC-03` Inline `style={{}}` with CSS variables; no Tiptap-imported stylesheet that overrides theme variables
- `XC-04` Named exports only — `export function TiptapNoteEditor`
- `XC-07` Tiptap packages are pre-approved; no other new npm packages without escalation
- **Escalation trigger:** If Tiptap mention extension cannot store both `id` and `title` in node attrs, halt and surface to Caleb before proceeding
