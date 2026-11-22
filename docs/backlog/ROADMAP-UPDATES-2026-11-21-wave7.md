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
| The note editor left silently after a failed load or create | `6ebb154` | `NoteEditorScreen` caught a failed `getNoteById` or `createNote` and navigated to `/session` with no message (only a genuinely missing note was toasted). Both now toast the error before leaving. | New `noteEditorLoadFailure.test.tsx`, fails on the old screen. |
| The play dashboard's quick-log bar failed silently | `13404b9` | `QuickLogBar.commit` was try/finally with no catch around `logToSession`, which rejects on a failed write: an unhandled rejection, and the text stayed in the box with no message. It now toasts the error and keeps the text so it can be sent again. | New `QuickLogBar.test.tsx`, fails on the old bar. |
| "Active character updated" after a choice that was not saved | `8a293e5` | `ActiveCharacterContext.setCharacter` installed the character, then saved the choice through `updateSettings`, which never rejects; it resolved either way, so `CharacterLibraryScreen` always said "Active character updated" (and navigated), and a failed save left this character on screen while the stored choice stayed the old one. `updateSettings` now resolves `true`/`false`; `setCharacter` saves first, installs only on success, and returns whether the character is now active (false for a missing id too). The library's three call sites report a failure and stay put. | `ActiveCharacterContext.test.tsx` +2 and `useAppSettingsSaveFailure.test.tsx`'s revert case now checks the return; all three fail on the old code. |
| Attachment captions never crossed an import | (this commit) | Attachments had no `updatedAt`, so the merge always kept an existing local copy and a caption edited on another device never arrived (the "bundle is newer" path was unreachable for them). `Attachment.updatedAt` is now optional on the type and stamped on create, caption edit, delete and restore (no index, so no schema version). The merge reads a missing value as `createdAt`, so older rows and bundles still compare. Closes the `attachments` half of R's "no `updatedAt`" line for good. | `importVersionAndEndpoints.test.ts` +1, fails on the old merge. |
