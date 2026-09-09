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

### H4. A campaign export is the only backup, and only Settings knows — OPEN (V)
- **Where:** `lastBackupAt` is written in exactly one place,
  `src/features/export/useExportActions.ts:439`, after a campaign export.
  `StorageSafetyCard` (the stale-backup warning) is mounted only at
  `SettingsScreen.tsx:310`. `config/defaults/backup.ts:13` sets the reminder at
  30 days.
- **What:** A player who never opens Settings never sees the warning. Nothing
  in the app creates a second copy of the data automatically.
- **Fix:** Surface the stale/never state as a dismissible banner in the shell
  (session screen is where people spend time). Then add an automatic local
  snapshot: write the campaign bundle into a `snapshots` table on a schedule
  (rotate the last N) or, where the File System Access API is available, into a
  user-chosen directory. Persisted storage (`storage/persistence.ts`) reduces
  eviction risk but is not a backup.

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

A second 2026-09-09 pass then took the expensive tail — the items scoring near
zero on this file's own formula, where changing no behaviour is most of the
work. It closed **H2** (the navigation catalogue, and `/more` with it), **H3**
(nine entity types given a way back, not the twelve this file claimed), and
**workstream M** (provider memoization), and took **H7** as far as the data
loss goes. Workstreams G and J are otherwise untouched.

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
