# Roadmap status updates, 2026-11-16

Status changes for `docs/backlog/2026-09-04-improvement-roadmap.md`, kept here
beside `ROADMAP-UPDATES-2026-11-02.md` rather than in the roadmap itself, as the
brief asked. Branch `work/e1-remaining-engine-data`, from `main` at `a478934`.

`.gitignore` ignores `docs/`, so this file needs `git add -f`.

## State of the 2026-11-02 work

The queue says the `roadmap/2026-11-02` work is uncommitted and that the owner has
an uncommitted edit in `2026-09-04-improvement-roadmap.md`. Neither is true any
more. The work is commits `51d31aa` and `5eb22ff`, merged into `main` as PR #4
(`05a9583`). The owner's roadmap and `.gitignore` edit is `e3d033a`, merged in
`a478934`. Replace the "Nothing below is committed" note in the 2026-11-02 file
with those hashes.

## E1 remainder: one declared path per field

Each field now lives in every bundled `system.json`, follows the same path as
`terms`/`timeUnits` (type in `types/system.ts`, the import schema, required by
`declaredEngineData`, merged by `getEngine`), and has its own tests in
`declaredEngineData.test.ts`. Each test was run against the code before its
change and failed.

| Field | JSON path | Status | Test |
|---|---|---|---|
| `derivedFields` | `derivedFields[]` | DONE | `derivedFields declared in system.json` |
| `death` | `death` (object, or `null`) | DONE. `null` removes the model (`getEngine` no longer uses `??` for nullable models). The schema rejects a trigger or track that names no resource. | `death declared in system.json` |
| `damageTrack` | `damageTrack` (object, or `null`) | DONE. Savage Worlds' trait penalty now reads `levels` and `penaltyPerLevel` from the declared track rather than restating them, so `penaltyPerLevel` has a reader at last and leaves `KNOWN_UNIMPLEMENTED`. The schema rejects a track or status condition that names nothing. | `damageTrack declared in system.json` |
| `magic` | `magic` (`resourceId`, `powerLevels`, `costPerLevel`, `trickCost`, `trickSchools`; or `null`) | DONE. Data only: `maxPrepared` and `castingImpairment` are Dragonbane rule functions and stay in the adapter, joined by `withMagicRules`. An imported system keeps its adapter's rules. The schema rejects a `resourceId` that names no resource. | `magic declared in system.json` |
| `advancement.sessionEvents` | `advancement.sessionEvents[]` (or `advancement: null`) | DONE. Only the events move; `usesMarks`, `maxSkillValue` and `rollPrompt` stay in the adapter, joined by `withAdvancementRules`. Traveller and Savage Worlds have no advancement roll, so their adapters still set `advancement: null`, and their JSON declares `null`. On those adapters declared events have nothing to feed and the model stays `null` (documented on the type). The schema rejects duplicate event ids. | `advancement.sessionEvents declared in system.json` |
| `probability.difficulty` | `probability.difficulty` (object, or `null`) | DONE. `chance` stays in the adapter. `TRAVELLER_DEFAULT_TARGET` is now read from the declared `defaultValue` rather than restated. The schema rejects a default that is not one of the options. `fallbackAdapter.test.ts` compared `probability` by identity to prove which adapter ran; it now compares `probability.chance`, because the merge builds a new object. | `probability.difficulty declared in system.json` |
| `rest[]` | `rest[]` (`id`, `label`, `prompt`, `clearsRestTracker`; or `null`) | DONE. Each rest's `apply` stays in the adapter, keyed by id, and `withRestRules` joins them. A bundled system that declares a rest its adapter cannot run throws at load. An imported one has the rest dropped with a warning. The schema rejects duplicate rest ids and a `timeUnits[].expiresOn.rest` that names an undeclared rest. | `rest[] declared in system.json` |

With these seven, E1 is DONE: every field the entry listed now has a JSON path in
all three bundled systems. CLAUDE.md and AGENTS.md list the new required fields
and the `null`-versus-absent rule.

## Found along the way

- `damageTrack.penaltyPerLevel` had no reader (listed in `KNOWN_UNIMPLEMENTED`).
  It has one now, and the entry is gone.
- Left as is: `TRAVELLER_DAMAGE_TRACK_IDS` (`['str','dex','end']`) restates the
  declared track's `order` + `overflowTo`, and Savage Worlds' Fatigue cap (2)
  stays in code because Fatigue is not on the damage track. Neither is in E1's list.
- Not touched, per the brief: E5, G6, S25.

## Checks at the end

`tsc -b` exit 0; `vitest run` 186 files, 2586 passed (2535 before this branch);
`eslint .` 0 errors, 32 warnings (unchanged); `vite build` passed. `knip
--dependencies` cannot run here (`knip: command not found`), on `main` too. Not
run in a browser.
