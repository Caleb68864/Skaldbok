# SS-12 — Integration evidence

Date: 2026-07-27

## Change summary

- `src/features/session/SessionQuickActions.tsx`: the FAB's "Note" quick
  action now opens `SessionLog` (`src/features/session/sessionLog/SessionLog.tsx`)
  instead of `QuickNoteAction`. `QuickNoteAction`/`QuickNoteDrawer` are
  untouched on disk and neither was deleted.

> **Correction (converge pass 1, 2026-07-27).** This section originally claimed
> "`QuickNoteAction` is still used by `PromoteEntriesSheet`". **That is false.**
> The only occurrence in `PromoteEntriesSheet.tsx` is a doc-comment naming
> where `SELECTABLE_NOTE_TYPES` is defined — not an import and not a render.
>
> Verified state: **both `QuickNoteAction` and `QuickNoteDrawer` have zero
> importers anywhere in `src/`.** They exist but are unreachable through any UI
> path, so the spec's "remain reachable outside the session flow" requirement
> is *not* met.
>
> Context that partly excuses it: `QuickNoteDrawer` had **zero importers before
> this work began** (verified at `5ad7566`) — it was already dead code when the
> requirement was written, so that half of the requirement was never
> satisfiable. Only `QuickNoteAction` was orphaned *by* SS-12.
>
> Deleting either is a human-only decision per the spec, so neither was removed
> and no artificial entry point was invented. Escalated for a decision.
- `src/features/notes/PromoteEntriesSheet.tsx`: fixed a latent gap surfaced
  during this integration pass — approving a suggested wikilink in the
  Promote sheet updated only the panel's local preview text and was
  discarded; the note actually created/appended never received the
  resolved `[[link]]`. `createNoteAndPromote` and
  `appendEntriesToExistingNote` now take the (possibly link-resolved) body
  text explicitly, and the sheet tracks the running approved text via
  `onApprove` so promotion persists any approved links.

## Mechanical checks

```
$ grep -rc "QuickNoteDrawer" src/
src/features/notes/QuickNoteDrawer.tsx:6
```
(non-zero — component still exists and is reachable outside play)

```
$ npm run build
...
✓ built in ~10.5s
```
Exit code 0.

```
$ npm test
 Test Files  23 passed (23)
      Tests  236 passed (236)
```
236 ≥ 219 required.

## Integration run (full flow, in the running app)

Exercised with a Playwright script against the Vite dev server
(`tests/ss12_integration_check.py`, chromium, headless):

1. Created campaign "SS12 Integration \<ts\>", started a session.
2. Created an NPC note "Dorgan the Blacksmith" via the FAB's "NPC / Monster"
   quick action.
3. Opened the FAB → **Note** action → confirmed it opens `SessionLog` (the
   docked `WritePad` + entry list), not the old `QuickNoteAction` chip form.
4. Committed 3 log entries via `WritePad`, one of which mentions
   "Dorgan the Blacksmith".
5. Tapped the first entry, edited it in place (appended `[edited]`),
   re-committed — confirmed the edit persisted and the entry count stayed
   at 3.
6. Long-pressed the second entry (~700ms pointerdown/up) — confirmed it
   soft-deleted (entry count dropped to 2).
7. Right-clicked (context-menu toggle) the remaining 2 entries to select
   them — confirmed the "2 selected" selection toolbar appeared.
8. Clicked **Promote** — the `PromoteEntriesSheet` opened over the
   selection.
9. Approved the single suggested `[[Dorgan the Blacksmith]]` wikilink
   (using an exact-name "Approve" button, distinct from "Approve all").
10. Filled a title ("Forge Recap") and clicked **Create note** — the
    selection was promoted into a new NPC-linked note; source entries were
    not deleted.
11. Navigated to `/session`, opened the session's overflow menu, clicked
    **Export Notes ZIP**, captured the downloaded file.

### Observed export contents

```
session-<id>.md
forge-recap-<id>.md
dorgan-the-blacksmith-<id>.md
```

- `session-<id>.md` contains a `## Session Log` section with both
  surviving entries, including the edited text (`... [edited]`) — confirms
  a session with log entries plus promoted notes still renders the
  chronological log section inline.
- `forge-recap-<id>.md` (the promoted note) contains:

  ```
  [<timestamp>]
  We met [[Dorgan the Blacksmith]] at the forge. Entry one. [edited]

  [<timestamp>]
  Entry three: left town before dusk.
  ```

  i.e. the approved link renders as a single, correctly resolved
  `[[Dorgan the Blacksmith]]` wikilink (not the raw plain-text mention),
  confirming the `PromoteEntriesSheet` fix above.

All steps passed; the script prints `ALL CHECKS PASSED` on completion.

## Known limitations (unchanged, out of scope)

- Deleting a session does not cascade-delete its log entries
  (`sessionRepository.softDelete`, see spec Edge Cases) — pre-existing,
  tracked separately.
- The link scanner surfaces low-signal candidates (e.g. isolated "PM",
  "Entry" fragments from timestamp text) as missing-record suggestions;
  this is scanner tuning, not part of SS-12's scope.
