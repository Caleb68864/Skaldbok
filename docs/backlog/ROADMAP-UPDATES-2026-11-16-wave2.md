# Roadmap status updates, 2026-11-16 (wave 2)

An audit of what is still open in `2026-09-04-improvement-roadmap.md`,
`2026-07-29-hardening-catalogue.md`, `ROADMAP-UPDATES-2026-11-02.md` and
`ROADMAP-UPDATES-2026-11-16.md`, checked against the code at `origin/main`
`e92ed0c` (PR #5 merged), and the items taken from it. Branch
`work/backlog-wave2`. Not pushed.

`.gitignore` ignores `docs/backlog/`, so this file needs `git add -f`.

Out of scope by the brief: E5, G6, S25, and anything that needs an owner
decision.

## Bookkeeping

- **E1** heading in the roadmap now reads DONE (PR #5, `e92ed0c`).
- The 2026-11-02 file's "Nothing below is committed" line is replaced with the
  real commits: `51d31aa`, `5eb22ff`, merged as PR #4 (`05a9583`); the owner's
  edit as `e3d033a`.
- The roadmap carried a stray diff3 base marker (`||||||| 05a9583`) above
  Workstream U, left over from a merge. Removed.

## Done in this wave

Each test was run against the code before its fix and watched fail.

| Item | Commit | What changed | Test |
|---|---|---|---|
| V (recorded): `PeekCard` closes itself on any load error | `ad46547` | A failed node read shows an alert with the message instead of closing. A failed note read or a corrupt body keeps the node on screen with an alert. A link whose node is gone still closes quietly. | `PeekCard.test.tsx`: 3 of 4 fail on old code |
| V (recorded): `NoteReader` renders a corrupt body as an empty note | `51ec4bb` | An alert ("may be damaged") above the empty editor. Nothing is written back. | `NoteReaderBody.test.tsx`: 1 of 2 fails on old code |
| R / U2 (recorded): `envelope.system` unread for validation | `1edcc42` | The import preview warns, once per id, about a ruleset (envelope, campaign or character `systemId`) that is not bundled, not stored on the device and not carried in `contents.systems`, with the number of characters on it. The import is not blocked. New `utils/import/unknownSystems.ts`. | `useImportActions.test.tsx` +4: the warning case fails on old code |
| R (recorded): `note.typeData` (ink) dropped by every Markdown renderer | `bff92b5` | An ink log entry or ink note now carries a line in the Markdown giving the stroke count and pointing to the JSON export. The strokes themselves are still not rendered (see below). `INK_TYPE_DATA_KEY` moved to `strokeModel`. | `renderSession.test.ts` +3: both ink cases fail on old code |
| V / U2: `TravellerBriefingScreen.test.tsx` flaky under load | `581b3c4` | `asyncUtilTimeout` 10 s for this file (restored after it), 30 s describe timeout. | Reproduced by pinning the file and twelve busy loops to one core: 4 failed on old code, the same cases as recorded. Passed twice under the same load afterwards. |

## Audit: what the roadmaps list as open

"Found done" means the code already does what the entry asks; the roadmap
overstated it.

| Item | Source | Status found | Evidence |
|---|---|---|---|
| E1 | roadmap | DONE | PR #5; the heading was stale |
| `useSystemDefinition.error` dropped at 18 call sites | roadmap Q, recorded | **Found done** | Wired through `getEngine`'s `unresolvedSystemId`; `isLoading` removed (`useSystemDefinition.ts` remarks) |
| `createAttachment` has zero callers | roadmap Q, recorded | **Found done** | `NoteAttachments.tsx:35` |
| `KnowledgeBaseContext` provider not audited | roadmap V, recorded | **Audited, clean** | Every member returns the repository promise; nothing is caught |
| `SessionLog.tsx` bare catches, `handleInkCommit().catch(() => {})` | roadmap V, recorded | **Audited, clean** | The five bare catches are `sessionStorage`/`localStorage` parks with a written reason. `handleInkCommit` toasts and rethrows before the button's `.catch`. |
| `attachments`/`kbEdges` have no `updatedAt` | roadmap R, recorded | Done (attachments) / does not apply (`kbEdges` is not merged) | 2026-11-02 file, "R (recorded)" |
| PeekCard, NoteReader body, `envelope.system`, ink in Markdown, the Traveller flake | V / R / U2 | DONE this wave | table above |
| C3 | roadmap | Open, **needs decision** | The entry offers two designs |
| C4 remainder | roadmap | Open, **needs decision** (tied to C3) | `ParticipantDrawer.tsx:109` still clamps to raw `linkedResource.max`, and `SheetScreen.tsx:1139` reads raw `current`. Which max and which pool are the truth is C3's question. |
| D6 / D12 skill marks | roadmap | Open, deliberately left | Dragon/demon cycle still in `SkillsScreen.tsx:145-147`; wants `skill.marks` and a rewrite of the cycle |
| D10 "Death Roll #n" | roadmap | Open, deliberately left | `useSessionLog.ts:400` |
| D12 `WeaponEditor` grip/damage-type lists | roadmap | Open, low value | Options mirror the `Weapon.grip`/`damageType` unions, which are structural per CLAUDE.md; already gated by `shows(...)` |
| D12 `bennies` card key, `StatKey`/`restsUsed` unions | roadmap | Open, low value | Persisted key (rename is a migration); `StatKey` already ends in `\| string`; `RestModule` casts around `restsUsed` |
| E5 | roadmap | Excluded by brief | |
| G6 | roadmap | Excluded by brief | |
| G9 boolean indexes | roadmap | Open, deliberately left | Dropping them needs `version(21)` for no user-visible gain |
| G10 `key={index}` | roadmap | Open, deliberately left | Controlled inputs, no state bug shown |
| H8 portraits | roadmap | Open, **needs decision** | Where portraits live, and a migration of user data |
| H9 two search indexes | roadmap | Open, not started | No defect shown; a refactor |
| I5 shared `setupFiles` | roadmap | Declined | 2026-11-02 file |
| I7 bundle casts | roadmap | Open, low value | 25 `as unknown as` outside tests, 15 of them in `utils/export/collectors.ts` (the entry said 21) |
| T1 skill training | roadmap | Open, **needs decision** | Spec status "Proposed", three unanswered rules questions |
| U2 create and import are two transactions | roadmap U2 | Open, **needs decision** | Folding the create into `mergeBundle` moves the create from the form to the Import click, which changes the dialog's behaviour |
| Session/campaign soft-delete cascade | roadmap Q, recorded | Open, **needs decision** | Recorded as a design change |
| A throwing migration leaves only Reload | roadmap Q, recorded | Open, **needs decision** | Needs a recovery surface designed |
| No purge | roadmap Q, recorded | Declined | |
| Five test-only helpers, `notesToTimeline` | roadmap R, recorded | Open, low value | All five still only referenced by their own module and tests; the adapter is documented as an extension point |
| Per-photo attachment delete | roadmap R, recorded | Open | Needs the Trash listing first |
| `CharacterRecord.campaignId` | roadmap R, recorded | Open, **needs decision** | |
| S25 private-note control | 2026-11-02 | Excluded by brief | |
| `TRAVELLER_DAMAGE_TRACK_IDS` restates the track | 2026-11-16 | Open, low value | Only a fallback: `getEngine` derives `resourceIds` from the declared resources (`engine/index.ts:189`) |
| Hardening catalogue B1 | catalogue | Open, blocked | Needs the physical Tab S9 |
| Everything else in the hardening catalogue | catalogue | Closed | Its own status table |

## Left from this wave

- The ink notice says the handwriting exists; it does not draw it. Drawing it
  faithfully means SVG with eraser strokes as masks and highlighter alpha, plus
  a choice between inline SVG and a sidecar file in the ZIP.
- The unknown-ruleset warning is computed in `useImportActions`, not the
  parser, because "stored on this device" needs the database. The parser's own
  tests do not see it.

## Checks at the end

`tsc -b` exit 0; `vitest run` 188 files, 2603 passed (2590 at `e92ed0c`, worked
out by subtracting the 13 added here, not measured); `eslint .` 0 errors, 32
warnings (unchanged); `vite build` passed; `knip --dependencies` exit 0. Nothing
was run in a browser.
