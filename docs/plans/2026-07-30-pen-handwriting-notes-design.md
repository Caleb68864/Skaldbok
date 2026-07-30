---
date: 2026-07-30
topic: "Pen handwriting into notes — free and offline"
author: Caleb Bennett
status: draft
tags:
  - design
  - pen-handwriting-notes
  - handwriting
  - skaldbok
---

# Pen Handwriting into Notes — Design

## Summary

Make S Pen note capture on the Galaxy Tab S9 feel like a notebook page rather than a
cramped IME strip. The research says plainly that **there is no free, offline,
stroke-based handwriting recogniser reachable from a browser** — so the only route to
*text* is the Android OS recogniser, which only fires on real text inputs. This design
therefore does two separable things: (1) make the existing `WritePad` textarea a
correct, tall, auto-growing OS-handwriting target so the recogniser writes into a
full-screen page instead of a docked panel, and (2) add an optional ink layer that
stores strokes as vectors, so a page that is *drawn* is never lost even when nothing
recognises it.

## Approach Selected

**Approach A+B (staged): fix the OS-handwriting target first, then add ink-as-truth
capture as a separate, additive note surface.** A is nearly free and is the only path
that produces *text*; B is the only path that produces a *notebook page*. Neither
alone satisfies the request, and B must never block A.

## Context — what the research established

These are settled. Do not re-investigate during implementation.

- **The Handwriting Recognition API is ChromeOS-only.** Chromium's
  `runtime_enabled_features.json5` sets `HandwritingRecognition` to `"ChromeOS":
  "stable"`, `"default": "experimental"`. There is no Android backend. Feature-detect
  it as a bonus branch, never as a plan.
- **MyScript's web SDK (iinkTS) is cloud-only.** On-device recognition exists only in
  the native iOS/Android/Windows iink SDK. Cloud breaks local-first.
- **ML Kit Digital Ink Recognition has no web path.** Android/iOS native only, ~20 MB
  per language. A **TWA cannot reach it** (a TWA is just a Chrome tab in a shell);
  Capacitor can, but that means shipping an APK — no longer a PWA.
- **MyScript's native offline SDK phones a licence server** and stops recognising
  roughly 30 days after install. Even the paid offline route is not truly offline.
- **Image OCR is the wrong modality and the sizes are worse than assumed.** Verified
  ONNX totals: `trocr-small-handwritten` int8 ≈ **64 MB**, `trocr-base-handwritten`
  int8 ≈ **338 MB** (encoder + decoder both required). TrOCR's headline 3.42% CER holds
  only on cleanly cropped single lines — ~30% CER on words. Rasterising strokes and
  OCRing them discards the stroke-order signal that makes cursive tractable.
  Tesseract.js is 30–55% on cursive: not a candidate.
- **One credible open stroke recogniser exists, and it is unproven.**
  `PellelNitram/OnlineHTR` — MIT, actively maintained (last activity 2026-06-11), a
  PyTorch reimplementation of the Carbune architecture with free IAM-OnDB weights.
  PyTorch → ONNX is routine, and the whole thing lands around **10–20 MB** with ONNX
  Runtime Web. But: the **weights carry no explicit licence**, **no CER is published**,
  IAM-OnDB itself is non-commercial-research-licensed, and it is English-only research
  code. Google's own Carbune weights were never released. This is a research spike, not
  a plan.
- **Storage is not the constraint; download and speed are.** Chrome on Android grants
  an origin ~60% of disk, so even 338 MB would *fit* on a Tab S9. The objections to a
  bundled model are first-run download, cold start, and autoregressive decode speed on
  ARM — not quota.
- **The OS recogniser only targets real text fields.** `WritePad` already uses a
  `<textarea>` for exactly this reason. That constraint stands.
- **`touch-action` gates handwriting.** Android currently requires both `pan-x` and
  `pan-y` to be permitted for stylus handwriting to fire on a field. `touch-action:
  none` or `pan-y` alone on the field *or any ancestor* silently disables it. The
  proposed `touch-action: handwriting` keyword is **"Proposed", not shipped**; the
  HTML `handwriting` attribute is **"No active development"**. Neither is available.
- **`pointerType` is the only reliable pen signal on Android.** Contact geometry
  (`width`/`height`) reports 0 for stylus on Android, so geometry-based palm rejection
  is unavailable. Samsung provides no OS-level global palm rejection — apps implement
  it themselves.
- **Canvas has hard size caps** (~32,767 px per axis, plus area caps). A page-height
  canvas is not viable; ink must be tiled and re-rasterised from vectors.

## Architecture

Two independent surfaces behind one entry point. The session log keeps its current
commit contract; nothing about `Note` storage changes shape.

```
                    ┌──────────────────────────────┐
                    │  Session Log / Note screen   │
                    └──────────────┬───────────────┘
                                   │ "write" action
                   ┌───────────────┴────────────────┐
                   │                                │
         ┌─────────▼─────────┐            ┌─────────▼──────────┐
         │  WritePad (text)  │            │  InkPad (strokes)  │
         │  <textarea>       │            │  <canvas> ×2       │
         │  OS recogniser    │            │  pointerType==pen  │
         │  writes here      │            │                    │
         └─────────┬─────────┘            └─────────┬──────────┘
                   │ string                          │ StrokePage
                   └───────────────┬─────────────────┘
                                   ▼
                       ┌───────────────────────┐
                       │  note body (ProseMirror
                       │  doc) + optional ink
                       │  attachment in Dexie  │
                       └───────────────────────┘
```

`WritePad` is the default and the only path that yields text. `InkPad` is opt-in per
entry and yields a stroke page rendered as ink.

## Components

**`WritePad` (exists — `src/components/notes/WritePad.tsx`)**
Owns: the OS-handwriting text target. Must become an *auto-growing* surface so there is
always blank ruled space below the caret — that is what turns "cramped panel" into
"page you keep writing down". Must not own: ink, recognition, or stroke storage.
Explicitly must **not** set `touch-action` on itself or gain a `touch-action`-setting
ancestor, or OS handwriting dies silently.

**`InkPad` (new)**
Owns: pointer capture, pen/touch routing, palm rejection, stroke tessellation, the
two-canvas render (committed layer + wet-ink layer), and viewport tiling. Does not own
persistence or recognition. Renders only what the stroke store gives it.

**`strokeStore` (new, in-memory) + ink persistence (new repository method)**
Owns: the vector model — `{ points: [x, y, pressure][], tool, color, width }` per
stroke, plus page height. Source of truth for undo, redo, export and re-rasterisation.
Ink is stored as a note attachment / `typeData` payload; the note body stays a
ProseMirror doc, per the existing universal-note-model contract.

**`penCapability` (new, tiny)**
Owns: runtime detection — does a `pen` pointer exist, does `navigator.ink` exist, does
`createHandwritingRecognizer` exist. Feature-detection only; never a device sniff and
never a `systemId`-style branch.

## Data Flow

**Text path.** Pen touches the tall `WritePad` textarea → Android/Samsung recogniser
claims the stroke because the field is handwriting-eligible → recognised text is
committed through the field's `InputConnection` → React `onChange` fires → existing
`onCommit` writes a `log` note. Unchanged from today apart from the taller, growing
target.

**Ink path.** `pointerdown` with `pointerType === 'pen'` → `preventDefault()`
synchronously in a `{passive: false}` listener so the pen never starts a scroll →
points accumulate via `getCoalescedEvents()` for fidelity → wet-ink canvas redraws that
stroke only → `pointerup` commits the stroke to `strokeStore` → the committed canvas
re-rasterises the affected tile → page height extends when the stroke's max-y crosses
~70% of the viewport → debounced write to Dexie.

Touch pointers are ignored entirely while a pen pointer is down and for ~500 ms after
`pointerup`. `pointercancel` **discards** the in-progress stroke rather than committing
it.

## Error Handling

- **OS handwriting doesn't fire at all.** The single most likely failure, and it is
  usually configuration, not code. Ordered checks: Samsung Keyboard active with S Pen
  to text on; Settings → Advanced features → S Pen; whether Gboard's "Write in text
  fields" behaves differently; and **Samsung Internet vs Chrome** — there is a
  documented case (Quill #3835) of S Pen writing working in Samsung Internet where it
  failed in Chrome. The app cannot detect this; surface a short in-app help panel
  rather than failing silently.
- **A `touch-action` regression kills handwriting.** Silent and hard to trace. Mitigate
  with an explicit note in the component doc comment and a mechanical check that no
  `touch-action` is applied to the WritePad subtree.
- **Palm strokes appear as ink.** Handled by the pen-latch + suppression window, and by
  discarding on `pointercancel`. Provide undo; do not attempt clever geometry rejection
  — the signals are not available on Android.
- **Stuck pan/draw state** when a finger is already down and the pen then lands
  (Excalidraw #9945 is the reference failure). Reset all pointer-mode state on
  `pointercancel` and whenever the active pointer set empties.
- **Canvas allocation failure** on a long page. Never allocate page-height; tile to
  viewport plus overscan.
- **Ink write fails.** Retain strokes in memory and toast, matching WritePad's existing
  "never clear on failure" contract.

## Success Criteria

1. On the Tab S9, writing with the S Pen on the note surface produces text **without a
   docked IME panel occupying the lower screen**, or — if the OS insists on a panel —
   the app documents the exact device setting that removes it.
2. The writing target is full-screen and **keeps growing downward** as the user writes;
   the user never runs out of page.
3. Capture still works with **no network** and with **no model download**.
4. Committing an entry does not blur the field or close the writing surface (existing
   contract, preserved).
5. Ink strokes, where used, survive reload and export.
6. `npm run build` passes; no `systemId` branching introduced.

## Exclusions

- **No bundled recognition model in this pass.** No TrOCR, no transformers.js, no
  Tesseract.js — image OCR is the wrong modality for ink and can't do cursive. The
  OnlineHTR/ONNX stroke spike is deliberately deferred, not forbidden (see Approaches
  Considered); it must not be started before Approach B ships.
- **No cloud recognition.** No MyScript cloud, no Google/Azure OCR. It would be the
  first server in a deliberately serverless app.
- **No native wrapper.** No TWA/Capacitor to reach ML Kit. Out of scope; it changes the
  distribution story entirely.
- **No rasterise-then-OCR.** Explicitly rejected on accuracy grounds.
- **No handwriting *search* over ink** in this pass.
- **No S Pen barrel-button features** — not exposed to web content.

## Open Questions

- Does Samsung DirectWriting treat a very tall `<textarea>` as one large writing area,
  or does it still dock a panel regardless of field height? **This is the pivotal
  unknown and is answerable only on the device.** If it docks regardless, Approach A's
  ceiling is much lower and the ink layer becomes the primary answer.
- Does the PWA installed via **Samsung Internet** behave better than via Chrome for S
  Pen writing? Worth a 10-minute test before any code is written.
- Should ink pages be a new note *type* or a `typeData` payload on the existing `log`
  type? The universal-note-model contract makes the latter additive and migration-free;
  confirm before speccing.

## Approaches Considered

- **A — Better OS-handwriting target (selected, first).** Tall auto-growing textarea,
  correct `touch-action`, device-setting guidance. Free, offline, no model, tiny code.
  The only path that yields *text*. Ceiling is set by the OS, not by us.
- **B — Ink as truth, no recognition (selected, second).** Store strokes as vectors and
  render ink. Gives a true notebook page and perfect fidelity. Cost: real work, and the
  output is not searchable text.
- **C — Bundled offline recogniser (rejected for now, one spike worth keeping).** The
  image-OCR substitutes (TrOCR 64–338 MB, Tesseract.js) fail on cursive and are the
  wrong modality. The one genuinely interesting option is **OnlineHTR → ONNX Runtime
  Web at ~10–20 MB** — small enough to precache and stroke-based, so it would compose
  with Approach B rather than replace it. Rejected *now* only because its weights have
  no stated licence and no published accuracy. If B ships and ink-search becomes
  desirable, this is the spike to run — timeboxed, and gated on emailing the author
  about licence and CER.

## Next Steps

- [ ] **Before speccing:** run the two device experiments in Open Questions. They can
      invalidate half this design in 15 minutes.
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-07-30-pen-handwriting-notes-design.md`)
- [ ] Confirm the ink-storage shape against the universal-note-model contract
