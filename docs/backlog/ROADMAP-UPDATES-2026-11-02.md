# Roadmap status updates, 2026-11-02

Status changes for `docs/backlog/2026-09-04-improvement-roadmap.md`, kept here because
that file has the owner's uncommitted edit. Nothing below is committed, so "this
change" means the uncommitted work on `roadmap/2026-11-02`. Replace it with the commit
when it lands.

`.gitignore` ignores `docs/`, so this file needs `git add -f`.

Measured at the end: `tsc -b` exit 0; `vitest run` 2495 passed, 1 failed, 180 files;
`vite build` passed; `eslint .` 0 errors, 32 warnings; `knip --dependencies` exit 0.
The one failure predates this work (see the end of this file).

## Done in this change

| Item | New status | What changed | Test |
|---|---|---|---|
| F6 | DONE | Round trip for every soft-deletable table, including cascades. Fails if a new table has no round trip. | `softDeleteRoundTrip.test.ts`; breaking `sessionRepository.restore` turns it red |
| E1 | PARTLY DONE | `terms`, `labels`, `panels`, `currency`, `outcomes`, `rollModifiers`, `timeUnits`, `logActions` moved to `system.json` for all three systems. **Bug fixed:** the import schema stripped `timeUnits[].expiresOn`. **Still open:** `death`, `damageTrack`, `magic`, `advancement.sessionEvents`, `probability.difficulty`, `derivedFields`, `rest[]`, which have no JSON path. | `declaredEngineData.test.ts` |
| E2 | DONE | `read`, `write` and `formatAmount` are built from the denominations. **Bug fixed:** declared coins read back as nothing. | `currencyAndPanelMerge.test.ts` |
| E3 | DONE | Traveller DMs follow the declared attributes. `resourceIds` is derived, using the new `ResourceDefinition.role`. The restated maxima are pinned by test, not removed. | `declaredIds.test.ts` |
| E4 | DONE | `system.json` declares `engine`. `SYSTEM_ADAPTERS` is derived from the registry, so the lockstep is gone. It remains as a lookup for older copies of a bundled system. | `fallbackAdapter.test.ts` |
| E5 | PARTLY DONE | System `index.ts` files no longer re-export maths, and the duplicate `getSkillBaseChance` is gone. **Still open, needs a decision:** moving the helpers conflicts with CLAUDE.md. | `bundledShape.test.ts` |
| E6 | DONE for what was listed | `terms`, `labels` and `timeUnits` share the engine types. Blank templates carry schema 6 and `deathSuccesses`. Checklist added to CLAUDE.md and AGENTS.md. Optional per-ruleset blocks stay per-ruleset. | `bundledShape.test.ts` |
| A8 | DONE | The wake lock now honours a saved preference that loads after mount. | `useWakeLock.test.tsx` |
| A9 | DONE for what remained | `danglingLinkEndpoint` treats a tombstone as missing. | `importVersionAndEndpoints.test.ts` |
| A10 | DONE, one line left as is | Session start is atomic. Bill posting is atomic. The resource-log race that double-counted damage is fixed. **A pending note title could overwrite the next note: fixed.** `getAll` guards each row. Import refuses a newer schema. A failed settings load can no longer overwrite settings. Route and split updates revert on failure. Unhandled promises handled. `bundleParser`'s hash `catch` stays deliberately (see decisions). | `sessionStartRace`, `resourceFlushRace`, `noteEditorNavigation`, `characterLibraryResilience`, `useAppSettingsLoadFailure`, `optimisticRevert` |
| G1 | DONE | `config/defaults/timelineTracks.ts`, a settings key, `useTimelineTrackCatalog()`. | `timelineTrackConfig.test.tsx` |
| G2 | DONE | The note editor reads `selectable` from config, and buttons now show labels rather than ids. Bestiary categories are one configured list. | `noteEditorNavigation.test.tsx` (editor); bestiary has no test |
| G3 | DONE | A repeat promotion no longer duplicates the edge. | `promotionAndRouteGuards.test.ts` |
| G6 | PARTLY DONE | `useIsPlayMode()` replaces the ad hoc checks. **Still open, needs a decision:** gear in play mode. | none: refactor, covered by existing tests |
| G7 | DONE | `deleteLinksForNote` is now `softDeleteLinksForNote`; `removePartyMember` is now `hardDeletePartyMember`. | existing guards |
| G8 | DONE | `routeRepository.restore` ignores a live stop. | `promotionAndRouteGuards.test.ts` |
| G9 | PARTLY DONE | `/notes` and the library no longer use dead or legacy paths. Boolean indexes left: dropping them needs a `version(21)` for no user-visible gain. | none |
| H5 | DONE | `useConfirm()`, used at every native `confirm` and `prompt` site. ESLint now fails on the native calls. | `ConfirmDialog.test.tsx` |
| H7 | DONE | A boundary inside `ShellLayout`, and the route appears in the report. | `shellErrorBoundary.test.tsx` |
| I2 | DONE | First chunk 944 kB to 459 kB, by loading jszip on demand and splitting React and data vendors. `chunkSizeWarningLimit` is 700. Screens were already lazy. | `vite build`; not run in a browser |
| I3 | DONE | Removed the two unused Radix packages. Added knip and a CI step. knip also found `@tiptap/core` and `@tiptap/pm` imported but undeclared, so they are now declared. | `npm run lint:deps` |
| I4 | DONE | The last raw colours became tokens. ESLint fails on `[#hex]` classes. Canvas ink colours stay, since they are drawing data. | `eslint .` |
| I5 | PARTLY DONE | `typecheck` and `test:coverage` scripts; thresholds set from measured 68/71/78/68. A shared `setupFiles` stays declined, for the reason the entry gives. | `vitest --coverage` |
| I6 | DONE | Timestamps go through `nowISO`, enforced by ESLint. **Behaviour change:** ledger default dates and the briefing date now use the local day, not UTC, so an evening entry in CST no longer gets tomorrow's date. | `eslint .`; the date change has no test |
| I7 | PARTLY DONE | Removed the `derivedStats` casts `DerivedValues` no longer needs. Bundle casts remain. | `tsc -b` |
| I8 | DONE | Startup seed effect deleted. | `appStateNoSeed.test.tsx` |
| I9 | DONE | `utils/diagnostics.ts` mirrors console errors and warnings to a ring buffer. Settings has Copy diagnostics. | `diagnostics.test.ts`, `DiagnosticsCard.test.tsx` |
| I11 | DONE (manual route) | Deleted the committed report and `.pyc`, and corrected the name in the script. | none |
| J1 | DONE | Route comment and the AGENTS.md description corrected. | `softDeleteCoverage.test.ts` |
| B10 | DONE | Editor bodies are validated in `utils/reference/parseEditorBody.ts`. | `parseEditorBody.test.ts` |
| C4 | PARTLY DONE | Modifier labels, the rest label and debt amounts now come from the engine. **Still open:** see decisions on spending a modified pool. | `modifierLabels.test.tsx` |
| R (recorded) | One line closed | Re-importing an unchanged attachment is a skip, not one error per photo. `kbEdges` is not merged at all, so that half of the line does not apply. | `importVersionAndEndpoints.test.ts` |

Not covered by a test of their own: the catches in `LedgerScreen`, `SessionScreen` and
`ManagePartyDrawer`, and the `useLedgerSplit` revert (same pattern as the tested route
revert).

## Found already done

| Item | Proof |
|---|---|
| A5 | `e092476` (K3); `useNoteActions.ts:169-186` |
| A8 toggles, clear-all, `showOtherSessionNotes` | `SettingsScreen.tsx:88-89` clears `db.tables`; `types/settings.ts:100` records the removal |
| A9 raw reads and participant copies | `directDexieAccess.test.ts`; S19 `404aa7d` |
| C2 | `TileCard.tsx` reads through `getEffectiveValue` and `resolveDerivedField` |
| F5 | B1 `bundleParser.test.ts` (`skills: null` case added today); B2 `attachmentFiles.test.ts:107`; B3 `attachmentFiles.test.ts:52`; B4 `mergeEngine.test.ts:140` |
| G4 | `migrated_from` is in the CLAUDE.md table and guarded by `softDeleteCoverage.test.ts` |
| G5 | H3 `52f1b43` |
| G11 | The named controls have `aria-label`s; `SkillRow` no longer exists |
| I6 ids | `crypto.randomUUID` appears only in `utils/ids.ts` |
| J2 README | `5328df8` covers the systems, ledger and routes |
| D12 `remakeCurrency` | It takes `currency.denominations` (`useCoinAdjuster.ts:31`) |
| Hardening catalogue | Everything is closed except B1, which needs the physical Tab S9 |

## Left open

| Item | Why |
|---|---|
| T1 and its spec | The spec's status is "Proposed" and it lists three unanswered rules decisions. Not started. |
| S25, private-note control | Excluded by the brief. |
| H8 | Not started. `attachments` requires a `noteId` and is filtered by note privacy, so where portraits live is a design choice, and the migration moves user data. |
| C3 | The entry offers two designs. Needs a decision. |
| H9 | The two indexes hold different documents (notes, KB nodes) and no defect is shown. Not started. |
| G10 | The inputs are controlled, so index keys cause no state bug. Left. |
| J2 `.gitignore` | The owner's uncommitted edit covers this. Not touched. |
| D10, D11, D12 remainder | Recorded as deliberately left in the Progress section. |

## Pre-existing failure

`navigationCatalogue.test.ts` fails on `main` at `5d45927`, before any of this work:
`/weather-reports`, `/weather-reports/:noteId` and `/weather-report` are routed with no
nav surface or written reason. Not fixed, as it is outside the two documents in scope.

Fixed afterwards on this branch by recording the routes in `navigationCatalogue.ts`: all
three are reachable from `/worlds`, so no navigation changed. `vitest run` is 2496 passed.
