<p align="center">
  <img src="public/icons/icon-512.png" alt="Skaldbok logo" width="160" height="160">
</p>

# Skaldbok

Skaldbok is a local-first tabletop RPG character sheet, campaign manager and
play dashboard, built as an installable PWA for tablets and desktops at the
table.

**There is no backend.** Every byte lives in the browser's IndexedDB on the
device you are using. There are no network calls anywhere in `src/` — no
telemetry, no sync, no accounts — and the fonts are bundled locally rather than
fetched. The corollary matters as much as the promise: nothing is backed up for
you, so the campaign export below is the only copy that survives the device.

## Current features

**Characters**

- Character sheet with identity, attributes, resources, conditions, derived
  stats, rest, advancement and temporary modifiers; panel order and which
  panels exist come from each system's `sheet.json`, not from code.
- Skills screen with roll-under probability, boon/bane (global and per-skill),
  trained flags, marks, user-authored custom skills, and speciality groups.
- Gear with inventory, containers, encumbrance, and a party-inventory tab that
  splits and makes change in the system's own denominations.
- Abilities/magic screen — shown only for systems whose engine declares one.
- Play dashboard: table-facing modules (resources, conditions, fast skills,
  equipped gear, abilities, rest, damage/heal, currency, quick log) laid out
  per system.
- Printable sheet at `/print`, in colour or black-and-white.

**Campaigns and play**

- Campaigns, sessions, and a session timeline; a separate session log for
  in-play capture.
- Notes with rich text, wiki-links, `@`-mentions, attachments, and pen/ink
  handwriting.
- Encounters and a combat view, with participants drawn from the bestiary or
  the party.
- Bestiary of campaign creature templates, with JSON import/export.
- Parties, and ships/vehicles for systems that declare them.
- Campaign ledger — running-balance cashbook, accounts, recurring bills, and
  payout splits that snapshot the percentages used at distribution time.
- Route planner, for systems that declare one.
- Knowledge base: a linked note graph with backlinks, search, and a force-
  directed graph view.
- Reference library: your own rules sections and notes, grouped, reorderable,
  and importable as JSON.
- Trash with per-row restore, backed by a project-wide soft-delete convention.

**Data safety**

- Autosave with a debounce, a flush on unmount, and a flush before any
  lifecycle operation that could race it.
- Character records are migrated on read through a versioned ladder, and
  normalised before persistence.
- Soft delete everywhere: user-facing deletes set `deletedAt` and a cascade id
  rather than removing rows, and restore brings a whole cascade back together.

## Backup and portability

A campaign export is a single `.skaldbok.json` file (schema `version: 1`)
carrying **every Dexie table the app persists** — 24 exported tables, plus 2
deliberately excluded and named as such (`appSettings` and `metadata`, both
per-device). The bundle includes the system definitions themselves, so a restore
on a new device does not point a campaign at a ruleset that device has never
seen.

This is enforced, not asserted: `src/utils/export/bundleParity.test.ts` walks
the live Dexie schema and fails if a table is neither exported nor explicitly
excluded, seeds a row into all 24 tables and fails if any comes back empty from
the collector, and round-trips export → delete the database → import →
assert every table repopulated.

Also exportable: Markdown for a single note, a session, or a whole campaign's
notes (ZIP, with attachments); Markdown for the ledger and for a route; and
bare-record JSON for a single character from the Character Library. Import
accepts `.skaldbok.json` / `.skaldmark.json` / `.json`, verifies a SHA-256
content hash, shows a preview with per-entity-type selection and conflict
detection, and drops a malformed row with a warning rather than rejecting the
whole file. ZIP is export-only.

**Restoring onto an empty device works.** Import is a device-level action, not a
campaign-scoped one: it is offered in the menu and in the campaign selector with
no campaign present, because a device that has lost its data has no campaign by
definition. What a bundle needs is then answered from the rows it carries rather
than from the label on the file:

- A **campaign bundle** brings its own campaign, so it is restored under that
  campaign's own identity and made active — you are never asked to invent a
  campaign to restore one into, and re-importing the same file updates that
  campaign instead of creating a second copy.
- A **character** has no campaign of its own (`characters` is a device-wide
  table; a character joins a campaign through a party seat), so a character
  bundle imports with no campaign involved at all.
- Only rows that genuinely carry a `campaignId` — sessions, notes, encounters,
  the ledger, and the rest — need a home, and only those are asked about. If
  there is nowhere for them to go yet, the dialog says which groups those are so
  you can bring in the rest now.

The merge runs in a single Dexie transaction, so a restore either lands whole or
not at all.

## Game systems

Three systems ship, registered in `src/systems/registry.ts`:

| Folder | `displayName` | Notes |
|---|---|---|
| `src/systems/classic-fantasy` | Dragonbane | The default. 6 attributes, 33 skills, HP/WP, death rolls, no declared currency. |
| `src/systems/traveller` | Traveller | 2d6 systems; specialty skill groups, credits, ships, finance fields, route planner. |
| `src/systems/savage-worlds` | Savage Worlds | Die-ladder attributes, wounds/fatigue, bennies that refresh per session. |

Anything that differs between rulesets — vocabulary, panels, formulas, rest and
death rules, currency, probability — resolves through a `SystemEngine` rather
than a `systemId` check in a screen.

Adding a system takes three things, not one: a `system.json` + `sheet.json`
folder under `src/systems/`, an entry in `registry.ts`, and an engine adapter in
`SYSTEM_ADAPTERS` (`src/features/systems/engine/index.ts`). Without the adapter
the system falls back to classic-fantasy's rules — the app now says so on screen
rather than silently applying another ruleset's maths, and a test fails if the
registry and the adapter map drift apart. Both JSON files carry independent
`version` counters and are cached in IndexedDB, so an edit is invisible until
you bump the version of the file you edited.

## Reference data policy

Skaldbok bundles **no publisher prose**: no spell descriptions, no ability text,
no monster stat blocks, no art or trade dress. In-app reference material of that
kind comes from your own JSON imports or is authored in the app.

Being precise about what the bundled `system.json` files *do* contain, since
"generic mechanical concepts" undersells it:

- The three `displayName` values are the published game names, and they are what
  the app shows in the system picker.
- Attribute, skill and condition **names** are the published ones.
- Traveller and Savage Worlds each carry a condensed `quickReference` block —
  the core roll, difficulty and effect ladders, the action economy, and the
  wound/benny rules. These are terse mechanical tables, not rules text, but they
  are more than bare identifiers.

If you use Skaldbok with a published commercial RPG, source any rules content
you import from material you own. `local-references/` is gitignored for exactly
that purpose; create it if you want somewhere to keep local archives. Skaldbok
is a tool; the books are still the books.

Skaldbok itself is MIT licensed — see `LICENSE`.

## Development

```bash
npm ci            # install
npm run dev       # Vite dev server, over HTTPS via a self-signed cert
npm run build     # tsc -b, then vite build
npm run lint      # ESLint (flat config in eslint.config.js)
npm test          # Vitest, single run — npm run test:watch for watch mode
npm run preview   # serve the built bundle
npm run docs      # TypeDoc into docs/api/
```

`npm run build` is the **only** type-check — there is no separate `typecheck`
script. `npm run docs:open` exists but is Windows-only (it shells out to
`start`).

CI (`.github/workflows/ci.yml`) runs typecheck, lint, test and build on every
push and pull request, in that order.

The dev server runs over HTTPS via `@vitejs/plugin-basic-ssl` so a tablet can
install the app from a LAN address; you will have to accept the self-signed
certificate. A Content-Security-Policy is injected into the built `index.html`
at build time only — adding it in dev would break Vite's HMR client. PWA
configuration is in `vite.config.ts`.

For LAN tablet testing: `npm run build && npx vite preview --host --port 4173`.
(`build-and-run.bat` does the same thing on Windows.)

### Tests

141 test files, all under `src/`, run by Vitest. (This number has now been wrong
twice, which is the argument for deriving it rather than remembering it:
`find src -name '*.test.ts*' | wc -l`.) The **node** environment and
`globals: false` are declared in `vite.config.ts`'s `test:` block — they used to
be the undeclared defaults, which is a different and weaker thing.

The suite is mostly pure logic (schema migrations, derived stats, ledger and
route maths, import parsers) plus repository tests against `fake-indexeddb`.
Several tests exist to enforce conventions rather than behaviour: released Dexie
`version(n)` blocks are fingerprinted and cannot be edited, every field declared
on the system/engine contract must have a reader somewhere, the export/schema
parity test above, and a check that no `systemId ===` branch has crept back into
a screen.

A DOM environment is available but **opt-in per file** — put
`// @vitest-environment jsdom` on the first line and use
`@testing-library/react`; fourteen files do today. It is not global so the pure
files keep the node environment and their speed. Because Vitest globals are off,
Testing Library's auto-cleanup does not run: every DOM test file must call
`cleanup()` in its own `afterEach`. `src/hooks/useAutosave.test.tsx` is the
reference pattern.

`tests/` holds Python Playwright scripts and `output/playwright/` a Node one.
Both are ad-hoc drivers against a running build, not part of `npm test`, and
both have drifted from the current UI.

## Known gaps

Recorded here rather than discovered later:

- **A photo can be added to a note but not removed on its own.** It goes when
  the note goes, and comes back when the note is restored.
  `trashRegistry.RESTORE_WITHOUT_LISTING` records why there is no per-photo
  delete: attachments have no Trash listing, so a standalone delete would be
  either permanent or invisible. The listing comes first, then the button.
- The printed sheet is fixed to one letter page. It now marks content it had to
  cut rather than dropping it silently, but it does not paginate.
- A campaign export is the only backup, and only the Settings screen says so.
  Nothing reminds you anywhere else, and nothing makes a second copy on its own.
- A migration that throws leaves the app on the storage-unavailable screen,
  whose only action is a reload — which runs the same migration again.

Three gaps that stood here have been closed, and are named because a reader may
remember them: `/more` and `MoreScreen` were deleted with the navigation
catalogue; the Settings "Bottom Navigation" toggles are gone (the setting they
wrote had no reader); and **Import is no longer gated on having a campaign** —
that entry also contradicted the Backup section above, which describes restoring
onto an empty device as the supported path. `importReachability.test.ts` is what
keeps the *third* of those true — it is the guard over Import's campaign gate.
The second is kept true by `settingsHaveReaders.test.ts`.

A fourth is closed with this sweep: **attachments could be read and not
created.** `createAttachment` had no caller, so the feature list's "attachments"
was a false statement rather than an incomplete one. The note reader now offers
"Add photo", renders the image rather than its UUID, and lets you caption it;
`NoteAttachments.test.tsx` fails if any of the three is unwired again.

`docs/backlog/2026-09-04-improvement-roadmap.md` is the full list, with evidence
and status per item.

## Project notes

- Public PWA assets live under `public/`; fonts are bundled in `public/fonts/`.
- `docs/` is gitignored (it is TypeDoc's output directory); the tracked
  documents under it are force-added.
- User-facing presets and groupings belong in configuration or user storage,
  not in hardcoded component arrays.
- UI code and hooks go through repositories in `src/storage/repositories/`;
  they never touch Dexie tables directly.
- Domain deletes use soft-delete repository flows, never hard deletion from UI
  code.

`CLAUDE.md` (and its near-copy `AGENTS.md`) carry the full conventions.
