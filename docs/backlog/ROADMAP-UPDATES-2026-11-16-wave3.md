# Roadmap status updates, 2026-11-16 (wave 3)

The work on branch `work/h9-and-cleanups`, cut from `origin/main` `1104533`
(PR #6 merged). Not pushed. Items taken from the audit table in
`ROADMAP-UPDATES-2026-11-16-wave2.md` and from `2026-09-04-improvement-roadmap.md`.

`.gitignore` ignores `docs/backlog/`, so this file needs `git add -f`.

Out of scope by the brief: E5, G6, S25, and everything the wave 2 audit marks
as needing a decision.

## Done in this wave

Fixes were tested against the code before the fix and the tests watched fail.
Refactors kept the suite green.

| Item | Commit | What changed | Test |
|---|---|---|---|
| R (recorded): test-only helpers in shipped modules | `068a132` | `entriesForAccount`, `countEarnedMarks`, `removeDebtPayment` and `raiseChance` moved to `src/test-utils/domainHelpers.ts`. Their tests import them from there. | New `test-utils/testUtilsBoundary.test.ts` fails if a non-test module imports `src/test-utils/`. A planted import in `savageMath.ts` made it fail. |
| I7: derived-stats casts | `afca664` | `PrintDerivedValues` is now the open `Record<string, string \| number \| undefined>` the engine actually returns, declared once (`PrintableSheetScreen` had a second copy). The screen spreads only printable values. `maxFor` passes `Number(value)`, the same conversion `DotTracker` already applied, so the same dots are drawn. `DerivedStatsModule` indexes `DerivedValues` directly. | Refactor; suite green |
| I7: bundle casts | `21e3d95` | No `as unknown as` left in `collectors.ts` (15), `privacyFilter.ts`, `referentialClosure.ts` or `bundleParser.ts`. There were two real disagreements. (1) The `.passthrough()` container and item schemas infer a `[k: string]: unknown` index signature that `InventoryContainer` and `InventoryItem` lack. The new `toBundleContainer` spreads each row into a plain object, which produces the same JSON. (2) `loadBundleSystems` was typed `Record<string, unknown>[]` but returns `SystemDefinition[]`. The rest were casts of values that already type-checked. | Refactor; suite green |
| H9, partly: two defects in `useKBSearch` | `8623d08` | The built index was kept in a ref and searches ran only when the query changed. A query that arrived before the async build finished stayed blank until the next keystroke. The session vault panel's search text is controlled and outlives the panel, so this can happen there. The index also rebuilt only when `campaignId` changed, while `VaultBrowser` reloads its list on `refreshToken`, so a node written while the vault was open appeared in the list and could not be found by search. The index now lives in state, and the hook takes the refresh token. | New `useKBSearch.test.tsx`: 2 of 3 fail on the old code, each for its own reason |
| `TRAVELLER_DAMAGE_TRACK_IDS` restates the track | `8067f3b` | Read from `travellerSystem.resources` (non-counter ids), the same derivation `getEngine` uses and the one the other two adapters already apply to their own lists. Same value. | `declaredIds.test.ts` +1: each adapter's own `resourceIds` equals `getEngine`'s |
| D12: `StatKey` / `restsUsed` unions | `4885d08` | `StatKey` is now `string`: the old union ended in `\| string`, which made it `string` already. `restsUsed` is `Record<string, boolean \| undefined>`, keyed by rest id, and `RestModule`'s two casts and its `asStoredRestsUsed` helper are gone. Type-only; stored data is unchanged. | `declaredCapabilities.test.ts` failed on its two `READ_DYNAMICALLY` entries (`stretch`, `shift`) once the members stopped being declared. Both entries were removed. |

## Left, with reasons

- **H9, the merge itself.** The two indexes do not hold the same documents.
  `useNoteSearch` indexes notes by title, body text, tags and descriptors, and
  its results feed `PromoteEntriesSheet`. `useKBSearch` indexes KB nodes by
  label only. Those include characters, locations, tags, unresolved links and
  shared nodes, none of which are notes, and its results feed `VaultBrowser`.
  They overlap only where a note-sourced node's label is the note's title. One
  "incrementally maintained" service needs a way to hear about writes: Dexie
  hooks, `liveQuery`, or the repositories calling it. Each is a different
  architecture, and the choice also decides whether the vault search starts
  matching body text. That is a design decision, not a contained refactor. The
  two defects that were fixable without it are fixed above.
- **I7, `sanitizeDeep`** (`utils/importExport.ts:48,49,59`). This is a generic
  `(value: T) => T` that rebuilds strings, arrays and objects. The compiler
  cannot prove the result is `T`, which may be a string literal type, so the
  three casts stay. Removing them means changing the signature to `unknown`,
  which only moves the casts to the two call sites.
- **`hasBlankTemplate`.** It checks the module-private `BLANK_TEMPLATES` map.
  Moving it to test utilities would mean exporting that map for the tests,
  which is the same production surface under a different name.
  `createBlankCharacter` overwrites `systemId`, so its output cannot show
  whether it fell back.
- **D12, the rest.** The dragon/demon mark cycle needs a new `skill.marks`
  engine field and a rewrite of the cycle. That is a design choice. The
  `bennies` card key is persisted, so renaming it is a migration.
  `WeaponEditor`'s grip and damage-type lists mirror the structural
  `Weapon.grip`/`damageType` unions and are already gated; they are low value.
  `remakeCurrency` "bypassing `engine.currency`" was found already done: both
  callers (`GearScreen`, `useCoinAdjuster`) read through `engine.currency.read`
  and write through `engine.currency.write`. The change-making itself works for
  any denomination list, and no ruleset needs a different `adjust`.

## Checks at the end

`tsc -b` exit 0. `vitest run`: 190 files, 2607 passed (2603 at `1104533`).
That is +1 for the boundary test, +3 in `useKBSearch.test.tsx` and +1 in
`declaredIds.test.ts`, minus 3 `it.each` cases in `declaredCapabilities.test.ts`
for `round`/`stretch`/`shift`, which are no longer declared. `eslint .` 0
errors, 32 warnings (unchanged). `vite build` passed. `knip --dependencies`
exit 0. A full `knip` lists 82 unused exports and 236 unused exported types;
CI does not gate on that and it was not compared with the base. Nothing was
run in a browser.

## Wave 4 (2026-11-21)

Branch `work/attachment-per-photo-delete`, cut from `main` `529b94e` (PR #7
merged). Not pushed.

| Item | What changed | Test |
|---|---|---|
| R (recorded): per-photo attachment delete, "needs the Trash listing first" | Listing first: `attachmentRepository.getDeleted(campaignId)` lists photos removed on their own whose note is live. A photo that went down with its note is left out (it comes back with the note); one removed on its own before its note was deleted is listed again once the note is restored. Then the writes: `softDeleteAttachment` (own txId; refuses a re-delete so a note's cascade id is never overwritten) and `restoreAttachment`. The Trash lists them under Photos, titled by caption or filename, "Photo on <note>". `NoteAttachments` has a Remove button per photo behind a confirm. `attachments` is removed from `RESTORE_WITHOUT_LISTING`; `COVERED_BY_CASCADE` in `softDeleteRoundTrip.test.ts` is now empty. The README gap is closed. | `attachmentRepository.test.ts` +5, `trashRegistry.test.ts` +2, `softDeleteRoundTrip.test.ts` +1, `NoteAttachments.test.tsx` +3. All 11 fail with the three source files reverted. Mutations: dropping the live-note filter fails 2; dropping the re-delete guard fails 1. |

Checks: `tsc -b` exit 0; `vitest run` 190 files, 2618 passed (2607 at
`529b94e`, measured); `eslint .` 0 errors, 32 warnings (unchanged); `vite build`
passed. `knip` is not installed in this checkout (`npm run lint:deps`: "knip:
command not found", the same on `main`), so the dependency check was not run.
Nothing was run in a browser.

Open and decision-free, found during the audit for this wave:

- **D12, two `'classic-fantasy'` literals left** where `DEFAULT_SYSTEM_ID`
  exists: `utils/import/bundleParser.ts:188` and
  `utils/export/bundleSerializer.ts:89` (`types/campaign.ts:9`'s Zod default too).
  Same value today, so a refactor with a guard, not a fix.
- **Not decision-free:** `labels.derivedPanel` / `labels.storyBankPanel` are read
  by the play-dashboard modules but not by `SheetScreen` (hard-coded "Derived
  Values" / "Story Bank"). Their type doc calls them dashboard card titles, and
  Traveller's `derivedPanel: "Stats"` was written for the dashboard, so whether
  the sheet should follow is the owner's call.
