# Pass 2 — behavioral verification of the residual gaps

- Mode: standard (targeted at pass 1's four residual gaps)
- Reference: `docs/specs/2026-07-29-notes-overhaul-completion.md`
- Code changes: **none** — all three items verified as already correct
- Branch HEAD: `3eb0471`

## Correction to pass 1

Pass 1 recorded the selection gesture as a **long-press** that "could not be
driven via Playwright". That was wrong. `SessionLogSelection.tsx:171` binds
`onContextMenu` — a **right-click**. Once `selectedIds.size > 0`, ordinary left
clicks toggle selection (`handleEntryTap`, line 118). Trivially drivable.

## G4 — Promote flow ✅ VERIFIED

1. Right-click entry 1 → `aria-pressed="true"`, action bar appears:
   `1 selected | Promote | Tag | Delete | Cancel`.
2. Left-click entry 2 → `2 selected`. The pad still held its uncommitted draft,
   confirming the tap toggled selection rather than opening the entry for edit.
3. Promote → sheet reads **"Promote 2 entries"**, three modes (New note / Add to
   existing / Tag only), title prefilled from the first selected entry, six type
   chips.
4. Set title `Ostrand cargo lead`, type `Rumor`, Create note.

**Result — the constraint that matters ("the raw log always survives intact"):**

| Check | Result |
|---|---|
| Raw entries retained | ✅ all 3 still present |
| `Promoted` badges on the 2 promoted entries | ✅ both `data-promoted-into` the *same* target id |
| Third entry unbadged | ✅ |
| Selection cleared, sheet closed | ✅ |

Persisted state (read from IndexedDB):

- 4 notes: 3 × `log`, 1 × `rumor`.
- Target note `type: 'rumor'`, `title: 'Ostrand cargo lead'`, `status: 'active'`,
  session-scoped.
- Body holds **both** entries in time order with timestamps retained:
  `[10:58:40 AM] Kesh swings… [10:59:12 AM] The innkeeper at Ostrand…` — matches
  the design's "concatenated in time order, timestamps retained".
- Two `promoted_into` edges, `note → note`, both → the target, neither deleted.
- All 3 log notes still `active`, none soft-deleted.

## G5 — Notes aggregate unaffected by log entries ✅ VERIFIED (the C-2 criterion)

With a real promoted note present and the Log lane at its default:

- `4 visible tracks and 2 visible events` — the session span plus
  `Ostrand cargo lead on Notes`.
- The three log entries contribute **nothing** to the collapsed Notes row.

Revealing the Log lane:

- `5 visible tracks and 5 visible events`, cleanly separated —
  **Log:** the 3 raw entries (long one truncated at 60 chars with `…`);
  **Notes:** `Ostrand cargo lead` only.

Had the lane nested under Notes as the original design specified, that row would
read 5 events with the promoted note buried in raw capture. This is the exact
failure red-team C-2 predicted, and the top-level placement prevents it.

## G6 — Commit failure retains the typed text ✅ VERIFIED

Patched `IDBObjectStore.prototype.add/put` to throw for the `notes` store, then
committed.

| Check | Result |
|---|---|
| Typed text retained verbatim | ✅ |
| No entry created | ✅ still 3 |
| Error surfaced to the user | ✅ toast: `noteRepository.createNote failed: Error: forced write failure (converge test)` |

First read of the toast said "no error surfaced" — wrong; the toast had already
expired. Re-checked with a `MutationObserver` armed before the click. The patch
was reverted afterwards.

## Still unverified

| Requirement | Why |
|---|---|
| Tab S9 + S Pen handwriting fit | Requires the physical device |

## Verdict

**0 gaps. `clean_streak` → 1.** Three of pass 1's four residual gaps closed with
no code change required; the fourth needs hardware.
