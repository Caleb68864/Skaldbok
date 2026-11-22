# Roadmap status updates, 2026-11-21 (wave 7)

Branch `work/found-wave7`, stacked on `work/decisions-wave6` (`39b4fc7`). Not
pushed.

`.gitignore` ignores `docs/backlog/`, so this file needs `git add -f`.

First the defects wave 5 found and did not fix, then the rest of the roadmap
under the owner's decision rule (see the wave 6 file).

## Done in this wave

| Item | Commit | What changed | Test |
|---|---|---|---|
| Recurring charges skipped a date change made while posting | `a699dc0` | `LedgerScreen` posted due bills from an effect guarded by a ref so two runs could not race the watermark. A date change that landed while a run was in flight returned early and was never revisited, so its charges stayed unposted until the date moved again or the screen reopened. The new `hooks/useSerialRunOnChange` keeps one run at a time and runs once more, with the latest date, after a change it had to skip. | New `useSerialRunOnChange.test.tsx` (3). With the old guard's behaviour (skip and forget) put back into the hook, the mid-run case fails. |
| The note editor left silently after a failed load or create | (this commit) | `NoteEditorScreen` caught a failed `getNoteById` or `createNote` and navigated to `/session` with no message (only a genuinely missing note was toasted). Both now toast the error before leaving. | New `noteEditorLoadFailure.test.tsx`, fails on the old screen. |
