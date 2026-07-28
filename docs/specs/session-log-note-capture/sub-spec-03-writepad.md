---
type: phase-spec
sub_spec_id: SS-03
phase: run
depends_on: []
wave: 1
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-03 — `WritePad` reusable ruled writing surface

## Scope

A full-screen ruled writing surface any long-text field can expand into. Built once here; proven reusable by SS-14 (ship notes) and consumed by SS-08 (session log).

## Non-negotiable constraints

- **Plain `<textarea>`, never `contenteditable`.** Chromium's stylus handwriting commits through the `InputConnection` created for an HTML *text field*. Whether Samsung DirectWriting fires on `contenteditable` is unconfirmed; a textarea is the safe target.
- **Never blur on commit.** Samsung's handwriting pad *is* the keyboard. A blur closes it and costs a tap per entry.
- **No `max-w` cap.** The existing `QuickNoteDrawer` is capped at `max-w-[480px]`, which is a sliver of a Galaxy Tab S9 — that cap is the bug being fixed.
- **`onCommit` may reject.** On throw/rejection, retain the text and toast. Never clear on failure.

## Interface Contracts

### WritePad
- Direction: SS-03 → SS-08, SS-14
- Owner: SS-03
- Shape: `WritePad(props: { open: boolean; value: string; onChange: (v: string) => void; onCommit: () => void | Promise<void>; onClose: () => void; placeholder?: string; commitLabel?: string }): JSX.Element | null`

## Implementation Steps

### Step 1. Create the component shell

Create `src/components/notes/WritePad.tsx`. Return `null` when `open` is false. Render a fixed full-viewport overlay following the existing modal conventions in `src/components/primitives/`.

### Step 2. Ruled textarea

Render a single `<textarea>` filling the available height. Apply the rules via inline style so the stripe pitch and `line-height` stay locked together:

```
lineHeight: '2rem',
backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent calc(2rem - 1px), var(--color-border) calc(2rem - 1px), var(--color-border) 2rem)',
backgroundAttachment: 'local'
```

`backgroundAttachment: 'local'` makes the rules scroll with the text rather than staying fixed to the box.

### Step 3. Commit handling with focus retention and failure recovery

Hold a `useRef` on the textarea. The commit handler must:

1. Return early when `value.trim()` is empty (whitespace-only commits are a no-op).
2. `try { await onCommit() } catch { toast; return }` — on failure, do **not** clear and do **not** close.
3. On success, re-focus the textarea synchronously via the ref.

Bind `Ctrl`/`Cmd`+`Enter` to commit. A bare `Enter` must insert a newline — do not preventDefault it.

### Step 4. Verify

```bash
npm run build
```

Then in the running app (`npm run preview`), confirm by hand: whitespace commit does nothing; after a real commit the caret is still in the textarea; the panel does not close.

### Step 5. Commit

```bash
git add src/components/notes/WritePad.tsx
git commit -m "feat(notes): WritePad full-screen ruled writing surface [factory-managed]"
```

## Verification Commands

```bash
npm run build
npm run preview   # manual check of focus retention and rules
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| WritePad component exported | [STRUCTURAL] | `grep -q "export function WritePad" src/components/notes/WritePad.tsx \|\| (echo "FAIL: WritePad not exported" && exit 1)` |
| No contenteditable | [MECHANICAL] | `[ $(grep -c "contenteditable" src/components/notes/WritePad.tsx) -eq 0 ] \|\| (echo "FAIL: WritePad uses contenteditable" && exit 1)` |
| Uses a textarea | [MECHANICAL] | `[ $(grep -c "textarea" src/components/notes/WritePad.tsx) -ge 1 ] \|\| (echo "FAIL: WritePad has no textarea" && exit 1)` |
| Ruled background present | [MECHANICAL] | `[ $(grep -c "repeating-linear-gradient" src/components/notes/WritePad.tsx) -ge 1 ] \|\| (echo "FAIL: no ruled background" && exit 1)` |
| Commit is failure-safe | [STRUCTURAL] | `grep -q "catch" src/components/notes/WritePad.tsx \|\| (echo "FAIL: commit handler has no try/catch" && exit 1)` |
| No width cap | [MECHANICAL] | `[ $(grep -c "max-w-\[480px\]" src/components/notes/WritePad.tsx) -eq 0 ] \|\| (echo "FAIL: WritePad reintroduces the 480px cap" && exit 1)` |
| Build passes | [MECHANICAL] | `npm run build > /dev/null 2>&1 \|\| (echo "FAIL: npm run build failed" && exit 1)` |
