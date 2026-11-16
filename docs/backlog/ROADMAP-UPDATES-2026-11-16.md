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
