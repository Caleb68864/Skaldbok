# Pen Handwriting into Notes — A Full Page to Write On, and Ink That Survives

## Meta

- Client: Personal
- Project: Skaldbok
- Repo: `C:\Users\CalebBennett\Documents\GitHub\Skaldbok`
- Date: 2026-07-30
- Author: Forge Dark Factory (Stage 2)
- Design doc: `docs/plans/2026-07-30-pen-handwriting-notes-design.md`
- Status: ready
- Spec format: Dark Factory 3.0
- Quality score: 27/30 (outcome 5, scope 5, decision guidance 5, edge coverage 4, acceptance criteria 4, decomposition 4)

**Package root note.** `package.json` lives at the repo root, so every
`npm run build` / `npm test` criterion below runs from the repo root with no
`cd` prefix. There is no sub-package.

## Outcome

Two things are true when this is done.

**A (ships first, alone if necessary).** On the Galaxy Tab S9, opening
`/session/log` and writing with the S Pen puts the recogniser's text into a
writing surface that starts tall and **grows downward as the user writes**, so
the user never reaches the bottom of the page mid-thought. No `touch-action`
declaration exists anywhere on the `WritePad` ancestor chain — enforced by a
vitest guard that fails the suite if one is reintroduced. If the OS still docks
a panel, the app tells the user which device setting removes it rather than
failing silently.

**B (ships second, additive).** An opt-in ink surface captures pen strokes as
vectors, palm-rejects touch while a pen is down, survives reload, and rides
along in export — with **zero Dexie schema version bump and zero migration**,
because ink is a `typeData` payload on the existing `log` note type.

`npm run build` and `npm test` pass. No `systemId ===` branch is introduced.

## Intent

**Trade-off hierarchy** (when valid approaches conflict):

1. **A must never be blocked by B.** A is nearly free and is the only path that
   yields *text*. If B is hard, cut B — never delay A for it.
2. **Additive beats structural.** Ink lands as `typeData` on an existing note
   type. A change that needs a Dexie `version(15)` block or a note-type addition
   is the wrong change unless the code proves otherwise.
3. **Never losing a thought beats correctness of the thought.** Match
   `WritePad`'s existing contract: a failed write retains the text and toasts;
   it never clears. Ink follows the same rule.
4. **Honest, device-bound criteria beat green CI.** A criterion a desktop
   Chromium harness passes while proving nothing is worse than no criterion.
   Tag it `[HUMAN REVIEW]` and say what device it needs.
5. **Existing repo conventions beat ideal design** — repositories, soft delete,
   engine-not-`systemId`, config-over-hardcoding.

**Decide autonomously:** grow algorithm details, max-height fraction, stroke
tessellation, tile size, canvas layering, help-panel copy and placement, module
file layout under the declared directories, ink JSON field names.

**Stop and escalate:** see Escalation Triggers.

## Context

### What the research settled — do not re-investigate

The design doc's `## Context — what the research established` is binding fact.
No sub-spec in this spec investigates handwriting recognition options. In brief:
the Handwriting Recognition API is ChromeOS-only; MyScript web is cloud-only;
ML Kit has no web path and a TWA cannot reach it; TrOCR int8 is 64–338 MB and is
the wrong modality for cursive; OnlineHTR is an unlicensed research spike,
deliberately deferred. **The Android OS recogniser only fires on real text
fields, and `touch-action` on the field or *any ancestor* silently kills it.**
`touch-action: handwriting` and the HTML `handwriting` attribute do not exist in
any shipping browser. On Android, `pointerType` is the only reliable pen signal —
stylus contact geometry reports 0, so geometry-based palm rejection is
unavailable. Canvas has hard per-axis and area caps, so a page-height canvas is
not viable; ink must tile.

### What the codebase actually contains (verified 2026-07-30)

- `src/components/notes/WritePad.tsx` (151 lines) already uses a `<textarea>`
  for exactly the OS-recogniser reason, with a `repeating-linear-gradient` ruled
  background at a 32 px pitch and `backgroundAttachment: 'local'`. It has two
  variants: `fullscreen` (`fixed inset-0`) and `docked` (fixed `dockedHeight`,
  default `14rem`). **The `docked` textarea is `flex-1` inside a fixed-height
  box — that is the cramped box.**
- Two consumers: `src/features/session/sessionLog/SessionLog.tsx` (docked, the
  capture screen) and `src/screens/ShipsScreen.tsx` (fullscreen, ship notes).
  ShipsScreen must not regress.
- `grep -rn "touch-action\|touchAction"` over `src/` returns exactly two hits:
  `src/components/timeline/TimelineViewport.tsx:51` and
  `src/features/kb/GraphView.tsx:320`. **Neither is on the `WritePad` ancestor
  chain today** — so a guard test starts green and stays meaningful.
- `src/types/note.ts` — `baseNoteSchema` already carries
  `typeData: z.unknown().optional()`, `'log'` is already in `NOTE_TYPES`, and
  soft-delete fields are already on the schema. **Ink needs no type change and
  no `NOTE_TYPES` addition.**
- `src/types/bundle.ts:49` exports notes as `z.array(baseNoteSchema)`, so a
  `typeData` ink payload is **already covered by export and import** with no
  work in the export feature.
- `src/storage/db/client.ts` is at `version(14)`. This spec adds **no**
  `version(15)` block. If a worker believes one is needed, that is an escalation
  (see triggers), not a decision.
- `src/storage/repositories/noteRepository.ts` already exposes
  `createLogEntry`, `updateLogEntry`, `listLogEntriesBySession`,
  `softDeleteWithLinks`, `restore`. Ink persistence extends this file; UI never
  touches `db.notes`.
- `src/features/systems/engine/engineConsumers.test.ts` scans all non-test
  `.ts`/`.tsx` under `src/` and fails on a `systemId ===` outside
  `engine/index.ts`. It also demonstrates the source-scanning test pattern the
  `touch-action` guard should copy.
- `npm test` is vitest, **pure logic only** — there is no jsdom/React Testing
  Library setup and this spec does not add one. `npm run build` (`tsc -b` +
  `vite build`) is the only type-check.
- `tests/e2e_full_test.py` drives desktop Chromium and already has a
  `phase_test_session_log` covering `/session/log`. **It has no stylus.** Ink
  capture and OS handwriting are unverifiable there, and this spec writes no
  Playwright criterion claiming otherwise.

### Resolved open questions

The design left three open. Two are resolved here; one is device-bound and is
carried as a `[HUMAN REVIEW]` criterion rather than a blocker.

- **Ink note type vs `typeData`?** → **`typeData` on the existing `log` type.**
  The code confirms it: `typeData` is already on `baseNoteSchema`, already
  exported via `bundle.ts`, and already inherits soft delete and restore.
  A new note type would touch `NOTE_TYPES`, the timeline adapter, the notes
  grid and the export path for no gain.
- **Samsung Internet vs Chrome?** → not a code decision. It becomes a line in
  the in-app help panel (SS-03), not a branch.
- **Does DirectWriting dock a panel regardless of field height?** → **still
  unknown, and only a Tab S9 can answer it.** It is REQ-013, a `[HUMAN REVIEW]`
  criterion. It does not gate any sub-spec: if the answer is "docks regardless",
  A's ceiling drops but A still delivers a growing page, and B becomes the
  primary answer — which is why B is specced here rather than deferred.

### Disambiguations (abstract phrases resolved)

- **"handles palm rejection"** → **Strict**: while any `pointerType === 'pen'`
  pointer is down, and for a 500 ms suppression window after `pointerup`, every
  non-pen pointer event on the ink surface is discarded outright. No geometry
  heuristic (the signals do not exist on Android). Per Intent #3, the escape
  hatch is undo, not cleverness.
- **"supports pressure"** → **Permissive**: `PointerEvent.pressure` is recorded
  as given, including `0` and the `0.5` default that non-pressure devices
  report. Never rejected, never normalised away.
- **"validates ink payload"** → **Permissive on read, strict on write**: the
  deserialiser drops malformed strokes and returns the rest rather than throwing,
  so one bad stroke never makes a note unreadable; the serialiser refuses to
  write a stroke with fewer than 1 point.
- **"error handling" for ink writes** → **Strict retention**: on write failure
  the strokes stay in memory, a toast fires, and nothing is cleared — identical
  to `WritePad`'s existing `onCommit` rejection contract.
- **"integrates with export"** → **no work**: `bundle.ts` already serialises
  `typeData` through `baseNoteSchema`. The criterion is a structural assertion,
  not an implementation.

## Requirements

### Approach A — the OS-handwriting target

1. **REQ-001:** The `WritePad` textarea grows in height as content is added,
   rather than scrolling inside a fixed-height box.
2. **REQ-002:** The docked `WritePad` starts at a height substantially taller
   than the current `14rem` default when rendered on the session log.
3. **REQ-003:** The growing docked pad is bounded by a maximum height so the
   committed-entry list above it never collapses to zero.
4. **REQ-004:** The `fullscreen` variant's behaviour on `ShipsScreen` is
   unchanged.
5. **REQ-005:** No `touch-action` CSS declaration or Tailwind `touch-*` utility
   appears on `WritePad` or on any component in its ancestor chain.
6. **REQ-006:** A vitest test fails the suite if REQ-005 is violated.
7. **REQ-007:** `WritePad`'s doc comment records why `touch-action` is forbidden
   on its subtree and why the element is a `<textarea>`.
8. **REQ-008:** Committing an entry does not blur the textarea or close the
   writing surface (existing contract, preserved).
9. **REQ-009:** A user-dismissible in-app help panel on the session log lists the
   ordered device checks for "S Pen writing does nothing".
10. **REQ-010:** The help panel is reachable but not modal, and does not occupy
    writing area when dismissed.

### Approach B — ink as truth

11. **REQ-011:** A stroke page serialises to and deserialises from a plain JSON
    value with no `Blob`, `Map`, or class instance in it.
12. **REQ-012:** Ink is persisted as a `typeData` payload on a `log`-type note
    via a `noteRepository` function; no UI code touches `db.notes` directly.
13. **REQ-013:** No new Dexie `version()` block is added to
    `src/storage/db/client.ts`; it remains at `version(14)`.
14. **REQ-014:** Ink notes inherit soft delete, restore and export from the
    existing `log` note path with no new code in the export feature.
15. **REQ-015:** While a pen pointer is down, and for a 500 ms window after
    `pointerup`, non-pen pointer events on the ink surface are discarded.
16. **REQ-016:** `pointercancel` discards the in-progress stroke rather than
    committing it, and resets all pointer-mode state.
17. **REQ-017:** When the active pointer set empties, all pointer-mode state is
    reset (the stuck pan/draw failure).
18. **REQ-018:** The ink surface never allocates a canvas larger than the
    viewport plus a bounded overscan, regardless of page height.
19. **REQ-019:** `pointerdown` with `pointerType === 'pen'` calls
    `preventDefault()` synchronously in a `{ passive: false }` listener.
20. **REQ-020:** Stroke points are gathered via `getCoalescedEvents()` where
    available, with a graceful fallback where it is not.
21. **REQ-021:** A failed ink write retains the strokes in memory and shows a
    toast; it never clears the surface.
22. **REQ-022:** Pen availability is determined by runtime feature detection
    only — never a user-agent sniff and never a `systemId` branch.
23. **REQ-023:** The ink surface is opt-in per entry; the text `WritePad`
    remains the default capture path on `/session/log`.
24. **REQ-024:** Committed ink entries render as ink in the session log entry
    list, and survive a page reload.

### Cross-cutting

25. **REQ-025:** `npm run build` passes.
26. **REQ-026:** `npm test` passes with no existing test weakened or skipped.
27. **REQ-027:** No `systemId ===` branch is introduced anywhere outside
    `src/features/systems/engine/index.ts`.
28. **REQ-028:** On a physical Galaxy Tab S9, S Pen writing on the session log
    produces text into a page that keeps growing, with either no docked IME
    panel or documented instructions for removing it. *(Device-bound; see the
    Verification section.)*

## Sub-Specs

---
sub_spec_id: SS-01
phase: 1
depends_on: []
---

### 1. Make the WritePad textarea a growing page

**Scope.** Turn the docked `WritePad` from a fixed-height box into an
auto-growing writing surface. The textarea's height tracks its own
`scrollHeight` (recomputed on `value` change and on mount), clamped between a
tall minimum and a maximum expressed as a fraction of the visual viewport so the
entry list above it cannot be squeezed out. Snap the computed height to a whole
multiple of `LINE_HEIGHT_PX` (32) so the ruled background stripes stay aligned
with the text baseline — the existing gradient assumes exact 32 px pitch.

The `fullscreen` variant keeps its current `fixed inset-0` + `flex-1` geometry
untouched: it is already full-page, growth is meaningless there, and
`ShipsScreen` depends on it. Grow logic is gated on `variant === 'docked'`.

Add two props with backwards-compatible defaults so `ShipsScreen` needs no edit:
an auto-grow toggle defaulting to on for `docked`, and a max-height fraction.
`dockedHeight` becomes the *minimum* height rather than the fixed height; keep
the prop name and raise `SessionLog`'s value to a tall starting page.

**Forbidden.** Do not add `touch-action`, `touch-none`, `touch-pan-*`, or
`overscroll-*` in any form. Do not replace the `<textarea>` with a
`contentEditable` div. Do not add a resize observer library — `scrollHeight` on
value change plus a `window.resize` listener is sufficient and dependency-free.

**Files (modify):**
- `src/components/notes/WritePad.tsx`
- `src/features/session/sessionLog/SessionLog.tsx`

**Acceptance criteria:**
- `[STRUCTURAL]` `src/components/notes/WritePad.tsx` contains a height
  recomputation that reads `scrollHeight` and applies a clamped result to the
  textarea's style, and that path is guarded on `variant === 'docked'`.
  *(REQ-001, REQ-004)*
- `[STRUCTURAL]` `SessionLog.tsx` passes a `dockedHeight` (or equivalent minimum)
  materially greater than the previous `14rem` default. *(REQ-002)*
- `[STRUCTURAL]` A maximum height bound exists and is derived from viewport
  height, not a hardcoded pixel constant (the exact fraction/formula is a
  worker decision per Intent's "Decide autonomously" list — verify the bound
  references a viewport dimension such as `window.innerHeight`, not that it
  equals any particular percentage). *(REQ-003)*
- `[MECHANICAL]` `grep -rn "touch-action\|touchAction\|touch-none\|touch-pan\|touch-manipulation" src/components/notes/WritePad.tsx src/features/session/sessionLog/ src/components/shell/ShellLayout.tsx` returns **no matches**. *(REQ-005)*
- `[MECHANICAL]` `npm run build` exits 0. *(REQ-025)*
- `[STRUCTURAL]` `WritePad`'s `commit()` still calls `textarea?.focus()` on both
  the success and the catch path, and still does not call `onClose()`.
  *(REQ-008)*
- `[STRUCTURAL]` `src/screens/ShipsScreen.tsx` is unmodified by this sub-spec
  (`git diff --name-only` does not list it). *(REQ-004)*
- `[HUMAN REVIEW]` On a touch device, typing past the initial height visibly
  extends the pad downward and the caret stays on screen; the ruled lines stay
  aligned with the text baseline at every height. *(REQ-001)*

**Dependencies:** none

---
sub_spec_id: SS-02
phase: 1
depends_on: []
---

### 2. Guard the WritePad subtree against a touch-action regression

**Scope.** The single most dangerous regression in this feature is silent: any
future `touch-action` on `WritePad` or an ancestor disables Android stylus
handwriting with no error, no console warning, and no visual change. Add a
source-scanning vitest that fails the suite when one appears.

Copy the pattern already established in
`src/features/systems/engine/engineConsumers.test.ts`: read files off disk,
strip comments so prose *about* the rule is not mistaken for a breach, then
assert. Scan a declared ancestor-chain file list —
`src/components/notes/WritePad.tsx`, `src/features/session/sessionLog/SessionLog.tsx`,
`src/components/shell/ShellLayout.tsx`, `src/components/shell/GlobalFAB.tsx`,
`src/screens/ShipsScreen.tsx` — for `touch-action`, `touchAction`, and the
Tailwind `touch-*` utilities. The test must carry a doc comment stating that the
file list *is* the WritePad ancestor chain and must be extended when a new
wrapper is introduced.

The test also asserts the positive invariant: `WritePad.tsx` still renders a
`<textarea>` element and not a `contentEditable`, because the whole feature rests
on it being a real text field.

Separately, expand `WritePad`'s component doc comment (`@remarks`) to record the
two constraints: OS recognition only targets real text fields, and `touch-action`
anywhere on the subtree kills it silently. Reference the design doc path.

**Files (new):**
- `src/components/notes/writePadHandwriting.test.ts`

**Files (modify):**
- `src/components/notes/WritePad.tsx`

**Acceptance criteria:**
- `[MECHANICAL]` `npx vitest run src/components/notes/writePadHandwriting.test.ts` exits 0. *(REQ-006)*
- `[BEHAVIORAL]` Temporarily adding `style={{ touchAction: 'none' }}` to
  `WritePad`'s root div makes that vitest run **fail**; reverting makes it pass.
  Record both outputs. *(REQ-006)*
- `[STRUCTURAL]` The test file strips comments before asserting, so a doc comment
  containing the string `touch-action` does not trip it. *(REQ-006, REQ-007)*
- `[STRUCTURAL]` `WritePad.tsx`'s `@remarks` block states both the
  real-text-field requirement and the `touch-action` prohibition, and cites
  `docs/plans/2026-07-30-pen-handwriting-notes-design.md`. *(REQ-007)*
- `[MECHANICAL]` `npm test` exits 0 with no test skipped or weakened. *(REQ-026)*

**Dependencies:** none

---
sub_spec_id: SS-03
phase: 2
depends_on: [SS-01]
---

### 3. In-app "S Pen writing isn't working" help panel

**Scope.** OS handwriting failing is the most likely failure mode and is almost
always device configuration, which the app cannot detect or fix. Surface the
ordered checks instead of failing silently.

Build a small collapsible panel component rendered on the session log, collapsed
to a single unobtrusive affordance by default so it costs zero writing area, and
expanding to the ordered checklist:

1. Samsung Keyboard is the active keyboard, with "S Pen to text" / DirectWriting
   enabled.
2. Settings → Advanced features → S Pen is on.
3. Gboard's "Write in text fields" behaves differently from Samsung Keyboard —
   try switching.
4. Try the PWA in **Samsung Internet** rather than Chrome. There is a documented
   case (Quill issue #3835) of S Pen writing working in Samsung Internet where it
   failed in Chrome.

The dismissed/expanded state persists in `localStorage`, matching the draft-park
pattern already in `SessionLog.tsx` — not IndexedDB, because this is transient UI
state and does not warrant a schema version. Wrap the read/write in `try/catch`
exactly as `readParkedDraft` does; a private-mode storage failure must not break
capture.

**Not in scope.** Do not attempt to *detect* whether handwriting is working —
there is no signal. Do not gate the panel on a device sniff. The copy is UI
copy, which the config-over-hardcoding rule explicitly exempts, so it lives in
the component.

**Files (new):**
- `src/components/notes/PenHelpPanel.tsx`

**Files (modify):**
- `src/features/session/sessionLog/SessionLog.tsx`

**Acceptance criteria:**
- `[STRUCTURAL]` `src/components/notes/PenHelpPanel.tsx` exists and exports a
  `PenHelpPanel` component. *(REQ-009)*
- `[STRUCTURAL]` The panel body names all four checks: Samsung Keyboard /
  DirectWriting, Advanced features → S Pen, Gboard, and Samsung Internet.
  *(REQ-009)*
- `[STRUCTURAL]` `SessionLog.tsx` renders `PenHelpPanel`. *(REQ-010)*
- `[STRUCTURAL]` The collapsed state renders as a single-line affordance, not a
  modal or an overlay, and the expanded/collapsed flag is read from and written
  to `localStorage` inside `try`/`catch`. *(REQ-010)*
- `[MECHANICAL]` `grep -n "touch-action\|touchAction\|touch-none\|touch-pan" src/components/notes/PenHelpPanel.tsx` returns no matches — the panel is on the WritePad ancestor chain's sibling and a `touch-action` here would be inherited by nothing, but the prohibition is absolute. *(REQ-005)*
- `[MECHANICAL]` `npx vitest run src/components/notes/writePadHandwriting.test.ts` still exits 0. *(REQ-006)*
- `[MECHANICAL]` `npm run build` exits 0. *(REQ-025)*
- `[HUMAN REVIEW]` Collapsed, the panel costs no meaningful writing height on a
  Tab S9 in landscape. *(REQ-010)*

**Dependencies:** SS-01

---
sub_spec_id: SS-04
phase: 2
depends_on: []
---

### 4. Stroke model, pen-latch logic, capability detection, and ink persistence

**Scope.** All of Approach B's *pure logic* — the parts `npm test` can actually
verify, since there is no DOM test setup. Four small modules plus one repository
extension.

**Stroke model.** A `StrokePage` is `{ version, strokes: Stroke[], pageHeight }`;
a `Stroke` is `{ points: [x, y, pressure][], tool, color, width }`. Points are a
flat tuple array, not objects — it serialises smaller and reads back as plain
JSON. Provide `serializeStrokePage` / `deserializeStrokePage` and a
`strokeBounds` helper (needed for tile invalidation in SS-05). Per the
disambiguation above: the deserialiser is permissive (drops malformed strokes,
returns the rest, never throws); the serialiser is strict (refuses a
zero-point stroke). Everything must be plain JSON — no `Blob`, no `Map`, no class
instance — because it is stored inside a Dexie record and must round-trip through
`bundle.ts` export/import.

**Pen latch.** A pure state machine, framework-free and DOM-free, so it is
testable: given a sequence of `{ pointerId, pointerType, phase, timestamp }`
events it answers "is this event accepted as ink, or discarded?". Rules: a pen
`pointerdown` latches; while latched, non-pen events are discarded; `pointerup`
starts a 500 ms suppression window during which non-pen events are still
discarded; `pointercancel` discards the in-progress stroke and resets; and when
the active pointer set empties, all state resets unconditionally.

**Capability detection.** Feature detection only — `matchMedia('(pointer: fine)')`
/ observed pen pointers, `'ink' in navigator`, and
`'createHandwritingRecognizer' in navigator`. Every probe wrapped so a missing
API is `false`, never a throw. **No user-agent string is read.** Handwriting
Recognition is detected as a bonus branch only; nothing may depend on it.

**Persistence.** Extend `noteRepository` with `saveInkPage(noteId, page)` and
`readInkPage(note)`, writing under a single namespaced key inside the existing
`typeData` object and **preserving any other `typeData` keys** (read-modify-write,
never overwrite the whole object). Also a `createInkLogEntry` that creates a
`log` note with an empty body and an ink `typeData`. This adds **no** Dexie
version block and **no** `NOTE_TYPES` entry.

**Files (new):**
- `src/features/notes/ink/strokeModel.ts`
- `src/features/notes/ink/strokeModel.test.ts`
- `src/features/notes/ink/penLatch.ts`
- `src/features/notes/ink/penLatch.test.ts`
- `src/features/notes/ink/penCapability.ts`

**Files (modify):**
- `src/storage/repositories/noteRepository.ts`

**Acceptance criteria:**
- `[MECHANICAL]` `npx vitest run src/features/notes/ink/` exits 0. *(REQ-011, REQ-015, REQ-016, REQ-017)*
- `[MECHANICAL]` `npx vitest run src/features/notes/ink/strokeModel.test.ts` includes a case asserting `JSON.parse(JSON.stringify(page))` deep-equals the serialised page, and a case where a malformed stroke is dropped while its siblings survive. *(REQ-011)*
- `[MECHANICAL]` `npx vitest run src/features/notes/ink/penLatch.test.ts` covers, as named cases: touch discarded while pen down; touch discarded within 500 ms of `pointerup`; touch accepted after 500 ms; `pointercancel` discards the in-progress stroke; state resets when the active pointer set empties. *(REQ-015, REQ-016, REQ-017)*
- `[MECHANICAL]` `git diff src/storage/db/client.ts` is empty and `grep -c "this.version(" src/storage/db/client.ts` still reports 14. *(REQ-013)*
- `[MECHANICAL]` `grep -n "NOTE_TYPES" src/types/note.ts` shows the list unchanged — no `'ink'` entry. *(REQ-012)*
- `[STRUCTURAL]` `noteRepository.saveInkPage` reads the note's existing
  `typeData`, merges under one namespaced key, and writes back — a note with
  unrelated `typeData` keys retains them. *(REQ-012)*
- `[MECHANICAL]` `grep -rn "userAgent\|navigator.platform\|systemId ===" src/features/notes/ink/` returns no matches. *(REQ-022, REQ-027)*
- `[STRUCTURAL]` `src/features/notes/ink/penCapability.ts` wraps every probe so
  a missing API yields `false` rather than throwing, and treats
  `createHandwritingRecognizer` as a bonus branch nothing depends on. *(REQ-022)*
- `[MECHANICAL]` `npm run build` exits 0. *(REQ-025)*

**Dependencies:** none

---
sub_spec_id: SS-05
phase: 3
depends_on: [SS-04]
---

### 5. InkPad — pointer capture, palm rejection, and the tiled two-canvas render

**Scope.** The DOM half of Approach B. `InkPad` owns pointer capture, the
pen/touch routing (delegating every accept/discard decision to SS-04's
`penLatch` — it re-implements none of it), stroke tessellation, the two-canvas
render, and viewport tiling. It owns neither persistence nor recognition: it
takes a `StrokePage` in and emits stroke commits out.

**Two canvases.** A committed layer holding everything already finished, and a
wet-ink layer on top that redraws only the in-progress stroke. Redrawing the
whole page per `pointermove` is the difference between ink that feels like a pen
and ink that lags.

**Tiling — non-negotiable.** Canvas has hard per-axis (~32,767 px) and total-area
caps, so a page-height canvas will fail to allocate on a long page. Allocate
viewport-height plus a bounded overscan and re-rasterise from the vector store as
the page scrolls. Use SS-04's `strokeBounds` to decide which region a committed
stroke invalidates.

**Pointer handling.** Register `pointerdown` via `addEventListener` with
`{ passive: false }` and call `preventDefault()` **synchronously** for
`pointerType === 'pen'` — a React `onPointerDown` prop cannot guarantee a
non-passive listener, and a passive listener means the pen starts a scroll
instead of a stroke. Gather points with `getCoalescedEvents()` where available,
falling back to the single event where it is not. Extend page height when a
stroke's max-y crosses ~70% of the viewport, so there is always blank page below
the pen — the ink-layer counterpart of SS-01's growing textarea.

**Undo.** Provide undo over committed strokes. Per the design, undo — not
geometry — is the answer to a palm stroke that slips through.

**Files (new):**
- `src/components/notes/InkPad.tsx`

**Acceptance criteria:**
- `[STRUCTURAL]` `InkPad` registers `pointerdown` through `addEventListener` with
  `{ passive: false }` and calls `preventDefault()` synchronously on the
  `pointerType === 'pen'` path. A React `onPointerDown` prop is not used for
  this. *(REQ-019)*
- `[STRUCTURAL]` `InkPad` imports and calls `penLatch` from
  `src/features/notes/ink/penLatch.ts` and contains no second copy of the
  pen/touch decision rules. *(REQ-015, REQ-016)*
- `[STRUCTURAL]` `InkPad` handles `pointercancel` by discarding the in-progress
  stroke, and resets all pointer state when the active pointer set empties.
  *(REQ-016, REQ-017)*
- `[STRUCTURAL]` Canvas `width`/`height` are computed from viewport dimensions
  plus a bounded overscan constant. No expression assigns page height to a canvas
  dimension. *(REQ-018)*
- `[STRUCTURAL]` Two `<canvas>` elements are rendered — a committed layer and a
  wet-ink layer — and the `pointermove` path draws only to the wet layer.
  *(REQ-018)*
- `[STRUCTURAL]` `getCoalescedEvents` is called behind a capability check with a
  single-event fallback. *(REQ-020)*
- `[MECHANICAL]` `grep -n "touch-action\|touchAction" src/components/notes/InkPad.tsx` — if `touch-action: none` is set, it is set **on the InkPad canvas elements only** and the sub-spec's diff shows no `touch-action` reaching a shared ancestor. Ink needs it; `WritePad` must never inherit it. *(REQ-005, REQ-018)*
- `[MECHANICAL]` `npx vitest run src/components/notes/writePadHandwriting.test.ts` exits 0 — proving the ink layer did not leak `touch-action` onto the text path. *(REQ-005, REQ-006)*
- `[MECHANICAL]` `npm run build` exits 0. *(REQ-025)*
- `[HUMAN REVIEW]` **Requires a Galaxy Tab S9 with an S Pen.** Drawing a stroke
  produces ink that tracks the nib without perceptible lag; resting a palm while
  writing produces no stray marks; a long page keeps scrolling with no canvas
  allocation failure in the console. **`tests/e2e_full_test.py` cannot verify
  this — desktop Chromium has no stylus and cannot emit `pointerType: 'pen'`
  with realistic timing.** *(REQ-015, REQ-018)*

**Dependencies:** SS-04

---
sub_spec_id: SS-06
phase: 4
depends_on: [SS-03, SS-04, SS-05]
---

### 6. Wire the ink surface into the session log and prove ink survives reload

**Scope.** The integration sub-spec. Nothing before this point is reachable from
a running app; this makes it so, and it is the only sub-spec that changes what a
user sees on `/session/log` beyond a taller pad.

Add an opt-in ink mode to `SessionLog`: a mode toggle whose ink option is
offered only when `penCapability` reports a pen (feature detection, never a
sniff), and whose **default is always the text `WritePad`** — Approach A is the
path that yields text and must stay the default. In ink mode, `SessionLog`
renders `InkPad` in the docked slot instead of `WritePad`; committing calls
`noteRepository.createInkLogEntry` / `saveInkPage`, then the existing `refresh()`.

Extend the entry list's `renderEntry` so an entry carrying an ink `typeData`
payload renders as ink (a bounded read-only preview raster) rather than as empty
text — a `log` note with an empty ProseMirror body currently renders as a blank
row, which would look like data loss.

**Failure contract.** A failed ink write re-throws so the strokes stay in memory
and a toast fires, exactly mirroring `handleCommit`'s existing comment: refresh
before clearing, never clear on failure.

Finally, update `tests/e2e_full_test.py`'s session-log phase to assert that the
text path still works end to end and that the mode toggle renders — and to state
in a comment that ink capture itself is **not** covered because the harness has
no stylus.

**Files (modify):**
- `src/features/session/sessionLog/SessionLog.tsx`
- `tests/e2e_full_test.py`

**Acceptance criteria:**
- `[INTEGRATION]` `src/features/session/sessionLog/SessionLog.tsx` imports
  `InkPad` from `src/components/notes/InkPad.tsx`, `penCapability` from
  `src/features/notes/ink/penCapability.ts`, and the ink persistence functions
  from `src/storage/repositories/noteRepository.ts` — every module created by
  SS-04 and SS-05 is reachable from the `/session/log` route. *(REQ-023, REQ-024)*
- `[MECHANICAL]` `grep -rn "InkPad\|penCapability\|saveInkPage" src/ --include=*.tsx --include=*.ts | grep -v "src/components/notes/InkPad.tsx\|src/features/notes/ink/"` returns at least one hit in `SessionLog.tsx` — no module created by this spec is an orphan. *(REQ-023)*
- `[STRUCTURAL]` The capture-mode state initialises to the text pad
  unconditionally, and the ink option is rendered only when `penCapability`
  reports a pen. *(REQ-023)*
- `[STRUCTURAL]` `renderEntry` branches on the presence of an ink `typeData`
  payload and renders ink for those entries. *(REQ-024)*
- `[STRUCTURAL]` The ink commit path re-throws on failure so strokes are retained
  and a toast fires; it does not clear the surface in a `finally`. *(REQ-021)*
- `[MECHANICAL]` `grep -rn "\.version(" src/storage/db/client.ts | wc -l` reports 14, and `grep -rn "db\.notes" src/features/ src/components/ src/screens/` returns no matches — UI never touches Dexie tables. *(REQ-012, REQ-013)*
- `[MECHANICAL]` `grep -rn "typeData" src/types/bundle.ts src/features/export/useExportActions.ts` — confirm export required **no** change because `bundle.ts:49` already serialises notes via `baseNoteSchema`. *(REQ-014)*
- `[MECHANICAL]` `npx vitest run src/features/systems/engine/engineConsumers.test.ts` exits 0 — no `systemId` branch introduced. *(REQ-027)*
- `[MECHANICAL]` `npm run build` exits 0 and `npm test` exits 0. *(REQ-025, REQ-026)*
- `[BEHAVIORAL]` `python tests/e2e_full_test.py` completes its session-log phase:
  the FAB navigates to `/session/log`, text capture commits an entry, and the
  capture-mode toggle is present in the DOM. Ink capture is explicitly **not**
  asserted. *(REQ-023)*
- `[HUMAN REVIEW]` **Requires a Galaxy Tab S9.** Draw an ink entry, commit it,
  fully reload the PWA: the entry is still in the log and still renders as the
  same ink. Then export the campaign bundle and confirm the ink payload is
  present in the JSON. *(REQ-024, REQ-014)*

**Dependencies:** SS-03, SS-04, SS-05

## Edge Cases

- **OS handwriting never fires at all.** The most likely failure and almost
  always configuration. The app cannot detect it. Handled by SS-03's help panel
  listing the ordered checks, including the Samsung Internet vs Chrome case
  (Quill #3835). Do not add detection logic — there is no signal to detect.
- **A `touch-action` regression silently kills handwriting.** Handled by SS-02's
  guard test plus SS-05's rule that ink's `touch-action: none` lives on the
  canvas elements only, never on a shared ancestor. This is the failure most
  likely to be reintroduced by a future unrelated change, which is exactly why
  it is a test and not a comment.
- **Palm strokes appear as ink.** Strict latch + 500 ms suppression window +
  discard on `pointercancel`, plus undo. No geometry heuristic — stylus
  `width`/`height` report 0 on Android, so the signals do not exist.
- **Finger already down when the pen lands (stuck pan/draw state,
  Excalidraw #9945).** Reset all pointer-mode state on `pointercancel` and
  unconditionally whenever the active pointer set empties. Both are named test
  cases in SS-04.
- **Canvas allocation failure on a long page.** Never allocate page height; tile
  to viewport plus bounded overscan and re-rasterise from vectors (SS-05).
- **Ink write fails.** Strokes stay in memory, toast fires, nothing clears —
  identical to `WritePad`'s existing rejection contract (REQ-021).
- **The growing pad squeezes the entry list to nothing.** Bounded by a
  viewport-fraction maximum (REQ-003). The entry list is not decoration:
  tap-to-edit and selection both live there.
- **A note carries unrelated `typeData` when ink is saved.** `saveInkPage` does
  read-modify-write under one namespaced key and never replaces the whole object.
- **A stored ink payload is corrupt.** The deserialiser drops malformed strokes
  and returns the rest. One bad stroke must never make a note unreadable.
- **`localStorage` unavailable (private mode / quota).** The help panel's
  persisted state is read and written inside `try`/`catch`, matching
  `readParkedDraft`. The panel simply forgets its state; capture is unaffected.
- **`getCoalescedEvents` missing.** Capability check with a single-event
  fallback; fidelity degrades, capture does not fail.
- **`ShipsScreen`'s fullscreen pad.** Untouched. Grow logic is gated on
  `variant === 'docked'` and the new props default to the current behaviour.
- **DirectWriting docks a panel regardless of textarea height.** The pivotal
  unknown (REQ-028). If true, A's ceiling drops but A still delivers a growing
  page, and B becomes the primary answer — which is why B is specced now rather
  than deferred behind the device test.

## Out of Scope

Carried verbatim from the design's binding `## Exclusions`:

- **No bundled recognition model in this pass.** No TrOCR, no transformers.js,
  no Tesseract.js — image OCR is the wrong modality for ink and cannot do
  cursive. The OnlineHTR/ONNX stroke spike is deliberately deferred, not
  forbidden; **it must not be started before Approach B ships.**
- **No cloud recognition.** No MyScript cloud, no Google/Azure OCR. It would be
  the first server in a deliberately serverless app.
- **No native wrapper.** No TWA/Capacitor to reach ML Kit. It changes the
  distribution story entirely.
- **No rasterise-then-OCR.** Explicitly rejected on accuracy grounds.
- **No handwriting *search* over ink** in this pass.
- **No S Pen barrel-button features** — not exposed to web content.

Additionally out of scope for this spec:

- **No Dexie `version(15)` block and no migration.** Ink is a `typeData`
  payload on the existing `log` type.
- **No new `NOTE_TYPES` entry.**
- **No component/DOM test infrastructure.** No jsdom, no React Testing Library,
  no `@testing-library/*` dependency. `npm test` stays pure-logic-only.
- **No changes to the export or import features.** `bundle.ts` already covers
  `typeData`.
- **No stylus assertions in `tests/e2e_full_test.py`.**
- **No `SessionQuickActions`-style chips, drawers or tag pickers** on the
  capture surface — the 2026-07-29 overhaul deleted them deliberately.
- **No ink rendering in the session timeline, notes grid, or print view.**
- **No pressure-curve tuning, pen colour/width picker UI, or eraser tool.** The
  model carries `tool`, `color` and `width` fields so these are additive later.

## Constraints

**Musts:**

- Approach A (SS-01 through SS-03) must be shippable and useful with SS-04
  through SS-06 unbuilt. If B stalls, A merges alone.
- Ink persists through `src/storage/repositories/noteRepository.ts`. UI code
  never touches `db.notes`.
- Soft delete is inherited from the existing `log` note path — `deletedAt` +
  `softDeletedBy`, reads filtered by `excludeDeleted`.
- The stroke payload must be plain JSON — no `Blob`, `Map`, or class instance —
  so it round-trips through `bundle.ts` export and import.
- Pen detection is runtime feature detection only.
- Every device-bound criterion is tagged `[HUMAN REVIEW]` and names the device.

**Must-Nots:**

- Must not add `touch-action` (or a Tailwind `touch-*` utility) to `WritePad` or
  any ancestor. Ink's `touch-action: none` is confined to `InkPad`'s own canvas
  elements.
- Must not replace `WritePad`'s `<textarea>` with a `contentEditable` element —
  the OS recogniser only targets real text fields.
- Must not add a `version(15)` block to `src/storage/db/client.ts`.
- Must not introduce a `systemId ===` branch anywhere outside
  `src/features/systems/engine/index.ts`.
- Must not clear the pad or the ink surface on a failed write.
- Must not weaken, skip, or delete an existing test to make the suite pass.
- Must not read `navigator.userAgent` or otherwise sniff the device.
- Must not make ink the default capture mode.
- Must not add a Playwright criterion that a stylus-less desktop harness would
  pass without proving anything.

**Preferences:**

- Prefer extending an existing module over adding one; prefer adding a pure
  module with a vitest over adding logic to a component that cannot be tested.
- Prefer `typeData` over a schema change; prefer a schema change over a new
  table; never a new table here.
- Prefer feature detection over configuration, and configuration over a
  hardcoded literal, per the project's config-over-hardcoding rule. UI copy is
  exempt.
- Prefer dependency-free implementations — no drawing, gesture, or
  auto-resize library. `scrollHeight`, `PointerEvent` and `CanvasRenderingContext2D`
  are sufficient.
- Prefer `localStorage` for transient UI state, matching `SessionLog`'s existing
  draft-park pattern.

**Escalation Triggers — stop and surface to the user:**

- A worker concludes ink genuinely requires a Dexie `version(15)` block, a new
  `NOTE_TYPES` entry, or a change to `src/types/note.ts`. The whole
  migration-free premise is at stake; do not proceed on your own judgement.
- Making SS-01 work appears to require setting `touch-action` on `WritePad` or an
  ancestor. That trades the feature for the fix.
- Any acceptance criterion appears to require jsdom or a React testing library.
- The Tab S9 test for REQ-028 shows DirectWriting docks a panel regardless of
  textarea height — report it; it re-weights A against B for future work but
  does not stop this spec.
- A change would touch `src/screens/ShipsScreen.tsx` or the `fullscreen`
  variant's geometry.
- `tests/e2e_full_test.py`'s existing phases start failing for reasons unrelated
  to the ink toggle.

**Known Weak Areas:**

- **Device-bound verification.** The single most important claim in this spec —
  that a tall growing textarea changes how the Samsung recogniser behaves — has
  no automated proof and cannot have one. Every criterion touching it is
  `[HUMAN REVIEW]`. Workers must not substitute a desktop Chromium assertion for
  it, and must not report the feature verified without the device pass.
- **`InkPad` has no unit coverage.** There is no DOM test setup and this spec
  does not add one, so SS-05's criteria are structural (source assertions) plus
  human review. This is why every rule that *can* be pure — the latch, the model,
  the capability probe — is pushed into SS-04 where vitest reaches it. Reviewers
  should read `InkPad` unusually carefully.

## Verification

**End to end, in order:**

1. **Automated, repo root:**
   - `npm run build` exits 0.
   - `npm test` exits 0, including the new
     `src/components/notes/writePadHandwriting.test.ts` and
     `src/features/notes/ink/*.test.ts`, with no prior test skipped.
   - `grep -c "this.version(" src/storage/db/client.ts` reports **14**.
   - `grep -rn "db\.notes" src/features/ src/components/ src/screens/` returns
     nothing.
   - `npx vitest run src/features/systems/engine/engineConsumers.test.ts` exits 0.
2. **Regression proof of the guard:** add `touchAction: 'none'` to `WritePad`'s
   root, confirm `writePadHandwriting.test.ts` **fails**, revert, confirm it
   passes. Paste both outputs.
3. **Desktop Chromium E2E:** `python tests/e2e_full_test.py` completes, including
   the session-log phase. This proves the text path and the mode toggle render.
   **It proves nothing about handwriting or ink.**
4. **Galaxy Tab S9 with S Pen — the only pass that verifies the feature:**
   - Install the PWA and open `/session/log`.
   - Write with the S Pen. Record whether text appears in the pad, and whether a
     docked IME panel occupies the lower screen. **This answers REQ-028, the
     design's pivotal open question.** If a panel docks, record the exact device
     settings tried.
   - Keep writing past the initial pad height: the pad must extend downward, the
     caret must stay visible, and the ruled lines must stay aligned.
   - Repeat in **Samsung Internet** and compare against Chrome (design open
     question #2). Record the result — it belongs in the help panel copy.
   - Switch to ink mode. Draw a page while resting a palm: no stray marks. Scroll
     a long page: no canvas allocation error in the console.
   - Commit an ink entry, fully reload: the entry is present and renders as the
     same ink.
   - Export the campaign bundle; confirm the ink payload is in the JSON.
   - Enable airplane mode and repeat text capture and ink capture: both must work
     with **no network and no model download** (design success criterion 3).

**Wave ordering:** wave 1 — SS-01, SS-02 (parallel). Wave 2 — SS-03, SS-04
(parallel). Wave 3 — SS-05. Wave 4 — SS-06. Approach A is complete and mergeable
at the end of wave 2.
