# Roadmap status updates, 2026-11-21 (wave 9)

Branch `work/portraits-wave9`, stacked on `work/roadmap-wave8` (`c5f281c`). Not
pushed.

`.gitignore` ignores `docs/backlog/`, so this file needs `git add -f`.

## H8: portraits out of the character record, non-destructively

| Commit | What changed | Test |
|---|---|---|
| `af06689` | **Schema:** an additive `version(21)` adds a `portraits` table (`id, characterId, deletedAt, softDeletedBy`), with no upgrade function; its fingerprint is recorded in `releasedSchemaVersions.test.ts`. **Data:** `types/portrait.ts` (an image Blob per character). `CharacterRecord.portraitId` names the row; the old inline `portraitUri` is still read and is only dropped when the user sets a new portrait. Nothing existing is moved. **Writes:** `usePortrait.useSetPortrait` stores the compressed image through `portraitRepository.savePortrait`, which replaces the character's row in place (so no tombstones pile up and no permanent delete is reachable), and the record keeps only the id, so the one-second autosave no longer rewrites the image. **Reads:** `usePortraitSrc` shows the stored Blob as an object URL (revoked on change) and falls back to `portraitUri`; the sheet and profile use it. **Deletes and Trash:** a character's portrait is soft-deleted with it under the character's cascade id and restored with it; it is a cascade child in `RESTORE_WITHOUT_LISTING` with that reason. Duplicating a character copies its portrait row. **Backups:** `portraits` joins the bundle registry after `characters`; the character, session and campaign exports carry the portraits of the characters they carry, as base64 like attachments; the merge restores the Blob and skips a portrait whose character is not on the device. CLAUDE.md/AGENTS.md: 22 of 27 tables are soft-deletable. | New `portraitRepository.test.ts` (4) and `usePortrait.test.tsx` (4); `softDeleteRoundTrip.test.ts` +1 (a character brings back its portrait); `bundleParity.test.ts` now seeds a portrait, so the export-every-table and import-round-trip cases cover it. New code, so these pin the contract rather than fail against an old version. |

Not done, deliberately: the ≤ 8 KB thumbnail H8 proposed. No list screen draws a portrait today, so there is nothing for it to speed up yet; the library still loads full records, which are now lighter for any character with a new portrait.

## Bookkeeping

The roadmap's headings still said OPEN for items closed in PR #4 and the waves
after it (the 2026-11-09 note there said they had not been folded in). Every
heading now carries its status and points at the update file that closed it.
Nothing is left OPEN: C3 (with C4's remainder) and T1 are BLOCKED on rules
text, and the rest are DONE or recorded as decided by agent for the owner to
revisit.
