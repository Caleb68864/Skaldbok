---
type: phase-spec
sub_spec_id: SS-01
phase: run
depends_on: []
wave: 1
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-01 — `textToDoc` helper and the `log` note type

## Scope

Add `'log'` to `NOTE_TYPES`. Create `textToDoc(text)` returning a ProseMirror doc, splitting on blank lines into paragraphs and parsing `[[label]]` spans into `wikiLink` inline atom nodes. Create `docToText(doc)` as the inverse. Both must round-trip.

## Why this matters

`resolveWikiLinks()` returns `''` for any non-object body (`src/utils/export/resolveWikiLinks.ts:26`). A log entry stored as a raw string would **silently export as empty**. This helper is the guard against that.

`wikiLink` is an inline atom node with `id` and `label` attrs (`src/features/notes/wikilinkExtension.ts`). `extractLinksFromTiptapJSON` reads wikilinks **by `label`** (`src/features/kb/tiptapParser.ts`), so a generated node with `id: null` still works for KB sync. Do not attempt to resolve ids here.

## Interface Contracts

### textToDoc
- Direction: SS-01 → SS-04, SS-05, SS-07, SS-08
- Owner: SS-01
- Shape: `textToDoc(text: string): unknown` — returns `{ type: 'doc', content: Array<ParagraphNode> }`

### docToText
- Direction: SS-01 → SS-07, SS-08
- Owner: SS-01
- Shape: `docToText(doc: unknown): string` — inverse of `textToDoc`; `wikiLink` nodes render as `[[label]]`

### NOTE_TYPES
- Direction: SS-01 → SS-04, SS-09, SS-10, SS-11
- Owner: SS-01
- Shape: `NOTE_TYPES` tuple gains the literal `'log'`

## Implementation Steps

### Step 1. Write the failing tests

Create `src/features/notes/textToDoc.test.ts`. Assert:
- `textToDoc('hello')` returns an object whose `type` is `'doc'` (never a string)
- `textToDoc('a\n\nb')` produces two paragraph nodes
- `textToDoc('met [[Ostrand]] today')` produces a paragraph containing text, a `wikiLink` node with `label: 'Ostrand'`, then text
- `docToText(textToDoc('a [[Ostrand]] b'))` returns `'a [[Ostrand]] b'`
- `docToText(textToDoc('para one\n\npara two'))` returns `'para one\n\npara two'`
- `textToDoc('')` returns a doc with a single empty paragraph (not a crash)
- Unmatched brackets (`'a [[ b'`) are treated as literal text, not a malformed node

### Step 2. Run to verify failure

```bash
npm test -- textToDoc
```

Expect: module-not-found or assertion failures.

### Step 3. Implement `textToDoc` / `docToText`

Create `src/features/notes/textToDoc.ts`. Split input on `/\n{2,}/` for paragraphs. Within each paragraph, split on `/\[\[([^\]]+)\]\]/` and emit alternating `text` and `wikiLink` nodes. `wikiLink` node shape: `{ type: 'wikiLink', attrs: { id: null, label } }`. Empty text runs must be omitted — ProseMirror rejects zero-length text nodes.

`docToText` walks `doc.content`, joining paragraphs with `'\n\n'`, mapping `text` → `node.text` and `wikiLink` → `` `[[${attrs.label}]]` ``.

### Step 4. Add `'log'` to `NOTE_TYPES`

Modify `src/types/note.ts`. Append `'log'` to the `NOTE_TYPES` tuple and extend the doc comment with `` - `'log'` — a single committed session-log entry. ``

No schema change is needed: `baseNoteSchema` already declares `type: z.string()`.

### Step 5. Run tests and build

```bash
npm test -- textToDoc
npm run build
```

### Step 6. Commit

```bash
git add src/features/notes/textToDoc.ts src/features/notes/textToDoc.test.ts src/types/note.ts
git commit -m "feat(notes): textToDoc/docToText helpers and the log note type [factory-managed]"
```

## Verification Commands

```bash
npm test          # full suite, 219+ tests
npm run build     # only type-check in the project
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| textToDoc.ts exports textToDoc | [STRUCTURAL] | `grep -q "export function textToDoc" src/features/notes/textToDoc.ts \|\| (echo "FAIL: textToDoc not exported" && exit 1)` |
| textToDoc.ts exports docToText | [STRUCTURAL] | `grep -q "export function docToText" src/features/notes/textToDoc.ts \|\| (echo "FAIL: docToText not exported" && exit 1)` |
| NOTE_TYPES contains 'log' | [STRUCTURAL] | `grep -q "'log'" src/types/note.ts \|\| (echo "FAIL: NOTE_TYPES missing 'log'" && exit 1)` |
| Tests pass | [MECHANICAL] | `npm test 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: test suite failed" && exit 1)` |
| Build passes | [MECHANICAL] | `npm run build > /dev/null 2>&1 \|\| (echo "FAIL: npm run build failed" && exit 1)` |
