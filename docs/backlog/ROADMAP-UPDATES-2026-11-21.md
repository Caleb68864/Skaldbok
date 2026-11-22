# Roadmap status updates, 2026-11-21 (wave 5)

Branch `work/hardening-wave5`, stacked on `work/attachment-per-photo-delete`
(`2cc441d`, the per-photo attachment delete; see the wave 3 file's "Wave 4").
Not pushed.

`.gitignore` ignores `docs/backlog/`, so this file needs `git add -f`.

Out of scope by the brief: E5, G6, S25. Left for the owner: whether the sheet
should read `labels.derivedPanel` / `labels.storyBankPanel`.

## Done in this wave

| Item | Commit | What changed | Test |
|---|---|---|---|
| D12: the last `'classic-fantasy'` fallbacks | `326fea7` | `DEFAULT_SYSTEM_ID` moved to `systems/defaultSystemId.ts` (no imports, so the type and bundle layers can read it without loading every `system.json`); `registry.ts` re-exports it. `bundleParser` (bare-character envelope), `bundleSerializer` (envelope system) and `campaignSchema`'s default now use it. Same value, so no behaviour change. | New `systems/defaultSystemId.test.ts`: fails on a quoted `'classic-fantasy'` in non-test source outside a three-file allowlist with reasons (the definition, the legacy alias table, the blank-template map). With the four files reverted it fails and lists the four sites. |
| Trash: a failed listing ended in "Nothing deleted" | `e9b33a8` | `TrashScreen` toasted a section whose `load` threw, then rendered from the sections that loaded. If those were empty, the page said "Nothing deleted. Anything you delete shows up here…" about rows it had not read, and the toast was gone in seconds. The failed headings are now kept in state and shown as a `role="alert"` line, and the empty state is not rendered while any section failed. | New `screens/TrashScreen.test.tsx`: 2 of 3 fail on the old screen; the third pins the true empty state. |
| A failed note delete said "deleted" and offered Undo | `359fc40` | `useNoteActions.deleteNote` catches and toasts its failure and never rejected, so `NoteReader.handleDelete` went on to navigate back and toast "<title> deleted" with Undo, for a note that was still live (Undo then no-ops). `deleteNote` now returns whether it deleted, and the reader stops on `false`. | `NoteReaderBody.test.tsx` +2: the failure case fails on the old code; the success case pins navigate + Undo. |
| Skill-check log entries deleted without their edges | (this commit) | `SkillCheckEditDrawer` deleted with the note-only `noteRepository.softDelete`, leaving the entry's session→note and encounter→note `contains` edges live and its attachments untombstoned. It now uses `softDeleteWithLinks`, so Trash restores the entry into its session and encounter. | New `noteDeleteReachability.test.ts`: fails on a non-test file outside `src/storage` that imports or calls the note-only `softDelete`; it named the drawer on the old code. |
