# Phase Spec — SS-06 · Note Reader

**Run:** `2026-04-07T00-01-30-design-doc`
**Sub-spec:** SS-06
**Phase:** 2 — Wikilinks + Reading
**Priority:** 8/10

---

## Dependency Order

> ⚠️ **Depends on SS-01, SS-02, SS-04, and SS-05 being completed first.**
> The KB context (SS-04) must exist for backlink/forward-link hooks. The wikilink extension (SS-05) must exist so the reader can render wikilink nodes as tappable links.

---

## Intent

Create `src/features/kb/NoteReader.tsx` as a component (not a screen — embedded within the KB screen). Renders Tiptap content read-only with tappable wikilinks, @mentions, and #descriptors. Shows a backlinks panel and forward links summary at the bottom. Provides inline peek cards on link tap and an "Edit" button to switch to `NoteEditorScreen`.

---

## Files to Create

| File | Exports |
|---|---|
| `src/features/kb/NoteReader.tsx` | `NoteReader` — main read-mode component |
| `src/features/kb/BacklinksPanel.tsx` | `BacklinksPanel` — lists all nodes linking to current node |
| `src/features/kb/PeekCard.tsx` | `PeekCard` — inline preview card (title, type badge, snippet, Open button) |

## Files to Modify

*(none — NoteReader is new; editing still uses NoteEditorScreen via navigation)*

---

## Implementation Steps

### Step 1 — Create `src/features/kb/NoteReader.tsx`

```typescript
interface NoteReaderProps {
  noteId: string;
}

export function NoteReader({ noteId }: NoteReaderProps) {
  // 1. Load note by ID from noteRepository
  // 2. Load attachments from attachmentRepository (if any)
  // 3. Render Tiptap EditorContent in read-only mode (editable={false})
  // 4. Wire wikilink taps to navigation (see below)
  // 5. Render BacklinksPanel and forward links summary below content
  // 6. Render attachment gallery if note.attachments exist
  // 7. Render Edit button
}
```

#### Read-Only Tiptap Setup

Configure the Tiptap editor with `editable: false`. Include all extensions needed to render the content (StarterKit + WikiLink + DescriptorMention + Mention). Do NOT include editing-specific extensions (undo/redo, keymaps, etc.).

The `WikiLink` extension (SS-05) node view (`WikiLinkComponent`) must be modified or wrapped to support a click/tap handler in read-only mode. When tapped:
- If `node.attrs.id !== 'unresolved'`: navigate to `/kb/{node.attrs.id}` via `useNavigate()`.
- If `node.attrs.id === 'unresolved'`: show a prompt "Note not found. Create it?" (use a `window.confirm` or a simple modal). If confirmed, create the note via `noteRepository.createNote({...})` and navigate to the new note's KB page.

#### Edit Button

Render an "Edit" button (using existing `Button` primitive from `src/components/primitives/`) that calls `navigate('/note/${noteId}/edit')`.

#### Forward Links Summary

Below the note body, render a section listing all wikilinks from this note using `useForwardLinks(noteNodeId)` from `useKnowledgeBase()`.

#### Attachment Gallery

If the note has attachments (read from `attachmentRepository` via `getAttachmentsByNote(noteId)`), render them below the forward links section. Use the `AttachmentThumbs` component from `src/components/notes/AttachmentThumbs.tsx` (see `QuickNoteDrawer.tsx` for usage reference). In read-only mode, pass `onDelete` and `onCaptionChange` as no-ops or omit editing callbacks.

### Step 2 — Create `src/features/kb/BacklinksPanel.tsx`

```typescript
interface BacklinksPanelProps {
  nodeId: string;    // The kb_nodes ID of the current note
}

export function BacklinksPanel({ nodeId }: BacklinksPanelProps) {
  // 1. Call useKnowledgeBase().useBacklinks(nodeId)
  // 2. For each KBEdge, resolve the fromId to a KBNode via getNodeById
  // 3. Render a list of linking notes: title + type badge + "Open" button
  // 4. Empty state: "No notes link here yet."
}
```

### Step 3 — Create `src/features/kb/PeekCard.tsx`

```typescript
interface PeekCardProps {
  nodeId: string;
  onClose: () => void;
  onOpen: () => void;
}

export function PeekCard({ nodeId, onClose, onOpen }: PeekCardProps) {
  // 1. Load KBNode by nodeId
  // 2. Load Note by node.sourceId (if type === 'note')
  // 3. Render: title, type badge, first ~100 chars of text content, "Open" button
  // 4. "Open" button calls onOpen (which navigates to /kb/{nodeId})
  // 5. Tap outside or swipe down calls onClose
}
```

Render `PeekCard` as an overlay/drawer anchored to the bottom of the screen (use existing `Drawer` primitive from `src/components/primitives/` if available).

---

## Acceptance Criteria

1. `npm run build` succeeds with zero TypeScript errors.
2. `NoteReader` renders the Tiptap document body of the given note in read-only mode (no cursor, no editing).
3. Wikilink nodes render as tappable styled links (not raw `[[text]]` strings).
4. Tapping a resolved wikilink navigates to `/kb/{targetNodeId}`.
5. Tapping an unresolved wikilink shows a prompt: "Note not found. Create it?" — confirming creates the note and navigates to it.
6. `BacklinksPanel` at the bottom shows all notes that link to the current note (uses `useBacklinks(nodeId)` from KB context).
7. Forward links summary shows all wikilinks from this note (uses `useForwardLinks(nodeId)`).
8. Tapping a link shows a `PeekCard` with: note title, type badge, first ~100 chars of text content, and an "Open" button.
9. "Edit" button navigates to `/note/{noteId}/edit` (existing `NoteEditorScreen` route).
10. Attachment gallery renders if the note has attachments (read from `attachmentRepository`).

---

## Verification Commands

```bash
# TypeScript build check
npm run build

# (Manual) Test in browser:
# 1. Navigate to /kb/{noteId} (after SS-08 is in place, or render NoteReader in a test harness)
# 2. Confirm: note body renders in read-only mode (cannot type)
# 3. Confirm: wikilink chips are tappable and navigate correctly
# 4. Confirm: unresolved wikilink shows creation prompt
# 5. Confirm: BacklinksPanel shows notes that link to this note
# 6. Confirm: Forward links section shows wikilinks from this note
# 7. Confirm: Tapping a link shows PeekCard
# 8. Confirm: Edit button navigates to editor
```

---

## Constraints / Notes

- NoteReader is a component, NOT a screen. It is composed inside `KnowledgeBaseScreen` (SS-08).
- Use existing primitives (`Card`, `Button`, `Drawer`, `Modal`) from `src/components/primitives/` — do not introduce custom styled elements.
- The wikilink click handler must work in Tiptap read-only mode. This may require a custom `NodeView` or an `onClick` handler on the rendered HTML element. Validate the approach works before committing.
- `useKnowledgeBase()` must be called within a `<KnowledgeBaseProvider>` — ensure `NoteReader` is always rendered inside one (SS-08 handles this at screen level).
- Correctness over speed. No shell commands. Cross-platform.
