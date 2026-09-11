# Improvement roadmap — scanned 2026-09-04

A prioritised backlog from a full read of the codebase at commit `8f96b0c`
(`main`). The first pass swept three areas: **security**, **engine
consistency** (rules that still live in screens or in one ruleset's helpers
instead of the `SystemEngine`), and **functionality / storage conventions**
(workstreams A–G). A second pass added **product gaps and reachability**,
**build, tooling, tests and performance**, and **documentation drift**
(workstreams H–J).

> **Reconciled 2026-09-08** by a five-pass re-audit (notes in `vault/`,
> gitignored; cross-project view in `../../../ROADMAP.md`). Two entries were
> checked against the tree and found wrong rather than merely stale:
> **H1 is withdrawn** (the Knowledge Base is reachable from the Session tab)
> and **H3 is rescoped** (four entity types already restore, not one). Acting
> on either as originally written would have deleted a live feature or
> mis-scoped the work. Baseline on that date: `tsc -b` clean, `vitest run`
> 1483 tests green across 86 files, `vite build` passing. The many **DONE**
> markers below were added as that work landed and were not re-verified in
> this pass.

> **Reconciled 2026-09-11 (second entry).** Four more commits closed the last of
> the queue — **workstream Q**: the repository factory (`S22`), the second scan's
> ~20-row tail, the `logNpcCapture` decision, and `H4`'s banner. `H4`'s automatic
> snapshot is **declined rather than deferred**, with the reason recorded in its
> entry. Baseline re-measured at the merge: `npx vitest run` **137 files / 2089
> tests** green · `npx tsc -b` exit 0 · `npx eslint .` **0 errors / 35 warnings** ·
> `npx vite build` exit 0.
>
> One of the corrected counts below is corrected again: the
> `preserve-caught-error` figure of 140 was measured with a grep that counts
> comments as code. It is now derived rather than written down.

> **Reconciled 2026-09-11.** Thirty-one non-merge commits landed between the last
> update to this file (`3fcb91e`) and now: a second five-pass scan
> (`vault/scan2-findings.md`), the nine fixes it ranked, the three residual guard
> gaps found by re-running the scan's own mutations against the fixes, the
> direct-Dexie guard and the writes it exposed, and the remainder taken here.
> **Workstream P** records them.
> Three of `O6`'s four "left open" items are closed and one of its claims was
> wrong; four counts this file carried are corrected below, each re-measured
> rather than remembered.
>
> Baseline measured at `d5cc397` on this date, not taken from any commit
> message: `npx vitest run` **134 files / 2051 tests** green ·
> `npx tsc -b` exit 0 · `npx eslint .` **0 errors / 35 warnings** ·
> `npx vite build` exit 0.
>
> **Counts corrected.** A roadmap carrying the first number of a pair is worse
> than one carrying none, because the first number is usually the one somebody
> planned against.
>
> | claim, as this file or the code carried it | measured 2026-09-11 | how |
> |---|---|---|
> | direct Dexie outside `src/storage/`: "42 calls in 13 files" (`O6`), then 56 in 14 (scan 2 §17) | **5 files**, each entry per-operation with a written reason | the keys of `DIRECT_DEXIE_ACCESS` in `directDexieAccess.test.ts`, with the guard green, so the allowlist *is* the surface |
> | `preserve-caught-error`: 119 (`eslint.config.js`), 128 (commit body), 129 (`O2`, `errorCause.test.ts`), 130 (scan 2 §18) | ~~**140**~~ — **this correction was itself two too high**, see `Q3`. The number is no longer recorded anywhere; `errorCause.test.ts` derives it. Two of `mergeEngine`'s four "outside" hits are comment lines *about* `{ cause: … }`, which the grep below cannot tell from code. | ~~`grep -rn "{ cause:" src \| grep -v "\.test\."`~~ — a census that strips comments first |
> | one-way trash registrations: "four" (scan 1), corrected to six (`O`) | **7** — `attachments`, `entityLinks`, `campaigns`, `encounters`, `ledgerSplits`, `routePlans`, `parties` | the keys of `RESTORE_WITHOUT_LISTING` in `features/trash/trashRegistry.ts` |
> | `sheetTemplateSchema.print` is "the only reserved-and-unread surface left in that file" (`O6`) | **false** — `surfaceLayoutSchema.layout` sat beside it, unlabelled and populated in all three shipped `sheet.json` | `P5` |
>
> The `preserve-caught-error` row is two corrections, not one: the number moved,
> and *"all in repositories"* stopped being true when `mergeEngine` and
> `linkSyncEngine` gained cause-carrying rethrows. Neither is a defect; both make
> the sentence in `O2`'s title wrong.

Status values: **OPEN** · **DONE** (record the commit) · **BLOCKED** (needs a
product decision) · **WONTFIX** (record why).

Verification levels, so a future reader knows how much to trust a line:

- **V** — checked line-by-line against the source by the author of this file.
- **R** — reported by a reviewer pass with file:line evidence, not independently
  re-read. Re-check the line before acting; the line number may have drifted.

Every item names its evidence as `file:line` at commit `8f96b0c`. Items are
grouped into workstreams; within a workstream they are ordered by impact. A
suggested order of attack across workstreams is at the end.

---

## Workstream A — Data loss and corruption

These produce wrong persisted data today. Fix before anything else.

### A1. Character delete is a hard delete — DONE (743c828, with Trash in 435feb6)
- **Where:** `src/features/characters/useCharacterActions.ts:57-58`;
  `src/storage/repositories/characterRepository.ts:98` (`remove`) and `:115`
  (`softDelete`, no callers). Caller `CharacterLibraryScreen.tsx:192` comments
  itself as "(soft delete)".
- **What:** The library's Delete button deletes `partyMembers` rows via raw
  Dexie, then calls `characterRepository.remove`, which is `db.characters.delete`.
  `represents` edges and `ships.ownerCharacterId` are left dangling. The whole
  soft-delete convention (restore, trash, cascade via `softDeletedBy`) is bypassed
  for the entity users care most about.
- **Fix:** One `db.transaction('rw', [characters, partyMembers, entityLinks])`
  that generates a `txId`, calls `characterRepository.softDelete(id, txId)`,
  `partyRepository.softDeletePartyMember(memberId, txId)` per linked member, and a
  new `entityLinkRepository.softDeleteLinksForCharacter(id, txId)`. Add the
  matching `restore` that matches on `softDeletedBy`. Rename `remove` to
  `hardDelete` so the tell is visible. Add the character to `TrashScreen`.
- **Also:** `ManagePartyDrawer.tsx:119` (`db.partyMembers.delete`; leaves
  `campaign.activeCharacterMemberId` dangling) and `ReferenceScreen.tsx:369`
  (`referenceNoteRepository.remove`; `ReferenceNote` has no `deletedAt`).

### A2. Derived-stat override bakes in temporary modifiers — DONE (0159487)
- **Where:** `src/screens/SheetScreen.tsx:1235`
  (`computedValue={resolved.isModified ? resolved.display : resolved.computed}`);
  `src/screens/GearScreen.tsx:590-594`; `src/components/fields/DerivedFieldDisplay.tsx:29,65`.
- **What:** The override input is seeded with the *effective* value when a
  modifier is active and commits on blur. Tap Movement while Hasted, tap away,
  and `derivedOverrides.movement` is persisted with the buff inside it. This is
  the exact case CLAUDE.md warns about ("bind editable inputs to the stored
  value, never the effective one").
- **Fix:** Always pass `resolved.computed` (or the existing override) as
  `computedValue`; show the modified value as a read-only adornment beside it.
  In `DerivedFieldDisplay`, skip `onOverride` when the committed value equals
  the seed so a tap-and-leave is a no-op.

### A3. Stale full-record puts race the active character's autosave — DONE (55e259d)
Root cause shared by four sites: code loads a character from the DB, mutates,
and `put`s the whole record while `ActiveCharacterContext` still holds the
previous in-memory record. The next autosave (or the next `updateCharacter`)
writes the stale record back.
- **A3a** `src/features/party/PartyInventoryTab.tsx:253-259` `persistCarrier`.
  Move an item off your own PC into a container, then edit anything on the
  sheet: item is back on the PC *and* still in the container. Also `:352-353`
  and `:381-382` do item and coin moves as two independent puts, so a failure
  between them destroys the item. Handlers at `:552,:622,:655,:792` have no
  catch.
- **A3b** `src/features/campaign/CampaignContext.tsx:380-397`
  `refreshPartyResources` (Start Session): `getById` + `save` per member, no
  `flushAll()`, no `updateCharacter`. The active PC's refreshed Bennies/HP are
  invisible and reverted by the next autosave.
- **A3c** `src/features/encounters/ParticipantDrawer.tsx:111-124`: same pattern
  for a linked PC's health, then `updateCharacter` replaces the whole
  `resources` map.
- **A3d** `src/storage/repositories/encounterRepository.ts:113-122,148-162` +
  `CombatEncounterView.tsx:150-168`: participant update is a non-transactional
  read-modify-write from component state; two quick blurs lose the first.
- **Fix:** A repository-level `characterRepository.patch(id, fn)` that runs
  read-modify-write inside one transaction, and a rule: if the target is the
  active character, route through `updateCharacter`; otherwise `flushAll()`
  first, then patch. Wrap multi-row moves in one transaction.

### A4. Attribute normalisation clamps to Dragonbane's range — DONE (33cca29)
- **Where:** `src/utils/characterNormalization.ts:53`
  `clampNumber(value, 1, 30, 10)`; `:17` clamps skills to `0..20`; applied on
  every save at `characterRepository.ts:72`.
- **What:** Traveller characteristics declare `min: 0`; a legitimate 0 becomes 1.
  The default `10` is not a Savage Worlds die rung. Skills over 20 are clamped
  even where the engine's range allows it.
- **Fix:** Pass the `SystemDefinition` (or engine) into normalisation; clamp
  attributes with `attributes[].min/max` and skills with `engine.skill.range`,
  snapping to `skill.ladder` when present. Default to the definition's default,
  not a literal.

### A5. Attachments hard-deleted before the note is soft-deleted — OPEN (R)
- **Where:** `src/features/notes/useNoteActions.ts:187`
  (`deleteAttachmentsByNote` then `softDeleteWithLinks`); Undo toast at
  `NoteReader.tsx:83`, `SessionLog.tsx:544`. `Attachment` has no `deletedAt`.
- **Fix:** Add `deletedAt`/`softDeletedBy` to `attachments` in a new
  `version()` block and soft-delete them in the same `txId`; or keep the blob
  and reclaim it from a purge keyed on `note.deletedAt` age.

### A6. Latent crash: `restoreGroup` queries an index that does not exist — DONE (5601188)
- **Where:** `src/storage/repositories/referenceSectionRepository.ts:76`
  `where('softDeletedBy')`; `src/storage/db/client.ts:572` declares
  `referenceSections: 'id, category, groupId, order, updatedAt, deletedAt'`.
- **What:** Dexie throws `SchemaError` the first time a reference group is
  restored. No caller today, which is why it has not fired.
- **Fix:** `version(19).stores({ referenceSections: '…, softDeletedBy' })` and a
  round-trip test (soft-delete group → restore → sections back).

### A7. v7 migration body was edited after later versions shipped — DONE (5601188)
- **Where:** `src/storage/db/client.ts:309-342`; commit `1b5e70a` added the
  `campaignId`/`body`/`status`/`pinned` backfill inside `version(7)` while the
  schema was already at v14. No later version re-runs the backfill (checked
  through v18).
- **What:** Any database that was already past v7 when that commit landed never
  gets the backfill. The reference notes it was meant to fix stay broken there.
- **Fix:** Add the same backfill as a `version(19).upgrade` (idempotent: only
  touch rows where the field is missing). Leave v7 as is; editing it again
  changes nothing for existing users.

### A8. Settings and maintenance actions that silently do nothing — OPEN (V)
- **Bottom-nav toggles:** `src/screens/SettingsScreen.tsx:248-280` write
  `settings.bottomNavTabs`; no reader exists outside Settings and
  `useAppSettings`. Copy promises a "☰ menu" that does not exist; list includes a
  dead `combat` tab. Either filter `BottomNav`/`CharacterSubNav` by the setting
  or remove the section.
- **Clear all data:** `SettingsScreen.tsx:108-146` hand-lists 16 tables and
  misses `systems`, `referenceSections`, `referenceGroups`, `ships`,
  `ledgerEntries`, `ledgerSplits`, `ledgerAccounts`, `recurringBills`,
  `routeStops`, `routePlans`. Use
  `db.transaction('rw', db.tables, () => Promise.all(db.tables.map(t => t.clear())))`.
- **`showOtherSessionNotes`** (`src/types/settings.ts:92`) has no reader.
- **`useWakeLock.ts:34-44`** auto-acquires on `[]` before settings load, so the
  persisted preference is ignored at startup.

### A9. Repository layering leaks (R)
Raw Dexie reads outside repositories, several without a `deletedAt` filter:
- `src/components/shell/CampaignHeader.tsx:73` `db.campaigns.toArray()` — use
  `campaignRepository.getAllCampaigns()`.
- `src/features/campaign/CampaignContext.tsx:193,195,313-315` raw
  `db.parties`/`db.partyMembers`/`db.sessions` — a tombstoned party or
  `status:'active'` session is rehydrated. `:410` counts deleted sessions
  (numbering skips); `:427,451,471,474,592` bypass `sessionRepository`.
- `src/features/session/useSessionLog.ts:661,667` `db.notes.get`/`db.encounters.get`
  without a deleted check (a note can be reassigned into a deleted encounter);
  `:235,573,614` raw adds; `:696` hand-rolled edge soft-delete.
- `src/features/encounters/addPartyCharactersToEncounter.ts:34`
  `db.entityLinks.toArray()` full scan inside a write transaction — use
  `getLinksFrom(id, 'represents')`.
- `src/features/encounters/useEncounter.ts:108-116,192-204,228-268` and
  `useSessionEncounter.ts:90,127,165,170-178` do repository work in hooks.
- Participant-add transaction is copy-pasted in four places
  (`useEncounter.ts:95-149`, `CombatEncounterView.tsx:258-280`,
  `BestiaryScreen.tsx:389-410`, `addPartyCharactersToEncounter.ts:29-82`);
  `BestiaryScreen.tsx:397` still has the `length + 1` sortOrder bug the other
  three fixed. Fold into `encounterRepository.addParticipant`.
- `src/utils/import/mergeEngine.ts:108-109` `danglingLinkEndpoint` accepts a
  soft-deleted row as a live endpoint. Add `|| exists.deletedAt`.
- `session`/`campaign`/`party`/`character` repos' `softDelete`/`restore`
  cascade to nothing (`sessionRepository.ts:193`, `campaignRepository.ts:77`,
  `partyRepository.ts:105`, `characterRepository.ts:115`). Symmetric today, but
  contrary to the convention's promise. Note: `session`→`note` uses a
  `sessionId` column, so a session restore should also restore its notes by
  `softDeletedBy`.

### A10. Other persistence races (R)
- `CampaignContext.tsx:404-427` "one active session" is check-then-act on React
  state with no transaction and no busy state on the buttons
  (`SessionScreen.tsx:242`, `SessionLog.tsx:638`). Encounters got this right.
- `src/features/ledger/useLedger.ts:352-372` bill posting writes N entries then
  the watermark, not atomically; a throw at k+1 re-posts all N next open.
  `LedgerScreen.tsx:63-83` has no catch.
- `useSessionLog.ts:344-365` resource-buffer flush resets after the await; an HP
  delta logged mid-flush is dropped.
- `NoteEditorScreen.tsx:83-147` load-on-id-change does not clear
  `pendingUpdatesRef`/`noteRef`; a flush can write note A's pending title onto
  note B if navigation happens within the 800 ms debounce.
- Unhandled promises: `SessionScreen.tsx:198`, `ManagePartyDrawer.tsx:57`,
  `LedgerScreen.tsx:308-309` (toast fires regardless), `ShipsScreen.tsx:106-110`,
  `useLedgerSplit.ts:74-81`, `useRoute.ts:91-98` (optimistic state, no revert).
- `characterRepository.ts:25` `getAll` maps `upgradeCharacter` with no per-row
  guard; one malformed record hides the whole library. Wrap per row, log and
  skip.
- `src/utils/migrations.ts:264` `schemaVersion > CURRENT_SCHEMA_VERSION` passes
  silently on import. Reject.
- `src/features/settings/useAppSettings.ts:75-77` swallows a load failure, then
  the next `updateSettings` overwrites disk with defaults.
- `src/utils/import/bundleParser.ts:305-306` a hash check that *throws* returns
  `true`.

---

## Workstream B — Security

The app has no eval, no `dangerouslySetInnerHTML`, no network calls, no CDN
scripts, all object URLs are revoked, and exports skip deleted rows. Every gap
is on the **import** path, where data is untrusted.

### B1. Legacy bare-character import skips validation — DONE (7bf2a4e)
- **Where:** `src/utils/import/bundleParser.ts:67-68` routes any JSON without a
  `version` key to `handleLegacySkaldbok` (`:144-171`), which never calls
  `migrateCharacter`. `validateContentsEntities` (`:177`) runs only on the
  versioned path (`:108`). `mergeEngine.ts:263` then `put`s the raw object.
  The read path (`characterRepository.getAll`) deliberately does not validate.
- **What:** A record with e.g. `skills: null` reaches every screen and breaks
  library load until IndexedDB is cleared. The single-character path
  (`importExport.ts:140`) validates; the campaign-menu path
  (`useImportActions.ts:95-99`, accepts `.json`) does not.
- **Fix:** Run `migrateCharacter` inside `handleLegacySkaldbok` and return a
  failure result on throw.

### B2. Bundle attachments are never validated; filename reaches ZIP paths — DONE (7bf2a4e mime/size, 1f7c538 filename)
- **Where:** `bundleParser.ts:251` claims attachments are "validated via
  bundleContentsSchema already", but the parser uses
  `bundleEnvelopeParseSchema` whose `contents` is `z.record(z.any())`
  (`src/types/bundle.ts:115-117`). `mergeEngine.ts:385-398` `atob`s unbounded
  base64 and stores arbitrary `mimeType`, `filename`, `sizeBytes`, `noteId`.
  On re-export the stored `filename` is the ZIP entry path verbatim
  (`useExportActions.ts:122,259,348`) — `../../x.jpg` is written as-is (zip-slip
  for whoever extracts).
- **Also:** attachments are not rendered today (`NoteReader.tsx:334-349` shows
  caption/id). The moment one is shown via `URL.createObjectURL(att.blob)`, an
  imported `image/svg+xml` or `text/html` blob is same-origin script.
- **Fix:** Validate with `attachmentBundleSchema` in `validateContentsEntities`;
  cap `data.length`; whitelist MIME types to raster images; regenerate
  `filename` on import (as `attachmentRepository.ts:25` does) or
  `basename`+slugify at export.

### B3. Session ZIP export leaks private notes' attachments — DONE (d7bea56)
- **Where:** `src/features/export/useExportActions.ts:237` computes
  `shareableNotes = excludePrivateNotes(linkedNotes)`; the attachment loop at
  `:256` iterates `linkedNotes`. The sidecar (`renderAttachmentSidecar.ts:16`)
  also includes the private note's title.
- **Fix:** Loop over `shareableNotes`.

### B4. Id-collision guard is bypassable — DONE (91a1722)
- **Where:** `mergeEngine.ts:282-291` treats a same-id row as a collision only
  when *both* `createdAt` exist and differ. A record with no `createdAt` and a
  far-future `updatedAt` passes `:297` and `:317` and overwrites the local row
  (`:324`). `computeConflicts`/`mergeEntity` read soft-deleted rows too, so an
  import silently resurrects and overwrites a tombstone.
- **Fix:** Mint a fresh id when `createdAt` is absent or differs (as
  `importExport.ts:149-152` does). Treat a tombstoned local row as a collision.

### B5. Prototype-key lookups on attacker-controlled strings — DONE (ce28c51)
- `importExport.ts:29` `SYSTEM_ID_ALIASES[normalized]` — `systemId:
  "__proto__"` persists `systemId: {}`.
- `mergeEngine.ts:106` `LINK_ENDPOINT_TABLES[type]` — throws inside `db.table`,
  caught; fails safe but by accident.
- `importExport.ts:46-49` `sanitizeDeep` assigns `out["__proto__"]`.
- `src/features/systems/cards/CardRenderer.tsx:59` `GUARDS[normalized.when]?.(engine)`
  — `when: "constructor"` calls `Object(engine)` → truthy → the "fail closed"
  guard fails **open**.
- **Fix:** `Object.hasOwn` at every site, or `Object.create(null)` maps.

### B6. Remote-URL portrait makes a network request — DONE (db42a26, tightened in ce28c51)
- **Where:** `portraitUri` (`src/types/character.ts:490`) is unconstrained
  (`schemas/character.schema.ts:135-139` is `passthrough()`), rendered as
  `<img src>` at `CharacterPortrait.tsx:139,208` and `ProfileScreen.tsx:146`.
- **What:** An imported character can carry a tracking pixel (IP/timing
  disclosure) from an app that promises no network.
- **Fix:** `z.string().regex(/^data:image\/(jpeg|png|webp|gif);base64,/).max(N)`,
  plus B7.

### B7. No Content-Security-Policy — DONE (ce28c51)
- `index.html` has none. Defence in depth, and it neutralises B6 via `img-src`.
- **Fix:** `<meta http-equiv="Content-Security-Policy" content="default-src
  'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline';
  script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'">`.
  Verify Tailwind/Tiptap inline styles and the PWA manifest still load.

### B8. Full DB dump left in localStorage forever — DONE (5601188)
- `src/storage/db/migrations/pre-encounter-rework-backup.ts:44-48` writes every
  domain table to `localStorage["forge:backup:…"]` during the v8 upgrade.
  Nothing removes it; it survives campaign deletion and sits outside the
  soft-delete model.
- **Fix:** Clear the key in the next `version()` upgrade.

### B9. Unbounded input sizes on the bundle path — DONE (91a1722)
- `useImportActions.ts:98` `file.text()` with no size check; `parseBundle`
  parses, then `verifyContentHash` (`bundleParser.ts:291`) re-parses; pre-v1
  bundles are re-serialised and re-parsed (`:85`). `baseNoteSchema.body` is
  `z.unknown()`. `utils/imageResize.ts:21` decodes any file via
  `createImageBitmap` with no MIME/size gate.
- **Fix:** Reject on `file.size` above a cap before `text()`; gate images as
  `CharacterPortrait.tsx:14-15` already does.

### B10. Reference import and editor bodies are unvalidated JSON — MOSTLY DONE (4d6d9e7); editor bodies remain
- `src/screens/ReferenceScreen.tsx:328` `JSON.parse(...) as ReferenceImportBundle`
  → `referenceSectionRepository.importBundle` (`:160-200`) stores
  `columns/rows/items/paragraphs` as-is; `parseEditorBody` (`:60,:64`) casts.
  Rendering is React text so no XSS; a malformed shape is a render error and a
  stuck section.
- **Fix:** Zod schemas for `ReferenceImportBundle` and the table/kv bodies.
- **Closed for the import path.** `importBundle` now takes `unknown` and
  validates it itself, so the enforcement is at the repository rather than at a
  cast in one screen. `referenceImportSectionSchema` / `…GroupSchema` /
  `…PageSchema` in `types/reference.ts` follow the row-schema pattern already
  there; `utils/import/referenceBundleParser.ts` filters row by row with
  `safeParse` and returns warnings, mirroring `bundleParser`. A bad row is
  dropped and reported in the screen's status line instead of being written and
  crashing the screen on the next visit — which the id-keyed `bulkPut` made
  permanent, since a malformed row could land on a good one. Six tests in
  `referenceSectionRepository.test.ts`; five fail with the validation bypassed.
- **Still open:** `parseEditorBody`'s two casts (`:60`, `:64`) — the in-app
  table/key-value editor bodies. Same shape, different entry point.

---

## Workstream C — Engine: modifiers and derived stats

The engine contract says a modifier target must reach a consumer. The
`engineContract` fingerprint was meant to enforce that, but it includes the raw
attribute values, so any `attr:` target trivially "moves" the fingerprint even
when no derived number changes.

### C1. Attribute modifiers never reach derived stats — DONE (80c510d)
- **Where:** `src/utils/derivedValues.ts:81,86,98,109,120,151` read
  `character.attributes['con'|'wil'|'str'|'agl'|'int']` raw;
  `savageWorldsEngine.ts:47-49` `traitDie` reads `character.attributes[id]` raw
  (feeds Toughness, Parry, Load Limit, the attribute badge);
  `travellerEngine.ts:68-72` carry limit reads raw (documented as deliberate).
- **What:** A +2 Vigor buff does not move Toughness. A CON buff does not move
  HP max. The `attr:` targets the picker offers change the attribute display
  and nothing downstream.
- **Decision needed:** Should a temporary attribute modifier flow into derived
  stats? In SWADE, yes (Toughness follows Vigor). In Dragonbane, a temporary CON
  change affecting HP max is arguable. Recommendation: flow it, and let a system
  opt a specific derived field out if a rule says so.
- **Fix:** Read attributes through `getEffectiveValue(attrKey(id), character)`
  in every `compute*` helper and in `traitDie`. Then fix the test (see F3).

### C2. Declarative card tiles ignore every resolver — OPEN (V)
- **Where:** `src/features/systems/cards/primitives/TileCard.tsx:41,47,53`
  `resolveDataPath` returns `character.attributes[id]`,
  `resources[id]?.current`, `derivedStats()[id]` raw.
- **What:** Every `tile`/`table`/`toggleGrid` card in every `sheet.json` is blind
  to `attr:`/`res:`/`derived:` modifiers **and** to `derivedOverrides`. This is
  the exact "target resolves but nothing reads it" class CLAUDE.md warns about,
  reintroduced by the card layer.
- **Fix:** `getEffectiveValue(attrKey(id))`, `getEffectiveValue(resKey(id))`,
  `resolveDerivedField(character, derived, field)`.

### C3. Two competing maxima for Dragonbane HP/WP — OPEN (R)
- **Where:** `src/utils/resourceMaxima.ts:30-41` writes `resources.hp.max =
  attributes.con` raw; `derived.hpMax/wpMax` are `overridable` and modifier
  targets (`classicFantasyEngine.ts:250-259`); `restActions.ts:53,92` restore to
  `resources.*.max`.
- **What:** A "+2 Max HP" modifier moves the Derived panel and print sheet but
  not the tracker's clamp or what rests restore to.
- **Fix:** One channel. Either `ResourceDefinition.max: { derivedKey: 'hpMax' }`
  resolved through `resolveDerivedField` everywhere a max is read, or drop
  `hpMax`/`wpMax` from `derivedFields` and make the resource max the only truth.

### C4. Effective vs stored reads that disagree on screen (R)
- `SheetScreen.tsx:759-768,798,1269` raw `resources[id].current` for display,
  the Traveller damage line, and `isDown`; `travellerEngine.ts:53` computes the
  DM badge via `getEffectiveValue(resKey)`. With a `res:end` modifier the badge
  and the "after N damage" line disagree. Keep the stepper bound to stored; show
  effective beside it.
- `MagicScreen.tsx:146,251-252` raw pool for affordability — a `res:wp`
  modifier cannot be spent.
- `ParticipantDrawer.tsx:74,109,204` clamps to raw `resource.max`.
- `PrintableSheet.tsx:140,403-410,735,751` raw attributes/skills/resources.
- `SheetScreen.tsx:722` binds `AttributeField value={ev.effective}`; writes go to
  stored, but `disabled={value <= min}` clamps on the buffed value.
- `BuffChipBar.tsx:28`, `SheetScreen.tsx:1603` print `ATTR:STR +2` — the id as
  label; `engine.modifiableStats(system)` has the label. `SheetScreen.tsx:1597`
  prints `rest.id` not `rest.label`.
- `DebtList.tsx:45` `${n} ${abbr}` bypasses `currency.formatAmount` (prints
  `1500 c` where the purse says `1g 5s`).

---

## Workstream D — Engine: rules still living in screens or one ruleset

Each of these is a rule that differs between systems but is implemented in
generic code, in one adapter's private helper, or as a `systemId ===` branch in
disguise. The fix pattern is the same every time: add the engine field, make
every adapter declare it, make the screen read it.

### D1. Encumbrance: three formulas, one wired to the wrong engine — DONE (2a48cf0)
- **Where:** classic `ceil(STR/2) + capacityBonus` (`derivedValues.ts:119-127`);
  Traveller `STR + END` (`travellerEngine.ts:68-72`); Savage `(sides+bonus) × 5`
  (`savageWorldsEngine.ts:103`). Only classic honours `capacityBonus`, so a
  backpack works in one system. Carried load is summed inline with the `tiny`
  exemption in `GearScreen.tsx:360-362,381` and `PartyInventoryTab.tsx:103`.
  `PartyInventoryTab.tsx:14,122,192` imports the Dragonbane
  `computeEncumbranceLimit` for every PC and calls `useSystemEngine()` (active
  *character*), not the campaign's engine — a Traveller party gets Dragonbane
  capacity, and with no active character, Dragonbane coins.
- **Fix:** `engine.encumbrance: { limit(character), load(character) } | null`;
  `null` hides the panel. Party screens use
  `useSystemEngineFor(activeCampaign?.system)`.

### D2. Modifier expiry is coupled to rest ids — DONE (0ee0e82)
- **Where:** `SheetScreen.tsx:533-553` expires modifiers whose `duration ===
  rest.id` when that rest button is pressed. That is the *only* expiry path.
- **What:** Traveller and Savage have `rest: null`, so no modifier ever expires
  there (Traveller even relabels `stretch`/`shift` as Watch/Day, which nothing
  fires). `scene` and `session` durations expire nowhere in any system.
- **Fix:** `TimeUnit.expiresOn?: { rest?: string; sessionStart?: boolean;
  encounterEnd?: boolean }`. Hook session start (next to `sessionRefreshPatch`)
  and encounter end. Add a generic "advance time" control for systems with no
  rest ladder.

### D3. Magic rules in the shared screen — DONE (d34f5fd)
- `src/screens/MagicScreen.tsx:17,137` `computeMaxPreparedSpells` reads
  `attributes['int']` raw (`derivedValues.ts:150-154`); `:18,139,320` the
  metal-armour-impairs-casting rule; `:145,150` fall back to `'wp'` and
  `{[1,2,3], 2, 1}`; `:421` restates "2 per power level / Tricks cost 1" as
  literals; `:427` fixes three power slots. `MagicModule.tsx:12-14` and
  `utils/spells.ts:11-13` detect tricks by `school.includes('trick')`; `:57`
  defaults power level `1` rather than `powerLevels[0]`.
  `abilities.ts:74,127` hardcode `cost.wp` while `toSpells` takes a
  `resourceId` no caller passes.
- **Fix:** `engine.magic.maxPrepared?(character)`,
  `engine.magic.castingImpairment?(character)`, `engine.magic.trickSchoolIds`;
  `magic === null` means no automation; render everything from the model.

### D4. Savage condition effects are declared and unread — DONE (8404407)
- **Where:** `src/systems/savage-worlds/system.json` declares
  `conditions[].effect: {scope:'all-traits', modifier:-2}` etc.;
  `savageWorldsEngine.ts:130-131` hardcodes `distracted`/`entangled` instead.
  Classic uses a different field (`linkedAttributeId`, read by
  `utils/conditionEffects.ts:16-25`); Traveller's `fatigued` is prose only.
  `declaredCapabilities.test.ts:103-104` lists `effect`/`duration`/`recovery`
  under `TOO_GENERIC`, so the guard cannot catch this.
- **Fix:** `engine.conditionPenalty(character, { skillId, linkedAttributeId })
  → { boonBane?, modifier, blocksActions }` driven by `conditions[].effect` for
  all three systems. Remove those names from `TOO_GENERIC`.

### D5. Damage handling inlined per track kind — DONE (90ab3f7)
- `DamageHealModule.tsx:6,97-139` imports `utils/damageTrack` directly, inlines
  `track.kind === 'levels'`, hardcodes `'shaken'`, "Shaken", "Wound", "under
  Toughness". `SheetScreen.tsx:43,746` imports `damageStatus`. `resolveDamage`'s
  `ap` is never supplied by any caller.
- **Fix:** `engine.applyDamage(character, input)` and `engine.damageStatus` as
  the only entry points; condition names via `system.conditions[].name`; a
  `summary` string on the result so the module prints what the engine says.
  Make `damageTrack.kind` and `attributeReadout` required rather than
  duck-typed.

### D6. `systemId ===` branches in disguise — MOSTLY DONE (c45865e); skill marks remain
- `SkillModule.tsx:38` `engine.resolution === 'd20-roll-under'` decides layout.
- `SkillsScreen.tsx:187-219` `!engine.skill.supportsMarks` as "not d20";
  `supportsMarks && value === 1` for auto-success; imports
  `formatProb`/`resolveEffectiveBoonBane` directly; `:312-321,395` capitalises
  state ids instead of `engine.rollModifiers[].label`; `:336-339,642-657`
  dragon/demon glyphs; `:298` custom skill created `{value: 0, trained: true}`
  (Traveller's rule).
- `DerivedStatsModule.tsx:22-34` `'characteristicDMs' in derived` — Traveller
  key names as a type test.
- `CombatModule.tsx:17` `showCoins = … && !engine.damageTrack`.
- `ResourceModule.tsx:36` `if (id === 'hp' || id === 'wp')` gates session
  logging — Wounds/Bennies/user pools never reach the log; `:50` `wounded =
  current > 0` assumes accumulating. `SheetScreen.tsx:402` already does it
  right with `engine.resourceIds.includes(id)`.
- **Fix:** `engine.skill.describe(value, ctx) → { value, odds, notes }`
  (classic's unused `formatSkillProbability` at `classicFantasyEngine.ts:17`
  already exists); `skill.autoSuccessAt?`; `skill.marks?: [{id,label,glyph}]`;
  `engine.attributeModifiers?(c)` folded into `attributeReadout`; place the
  currency card in `sheet.json`; log all `resourceIds`. Extend
  `engineConsumers.test.ts` to flag these patterns (F2).

### D7. Print sheet is a Dragonbane skeleton — DONE (1411b67)
- `src/components/PrintableSheet.tsx`: `:238` abilities gated on `hasMagic`
  (Traveller Talents never print); `:140` raw attributes; `:403-410`
  `charSkill?.value ?? ''` (untrained skills print blank); `:724-753`
  `hasHpWpPools`, `id === 'hp'/'wp'`, "Hit Points & Willpower", `wp-dot-filled`;
  `:181` `PRINT_DERIVED_ORDER`; `:677-680` `PRINT_DEATH_TRACK_LABELS`;
  `:366-455` skills keyed on `core`/`weapon` category ids with
  "General/Weapon/Secondary Skills" headings; `:497` "Tiny Items" printed when
  `labels.tinyItems === null`.
- **Fix:** `DerivedFieldDef.printLabel`, `DeathTrack.printLabel`,
  `labels.resourcesPrintHeading`; resolve via `getEffectiveValue`,
  `resolveSkillValue`, `engine.skill.computeValue`; iterate
  `resolveSkillCategories`; gate abilities on `labels.abilitiesScreen !== null`.

### D8. System-specific sheet panels in code — DONE (a0d2af5)
- `SheetScreen.tsx:120-155,969-1138` Traveller career/connection columns,
  Savage Edges/Hindrances titles and placeholders, `systemData` keys
  (`careerTerms`, `allies`, `edges`, …) all in code, while
  `identityFields`/`financeFields` already show the declarative pattern.
  `:798,816,824` "DM" and `resources[attrId].current` assume Traveller's damage
  convention; `:361` `?? 10`, `:378` `?? 30`; `:1255` `index === 0 ?
  'rest-btn--round' : 'rest-btn--stretch'`; `:706,785` two attribute grids for
  `attributes` vs `characteristics` panel keys.
- **Fix:** `sheetPanels` in `system.json` rendered by one generic repeatable-rows
  panel; alias the two panel keys.

### D9. Creature stats and encounter defaults — DONE (7fb7d3f)
- `useEncounter.ts:121-123` `template.stats?.hp`;
  `EncounterParticipantPicker.tsx:107` `{hp, armor: 0, movement: 0}`;
  `CombatEncounterView.tsx:245`; `QuickCreateParticipantFlow.tsx:23`
  `DEFAULT_LABELS = {health:'HP'…}`; `features/bestiary/creatureStats.ts:13-17,45,57`
  `{id:'hp', label:'HP'}`, `?? 'hp'`. `system.creatures.healthStatId` exists.
  Traveller's JSON `statFields` labels ("Hits", "Speed (m)") disagree with the
  adapter's `labels.creature*` ("END", "Mv") for the same system.
- **Fix:** Derive everything from `resolveCreatureStatFields(system)`; delete
  the three `labels.creature*` keys.

### D10. Session log vocabulary — MOSTLY DONE (7fb7d3f); "Death Roll #n" remains
- `useSessionLog.ts:278-290,306` `'success'|'failure'|'dragon'|'demon'`,
  `tags.push('Boon'|'Bane'|'Pushed')` (dead but exported; `formatSkillCheckTitle.ts`
  already uses `engine.outcomes`); `:387` `resourceId = 'hp'`; `:108-112`
  `LEGACY_COIN_ABBREVIATIONS`; `:351` `resource.toUpperCase()` ("Took 1 BENNIES
  damage"); `:426-428` "Death Roll #n" ignoring `death.tracks[].label`; `:471`
  "Coins" ignoring `currency.label`.

### D11. The health resource is named six ways — PARTLY DONE (74bd175); health consolidation declined
`primaryHealthResourceId`, `damageTrack.order[0]`, `death.triggerResourceId`,
`terms.healthResource`, `labels.participantHealth`, `creatures.healthStatId`;
`downLabel`/`deadLabel` exist on both `DamageTrackModel` and `DeathModel`.
Magic presence has five flags (`hasMagic`, `magic !== null`,
`labels.abilitiesScreen`, `panels.includes('magic')`, sheet.json `when:
hasMagic`). `skill.advancementMax` duplicates `advancement.maxSkillValue`.
- **Fix:** `engine.health { resourceId, label, downLabel, deadLabel }`; derive
  `hasMagic` from `magic !== null`; drop `advancementMax`.

### D12. Smaller leaks — MOSTLY DONE (1411b67); see the Progress note
- `AttributeField.tsx:36` defaults `min = 3, max = 18`; `SheetScreen.tsx:801-808`
  passes `attr?.min` so an undeclared attribute silently gets 3..18. Make
  required.
- `InventoryItemEditor.tsx:84-92` "Tiny item" checkbox rendered when
  `labels.tinyItems === null`. `WeaponEditor.tsx:28-40,101-127` grip/damage-type
  lists in code.
- `GearScreen.tsx:18,281` `remakeCurrency` bypasses `engine.currency`
  (add `currency.adjust`).
- Dead roll-under components: `components/fields/SkillList.tsx:23`,
  `SkillRow.tsx:15,32,40`; sole caller `SkillsScreen.tsx:676` passes
  `categories={[]}`. Delete.
- `'classic-fantasy'` literal as fallback in 8 sites (`CampaignHeader.tsx:66`,
  `SessionSubNav.tsx:80`, `CombatEncounterView.tsx:53`, `ParticipantDrawer.tsx:32`,
  `useRoute.ts:29`, `useLedger.ts:29`, `bundleParser.ts:164`,
  `bundleSerializer.ts:52`) while `DEFAULT_SYSTEM_ID` exists. Let
  `useSystemDefinition(id?)` default internally.
- `features/characters/characterMappers.ts:15-31` a third hand-maintained
  system-id map; unknown ids get a Dragonbane blank despite the comment.
- `cards/registry.ts:33,61` persisted card key `bennies` for a generic
  session-refresh pool; `types/system.ts:331` `bennies` panel key duplicates
  `resources[].refresh: 'session'`.
- `types/character.ts:272-276` `StatKey` union names `str…cha`, `hpMax`,
  `wpMax`; `:381` `restsUsed?: {round?, stretch?, shift?}`. Widen to `string`.
- Vocabulary with no engine field yet: "Rest & Recovery", "Death Rolls",
  "Finances", "Skills", "Prepared …", "roll a dragon or a demon"
  (`AdvancementPanel.tsx:116`), "Characteristic" in shared forms
  (`SkillsScreen.tsx:546`, `AddCustomSkillForm.tsx:83`), `?? 'Bennies'`
  (`BenniesModule.tsx:47-59`), Traveller flavour in ledger/route/ship
  placeholders (`BillsPanel`, `AccountsPanel`, `DistributeModal`,
  `LedgerImportModal`, `RouteScreen`, `RouteImportModal`, `ShipsScreen`,
  `utils/route/calendar.ts:85-102` 7-day week). Declared but unread on the
  sheet: `labels.derivedPanel` (`SheetScreen.tsx:1225`), `labels.storyBankPanel`
  (`:1143`).

---

## Workstream E — Engine: data that should be JSON, code that should be an adapter

Nothing here is a bug. It is the structural work that makes the next system
cheap and makes a user-authored system possible.

### E1. Move adapter data into `system.json` — OPEN (V)
`getEngine` (`engine/index.ts:95-106`) already merges `terms`, `labels`,
`logActions`, `outcomes`, `rollModifiers`, `timeUnits`, `panels` and
`currency` from JSON. Only Traveller declares `panels` and `currency`; none
declare the rest. Move all of it for all three systems so the adapters hold
only functions. Candidates that are pure data but have no JSON path yet:
`death` (tracks, labels), `damageTrack` (order, thresholds, labels), `magic`
(resource, levels, costs), `advancement.sessionEvents`, `probability.difficulty`,
`derivedFields` (labels, surfaces; the computation stays in code),
`rest[].prompt` and `rest[].label`. Bump each `system.json` `version`.

### E2. Generic currency read/write — OPEN (V)
All three adapters' `currency.read`/`write` are the identical
`character.wealth?.[id] ?? 0` / `{ wealth: {...character.wealth, ...amounts} }`.
Traveller's whole adapter `currency` block (`travellerEngine.ts:314-329`) is
overwritten by `mergeCurrency` except `read`/`write`. `makeFormatAmount`
(`utils/currency.ts:90-111`) is used only by classic; Traveller and Savage
hand-roll `formatAmount` with a hardcoded `'en-US'` locale.
- **Fix:** A default `read`/`write` built from `denominations` in
  `mergeCurrency`; a `formatAmount` that handles single-denomination systems
  with a `prefix` option; adapters stop declaring currency at all.

### E3. Derive `attributeIds`/`resourceIds` from JSON — OPEN (V)
`attributeIds` is hardcoded in all three adapters and overwritten by
`getEngine`, but `travellerEngine.ts:125` iterates `TRAVELLER_ATTRIBUTE_IDS`
for DMs, so a characteristic added in JSON gets a badge and no DM row.
`resourceIds` is hardcoded because classic wants to omit the death-track
counters; declare that on the resource (`ResourceDefinition.role: 'track' |
'counter'`) and derive. `damageTrack.levels`/`death.tracks[].max`/`skill.ladder`
restate `defaultMax`/`scale.ladder`; `scale.allowsPlus` and
`damageTrack.penaltyPerLevel` are unread.

### E4. Base adapter by declaration, not by id — PARTLY DONE (518238d); selection by declaration remains
`baseEngineFor` (`engine/index.ts:16-27`) maps by `system.id`, so a
user-imported system silently gets Dragonbane formulas (d20 roll-under, HP/WP
rests, death rolls). Let `system.json` declare `engine: 'd20-roll-under' |
'2d6-plus' | 'trait-die-vs-tn'` (the `ResolutionMethod` union already exists)
and pick the adapter from that. This also removes the hand-maintained lockstep
between `registry.ts` and `baseEngineFor`. Warn loudly (not just in DEV) when
an unknown id falls back.

**Done:** the loud warning, and more than a warning. The `if (system.id === …)`
chain is now `SYSTEM_ADAPTERS`, a map, so "does this system have an adapter?" is
answerable rather than a fallthrough; the warning fires in every environment
(once per id, since this runs during render); `SystemEngine.fallbackRulesFor`
carries the unsupported id and `CharacterSubNav` — the one component every
character screen passes through — names the system and says the numbers below
came from classic-fantasy's rules. `fallbackAdapter.test.ts` also enforces the
`registry.ts` ↔ adapter lockstep CLAUDE.md describes, so a bundled system
registered without an adapter now fails CI instead of shipping as Dragonbane.

**Still open:** picking the adapter from a declared `engine:` discriminator
rather than from the id, which is what would remove the lockstep rather than
merely guard it.

### E5. Classic-fantasy helpers into `systems/classic-fantasy/classicMath.ts` — OPEN (R)
Mirror `travellerMath.ts` and `savageMath.ts`: the `compute*` family in
`derivedValues.ts` (only `classicFantasyEngine` and the leaks in D1/D3 import
them; `computeBaseChance`/`getSkillBaseChance` are byte-identical;
`DERIVED_KEYS` at `:217` duplicates `migrations.ts:85`), all of
`restActions.ts` (hardcodes `wp`/`hp`; `ResourceDefinition.refresh: 'rest'` has
no reader — `RestDefinition.restores: [{resourceId, amount}]` would fix both),
`boonBane.ts:13-25` d20 maths (keep `formatProb`/`resolveEffectiveBoonBane`
generic), `abilities.ts`, `spells.ts`. Conversely `systems/traveller/index.ts:18`
and `systems/savage-worlds/index.ts:15` `export * from './…Math'` off the data
module; drop so system folders are data-only.

### E6. `system.json` structural drift — OPEN (V)
Only Traveller declares `panels`, `currency`, `creatures`, `vehicles`,
`financeFields`, `itemFields`, `skillGroups`, `routePlanner`, `calendar`; only
Savage `scale`, `conditions[].effect/duration/recovery`, `refresh`; only classic
`linkedAttributeId`. `types/system.ts:474-490` types `terms` with 5 keys and
`labels` with 4 while the schema accepts 6/22, so a TS-authored system cannot
set `labels.memento` without a cast. Blank templates
(`sample-data/*.blank.character.json`) restate `defaultMax`, stamp
`schemaVersion: 4` while current is 5, and the classic one has `deathRolls`
but not `deathSuccesses`. Write a "system.json checklist" and bring all three
to the same shape.

---

## Workstream F — Tests that would have caught the above

### F1. Widen `vocabularyLeaks.test.ts` — DONE (1411b67)
`:23` scans only `features/encounters` and `features/playDashboard` for
`HP|Hit Points`. Add `src/screens` and `src/components`; it catches
`PrintableSheet.tsx:741` immediately. Add `WP`, `Bennies`, `Wounds`, `DM`,
`Cr`, `gold` with an allowlist for adapters and `system.json`.

### F2. Extend `engineConsumers.test.ts` — DONE (c45865e)
It catches `systemId ===` but not `engine.resolution ===`, `supportsMarks` as
a proxy, `'characteristicDMs' in derived`, or `!engine.damageTrack` as a layout
switch. Add those patterns.

### F3. Make the contract fingerprint honest — DONE (80c510d)
`engineContract.test.ts:229` includes `attrs` via `getEffectiveValue`, so any
`attr:` target moves the fingerprint even when no derived value changes. Either
drop that line, or assert per target that at least one of `derived`, `badges`,
`fields` or `skill` moves.

### F4. Remove `effect` from `TOO_GENERIC` — DONE (8404407)
`declaredCapabilities.test.ts:103-104`. They hide D4. Also align the staleness
self-check (`:144-146`) with the main check's three read patterns.

### F5. Cover the import path — OPEN
Tests for B1 (legacy JSON with `skills: null` is rejected), B2 (attachment
with `../` filename is renamed), B3 (private note attachments absent from the
session ZIP), B4 (same-id, no-`createdAt` import mints a new id).

### F6. Round-trip soft delete for every entity — OPEN
For each repository with `softDelete`: delete → not in default reads → restore
→ back with cascaded rows. A6 would have failed on day one.

---

## Workstream G — Configuration over hardcoding and polish

- **G1** Timeline track grouping lives in
  `components/timeline/config/defaultTimelineTrackCatalog.ts:24`, imported
  directly by `sessionTimelineAdapter.ts:3,55`; no settings key. This is
  CLAUDE.md's first named example. Move to `config/defaults/timelineTracks.ts`,
  add a settings key and `useTimelineTrackCatalog()`. (R)
- **G2** `NotesGrid.tsx:19-33` `NOTE_TYPE_FILTERS`; `PromoteEntriesSheet.tsx:30-37`
  vs `NoteEditorScreen.tsx:265` two *disagreeing* selectable-note-type lists;
  `VaultBrowser.tsx:56-62` `CATEGORY_TABS`; `BestiaryScreen.tsx:47-52` +
  `CreatureTemplateForm.tsx:145` duplicated bestiary labels. (R)
- **G3** `noteRepository.addPromotedIntoEdges:534-547` has no dedupe; promoting
  twice yields duplicate `promoted_into` edges. (R)
- **G4** `migrated_from` link type (`client.ts:242`) is missing from the
  CLAUDE.md table and the `entityLinkRepository.ts:12-13` comment;
  `campaign`/`party`/`partyMember` entity types are documented but never
  created. (R)
- **G5** `TrashScreen.tsx` surfaces only creature templates; every other
  entity's tombstones are unreachable except via the note Undo toast. (R)
- **G6** Play-mode guard consistency: `SheetScreen.tsx:288` and
  `CampaignHeader.tsx:68` check `settings.mode === 'play'` ad hoc;
  `ProfileScreen.tsx:66,209,226` gates identity on `useIsEditMode()` while
  `SheetScreen.tsx:176` uses `FIELD_PATHS.identity`; `SkillsScreen.tsx:126,643`
  uses `!skillsEditable` as a play detector for marks; `GearScreen.tsx:125,433-483`
  locks gear behind `useIsEditMode` while `modeGuards.ts` documents weapons as
  play-editable. Add `FIELD_PATHS.skillMarks`, `FIELD_PATHS.gear`,
  `useIsPlayMode()`. (R)
- **G7** Legacy hard-delete names still exported (`characterRepository.remove`,
  `noteRepository.deleteNote`, `partyRepository.removePartyMember`,
  `referenceNoteRepository.remove`); `entityLinkRepository.deleteLinksForNote`
  is a soft delete with a hard name. Rename to `hardDelete*`/`softDelete*`. (R)
- **G8** Unguarded `softDelete` re-stamps `softDeletedBy` on already-deleted
  rows (ledger, ledgerSplit, recurringBill, routePlan, ship, referenceSection);
  `shipRepository.softDelete` takes no `txId`; `routeRepository.restore:185-199`
  does not check `deletedAt`. (R)
- **G9** `routes/index.tsx:61` `/notes` → `/session?view=notes` but nothing
  reads `view`; `CharacterLibraryScreen.tsx:203` navigates to legacy `/sheet`.
  Boolean indexes are dead in IndexedDB (`notes.pinned`,
  `ledgerAccounts.isPrimary`, `recurringBills.active`). (R)
- **G10** `key={index}` on removable lists: `RepeatableRows.tsx:53`,
  `AddModifierDrawer.tsx:166`, `GearScreen.tsx:530`. (R)
- **G11** a11y quick wins: `DerivedFieldDisplay.tsx:63,73` clickable span and
  unlabeled input; `SkillRow.tsx:36`; icon-only buttons at
  `ManagePartyDrawer.tsx:168`, `BuffChipBar.tsx:100`, `TagPicker.tsx:147`. (R)

---

## Workstream H — Product gaps and reachability (second pass)

Findings from the second sweep: features that exist in code but cannot be
reached, and safety or UX gaps that no single bug explains.

### H1. The Knowledge Base is unreachable from the UI — WITHDRAWN (2026-09-08 audit)
**This finding was wrong and no work should be scheduled against it.** The
Knowledge Base *is* reachable without typing a URL. `SessionScreen.tsx:290`
mounts `<VaultBrowser campaignId={...} compact />` (and again at `:600`), and
`VaultBrowser`'s compact branch renders an "Open Knowledge Base →" button that
calls `navigate('/kb')`. The original entry read the `navigate('/kb')` call
sites as internal to the feature; the relevant fact is that the *component
containing them* is mounted on the Session tab, so the path from a running app
to `/kb` exists and is two taps.

Verified 2026-09-08: `SessionScreen.tsx:14,290,600,603`,
`VaultBrowser.tsx:314-326`, `KnowledgeBaseScreen.tsx:18,111`.

The genuine orphan the entry was reaching for is **`MoreScreen`**, which really
does have no link site — `/more` appears only as its own route definition at
`routes/index.tsx:103`. That is already H2's territory; H2 stands and is where
this belongs. Do not delete the KB feature or the d3 dependencies on the
strength of this entry.

### H2. Navigation is five hand-maintained lists, one of them dead — DONE (3f88005)
- **Where:** `BottomNav.tsx:14-16`, `CampaignHeader.tsx:186-221`,
  `SessionSubNav.tsx:32-34,89`, `MoreScreen.tsx:25-29`, plus an ad-hoc bestiary
  button at `SessionScreen.tsx:216,519`. `MoreScreen` has no link site anywhere
  (`rg MoreScreen` finds only the route) and duplicates the header menu.
- **What:** Every new screen is added to whichever list the author remembers.
  Ledger, route, ships, bestiary and KB each ended up on a different surface.
  The `bottomNavTabs` setting (A8) has nothing to filter because there is no
  shared catalogue.
- **Fix:** One `config/defaults/navigation.ts` catalogue (id, path, label, icon,
  surface) read through a hook, per the configuration rule. Delete
  `MoreScreen`. This is the natural home for the A8 bottom-nav toggles.
- **Closed** as `components/shell/navigationCatalogue.ts` — a manifest of every
  destination with the surfaces that offer it, read by all four nav surfaces.
  Deliberately **not** a renderer: the three tab rows have engine-driven
  labels, conditional tabs and longest-prefix active matching, and collapsing
  them into one component would trade a real bug for a worse abstraction. Only
  the duplicated list of destinations moved. `MoreScreen` and `/more` deleted.
- **`navigationCatalogue.test.ts` is the part that matters.** It parses the real
  route table, skips redirects, and fails on any concrete route that neither
  appears in the catalogue nor is recorded as a deliberate exception with a
  reason — plus the reverse, a catalogue entry or an exception naming a route
  that no longer exists. It found three orphans on its first run, one of them
  unknown: **`/ships` had no recorded way in.** It is reachable, from the
  vehicles panel on the sheet, but nothing said so and nothing would have
  noticed if that link went.
- **Still open:** the A8 bottom-nav toggles. `settings.bottomNavTabs` is written
  by the Settings screen and read by nothing; the catalogue is now the place
  that could filter it, but wiring it is a separate change.

### H3. Many soft-deleted entities are unrestorable — DONE (52f1b43), RESCOPED (2026-09-08 audit)
**The original title and premise were stale.** Four types restore from the
trash screen today, not one: `TrashScreen.tsx:80,91,102,113` wires Restore for
characters, sessions, notes **and** creatures, and its empty-state text at
`:172` says so. Sessions in particular are listed below as unrestorable and are
not. The remaining work is real but smaller than written — re-verify each type
below against `TrashScreen.tsx` before scoping.

Repositories that implement `restore` but have no UI
calling it (list as originally written, now known to over-count): `session`, `party` / `partyMember`, `ship`, `route`, `routePlan`,
`ledger`, `ledgerSplit`, `ledgerAccount`, `recurringBill`,
`inventoryContainer`, `referenceSection` (`restoreGroup` too). Callers of
`restore` outside `storage/`: `TrashScreen.tsx:31` (creatures),
`NoteReader.tsx:83` and `SessionLog.tsx:544` (note undo toasts). The soft-delete
convention promises reversibility; today deleting a session or a ledger account
is a hard delete from the user's point of view.
- **Fix:** A generic trash screen driven by a small registry of
  `{ label, getDeleted, restore }` per repository, replacing
  `/bestiary/trash`. Include `deletedAt` and a purge action that calls
  `hardDelete`.
- **Closed, and the count was nine, not twelve.** Re-verified repository by
  repository before scoping, since the list above was known to over-count. The
  nine genuinely unrecoverable-from-the-UI types were ships, inventory
  containers, party members, ledger entries, ledger accounts, recurring bills,
  route stops, reference sections and reference cards. `routePlan` and
  `ledgerSplit` were dropped from the list: one row per campaign, created
  lazily, with no user-facing delete at all — a restore for them would be dead
  code. Sessions, encounters, campaigns and parties likewise have no user-facing
  delete; the Trash's Sessions section is currently unreachable in normal use
  and was left in place rather than removed.
- **What was missing was never `restore`** — all nine already had one, sitting
  in the repository with no caller. It was the `getDeleted` listing and the
  surface. Nine listings added (`getDeletedGroups` for cards,
  `getDeletedMembers` for party seats, which scope through the party since a
  `PartyMember` has no `campaignId`), plus `onlyDeleted` in `utils/softDelete`
  as the shared body — the four existing listings had already drifted, two
  sorting and two not.
- **`features/trash/trashRegistry.ts`** holds the list as data; `TrashScreen` is
  now only the rendering, and loads with `allSettled` so one repository throwing
  cannot blank the whole Trash. `trashRegistry.test.ts` reads the repository
  directory, finds every exported `getDeleted*`, and fails if the registry does
  not *call* it — checked on the call rather than the import, so a leftover
  import cannot pass while rows stay stranded. Then thirteen tests run the real
  loop per type against `fake-indexeddb`.
- **Not done:** the purge action calling `hardDelete`. Deliberately: there is no
  way back from it, the Trash has no confirmation flow, and nothing is asking
  for the space yet.
- **First exercise of a latent path:** restoring a reference card cascades to
  the sections that went down with it, through a `softDeletedBy` query that only
  became legal at schema v19 and that nothing had ever called.

### H4. A campaign export is the only backup, and only Settings knows — DONE for the banner (Q4); the snapshot is WONTFIX as written
- **Where:** `lastBackupAt` is written in exactly one place,
  `src/features/export/useExportActions.ts:456`, after a campaign export.
  `StorageSafetyCard` (the stale-backup warning) was mounted only at
  `src/screens/SettingsScreen.tsx:207`. `config/defaults/backup.ts:13` sets the
  reminder at 30 days. (Two of the three citations this entry carried had
  drifted — `:439` and `SettingsScreen.tsx:310` — and there is no
  `features/settings/SettingsScreen.tsx`. Re-measured 2026-09-11.)
- **What:** A player who never opens Settings never sees the warning. Nothing
  in the app creates a second copy of the data automatically.
- **Still OPEN, but its evidence changed (2026-09-11).** `lastBackupAt` now
  means something: it was stamped from a `.click()` on a detached anchor that
  had no failure mode until `a3ea4fd`, and the file it certifies was missing
  every `represents` edge and every reference note until `8969435` / `068c634`
  (P1). The shell banner and the automatic snapshot are still not built — that
  is the whole of what remains here.
- **Banner — DONE (`Q4`).** `components/shell/BackupReminderBanner.tsx`, mounted
  in `ShellLayout` above the outlet, so it is on every route rather than on the
  one screen you only open when you have already thought about backups. It
  deliberately offers no one-tap export: `exportCampaign(id, includePrivate =
  false)` excludes private notes by default and stamps `lastBackupAt` either
  way, so a button there would write a partial copy and report the campaign as
  safe — `P1`'s defect, rebuilt. Dismissal is session-scoped and persists
  nothing.
- **Snapshot — WONTFIX as specified.** The proposal is two features and neither
  is the one this entry is filed under.
  - **A `snapshots` table is not a backup.** It lives in the same IndexedDB as
    the campaign it copies, so site-data clearing, eviction and corruption take
    both. This entry's own last line makes the argument about persisted storage;
    a copy stored inside the thing being protected is the same case. What it
    *would* be is an **undo** for user error — an accidental delete, a bad
    import — which is a real feature with its own questions (retention, a size
    budget against the quota the safety card already reports, per-entity
    restore). Worth scoping as undo. Shipping it as "backup" would put a second
    green tick on a screen whose tick already meant less than it looked.
  - **The File System Access route is a real backup and is unavailable here.**
    `showSaveFilePicker` / `showDirectoryPicker` are Chromium-desktop only — not
    Safari, not Firefox, not Chrome on Android. This app installs on tablets
    over LAN HTTPS, which is exactly the device class without the API. It would
    serve desktop Chrome and silently do nothing everywhere else.
- **What is actually left**, if someone wants to take it further: an export the
  user cannot get wrong. The privacy toggle is the reason a backup button cannot
  live on a banner, and it is the reason `lastBackupAt` can be stamped by an
  export that omits data. A "full backup" path with no options, separate from the
  shareable export, would collapse both problems.

### H5. Browser-native `confirm`/`prompt` dialogs — OPEN (V)
- **Where:** `TiptapNoteEditor.tsx:595` `window.prompt('URL')` for links;
  `SkillCheckEditDrawer.tsx:106`, `PartyInventoryTab.tsx:526,655`,
  `BestiaryScreen.tsx:174`, `NoteReader.tsx:190` use `confirm()` for deletes.
- **What:** Unthemed, block the main thread, render as bare sheets in an
  installed iOS PWA, and are inconsistent with the two-step Modal the Settings
  danger zone already uses (`SettingsScreen.tsx:325-334`).
- **Fix:** A `useConfirm()` hook over the existing Modal primitive; a small link
  popover for Tiptap.

### H6. Pinch zoom is disabled — DONE (a41d237)
- **Where:** `index.html:8` `maximum-scale=1.0, user-scalable=no`.
- **What:** Fails WCAG 1.4.4 on Android (iOS ignores the attribute). For a
  tablet app with small stat tiles this matters.
- **Fix:** Drop both attributes; use `touch-action: manipulation` on buttons to
  kill the double-tap delay instead.
- **Closed:** Both attributes dropped, `viewport-fit=cover` added while the tag
  was open. `src/pwa/viewport.test.ts` asserts neither property returns — this
  is a line that gets re-added by reflex, as the standard cure for iOS
  focus-zoom on inputs (the actual cure being a 16px input font size).

### H7. One error boundary for the whole app — PARTLY DONE (835d16d); the extra boundary remains
- **Where:** `src/app/App.tsx:20` wraps the routes in the only `ErrorBoundary`
  (`app/ErrorBoundary.tsx`); the only other boundary is per-card inside
  `CardRenderer.tsx:17`.
- **What:** A render throw in any panel unmounts the shell and every provider's
  children. "Try Again" (`ErrorBoundary.tsx:39`) re-renders the same state, and
  the escape hatch is `window.location.assign('/library')` (`:40`), a full
  reload that runs no React cleanup, so the `useAutosave` unmount flush never
  fires and the last debounce window of edits is lost.
- **Fix:** A boundary inside `ShellLayout` around the outlet so the bottom nav
  survives; flush autosave (`features/persistence/autosaveFlush`) before
  navigating away; include the route in the error report.
- **Done: the data loss.** A test written before the fix established what was
  actually happening, which was not quite what this entry says. React *does*
  unmount the subtree that threw, so the `useAutosave` unmount flush fires —
  but it is fire-and-forget, with nobody left to await it, and
  `window.location.assign` went ahead while the write was still in flight.
  Separately `flushAll()` was never called on this path at all, so a
  registration outside the crashed subtree was not flushed either.
- `autosaveFlush` gains `trackPendingWrite`, and `flushAll` now waits for
  already-started writes as well as registered flushes. That makes `flushAll()`
  mean what all four of its callers assume — the data is on disk, not merely
  that nothing new was queued — so `endSession`, `clearCharacter`,
  `deleteCharacter` and `setCharacter` inherit the guarantee too. The recovery
  button awaits it, and both buttons disable while it runs.
- **Still open:** the boundary inside `ShellLayout` so the nav survives a panel
  throw, and the route in the error report.

### H8. Portraits live inline on the character record — OPEN (V)
- **Where:** `types/character.ts:490-491` `portraitUri` is a base64 data URL;
  `utils/imageResize.ts:18-19` caps it at 1920 px JPEG q0.8, so roughly
  200–600 KB per character.
- **What:** `CharacterLibraryScreen.tsx:88` loads every full record via
  `characterRepository.getAll()` to draw a list; every 1 s autosave
  (`hooks/useAutosave.ts:9`) rewrites the blob; every export, import,
  `upgradeCharacter`, normalisation and Zod pass round-trips it as a string.
- **Fix:** Store the image as a `Blob` in `attachments` linked to the character
  (Dexie stores Blobs natively) and keep a ≤ 8 KB thumbnail on the record. Add
  a migration; the `portraitUri` string form stays readable for imports.

### H9. Two full-text indexes over overlapping content — OPEN (V)
- **Where:** `features/notes/useNoteSearch.ts:18` is a module-global MiniSearch
  rebuilt with `removeAll` + `addAll` (`:61-63`); `features/kb/useKBSearch.ts:34`
  is a per-mount index built with `addAllAsync`. KB nodes are synced from notes
  by `linkSyncEngine` (`noteRepository.ts:12-15`).
- **Fix:** One search service, built once, incrementally maintained, exposed to
  both screens. (H1 is withdrawn — the KB is staying, so this applies.)

---

## Workstream I — Build, tooling, tests and performance (second pass)

### I1. No linter, but ten lint suppressions — DONE (6f3a37f)
- **Where:** `package.json` has no `eslint`, no config file exists at the root,
  and there is no `lint` script. Yet
  `eslint-disable-next-line react-hooks/exhaustive-deps` appears ten times:
  `hooks/useAutosave.ts` ×3, `screens/NoteEditorScreen.tsx` ×2,
  `context/ActiveCharacterContext.tsx`, `features/campaign/CampaignContext.tsx`,
  `features/notes/PromoteEntriesSheet.tsx`, `hooks/useWakeLock.ts`,
  `screens/LedgerScreen.tsx`.
- **What:** Those comments mark known stale-closure sites (the autosave one
  documents that `saveFn` must be stable or the flush goes stale). Nothing
  enforces the rule anywhere else, and A10's race list is largely effect-deps
  bugs.
- **Fix:** ESLint 9 flat config with `typescript-eslint` and
  `eslint-plugin-react-hooks`, a `lint` script, and run it in the same place as
  `tsc -b`. Add `no-restricted-properties` for I6 and `no-restricted-syntax`
  for I4 while there. Prettier or an `.editorconfig` would also be new.
- **Closed.** `eslint.config.js` (flat, ESLint 10) with `@eslint/js`
  recommended, `typescript-eslint` recommended, `rules-of-hooks` (error),
  `exhaustive-deps` (warn) and `react-refresh/only-export-components` (warn);
  a `lint` script; a CI step between typecheck and test. Deliberately the rules
  the tree already passes, so it is green the day it lands.
- **It found a real crash on its first run.** `ManagePartyDrawer` called
  `useModalBehaviour` after `if (!activeCampaign) return null`, so the drawer
  threw "Rendered more hooks than during the previous render" whenever the
  campaign context resolved after the drawer mounted — see L4.
- **What it flags and this pass did not fix:** `preserve-caught-error` (new in
  ESLint 10) at 119 sites where the repositories rethrow as
  `Failed to …: ${String(err)}` with no `{ cause }`; turned **off** in the
  config with that reason recorded, because 119 mechanical rewrites of
  error-handling code in the commit that introduces a linter is how a linter
  gets reverted. Worth doing as its own change. Also 35 warnings left standing:
  25 `react-refresh/only-export-components` (context modules exporting a
  provider beside its hook) and 10 `exhaustive-deps`. `no-explicit-any` is off
  in `*.test.*` only, where `any` builds the deliberately malformed input the
  test is about; it is an error in shipped source, where the single remaining
  `any` (`CARD_REGISTRY`'s `ComponentType<any>`) now carries a live disable
  comment explaining that `ComponentType` is contravariant in its props.
- **Not done:** `no-restricted-properties` for I6, `no-restricted-syntax` for
  I4, and the React Compiler rules that `eslint-plugin-react-hooks` v7 now
  turns on in `recommended` (`purity`, `immutability`, `set-state-in-effect`,
  `refs`, …). Those are refactors, not configuration.

### I2. No code splitting; every screen is in the first chunk — OPEN (V)
- **Where:** `src/routes/index.tsx:3-22` imports all 21 screens statically.
  The only dynamic imports in `src` are `linkSyncEngine` (three sites). Tiptap
  + ProseMirror, `d3-force`/`d3-selection`/`d3-zoom`, `jszip` and `minisearch`
  therefore load before the character sheet renders, and every service-worker
  update re-downloads the lot over LAN.
- **What could not be verified:** chunk sizes. `node_modules` is absent in this
  checkout, so `npm run build` stops at `tsc: command not found`. Run
  `npm ci && npm run build` and record the sizes before and after.
- **Fix:** `React.lazy` for `/print`, `/kb`, `/ledger`, `/route`, `/ships`, the
  note editor and the import/export modals; `build.rollupOptions.output.manualChunks`
  for the vendor groups; `build.chunkSizeWarningLimit` so regressions warn.

### I3. Unused and unaudited dependencies — OPEN (V)
- **Where:** `@radix-ui/react-collapsible` and `@radix-ui/react-toast` are in
  `dependencies` but imported nowhere in `src` (the other four Radix packages
  are used in 2–3 files each). `class-variance-authority`, `clsx` and
  `tailwind-merge` are each imported from a single file.
- **Fix:** Remove the two; add `knip` (or `depcheck`) to the lint step so the
  list cannot regrow. No lockfile audit runs today either.

### I4. Theme tokens bypassed by raw colours and inline styles — OPEN (V)
- **Where:** 51 six-digit hex literals in `.tsx` (`RouteScreen.tsx` 8,
  `SessionLog.tsx` 6, `SheetScreen.tsx` 4, `LedgerImportModal.tsx` 3, and
  others) and 36 `style={{` blocks.
- **What:** Those colours do not follow the theme setting the app otherwise
  honours through `--color-*` tokens.
- **Fix:** Move to tokens; guard with an ESLint `no-restricted-syntax` regex on
  `#[0-9a-f]{6}` in JSX.

### I5. Test infrastructure is implicit — PARTLY DONE (3e1d307); shared setup and coverage remain
- **Where:** No `vitest.config.ts` (defaults: node environment, no
  `setupFiles`, no coverage), so each of the repository tests wires
  `fake-indexeddb` itself. 71 test files exist.
- **Fix:** Add a config with a shared `setupFiles` for `fake-indexeddb/auto`,
  coverage on `src/storage/**` and `src/utils/migrations.ts` with a threshold,
  and a `typecheck` script so type errors are not only found by `build`.
  Update CLAUDE.md (see J1) — it still says tests cover "pure logic only".
- **Done:** a DOM environment now exists (L1), opted into per file with an
  `@vitest-environment jsdom` docblock rather than globally, so the pure files
  keep the node environment and their speed. A `lint` script exists (I1);
  `tsc -b` is still reached through `build` rather than a `typecheck` script.
- **Still open:** the shared `setupFiles` for `fake-indexeddb/auto`, and
  coverage with a threshold. Note that a global `setupFiles` would run for every
  file including the pure ones, which is the trade-off that kept this per-file.

### I6. Bypassed shared helpers — OPEN (V)
- **Ids:** `crypto.randomUUID()` called directly at `ToastContext.tsx:53`,
  `PartyInventoryTab.tsx:349`, `SessionLog.tsx:129`, `MagicScreen.tsx:272`,
  `SheetScreen.tsx:465` instead of `generateId`. The inventory-split id at
  `PartyInventoryTab.tsx:349` is a persisted entity id the import collision
  guard (B4) will never learn about.
- **Time:** 18 direct `new Date().toISOString()` (`client.ts` 4,
  `useLedger.ts` 3, one each in eleven more files) against 202 `nowISO()` calls.
- **Fix:** Mechanical replace; `no-restricted-properties` in I1 keeps it fixed.

### I7. Casts that paper over type disagreements — OPEN (V)
- **Where:** 21 `as unknown as` in non-test source. Six are the same cast of
  `engine.derivedStats()` to `Record<string, …>` (`SheetScreen.tsx:292`,
  `GearScreen.tsx:368`, `PrintableSheet.tsx:191`,
  `PrintableSheetScreen.tsx:120-129`, `DerivedStatsModule.tsx:38`,
  `TileCard.tsx:52`); twelve are bundle typing in `utils/export/collectors.ts`,
  `utils/import/bundleParser.ts:238`, `utils/export/referentialClosure.ts:91`.
- **Fix:** Give `derivedStats` a record return type (or a `derivedRecord()`
  accessor) as part of C2; make the bundle types share the domain types rather
  than restating them as `Record<string, unknown>`.

### I8. Redundant, hard-coded system seeding at startup — OPEN (V)
- **Where:** `context/AppStateContext.tsx:64-66` seeds `'classic-fantasy'` by
  literal id. `features/systems/useSystemDefinition.ts:3,45-50` already seeds
  any bundled system from `BUNDLED_SYSTEMS` on demand, with the version gate.
- **What:** A `systemId` literal outside `baseEngineFor`, and a second write
  path for the same row that ignores the version gate.
- **Fix:** Delete the effect.

### I9. Diagnostics go only to the console — OPEN (V)
- **Where:** 160 `console.*` calls in non-test source; several are the only
  signal of a failure (`AppStateContext.tsx:66-68`, `ErrorBoundary.tsx:20`).
- **What:** The target device is a tablet with no devtools.
- **Fix:** A tiny `log` module that mirrors to a ring buffer, and a "copy
  diagnostics" button on Settings that dumps it with app version, schema
  version and `storage.estimate()`.

### I10. No continuous integration — DONE (bfdf641)
- **Where:** No `.github/` directory; nothing runs `tsc -b`, `vitest` or the
  Playwright script on push.
- **Fix:** One workflow: `npm ci`, `npm run build`, `npm test`. Add `lint`
  once I1 lands.
- **Closed:** `.github/workflows/ci.yml` runs `npx tsc -b`, `npx vitest run` and
  `npx vite build` on every branch push and pull request, typecheck first
  because it is fastest and fails most often. The Playwright script is not
  wired in — see I11, it does not run unattended in its current shape. Add
  `lint` here once I1 lands.

### I11. The E2E suite is a stale Python script with a committed report — OPEN (V)
- **Where:** `tests/e2e_full_test.py` (last touched 2026-07-30) still describes
  the app as "Skaldmark Dragonbane"; `tests/test_report.txt` is a committed run
  artefact; `tests/ss12_integration_check.py` and `__pycache__/` sit beside
  them. No npm script runs any of it.
- **Fix:** Port to `@playwright/test` so it shares the TypeScript toolchain and
  can run in I10, or mark it manual and delete the report and cache.

---

## Workstream J — Documentation drift (second pass)

### J1. CLAUDE.md / AGENTS.md contradict the code — OPEN (V)
- "Two adapters ship today: `classicFantasyEngine` and `travellerEngine`" —
  `savageWorldsEngine.ts` exists and `systems/registry.ts:1-3` lists three.
- "`npm test` covers pure logic only — schema migrations, stat-key resolution,
  ability projections, container wealth" — 71 test files, including repository
  tests against `fake-indexeddb`.
- "`AGENTS.md` is a near-verbatim copy of this file" — AGENTS.md (434 lines)
  omits the first 55 lines of CLAUDE.md (what Skaldbok is, commands,
  architecture). Both last touched 2026-08-08.
- `routes/index.tsx:26-50` documents `createBrowserRouter` + `RouterProvider`;
  the app uses `BrowserRouter` + `useRoutes` (`AppProviders.tsx:15`,
  `App.tsx:8`).
- The Entity Linking table is missing `migrated_from` (already G4).

### J2. README and repository hygiene — OPEN (V)
- `README.md` (last touched 2026-05-07) describes one bundled system and no
  engine, ledger, route planner, ships, bestiary, encounters or knowledge base.
- `.gitignore:8` ignores all of `docs/`, presumably for the TypeDoc output in
  `docs/api/`, yet 20+ files under `docs/` are force-tracked. Every new
  document needs `git add -f`, and a plain `git add .` silently skips new files
  under `docs/`. Narrow the ignore to `docs/api/`.

---

## Workstream K — Closed by the 2026-09-08 audit pass

Findings from the re-audit that had no entry above, fixed in the same pass.
Each was re-verified against the source before it was touched; every one of the
ten in the brief was real. Each fix has a test that fails without it unless the
line says otherwise.

### K1. The campaign export was not a complete backup — DONE (cf471d7)
- **Where:** `types/bundle.ts` and `utils/export/collectors.ts`.
- **What:** `StorageSafetyCard.tsx:102` calls a campaign export "the only copy
  that survives this device". It omitted **twelve of the twenty-six Dexie
  tables**: `ships`, `ledgerEntries`, `ledgerAccounts`, `ledgerSplits`,
  `recurringBills`, `routeStops`, `routePlans`, `kb_nodes`, `kb_edges`,
  `referenceSections`, `referenceGroups`, and `systems`. A user-authored ruleset
  in particular exists only in the local `systems` table, so a restore pointed
  the campaign at a system the new device had never seen.
- **Cause:** four hand-maintained copies of the entity-type list — the bundle
  schema, the collector, the merge engine, and the import dialog's labels.
- **Fix:** one registry, `types/bundleTables.ts`, that all four read, recording
  both the mapping and the reason each excluded table (`appSettings`,
  `metadata`, the legacy `referenceNotes`) stays behind.

### K2. Nothing enforced Dexie-schema ↔ bundle-schema parity — DONE (cf471d7)
- **What:** K1's real cause, and the reason it would have recurred on the next
  table.
- **Fix:** `utils/export/bundleParity.test.ts` walks `db.tables` at runtime and
  fails on any table that is neither mapped into a bundle nor excluded with a
  stated reason; seeds one row in every mapped table and fails if
  `collectCampaignBundle` does not emit it; and runs a full export → wipe →
  import round trip asserting every table comes back. A mapping with no
  collector behind it fails as loudly as no mapping. Also pins that collection
  is read-only — `ledgerSplitRepository` and `routePlanRepository` gained
  `listByCampaign` because their only read path, `getOrCreateForCampaign`,
  writes on a miss.
- **Related:** this is most of **F5** (the import path now has round-trip
  coverage for every entity type), though F5's four specific B-series cases are
  still unwritten.

### K3. Deleting a note hard-deleted its attachments — DONE (e092476)
- **Where:** `useNoteActions.ts:187`, `attachmentRepository.ts:105`.
- **What:** Trash restored the note and its edges; the photos were already
  gone. Unrecoverable loss inside the one feature whose promise is that the
  deletion can be taken back.
- **Fix:** attachments carry `deletedAt`/`softDeletedBy` (schema `version(20)`
  indexes both) and cascade inside `noteRepository.softDeleteWithLinks` under
  the note's own transaction id. `deleteAttachment` stays a hard delete on
  purpose — that is the per-photo remove control, where freeing the space is
  the point. This is one entity type's worth of **F6**.

### K4. `normalizeCharacter` capped money, skills and resources — DONE (49a541f)
- **Where:** `utils/characterNormalization.ts`.
- **What:** every save clamped money to 999,999, skills to 20 and resource pools
  to 999. All three were literals. A Traveller purse at 2.4 million credits was
  rewritten on the next save, and a user-authored percentile system lost every
  skill above 20 — in the app whose headline feature is authoring your own
  system.
- **Fix:** bounds come from the system definition where it states them
  (`ResourceDefinition.min`) and nowhere else; `skillMax` becomes `skillRange`
  and has no default. This closes the A4 caveat recorded under Progress below.

### K5. Five call sites bypassed `generateId()` — DONE (e95b966)
- **Where:** `ToastContext.tsx:53`, `SheetScreen.tsx:431`, `MagicScreen.tsx:276`,
  `PartyInventoryTab.tsx:392`, `SessionLog.tsx:129`.
- **What:** `ids.ts` exists because `crypto.randomUUID` is undefined over the
  project's own documented plain-http LAN tablet flow. One of the five was
  `showToast`, so on that flow the app threw on every toast — including the
  toast reporting the error that caused it.
- **Fix:** all five call `generateId()`; `utils/ids.test.ts` scans `src` so the
  fallback protects code not yet written.

### K6. `setCharacter` read the record before flushing autosave — DONE (56eb4c5)
- **Where:** `ActiveCharacterContext.tsx:87-95`.
- **What:** the read saw the pre-flush row, the flush then wrote the pending
  edit to that same row, and the stale snapshot went into state on top of it —
  reverting the edit the flush existed to protect.
- **Fix:** flush, then read. **Untested**: this is a React hook callback and
  there is no DOM test environment here (see I5), so there is nothing to mount
  it in. Recorded rather than faked.

### K7. `creatureTemplateRepository.getDeleted` was unscoped — DONE (e014a71)
- **What:** it read the whole table, so a creature deleted in one campaign
  appeared in another campaign's Trash — and restoring it there put it back
  where the GM who deleted it was not looking.
- **Fix:** takes a `campaignId`, matching `sessionRepository.getDeleted` and
  `noteRepository.getDeleted`.

### K8. Five encounter writes bypassed the repository's soft-delete guard — DONE (444d984)
- **Where:** `useEncounter.ts` — description, body, summary, tags, location.
- **What:** each skipped both things `encounterRepository.update` exists for:
  the `deletedAt` check, so an autosave landing after deletion wrote into a
  tombstoned row nobody can reach; and the single read-modify-write
  transaction. `updateParticipant` in the same hook always used the repository,
  which is why the guard was tested there and absent here. CLAUDE.md states the
  rule these broke: hooks call repositories, never the Dexie tables.
- **Fix:** all five delegate. The two participant paths in the same hook need
  their own transaction (they touch `entityLinks` too) and now make the
  `deletedAt` check themselves.
- **Still open:** four further direct writers of the same shape outside this
  hook — `CombatEncounterView.tsx:274`, `addPartyCharactersToEncounter.ts:79`,
  `BestiaryScreen.tsx:399`, `useSessionEncounter.ts:177`. Same bug class, left
  as out of scope for that pass.

---

## Workstream L — Closed by the 2026-09-09 pass

Six items from the same re-audit, plus one crash the linter found on its first
run. Each was verified in the source before being touched, and each fix has a
test that fails when the fix is reverted — verified by reverting it. The items
that already had entries above are marked there instead: **B10** (reference
import validation), **I1** (linter), **I5** (DOM environment, in part), **E4**
(the unknown-system fallback, in part).

Baseline before: `tsc -b` clean, `vitest run` 1515 tests / 91 files, `vite
build` passing. After: 1595 tests / 99 files, plus `eslint .` at 0 errors.

### L1. No DOM test environment, so autosave had zero tests — DONE (3e1d307)
- **Where:** `hooks/useAutosave.ts`, `features/persistence/autosaveFlush.ts`.
  No `jsdom` in devDependencies, no `test.environment` configured.
- **What:** the code that decides whether a user's edit survives could not be
  tested at all, because no hook that renders could be mounted. The
  flush-before-read fix in `ActiveCharacterContext` (K6, 56eb4c5) shipped
  untested for exactly this reason.
- **Fix:** `jsdom` and `@testing-library/react` as devDependencies, opted into
  **per file** with an `@vitest-environment jsdom` docblock rather than a global
  switch — the other 91 test files are pure and keep the node environment.
  Three test files, 29 tests: the flush registry's `allSettled` and
  entry-snapshot contracts; the unmount flush gated on the dirty flag rather
  than the timer, the "already saved, don't re-write" clear, the record arriving
  mid-save staying dirty, once-per-streak error toasts, and the
  register/unregister lifecycle; and the K6 regression asserted on both call
  order and value, which fails if the two statements are swapped back.
- **Note for the next reader:** Testing Library only auto-cleans when Vitest
  globals are on, and they are not — every DOM test file calls `cleanup()` in
  its own `afterEach`. Without it renders stack up in one document and
  `getByRole` starts finding duplicates.

### L2. Nothing guarded already-released `version(n)` blocks — DONE (e80bd7b)
- **Where:** `storage/db/client.ts`, whose header comment says "never edit an
  existing block".
- **What:** Dexie runs an upgrade once, on the way past that version, so
  editing a released block changes what a *fresh install* gets and nothing else.
  A7 records this having already happened: the v7 note backfill was added at
  v14, every existing database skipped it, and `version(19)` exists solely to
  re-run it. Only the comment stood between that and a third occurrence — the
  same enforce-nothing shape as I1's ten inert suppressions.
- **Fix:** `releasedSchemaVersions.test.ts` fingerprints all twenty released
  blocks from the source, covering each block's `.stores(...)` **and** its
  inline `.upgrade(...)` body (the v7 incident was an upgrade-body edit, not a
  schema-string one). Comments and indentation are stripped first. It also
  asserts versions are contiguous from 1 and in source order, that none has been
  deleted, and that a newly added version gets its fingerprint in the same
  commit. The failure message says which case it is and what to do instead.
- **Not fingerprinted, deliberately:** the two upgrades that live in exported
  functions, since they are exported precisely so their own tests run the
  shipped function and a change already fails on behaviour.

### L3. The printed sheet dropped rows with no marker — DONE (8c5f6f4)
- **Where:** `styles/print-sheet.css:22-25,374-377,744-761`,
  `components/PrintableSheet.tsx`.
- **What:** two mechanisms, both silent. The renderer prints a fixed number of
  slots — ten inventory rows, three weapons, six secondary skills — and never
  drew the rest; a player carrying fourteen items got ten on a page that looked
  complete. Separately `.print-col` clips at a fixed height under
  `overflow: hidden`, so a long skills list lost its tail.
- **Fix:** each capped section ends with "+ n more items not printed"; and
  `PrintColumn` measures each column after layout and drops a "⚠ Cut off" band
  at its foot, absolutely positioned so it is neither clipped by the overflow it
  reports nor able to change the measurement that produced it. Eight tests; the
  clipping ones stub `scrollHeight`/`clientHeight` because jsdom performs no
  layout.
- **Full pagination was not attempted, and is a separate decision.** The
  single-page constraint is load-bearing rather than incidental: `.print-sheet`
  is a fixed 10.5in box with `page-break-inside/after: avoid` (the SS-15 notes
  record Chrome emitting a blank second page without them), and the two
  three-column bands are fixed-height grids whose font sizes were tuned down to
  fit inside them. Flowing to page two means giving up the fixed heights, which
  means giving up the `avoid` rules, which means re-tuning the density
  mitigations that only make sense against a known budget. That is a rewrite of
  the print layout and it needs a decision about what a two-page sheet should
  look like first.

### L4. `ManagePartyDrawer` called a hook after an early return — DONE (6f3a37f)
- **Where:** `features/campaign/ManagePartyDrawer.tsx` — `useModalBehaviour`
  sat below `if (!activeCampaign) return null`.
- **What:** the drawer opens from a header that renders while `CampaignContext`
  is still reading IndexedDB, so it renders null first and then renders again
  with the campaign — at which point React sees more hooks than the previous
  render and throws, taking the screen to the error boundary. The reverse
  direction (campaign cleared while the drawer is open) throws "Rendered fewer
  hooks than expected".
- **Found by:** `react-hooks/rules-of-hooks`, on the linter's first run. Nothing
  else in the repo could have found it, and it is the clearest argument for I1
  that this pass produced.
- **Fix:** the hook moves above the early return, with both directions covered
  by tests that fail if it moves back down.

---

## Workstream M — Closed by the 2026-09-09 pass (part two)

The expensive tail: four items that all scored near zero on this file's own
formula — blast radius 4–5 against moderate impact — because they are refactors
where *changing no behaviour* is most of the work. Three had entries above
(**H2**, **H3**, **H7**) and are marked there. The fourth is here.

Baseline before: 1595 tests / 99 files. After: 1649 tests / 103 files, with
`tsc -b`, `eslint .` (0 errors) and `vite build` green throughout.

### M1. No provider memoized its `value=` prop — DONE (907e7a1)
- **Where:** `CampaignContext.tsx:665`, `AppStateContext.tsx:113`,
  `ActiveCharacterContext.tsx:121`, `ToastContext.tsx:64`,
  `ThemeProvider.tsx:49`, `KnowledgeBaseContext.tsx:139`.
- **What:** each built its context value as an object literal in the render
  body, so it was a new identity on every render whether or not anything in it
  had changed. React compares context values by identity, so every consumer
  re-rendered — 31 files consume `CampaignContext`, 34 consume `useToast`, 20
  consume `useAppState`.
- **The audit was wrong about one:** `SessionRefreshContext` already memoized.
  `SessionEncounterContext` passes a hook result straight through and was left
  alone.
- **Measured, not assumed.** `ToastProvider` holds the toast queue, so it
  re-renders whenever a toast is shown and again when each expires. With 20
  consumers mounted and one toast shown: **20 consumer re-renders before, 0
  after**, and the test asserts the zero.
- **Worth recording:** the first version of that measurement re-rendered the
  provider's *parent*, which does not re-render the provider at all — `children`
  is the same element reference — and so passed with and without the memo. A
  harness that cannot fail is worse than no harness.
- **The risk was never the memo**, it was a dependency array that omits a member
  and freezes a value consumers depend on. Every provider lists every member, so
  identity changes exactly when the value does; and a test parses each
  provider's value `useMemo` out of its own source and fails if a member is
  missing from the deps, which is otherwise invisible until someone notices a
  screen not updating. `AppStateContext`'s five plain functions and
  `ThemeProvider`'s `setTheme` became `useCallback`s first — a function
  redefined every render makes any surrounding memo a no-op.

---

## Workstream N — Closed by the 2026-09-09 maintainability pass

Sourced from `vault/maintainability-2026-09-09.md`, which asked "what will make
the next change expensive, risky or easy to get wrong?" rather than "is there a
bug". Its dominant finding is that this codebase's conventions are enforced by
source-scanning tests, so **the scope boundary of each guard — not the
convention — is where drift lives**. Most of what follows widens or adds a
guard; two items are behaviour.

Baseline before: 1649 tests / 103 files. After: **1872 tests / 112 files**, with
`tsc -b`, `eslint .` (0 errors, the same 35 standing warnings) and `vite build`
green throughout. Every item below was reverted and re-run to confirm its test
fails without the fix.

### N1. Nothing enforced the `system.json` / `sheet.json` version bump — DONE
- **Where:** six bundled JSON files; `useSystemDefinition.ts:49`,
  `useSheetTemplate.ts:63`.
- **What:** `CLAUDE.md`'s one bolded convention, with zero enforcement. Both
  gates compare strictly-greater-than against an IndexedDB cache that survives
  reload, so a missed bump is invisible **to the author locally** and presents
  as "my edit didn't work".
- **Fix:** `src/systems/bundledVersionBumps.test.ts`, following
  `releasedSchemaVersions.test.ts`: hash each file's content minus its
  `version`, record `{version, hash}` by hand. Key order is canonicalised so
  reformatting is not a change; array order is, because region layout and skill
  order are content.

### N2. Two hard-delete traps, one live — DONE
- **Where:** `ReferenceScreen.tsx:394` → `referenceNoteRepository.remove`;
  `noteRepository.deleteNote`.
- **What:** the first was `db.referenceNotes.delete` wired to a confirmation
  dialog with no Trash — the only user-facing control in the app that destroyed
  content outright. It passed review because it was not *named* `hardDelete`.
  The second was a callerless duplicate of `hardDelete` whose JSDoc `@example`
  read `await deleteNote('abc123')`.
- **Fix:** reference notes now soft-delete, list in the Trash and restore; both
  fields are unindexed so no `version()` block was needed. `deleteNote` is
  removed and its KB-node cleanup moved onto `hardDelete`.
  `hardDeleteReachability.test.ts` guards the *operation* rather than the name.

### N3. `declaredCapabilities.test.ts` could not see nested or inline fields — DONE
- **What:** `^\s{2}` is the top level of an interface and nothing else, so every
  nested member was unchecked — including `allowsPlus`, one of the five bugs
  named in that file's own doc comment. Its `\bname\s*[,}]` read-pattern matched
  ES6 shorthand *construction*; `DamageApplication.depleted` was the live false
  pass.
- **Fix:** any indent, plus an inline pattern; destructuring matched
  specifically. Four newly-visible inert fields went to `KNOWN_UNIMPLEMENTED`
  with reasons — `condition.recovery`'s `traitId`/`onCriticalFailure`,
  `depleted`, `raises`. The extraction is pinned by example in both directions.

### N4. Zod ↔ TypeScript label drift — DONE
- **Where:** `schemas/system.schema.ts`; `engine/types.ts:316,325`;
  `systemDefinitionSchema.test.ts`.
- **What:** three keys removed from `SystemLabels` and left in the schema, held
  in place by a *passing* test asserting they survive validation; and
  `printResources`/`printAbilities`, read by `PrintableSheet`, missing from it —
  so an imported system could not rename its printed headings while a bundled
  one could.
- **Fix:** the mirror is now a **compile error** in both directions rather than
  a list. `sheetPanels[].id` is enumerated like its sibling `panels`.

### N5. `where('softDeletedBy')` had no index guard — DONE
- **What:** three queries, three indexed tables, agreeing by hand. Dexie throws
  a `SchemaError` for an unindexed one — and not at `.where(...)` but when the
  query runs, on the restore path, which is the least-exercised path there is.
- **Fix:** `softDeletedByIndex.test.ts` reads the index side off the *opened*
  database, so it reflects the schema Dexie assembles across all twenty blocks.

### N6. `bottomNavTabs` was a user-visible setting that changed nothing — DONE
- **What:** seven ON/OFF toggles writing a field `BottomNav` and
  `CharacterSubNav` never consulted, with copy promising a ☰ menu that no longer
  exists. It escaped `declaredCapabilities` because the field *was* read — by
  the control that wrote it.
- **Fix:** removed rather than wired, because wiring it would fight the
  navigation catalogue's guarantee that every route has a way in.
  `showOtherSessionNotes` (no writer, no reader) went with it.
  `settingsHaveReaders.test.ts` now fails on a settings field nothing outside
  the writer reads.

### N7. Three `NOTE_TYPES` had no config entry — DONE
- **What:** `npc`, `spell-cast` and `ability-use` are actively written by four
  flows and were absent from `DEFAULT_NOTE_TYPE_CONFIG`, which is what
  `NotesGrid` builds its filter chips from. No test referenced that constant.
- **Not changed:** `baseNoteSchema.type` stays `z.string()`. A validation
  failure is treated as an absent note on read, so `z.enum(NOTE_TYPES)` would
  hide any row carrying a type this build does not know.

### N8. There was no vitest configuration at all — DONE
- **What:** no `test:` block, no `vitest.config.*`. `environment: 'node'` and
  `globals: false` matched `CLAUDE.md` **by omission**. Globals-on is the quiet
  one: it would silently make every DOM test's manual `cleanup()` redundant.
- **Fix:** both declared in `vite.config.ts` with the reason, plus
  `jsdomBoundary.test.ts` for the per-file half — pragma on line 1, `cleanup()`
  in an `afterEach` — which was perfect and entirely unenforced.

### N9. Three blind assertions in `providerMemoization.test.tsx` — DONE
- **What:** `expect(after).not.toBe(before === 'parchment' ? after : before)`
  becomes `expect(after).not.toBe(after)` if `DEFAULT_THEME` ever changes;
  `expect(source).toMatch(/useMemo/)` passes on any file containing the string;
  the dependency check took the first object-returning `useMemo` in the file
  with nothing tying it to `.Provider value={…}`.
- **And the 7-file list omitted an eighth provider** — and not harmlessly.
  `SessionEncounterContext` takes its value from `useSessionEncounter`, which
  returned a fresh object literal every render: the exact defect this file
  exists to catch, one level below where it was looking. Now memoised, and the
  file list is discovered rather than maintained.

### N10. `engine/index.ts` cited a test that has never existed — DONE
- **Fix:** the citation names the real guard; that guard now enforces
  adapter → registry as well as registry → adapter; and
  `testCitations.test.ts` fails on any comment naming a test file that is not
  there — the class, not the instance.

### N11. Repository conventions were unguarded — DONE (test only, by design)
- **Where:** `src/storage/repositories/repositoryConventions.test.ts`.
- **What:** 24 hand-written repositories, no factory, and five measured
  divergences in the soft-delete contract: `softDelete` signatures that cannot
  join a cascade (`shipRepository` takes no `txId`), six missing the re-delete
  guard, seven minting the transaction id with bare `generateId()`, five with
  `restore` and no `getDeleted`, and sixteen validating nothing on read.
- **Deliberately the test and not a factory.** This is the layer where a mistake
  in a local-first app is unrecoverable. Each check carries an exception list
  with a reason per entry, and each list is **self-checking** — an entry that no
  longer diverges fails, so the lists cannot rot into a record of things already
  fixed. A new repository is on none of them and must comply, which stops the
  drift widening while the entries are worked off.
- **The test found a sixth divergence the scan missed:** the Trash lists deleted
  party *members* and has no equivalent for a party, so `partyRepository.restore`
  cannot be reached.

**Left open, with reasons.** From the same scan and not taken here: the 42
direct Dexie calls outside `src/storage/` (scan §7 — the largest remaining
unguarded axis); `preserve-caught-error`, 128 sites, all in repositories, worth
taking as its own mechanical commit; the `resolveComponent` subsystem, 156 lines
tested and unreachable; the migration freeze's widening blind spot for
*extracted* upgrades; and the `CLAUDE.md` drift the scan documents in §8 —
soft-delete list of 9 against 20 tables, and the `migrated_from` relationship
type that exists in every database that came up through v6 and is in no list.

---

## Workstream O — Import without a campaign, and the maintainability tail

Baseline before: 1872 tests / 112 files, `tsc -b` clean, `eslint .` at 0 errors
/ 35 standing warnings, `vite build` passing. After: **1931 tests / 120 files**,
with all four checks green and `preserve-caught-error` now enforced on top of
them. Every item below was reverted and re-run to confirm its test fails without
the fix.

Two of the scan's claims did not hold exactly and are corrected in place: the
`preserve-caught-error` count is 129, not 128 or the config's 119; and six
repositories restore without a listing, not four (the scan excluded two cascade
children for a reason that was right but written down nowhere).

### O1. Import was gated on an active campaign — DONE
- **Where:** `components/shell/CampaignHeader.tsx` (the Import button inside
  `{activeCampaign && ( … )}`); `components/import/ImportPreview.tsx:76`
  (`needsCampaignSelector = bundle.type === 'session' || 'character'`).
  Recorded in the README under *Known gap* rather than fixed.
- **What:** on a genuinely fresh install the Import action did not render, so a
  campaign had to be **created** before one could be **restored** — the recovery
  path gated on the thing being recovered. The second half was worse: even with
  the button reachable, a `character` bundle demanded a target campaign chosen
  from a list that on a fresh install is empty, so a character could not be
  imported at all. That demand was never right on its own terms —
  `CharacterRecord` has no `campaignId`; a character is a device-global row that
  joins a campaign through a party seat.
- **Fix, in three parts.**
  1. **Import left the campaign gate.** It is a device-level action; the
     *exports* stay gated because there is genuinely nothing to export. The
     campaign selector's empty state offers "Import a backup" beside "Create
     Campaign", and `NoCampaignPrompt` names restoring as well as creating.
  2. **The requirement is computed from the rows, not the label.**
     `utils/import/importCampaignTarget.ts` answers one question — does anything
     the user selected carry a `campaignId`, and does the bundle bring a campaign
     of its own to satisfy it? `CAMPAIGN_SCOPED_BUNDLE_KEYS` is *derived from
     `bundleContentsSchema`* rather than written out, for the reason
     `types/bundleTables.ts` exists: a hand-copied list of which entities are
     campaign-scoped is one more thing to forget when a table is added. The
     derived set is pinned by a test so a Zod upgrade that breaks introspection
     fails loudly instead of silently yielding "nothing needs a campaign".
  3. **Create where there is one sane answer; ask where the choice is real.**
     A campaign bundle *creates* — it is restored under its own id, and made
     active when no campaign was open, because a fresh-install user who restores
     2,000 rows and still sees "No campaign" cannot tell that from an import that
     did nothing. Re-importing the same file updates that campaign rather than
     creating a second copy (the merge engine's `createdAt` collision guard
     already did the work; a test now pins it). A character bundle asks nothing,
     because nothing in it is campaign-scoped. Sessions, and the notes that
     travel with a character, do carry a `campaignId` with no campaign in the
     bundle to satisfy them — there the dialog *asks*, naming the groups, and
     unticking them lets the rest through. Inventing a campaign to hold someone
     else's session, with a name and a ruleset guessed on their behalf, would be
     fabricating data on the recovery path.
- **Atomicity.** `mergeBundle` already runs the whole import in one Dexie
  transaction; a test now closes the database under it and asserts a fresh
  install is left empty rather than half-restored.
- **Tests:** `utils/import/importCampaignTarget.test.ts` (the decision, 10),
  `utils/import/freshInstallRestore.test.ts` (seed → export → wipe the database →
  resolve → merge, including the character case and the rollback, 5),
  `components/import/ImportPreview.test.tsx` (the dialog rendered for real,
  because the regression is a disabled button, 5),
  `components/shell/importReachability.test.ts` (a source scan in the style of
  `navigationCatalogue`/`trashRegistry`: `startImport()` must not sit inside any
  `activeCampaign` conditional; brace-balanced rather than regex, so
  reformatting cannot quietly disable it, 3).

### O2. `preserve-caught-error` taken — 129 sites, all in repositories — DONE
- **Where:** `eslint.config.js:66` (the rule, disabled, citing 119); every
  `src/storage/repositories/*.ts`.
- **Verified:** the comment was stale. Re-running eslint with the rule forced to
  `error` gives **129**, not 119, and confirms the scan's other two claims: all
  of them are in `src/storage/repositories/`, none anywhere else, and there was
  no `cause:` in the codebase.
- **Why it is not cosmetic here.** `` `${e}` `` renders a Dexie failure as
  "ConstraintError: Key already exists" and discards the stack *and* `err.name`.
  This app keeps the user's data in one IndexedDB database on one device, so a
  `QuotaExceededError` — the device is out of room, the write did not happen —
  reads as an ordinary validation failure by the time it reaches a toast.
  `mergeEngine` already branches on exactly those names to decide between
  rolling an import back and skipping a row; the repositories were throwing the
  same information away one layer below it.
- **Done as a codemod, purely additive**, with the rule flipped to `error` in the
  same commit. One site needed a hand: `attachmentRepository.createAttachment`
  re-labels a quota failure as a *new* named error, which the rule accepts and
  which loses the original just as thoroughly.
- **`tsconfig.app.json` gains `ES2022.Error`** — the one lib slice declaring
  `ErrorOptions` and `Error.prototype.cause`. `target` stays ES2020, so nothing
  about the emitted syntax moves.
- **Tests:** `errorCause.test.ts`, both halves. Three behavioural tests force a
  `QuotaExceededError` through a repository and assert the name and the original
  stack are still reachable; a source scan then covers all 129 by walking every
  brace-balanced `catch (x) { … }` in the directory, so reverting one `{ cause }`
  fails the suite and not only the lint step.

### O3. `CLAUDE.md` / `AGENTS.md` reconciled with the schema — DONE
- **Verified:** the soft-delete list named nine entities; **20 of the 26 tables**
  declare `deletedAt`. The eleven undocumented ones are attachments, inventory
  containers, ships, all four ledger tables, both route tables and both
  reference tables. `migrated_from` is written by the `version(6)` upgrade and
  appeared in none of the three lists that name relationship types.
- **The list was deleted rather than corrected.** The docs now state a count and
  point at `TABLES_WITHOUT_SOFT_DELETE` (`types/bundleTables.ts`), which records
  the six *exclusions* with a reason each — the same shape as
  `TABLES_OUTSIDE_BUNDLE` beside it. Six entries with reasons stay true in a way
  twenty names in prose do not.
- Also fixed while there: the `entityType` comment in `entityLinkRepository.ts`
  over-declared by three. It now separates what the app writes (6) from what the
  merge engine can resolve on import (9, including `inventoryContainer`, which
  the old comment omitted) — different questions that had been merged.
- **Tests:** `softDeleteCoverage.test.ts` walks `db.tables` against the exclusion
  map, checks the count the docs state, **diffs the sections CLAUDE.md and
  AGENTS.md share** (which CLAUDE.md instructs and nothing enforced), and scans
  `src` for every `relationshipType` literal, failing if any of the three lists
  is short.

### O4. Trash registry enforced in both directions — DONE
- **Verified, with a correction:** the scan said four repositories. It is six —
  `attachmentRepository` and `entityLinkRepository` as well, which the scan
  excluded as cascade children. That is the right *reason* but it was never
  written down anywhere, which is the finding.
- **What was wrong:** `trashRegistry.test.ts` enforced `getDeleted → registry`,
  the half that had already failed. That is the second step. A repository gains
  `softDelete` and `restore` first, and until it also gains a listing its
  tombstoned rows are invisible — with the existing guard passing, because it is
  never asked about a repository that has no listing to check.
- **Fix:** `RESTORE_WITHOUT_LISTING` records each of the six with its reason
  (cascade children restored by txId; campaigns and encounters with no
  user-facing delete and an incomplete cascade; ledger splits and route plans as
  one lazily created row per campaign). A seventh cannot appear silently, and an
  exemption that goes stale — the repository grows a listing — fails too.

### O5. Migration freeze extended to extracted upgrades — DONE
- **Where:** `releasedSchemaVersions.test.ts`; `client.ts:568,636`.
- **The decision, since the file had a stated reason for the gap.**
  `upgradeReferenceGroupsToV14` and `upgradeNotesAndClearBackupsToV19` were left
  outside the hash on the grounds that an exported function has its own
  behavioural tests. That does not survive contact with what a freeze is for: a
  behavioural test catches the changes it happens to cover, a hash catches every
  change, and "every change" is the whole property, because a released upgrade
  should not be edited at all. Extraction is the pattern the file *recommends*
  going forward, so the guarantee was shrinking with each version that used it.
- **Fix:** both are fingerprinted, along with `writePreEncounterReworkBackup`
  which the frozen v8 block calls out to, and a named `.upgrade(fn)` with no
  fingerprint fails — so the next extracted upgrade cannot join silently. The
  behavioural tests stay: they say what the upgrade does, the hash says it has
  not moved. Verified by editing the v14 body and watching it fail.
- **Where the freeze still stops is now stated** rather than left to be found:
  `generateId` is called from the v6, v8 and v9 upgrades and is deliberately not
  fingerprinted, because freezing a general helper would freeze the codebase.

### O6. The tail — DONE
- **`resolveComponent` connected, not deleted.** Verified unreachable from both
  ends: `sheetTemplateSchema` had no `components` key, so nothing could declare
  one, and `PlayDashboardScreen` never passed `CardRenderer` a registry.
  Deleting ~250 lines would have discarded real hardening (own-property lookups
  against a template's `card: "toString"`, a recursion stack, a depth cap and a
  separate breadth budget) that would have to be rediscovered. It is finished
  work with two wires unattached, and attaching them is fifteen lines. Every
  bundled template declares no components and is unaffected.
  `componentReachability.test.ts` covers the two links — including a source check
  that no `<CardRenderer>` is missing the prop, since it is optional and defaults
  to `{}`, so forgetting it renders nothing and raises nothing.
- **Five inert `PANEL_KEYS` documented, not removed.** Verified: two production
  sites read `engine.panels`, asking about eight keys between them; `skills`,
  `inventory`, `combat`, `notes` and `bennies` are read by nothing. They stay
  because `panels` is data a `system.json` may override and the Zod schema
  validates an imported system's `panels` against these keys — shrinking the list
  would make a previously valid user-authored system fail validation, a data
  regression for five fewer strings. `panelKeyReaders.test.ts` pins the three
  groups and fails in both directions, so the comment cannot rot into a lie.
- **Four DB-reset dialects, one replaced.** `src/test-utils/resetDatabase.ts`,
  derived from `db.tables`, replaces the six files that hand-listed their tables
  plus the two that spelled the same loop out inline. `db.delete()`+`db.open()`
  and `Dexie.delete(DB_NAME)` remain as separate sanctioned dialects — they
  re-run the upgrade ladder and drop the database before redeclaring it at a
  lower version respectively — with both reasons recorded beside the helper.
- **`TimelineExample.tsx` + `mockData.ts` deleted.** 177 lines, referenced by
  nothing but each other.

**Left open from the same scan**, with reasons: the 42 direct Dexie calls
outside `src/storage/` (the largest remaining unguarded axis, and a cross-cutting
refactor rather than a guard); the repository factory, which the scan itself
argues should follow `repositoryConventions.test.ts` rather than precede it;
`declaredCapabilities`' remaining blind spots beyond the ones N3 fixed; and
`sheetTemplateSchema.print`, which is still authored-and-discarded — now the only
reserved-and-unread surface left in that file.

> **Three of those four are closed — see P4, P6 and P5 — and the fourth line is
> wrong as written.** The direct-Dexie count was never 42 (see the corrected
> counts at the top). And `print` was *not* "the only reserved-and-unread
> surface left in that file": `surfaceLayoutSchema.layout` was declared four
> lines above it, described as a *"layout identifier"*, populated in all three
> bundled `sheet.json` files, and read by nothing. It went unnoticed for the
> reason `print` was noticed — `print` carried a comment admitting it was
> reserved, and `layout` did not. **An honest label makes a dead field
> findable; it does not make it harmless.** The repository factory remains open
> and unchanged.

---

## Workstream P — Closed by the second scan and the passes after it (2026-09-10/11)

Thirty-one non-merge commits between `3fcb91e` and `d5cc397` (`git log
--no-merges 3fcb91e..d5cc397`). The source is `vault/scan2-findings.md`
(gitignored) and the passes that worked down it. Every item below was landed with
a test that fails without the fix.

`vault/scan2-findings.md`'s own Pass 6 re-ran its eighteen recorded mutations
against the merged fixes at `98a2fa8` and reports all eighteen red. That is the
scan author's verification, not a re-verification by this file — it is recorded
here with its source so a reader knows which it is. The mutations named in P5
through P9 below were run by the author of those commits and are quoted in them.

**What this workstream is about, in one line:** the first scan's signature bug
was *a rule maintained in two places*; this one's is *a guard whose scope is
narrower than the rule it guards*, and its worst form is **a failure absorbed by
a broad catch and reported as success**, which is a test that cannot fail
wearing production code's clothes.

### P1. The backup promise — four defects on one sentence — DONE
`StorageSafetyCard.tsx:102` tells the user, in danger red, that *"Exporting a
campaign is the only copy that survives this device."* Four things were wrong
with the file behind that sentence, and the fourth made the other three
invisible.
- **Every `represents` edge was dropped from every export** (`8969435`).
  `collectors.ts` collected entity links for note and encounter ids only, and the
  participant→creature binding has an encounter-*participant* at one end. On
  restore, every participant came back as a bare name with no stat block. The fix
  is not a wider enumeration: `collectBundleEntityIds` walks the assembled rows
  and keeps every edge whose *both* endpoints are in the bundle, so an edge type
  the app has never written travels too.
- **`referenceNotes` was excluded from every bundle on a false premise**
  (`068c634`). The exclusion said its content "is already exported as notes";
  `ReferenceScreen` writes it to `referenceNotes` and nowhere else. Exemption
  reasons are now checked against the repository layer's own writes, so the
  recorded reason has to be *true*, not merely present.
- **`systems` reached only the campaign collector** (`a8c07f5`, `e47bef8`).
  A character or session built on a user-authored ruleset restored under
  classic-fantasy, which brings Dragonbane's formulas with it.
- **`lastBackupAt` was stamped from a `.click()` that cannot fail**
  (`a3ea4fd`). `downloadBlob` never appended the anchor and returned `void`, so
  "the export succeeded" meant "we called `.click()`". The card turned green on
  it.
- **The fresh-install rollback was guarded by a test that could not fail**
  (`0f45579`, then `906ea82`). The test closed the database *before* `mergeBundle`,
  so "leaves nothing behind" was trivially true. Deleting the entire
  abort-and-roll-back mechanism kept 1931 tests green. Fixed, and then fixed
  again one level in: `isFatalMergeError` read `err.name` without walking
  `err.cause`, so a wrapped quota failure was filed as a per-row error and the
  rollback never fired.

### P2. Six guards that enforced less than they claimed — DONE
Each was found green-by-reading and fell to a mutation.
- **The migration freeze** did not see `.upgrade((tx) => fn(tx))` (`5c7aede`),
  and then could not place an upgrade body with no name at all (`cf17207`).
- **The hard-delete check** never left `src/storage/repositories/`, so an inline
  `db.notes.delete(...)` in a screen passed everything; and it did not match
  `.clear()` (`c3169db`), nor `db.table('notes')`, the codebase's own idiom
  (`b0690ec`).
- **`declaredCapabilities`** could not see the middle member of a three-member
  inline object — `matchAll` consumed the `;` that introduced the next one — and
  **`componentReachability`** scanned one file and could not cross a `>` inside a
  prop (`ae64478`).
- **`panelKeyReaders`'s third assertion could not fail**: it searched the whole
  file for the key's literal, and the file opens with an unrelated list
  containing all eight (`2426906`).
- **The autosave banner guard** proved the tag was present, not that it was fed
  the live error (`d795efd`), after the banner was put on all seven character
  screens rather than two (`5df2223`).
- **Two exemption lists for one invariant**, each blind exactly where the other
  had an entry, are one list decided from the writes rather than the names
  (`3182789`).

### P3. Error paths that could not be entered — DONE
- **Two repositories swallowed a failed write** and returned `undefined`
  (`c3adae1`): a quota failure closed the form and lost the creature with no
  message. A census of ~130 write functions found exactly these two, so it was a
  divergence from the layer's convention rather than a house style.
- **A reference import overwrote local sections by id** with no collision,
  tombstone or `updatedAt` check (`1775f5c`) — the user's own house rules.
- **A blocked schema upgrade hung the loading screen forever** (`42001d1`).
  Dexie does not reject for `blocked`; it fires an event and waits, so the one
  storage failure the code names in a comment was the one it could not detect.

### P4. The direct-Dexie surface, from a number into a guard — DONE
The largest item `O6` left open, and the one it mis-measured.
`directDexieAccess.test.ts` (`08e233b`) walks every non-test file outside
`src/storage/` and fails on any Dexie access not allowlisted **per operation**
(`<table>:read|write|delete|ref`) with a written reason; an expression it cannot
classify is reported rather than skipped, and a permission for an access a file
no longer makes fails too, so the surface can only shrink.

Writing it exposed five data paths nobody had asked for, all now fixed behind
repository functions: four participant writes that did not check `deletedAt`
(`44a23c9`), an end-of-fight summary and a note reassignment that could land in a
deleted encounter (`18466fc`), KB node reads that bypassed their repository
(`be33e92`), and the KB graph marker (`5b0c8ba`, `P7`).

**Measured, not remembered: the allowlist is 5 files**, listed in the corrected
counts at the top. It was 14 when the guard landed.

### P5. `sheetTemplateSchema.print` and `surfaceLayoutSchema.layout` — DONE (dropped)
Decided together, because they are the same shape and leaving one would have
made the pair inconsistent. Neither is rendered by anything: `/print` goes
through the hardcoded `PrintableSheet` component, and the real layout is each
region's own `columns`. Honouring `print` is a feature, not a fix; a schema is
not the place to keep a plan. Both are dropped, the three bundled `sheet.json`
files lost their `layout` line and had their versions bumped (7→8, 4→5, 8→9)
with fingerprints updated.

The guard is the part that generalises: `cards/schema.test.ts` derives the key
list from the Zod `shape` itself, so a key added and not read fails in the same
commit. `declaredCapabilities` enforces this for *interfaces*, so a contract
declared as a Zod schema was outside it entirely — the scope-narrower-than-the-rule
defect, in the guard written to catch it.

### P6. `declaredCapabilities`' remaining blind spots — DONE
The second of `O6`'s open items. Four declaration shapes it could not spell
(`readonly x`, a method signature, a quoted key, `_`/`$` in a name) and three
shapes that made an unread field look read (a hyphenated name in a string, an
array literal holding the string, an assignment). All seven were measured against
the previous code before being changed, and all are pinned by example, so
reverting any of them fails.

`schemas/system.schema.ts` joins the declaration files: the type and the schema
agree exactly today, so it costs nothing and closes the mirror of a gap
`CLAUDE.md` already warns about. `TOO_GENERIC` — the guard's largest remaining
blind spot, deliberately — now fails on any entry no declaration file declares;
six such entries were removed, one of which was `layout`, the very field `P5`
found dead in the card schema.

**Not done, deliberately:** the guard is not widened to `types/character.ts`,
`types/attachment.ts` or `types/campaign.ts`. That names the twelve
declared-and-unread fields in scan 2 §14 at once, and each needs a decision that
belongs to whoever owns the feature. Queued as a gated sweep.

### P7. The KB graph was rebuilt in full on every mount, and reported success — DONE
The scan filed this as a `metadata` row-duplication bug. **That mechanism is
impossible** — see *Withdrawn* below. What actually happened: the marker write
violated a unique index, `bulkRebuildGraph`'s own `catch` swallowed the
`ConstraintError`, and the marker that answers *"has the graph been built?"* kept
its old value forever.

The write was fixed first (`5b0c8ba`); this pass fixed the swallow, which is what
made it invisible. `bulkRebuildGraph` no longer wraps its body in a catch, does
not record the graph as built when a note failed to sync, and rejects — so the
screen's `catch` and `useImportActions`' *"the knowledge graph could not be
rebuilt"* toast, both recorded by the scan as unreachable, are reachable. The
swallow now lives only in `syncNote`, whose callers are note saves that cannot
use an answer.

### P8. A `systemId ===` branch with no `systemId` in it — DONE
Three creature-create flows wrote `stats: { hp, armor: 0, movement: 0 }` — three
Dragonbane ids applied to every ruleset, in a field that has been
`z.record(z.string(), z.number())` keyed by `system.creatures.statFields` since
the bestiary was generalised. An NPC captured under an authored ruleset was
stored with stats that ruleset does not declare, so the bestiary showed its
declared block reading 0 and filed the entered numbers under "Other".

`newCreatureStatBlock(system, { health })` is the shared half.
`QuickCreateParticipantFlow` renders one input per declared stat instead of three
fixed ones, which also retired its `vocabularyLeaks` exemption (verified by
mutation, not by assumption).

**Can the guard that forbids `systemId ===` be taught to see a shape branch?**
For a specific field, yes, and not by listing Dragonbane's ids: the rule
`engineConsumers.test.ts` now enforces is *do not spell ids the ruleset owns* — a
`stats:` literal with identifier keys is an offence whatever the keys are. The
**class** is not decidable: the vocabulary is runtime data a user may author, the
same token is correct in the default block and wrong four lines away, and the
openness that lets a Traveller creature exist is what removed the closed type the
compiler could have checked. Shapes can be taught one at a time, against a field
whose source of truth is known. The class cannot.

### P9. The last direct-Dexie debt, and the reason that was wrong — DONE
`useSessionLog`'s two transactions were the last `DEBT` entry. Their recorded
reason — *"their home is a storage-layer service that does not exist yet, and
inventing one inside a hook carrying buffered writes and flush semantics is a
larger change than the remaining risk justifies"* — was specific, honest, and
**checkable**. The service existed: `features/notes/noteCreationService.ts`
imported nothing but repositories, types and utils. Storage-layer code filed
under a feature directory.

It moved to `storage/noteCreationService.ts` unchanged and grew the two
transactions as `createSessionLogNote` and `captureNpcWithNote`. The hook imports
no Dexie at all. Nothing about the buffers or the flush was in the way. The move
is also what made the writes testable without a React tree, which is the second
half of why they had no tests; the new tests assert the property a call site
cannot — that a failure part-way leaves *nothing* behind.

An exemption's reason is a claim like any other, and this one survived two passes
because nobody opened the file it named.

### Withdrawn or corrected by these passes
Recorded so nobody re-derives them.
- **The link-sync `metadata` defect's stated mechanism is impossible.** The scan
  said a prior `set()` leaves "two rows sharing one logical key". `metadata` is
  declared `'id, &key'` — `key` is unique, so two such rows cannot exist. It was
  found by writing the scan's probe and watching it *pass*. The real mechanism is
  `P7`.
- **`hardDeleteReachability`'s bare-`name(` regex does not produce false
  positives.** Expected by the scan, and no example could be constructed. The
  defect in that guard was the opposite one (`P2`).
- **`componentReachability`'s regex is not defeated by multi-line JSX.**
  `[^>]` matches newlines. It is defeated by a `>` *inside a prop*, which is a
  narrower and different claim.
- **`O6`'s "only reserved-and-unread surface" claim is false** — `P5`.
- **The `DEBT` reason for the last two transactions is false** — `P9`.
- **Four counts are corrected** at the top of this file.

---

## Workstream Q — The repository factory, the scan-2 tail, and H4's banner (2026-09-11)

The last of the queue. Four commits: `S22`, the ~20 smaller rows of the second
scan, the `logNpcCapture` decision, and `H4`.

> **Baseline measured at the merge, not taken from a commit message:**
> `npx vitest run` **137 files / 2089 tests** green · `npx tsc -b` exit 0 ·
> `npx eslint .` **0 errors / 35 warnings** · `npx vite build` exit 0.
> (Was 134 / 2051 at `d5cc397`.)

### Q1. The repository factory — DONE
`S22`, and the sequencing held: `repositoryConventions.test.ts` was written
first, deliberately, so that the factory could be built to a stated convention
rather than hardening whatever shape happened to exist.

`createRepository.ts` writes the no-cascade lifecycle once. Five repositories
take it and **three of the four divergence lists empty**: no `softDelete` in the
layer now lacks a `txId` (a ship could not go down with its campaign or come
back with it), none skips the re-delete guard, and none mints with the bare
generator. `UNVALIDATED_READS` is untouched on purpose — validating on read
decides what happens to a row that fails, and dropping it is data loss in an app
whose data exists in one browser. That is a decision per entity.

**No cascade support**, deliberately: three repositories take entity links down
with them and eleven do not, so a hook would be a capability declared for callers
that mostly do not exist — the shape `declaredCapabilities.test.ts` exists to
catch.

**The larger half of the work was keeping the guards honest.** Moving a lifecycle
behind a builder is the moment a source-scanning guard goes quiet, and this was
measured rather than assumed. With the five repositories moved and the guards
unchanged: `repositoryConventions` counted 12 soft-deleting repositories where it
had counted 17 and refused via its own floor; `softDeleteCapabilities` lost every
attribution for all five tables and `trashRegistry.test.ts` reported two **live**
exemptions as stale, which would have invited the next reader to delete a
permission still doing its job; and `hardDeleteReachability` could not see the
factory's permanent delete at all. All three now read the factory, and a
`softDelete` attributable to neither route is reported rather than excused.

Two false results of this pass's own, recorded where they happened:
- A pattern searching the whole factory file matched the `SoftDeleteOps`
  **interface** rather than the implementation, so removing `txId` from the body
  left four assertions green.
- `db.table<Note, string>('notes')` puts a `<` where `hardDeleteReachability`'s
  table pattern wanted a `(`, so the layer's one shared permanent delete could
  have been renamed to anything. A **pre-existing** hole, surfaced because the
  factory writes through that form. Closed in both guards that carry the pattern.

Also measured and worth knowing: `db.ships === db.table('ships')` is **false**.
Same object store, so data and transaction scoping are unaffected — but a test
spying `db.ships.update` does not see a factory write and passes having tested
nothing.

### Q2. `logNpcCapture` removed — DONE
No caller since `f1dd4c4` (2026-07-29). **The opposite decision to
`resolveComponent`, on a distinction worth keeping:** `resolveComponent` was
*unfinished* — nobody had decided against it and the wires were simply never
attached, so fifteen lines of wiring bought back ~250 lines of finished
hardening. `logNpcCapture` is *deprecated*, and the decision is written down:
`docs/plans/2026-07-29-notes-overhaul-completion-design.md` lists
`QuickNpcAction.tsx` under **Deleted** with the reason "NPC capture lives on the
Bestiary screen", says the Session tab "loses its capture role", and states
"The deletion is the feature, not a regression to compensate for." Wiring it back
would rebuild the surface that overhaul removed on purpose.

Checked before deciding, because "it is a duplicate" would have been the easy
reason and it is false: the three wired creature-creation flows write a template
and nothing else, so `captureNpcWithNote` was a real capability — one the product
chose not to offer from that tab. The one edge worth checking, `introduced_in`,
stays live through `useNoteActions.createNote`. Its only test went with it, so
two replace it against `persistCanonicalNoteLinks` directly, with a control.

215 lines out. Two rounds of maintenance had already been paid on it while it was
unreachable.

### Q3. The scan-2 tail — DONE
Re-verified every row before acting. **Five were already closed** and are
recorded as such rather than re-fixed: `bulkRebuildGraph` rejects now, the
timeline README no longer names `TimelineExample`, `softDeleteCoverage`'s field
floor is derived rather than the literal 20, `KnowledgeBaseScreen` has a heading,
and four screens explain what Play mode hides.

Three guard holes closed, each with a counterfactual showing the previous
version green:
- **The relationship-type scan** saw neither a comparison
  (`link.relationshipType === 'represents'`, in the export collector) nor a
  double-quoted literal nor a positional argument (`ensureLink(…, 'introduced_in')`
  — covered only by accident, via an unrelated `getLinksFrom`). Widened, and a
  site whose type is a *variable* is now reported rather than skipped.
- **`importReachability`** stripped one campaign-gated region and called it all
  of them. `CampaignHeader` has two, so reformatting one opener left it
  unstripped while the other satisfied the self-check.
- **`preserve-caught-error`'s site count** has now been wrong five times — 119,
  128, 129, 130, 140. It is written down nowhere; a census derives it, and strips
  comments first, because every naive `grep -c` of that pattern (including the
  one behind this file's own most recent correction) counted two lines of
  `mergeEngine` prose *about* `{ cause: … }` as code. The true figure is **139**
  today, and the point is that no one should need to know that.

One warning nobody could read: `EndSessionModal` said "An active encounter will
be ended automatically" in `text-amber-700 dark:text-amber-300` with no
background of its own. Tailwind's `dark:` follows `prefers-color-scheme`; this
app themes by `data-theme` and has **ten themes**. On OS-dark / app-light that is
amber-300 on `#F7F1E2` — about **1.3:1**. All nine `dark:` usages moved to the
tokens every theme defines, and `themeVariants.test.ts` forbids the variant and
asserts the tokens exist in every theme, since otherwise the advice resolves to
transparent text.

Smaller and true: the Tiptap toolbar conveyed state by colour alone (eight
`aria-pressed`, fed by the same expression as the class); `ShipsScreen`'s empty
state said "Add your first above" while the create row is `isEditMode &&`, so in
Play mode — the default — it pointed at a control that is not rendered;
`bundleParser`'s scope warning justified itself by a branch `f3142e7` deleted;
`useImportActions`' campaign read-back had its collision case backwards; three of
four README "Known gaps" were stale and one **contradicted the Backup section two
pages up**, and its test counts read 99 files and "no config file" against 135
and a declared `test:` block.

### Q4. H4's banner — DONE; its snapshot — WONTFIX as written
See `H4` above for both halves and the reasoning.

### Recorded, not fixed — the gated sweep's queue grew by two
- **Attachments can be read but not created.** `createAttachment` still has zero
  callers; storage, soft delete, bundles, ZIP export and rendering all exist and
  nothing puts a file in. Measured, because a reader of this in passing concluded
  otherwise from the note-reader gallery. Now in the README's Known gaps, since
  the feature list says "attachments".
- **`useSystemDefinition.error` is computed and dropped at all eighteen call
  sites** — the same shape, and `isLoading` with it.
- `sessionRepository.softDelete` cascades only edges and
  `campaignRepository.softDelete` cascades nothing: orphans rather than loss, and
  a design change rather than a fix.
- A throwing migration still leaves only a Reload that re-runs it.
- No purge, so "free up space" remains advice nobody can take.

---

## Suggested order of attack

Each line is a self-contained change that can ship on its own and be verified
with `npm run build` + `npm test` + a walk through the app.

1. **A1** character soft delete, with **F6** so it stays fixed.
2. **A2** derived override seed. One-line change, high damage.
3. **B3** private attachment leak, **B1** legacy import validation. Both small.
4. **A6 + A7 + B8** in one `version(19)` block: the missing index, the v7
   backfill, and clearing the localStorage dump.
5. **A3** the stale-put family, via a `characterRepository.patch` helper.
6. **A4** normalisation from the system definition.
7. **C2** TileCard resolvers, **C1** attribute modifiers into derived stats,
   then **F3** so the contract test actually guards it.
8. **D1** `engine.encumbrance` (fixes the party screen's wrong engine too).
9. **D2** modifier expiry hooks. Traveller and Savage players are stuck with
   permanent buffs until this lands.
10. **D6 + F2** proxy branches and the test that flags them.
11. **B2, B4, B5, B6, B7, B9** the remaining import hardening, as one pass.
12. **D3, D4, D5, D11** engine models for magic, conditions, damage, health.
13. **D7, D8, D9, D10, D12** screen-by-screen vocabulary and panel cleanup,
    with **F1** widened first so regressions fail.
14. **E1–E6** the data-into-JSON refactor. Best done after D-work so the
    adapters are already thin.
15. **A8–A10, G** as filler.
16. **H1 is withdrawn** — the KB is reachable, so there is no fate to decide.
    **H2** (the navigation catalogue, with `MoreScreen` deleted) and **H3** (the
    registry-driven trash) are both now done. What they left behind is A8's
    bottom-nav toggles, which the catalogue is now the natural place to filter,
    and a purge action for the Trash, which was declined rather than forgotten.
17. **I1 + I10** linter and CI — both now done, so **I3, I4, I6** are one-time
    fixes that stay fixed. **I8** is a one-line delete. When picking up I4 and
    I6, add their `no-restricted-syntax` / `no-restricted-properties` rules to
    `eslint.config.js` in the same change, which is what makes them stay fixed.
18. **H4** backup banner and snapshots, **H7** shell-level error boundary,
    **H8** portraits out of the record. Each is a user-visible safety win.
19. **I2** code splitting once **npm ci** is possible and sizes can be
    measured; **I5, I7, I9, I11** as filler.
20. **J1, J2** whenever CLAUDE.md is next touched; they are the cheapest items
    in the file and the ones most likely to mislead the next reader.

When an item is closed, change its status line to `DONE (<commit>)` and leave
the evidence in place so the next scan can confirm it did not regress.

---

## Progress

Steps 1 to 13 of the order of attack are closed: A1–A4, A6, A7, B1–B9, C1, C2,
D1–D12 (two small parts remain, below), F1–F4. Workstream D is effectively
finished; workstream B is finished apart from **B10**, the unvalidated
reference-import JSON. Step 14 is next — **E1 to E6**, moving adapter data into
JSON, which the D-work has already made easier by thinning the adapters.

The 2026-09-08 audit pass then closed **workstream K** (eight findings that had
no entry here, including the incomplete export and the parity test that keeps it
complete), plus **H6** and **I10**.

The 2026-09-09 pass closed **workstream L** — a DOM test environment and the
autosave tests it made possible (L1), the released-`version(n)` guard (L2), the
printed sheet's silent truncation (L3), and a hook-order crash the new linter
found (L4) — together with **I1** (the linter itself), **B10** (the reference
import, apart from the in-app editor bodies), and partial progress on **E4**
(the unknown-system fallback is now loud and guarded, but adapter selection is
still by id) and **I5** (a DOM environment exists; shared setup and coverage do
not).

A third 2026-09-09 pass closed **workstream N**, from a maintainability scan
that asked what makes the next change expensive rather than what is broken. Its
finding is worth carrying forward: the guards are now the load-bearing artifact
here, and the drift lives in their scope boundaries rather than in the
conventions they enforce. Two of the eleven items were behaviour (a live
hard-delete on user content; three note types that could not be filtered); the
rest widened, added or repaired a guard. It also wrote `repositoryConventions`
— the test only, ahead of any repository factory, because that is the layer
where a mistake cannot be undone.

A second 2026-09-09 pass then took the expensive tail — the items scoring near
zero on this file's own formula, where changing no behaviour is most of the
work. It closed **H2** (the navigation catalogue, and `/more` with it), **H3**
(nine entity types given a way back, not the twelve this file claimed), and
**workstream M** (provider memoization), and took **H7** as far as the data
loss goes. Workstreams G and J are otherwise untouched.

The 2026-09-10/11 passes closed **workstream P** — the second five-pass scan and
the three passes that worked down it. Nine ranked findings, three residual gaps
found by re-running the scan's own mutations against its own fixes, and the
direct-Dexie guard, which was the largest item `O6` left open and which exposed,
on the way in, six writes that could land in a deleted encounter, a set of KB
reads that bypassed their repository, and the graph marker of P7 — none of them
reported by the scan. `O6`'s other two open items
are closed with it (`declaredCapabilities`' blind spots, `sheetTemplateSchema.print`),
and one of `O6`'s claims is withdrawn.

**Workstream Q then closed the last of the queue** on 2026-09-11: the repository
factory (`S22`, the fourth and last of `O6`'s items), the second scan's tail, the
`logNpcCapture` decision, and `H4`'s banner — with `H4`'s snapshot declined
rather than left open, because the version written down would not have been a
backup. What remained was the gated sweep for unwired and half-wired surfaces,
which `Q` added two entries to rather than acting on. **Workstream R is that
sweep, and it is done — see below.**

Two things from that workstream are worth carrying forward more than the ticks:

- **The signature bug has moved again.** Scan 1: a rule maintained in two
  places. Scan 2: a guard whose *scope* is narrower than the rule it guards —
  found five times, including in the guard written to catch declared-and-unread
  fields, which could not see a contract declared as a Zod schema.
- **Its worst form is a failure absorbed by a broad catch and reported as
  success** (P3, P7). That is a test that cannot fail, living in production
  code, and it hides the defect *and* the evidence of it: the KB graph rebuilt
  itself in full on every mount for as long as the marker existed, and every
  rebuild reported success.

What step 13 deliberately left:

- **D10:** `logDeathRoll` still writes "Death Roll #n". Sourcing that phrase
  means a new field on a death model only Dragonbane declares, read from a panel
  that only renders when that model exists. Over-fitting for one string.
- **D12:** the dragon/demon mark glyphs, their colours and the marked-count
  badge are still Dragonbane's, written into `SkillsScreen`. That wants
  `skill.marks?: [{ id, label, glyph }]` and a rewrite of the mark cycle.
  Also still open from D12: `WeaponEditor`'s grip and damage-type lists,
  `remakeCurrency` bypassing `engine.currency`, the `bennies` card key, and the
  `StatKey`/`restsUsed` unions in `types/character.ts`.

Seven things a future reader should know before picking up the rest:

- **The E2E suite never leaves the default system.** It creates characters
  without touching the system picker, so nothing it does exercises Traveller or
  Savage Worlds. `tests/panels_check.py` was written for D8 and drives both
  sheets in a browser; extend it rather than assuming the main suite covers a
  system-specific change.
- **Two more engine fields were deleted for having no reader**, following the
  pattern from step 10: `labels.creature{Health,Armor,Movement}` duplicated
  `creatures.statFields` and disagreed with it, and `skill.advancementMax`
  duplicated `advancement.maxSkillValue`.

- **D11's health consolidation was declined, not forgotten.** Folding
  `terms.healthResource` and `labels.participantHealth` into an
  `engine.health` object would move two fields that `system.json` can
  override — `getEngine` merges `terms` and `labels` by key. A new home either
  breaks that documented override or becomes an alias for it, which is more
  indirection rather than less. The two genuinely redundant flags it also named
  (`hasMagic`, `skill.advancementMax`) are gone.

- **D6 is closed except for skill marks.** The dragon/demon glyphs, their
  colours and the marked-count badge are still Dragonbane vocabulary written
  into `SkillsScreen`. That wants `skill.marks?: [{ id, label, glyph }]` and a
  rewrite of the mark cycle, which is a bigger change than the branch removals
  around it and was left rather than half-done.
- **Two engine fields were deleted rather than kept.** `engine.resolution` and a
  proposed `skill.autoSuccessAt` both ended up with no reader once the thing
  that had branched on them was fixed, and `declaredCapabilities.test.ts`
  flagged each immediately. A descriptive label whose only use is to be branched
  on invites the next person to branch on it again.
- **The CSP is applied at build only.** Adding it in dev breaks Vite's HMR
  client, and a policy loosened for the dev server is not the policy that ships.
  It is verified by running the Playwright suite against `npm run preview`.

- **A7 and B8 shipped as part of the same `version(19)` block as A6.**
  `version(20)` is now taken too — K3's attachment soft-delete indexes. A future
  schema change adds `version(21)`; do not edit either.
- **A4 left the skill clamp at 20. K4 removed it** (49a541f). The cycle
  described here is real and unchanged — `engine/index` imports
  `ActiveCharacterContext`, which imports the normaliser — so the resolution was
  not to reach for the engine but to stop inventing a ceiling: with no declared
  range there is now no cap, exactly as `normalizeAttribute` already treated an
  undeclared attribute. The option is `skillRange` rather than `skillMax`, and
  still nothing passes it.

---

## Workstream R — the gated half-wired sweep (2026-09-11) — DONE

Five passes for unwired and half-wired surfaces: reachability both ways, the
boundary walk, the declaration-versus-consumer audit, the unreachable caller, and
the promise audit. Ranked by `Impact × 4 − Blast × 3 − Effort`. Every finding
names **wire** or **remove** with its reason, because there is no third state.

### The findings, ranked

| # | Finding | Decision | Score |
|---|---|---|---|
| R1 | `createAttachment` had zero callers, so the app could not make an attachment at all, while the README listed "attachments" as shipped | **Wire** | 5×4 − 2×3 − 3 = **11** |
| R2 | `useSystemDefinition.error` computed and dropped at all 18 call sites, so a ruleset that failed to load was served as one still loading — with another system's maths | **Wire** | 4×4 − 2×3 − 3 = **7** |
| R3 | `campaignSchema.activePartyId` written by three UI flows and read by none; the party came back as whichever row the index yielded first | **Wire** | 3×4 − 1×3 − 2 = **7** |
| R4 | Nine `CharacterUiState` / schema fields declared, validated, some persisted on every save, none read | **Remove** | 2×4 − 1×3 − 2 = **3** |
| R5 | Two Reference delete dialogs said "This cannot be undone" over a soft delete with a working Trash listing | **Remove the claim** | 3×4 − 1×3 − 1 = **8** |
| R6 | "Clear All Data" warned about "characters and notes" and clears every table | **Correct the copy** | 3×4 − 1×3 − 1 = **8** |
| R7 | Nine exports with no caller anywhere, including a whole screen component pair kept "for rollback safety" | **Remove** | 2×4 − 2×3 − 2 = **0** |
| R8 | Settings sent the user to "More → Session Log"; `/more` was deleted | **Correct the copy** | 2×4 − 1×3 − 1 = **4** |
| R9 | `encounterRepository.addParticipant` — a callerless duplicate that could write a participant with **no `represents` edge** | **Remove** | 2×4 − 1×3 − 1 = **4** |
| R10 | `creatureTemplateSchema.imageUrl` — a live text input whose only reader was itself | **Remove, control and all** | 2×4 − 2×3 − 1 = **1** |
| R11 | `linkSyncEngine.syncCharacter` — finished, hardened, unreachable | **Remove** | 1×4 − 2×3 − 2 = **−4** |

### The decisions worth re-reading

**R1 — attachments.** The promise-audit finding of the set, and the only one that
is a false statement to a user rather than dead code. Wired on the
`resolveComponent` precedent: downscale-and-re-encode, a `QuotaExceededError`
re-label, a soft-delete cascade with restore-by-txId, a `RESTORE_WITHOUT_LISTING`
exemption, ZIP sidecar rendering, base64 round-tripping and a mime/size/base64
restore guard were all already built around the missing entry point. No design doc
deprecates it; the ink design doc assumes it. (The "AttachTo" controls the notes
overhaul deleted are a different concept — attaching a *log entry* to a note.)

The read half was half-wired too: the gallery showed `att.caption || att.id`, a
raw UUID, since nothing could set a caption either, and no `<img>` existed
anywhere in the app.

Three more dead exports in that file got three different answers.
`getAttachmentsByCampaign` **removed** — its only caller was one assertion in its
own test. `sizeBytes` **wired** — into the gallery and into
`renderAttachmentSidecar`, the one file whose job is to preserve attachment
metadata and which omitted the number saying how much of the device the photo
costs. `deleteAttachment` **kept internal, and its doc corrected**: it called
itself "the per-photo remove control", a control that did not exist and could
not, because `hardDeleteReachability.test.ts` forbids a permanent delete on user
content outside `src/storage` *and* `RESTORE_WITHOUT_LISTING` exempts the
`attachments` table from a Trash listing on the grounds that an attachment is
never deleted on its own. The doc authorised a caller the exemption depends on
not existing.

**R2 — the two nulls.** `error` was the only thing separating "failed to load"
from "not finished loading", and both reach a consumer as `system === null`. So
`fallbackRulesFor` and its on-screen notice — which exist for exactly this — could
never fire for a missing ruleset, and `fallbackAdapter.test.ts` asserted that
absence in two lines. A test defending the gap, and for a sound reason:
`getEngine` alone genuinely cannot tell. It is told now, via
`getEngine(system, unresolvedSystemId?)`, and both original assertions still hold.
`isLoading` got the opposite answer and was removed: no consumer ever showed a
spinner.

The guard is structural rather than a list of screens. Sixteen other files call
the hook for labels and terms; a notice in each would be sixteen chances to
render one fed a constant — the defect wearing the shape of the fix.

**R10 — the one case where "expose it" was the wrong answer.** `imageUrl` is
verbatim the `bottomNavTabs` shape: a real text input, placeholder `https://…`,
read only by the form reading back what it wrote. Wiring it means fetching user
content from a third party on every card render, in an offline-first app whose own
pattern for images is a data URI. The control went with the field. This is the
`PrinterProfile` calibration precedent in the same direction.

**R11 — the one that looked most like `resolveComponent` and was not.**
`syncCharacter` needs a `campaignId` and `CharacterRecord` does not have one — a
character belongs to a campaign only through a party seat. The obvious wiring,
mirroring `noteRepository`'s fire-and-forget `syncNote`, means a party lookup on
every autosave across seven screens. Not a fifteen-line wire: a change to what a
character is. And nothing downstream is orphaned — the `'character'` node type is
already populated, because `nodeTypeForNote` maps an `npc` note to it.

### What the guards learned

`declaredCapabilities` is finally widened to `types/character.ts`,
`types/attachment.ts` and `types/campaign.ts`, which `P6` deliberately deferred.
Widening it found two blind spots **in the guard**, both unreachable while it
covered only files containing nothing but declarations:

- **A value object read as a set of declarations.** `METADATA_KEYS = { kin:
  'kin', … }` is a population, and its keys were extracted and reported unread.
  The file's own comment already stated the rule that separates the two and never
  applied it. Narrow enough that `kindField: 'die-ladder'` — a literal *type* — is
  still seen; both halves pinned.
- **A JS built-in reporting a reader.** `Math.round(` matched `\.round`, so
  `restsUsed.round` looked read. Had that field been the bug, the guard would
  have excused it.

`round` is *still* read after that fix, and the new allowlist's self-check said
so rather than letting the entry stand: `CombatEncounterView` reads
`event.round`, a different field of the same name. That is `TOO_GENERIC`'s
limitation and it is recorded in place instead of papered over.

Two new guards: `systemLoadErrorReaders.test.ts` (the engine hooks must bind the
hook's error and pass it on) and `irreversibilityClaims.test.ts` (only a screen
that really destroys something may say so — `SettingsScreen` is the sole entry).

### On counts, because this project has been bitten by them

Every guard's case count was **derived before and after**, per guard, and the
per-case *names* diffed as well as the totals — including after deleting source
files, which is precisely what shrinks a source-scanning guard's corpus:

| guard | before | after |
|---|---|---|
| `declaredCapabilities` | 169 | 247 |
| `settingsHaveReaders` | 16 | 16 |
| `repositoryConventions` | 88 | 88 |
| `trashRegistry` | 16 | 16 |
| `panelKeyReaders` | 5 | 5 |
| `componentReachability` | 9 | 9 |
| `cards/schema` | 19 | 19 |
| `importReachability` | 4 | 4 |

No guard lost a case. Suite 2089 → 2200 tests, 137 → 141 files; ESLint warnings
36 → 31.

### Three things this sweep got wrong first, and caught

- **A test that could not fail, written this session.** The `activePartyId` test
  seeded `party-old` then `party-chosen` and preferred `party-chosen` — but Dexie
  returns an index scan in *primary-key* order, so the unpreferred scan already
  gave the expected answer. Deleting the entire preference branch left it green.
  The ids are adversarial now.
- **A guard hole in a guard written an hour earlier.**
  `toContain('role="status"')` passes on `data-role="status"` — a substring match
  with no left boundary, the same shape as the `\b`-before-a-hyphen false positive
  `declaredCapabilities` was rewritten to stop making.
- **A false "dead" verdict from excluding same-file callers.** A first pass
  reported `pushSegment` and `endActiveSegment` unreachable; both are called by a
  sibling four lines away, and `Encounter.segments` — which four production
  readers depend on — is written inline by `startForSession` and `endWithSummary`.
  Filed and withdrawn before it became a finding.

### Recorded, not fixed

These were found and are **not** half-wired surfaces, so they are recorded rather
than acted on. Two are serious.

- **Ten live character sub-fields are stripped on every import.**
  `characterRecordSchema` is `.passthrough()` at the top level only, and
  `bundleParser` is the one branch that replaces the row with parser output. So
  `CharacterSkill.dragonMarked`/`demonMarked`, `Weapon.metal`/`damageType`/
  `strRequirement`/`damaged`/`isShield` and `ArmorPiece.weight`/`bodyPart`/
  `movementPenalty`/`metal` vanish on import. All are read by live code. The repo
  already fixed exactly one instance of this shape (`StoryBeat.body`) and never
  applied the reasoning to the nested objects. `bundleParser.test.ts:74` claims to
  guard it and asserts only the two fields the two `passthrough()` calls already
  protect.
- **The privacy filter never touches `kbNodes`/`kbEdges`.** `applyPrivacyFilter`
  spreads `...contents` and overrides `notes`, `entityLinks` and `attachments`
  only, so a private note's title, id and its whole edge set ship in a campaign
  bundle the user was told excludes it. The Markdown path is defended against
  this; the JSON path — the one that leaves the device as a shareable file — is
  not.
- `attachments` and `kbEdges` carry no `updatedAt`, so re-importing the same
  backup reports one error per row and neither can ever be updated by a bundle.
- `envelope.system` is derived on export and read by nothing on import.
- `note.typeData` — where ink strokes live — survives the JSON bundle and is
  dropped by every Markdown/ZIP renderer.
- Five test-only pure helpers (`entriesForAccount`, `countEarnedMarks`,
  `hasBlankTemplate`, `removeDebtPayment`, `raiseChance`) and the unreachable
  `notesToTimeline` adapter module. The adapter is left because three doc comments
  name it as the timeline component library's canonical extension point, so
  removing it is a decision about that library's documented architecture rather
  than a wiring fix.
- A per-photo delete for attachments needs the Trash listing first — see the
  README's Known gaps and `RESTORE_WITHOUT_LISTING.attachments`.
- Whether a `CharacterRecord` should carry a `campaignId` — the question `R11`
  leaves open.
