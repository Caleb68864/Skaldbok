# Phase Spec — SS-16: Round-Trip Test — Character

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 3.1 — Integration: Round-Trip Test — Character
**Depends on:** ALL Feature A (SS-01 through SS-08) and ALL Feature B (SS-09 through SS-15) must be completed first.
**Delivery order note:** Step 16 in execution sequence. Integration verification — no new code written unless bugs discovered.

---

## Objective

Verify the complete character export → import round-trip works end-to-end. This sub-spec is primarily verification, not implementation. If failures are found, fix the root cause in the relevant sub-spec's files.

---

## Scenario

1. Create a character with linked notes (public and private)
2. Export the character (default: private notes excluded)
3. Import the bundle to an empty/different campaign
4. Import the same bundle a second time
5. Toggle private inclusion and export again

---

## Verification Steps

### Step 1: Setup

In the running app:
1. Create or select a character with at least:
   - 3 linked notes (2 public, 1 private — set `visibility: 'private'` on one)
   - At least 1 attachment on a public note
   - Entity links from character to notes

### Step 2: Export (default — no private notes)

1. Navigate to character detail screen.
2. Tap "Export character".
3. Receive the `.skaldmark.json` file.
4. Open the file and verify its structure:

```typescript
const bundle = JSON.parse(fileContents);

// Structural checks
assert(bundle.version === 1);
assert(bundle.type === 'character');
assert(bundle.system === 'dragonbane');
assert(typeof bundle.exportedAt === 'string');
assert(typeof bundle.contentHash === 'string'); // if Web Crypto available

// Contents checks
assert(bundle.contents.characters?.length === 1);
assert(bundle.contents.notes?.length === 2); // private note EXCLUDED
assert(bundle.contents.entityLinks?.length >= 2); // links to the 2 public notes
assert(bundle.contents.attachments?.length >= 1);

// Private note absent
const noteIds = bundle.contents.notes.map(n => n.id);
// The private note ID must NOT be in noteIds
```

### Step 3: Import to different campaign

1. Navigate to Campaign settings for a different (or new empty) campaign.
2. Tap "Import".
3. Select the exported `.skaldmark.json` file.
4. In `ImportPreview`:
   - Verify entity counts are correct (1 character, 2 notes, N entity links, N attachments).
   - Select the target campaign.
   - Tap "Import N items".
5. Verify toast: `"Imported N new, updated 0, skipped 0"`.
6. Verify in the target campaign:
   - Character appears in the character list.
   - Character's linked notes appear.
   - Private note is NOT present.

### Step 4: Second import of same bundle (idempotency)

1. Import the same `.skaldmark.json` file again to the same campaign.
2. Verify toast: `"Imported 0 new, updated 0, skipped N"`.
3. Verify no duplicate entities in the database.

### Step 5: Export with private notes included

If the UI exposes a "include private" toggle on the export:
1. Export character with `includePrivate: true`.
2. Open the file and verify the private note IS present.
3. Verify entity links to the private note are present.

If no UI toggle exists (the toggle may be deferred), call `exportCharacter(characterId, true)` directly in DevTools console and verify the file.

---

## What to Fix If Verification Fails

| Failure | Fix Location |
|---------|-------------|
| Private note present in default export | SS-10 (privacyFilter.ts) |
| Notes missing from bundle | SS-09 (collectors.ts — entity link traversal) |
| Import inserts duplicate on second run | SS-13 (mergeEngine.ts — dedup logic) |
| Entity links orphaned after import | SS-13 (mergeEngine.ts — processing order, sessionId clearing) |
| Toast message format wrong | SS-15 (useImportActions.ts) |
| Attachment content is `[object Object]` | SS-11 (bundleSerializer.ts — Blob to base64 conversion) |

---

## Acceptance Criteria

- [ ] Exported character bundle parses without errors (`parseBundle` returns `{ success: true }`)
- [ ] All PUBLIC notes linked to character are present in bundle
- [ ] Private note is NOT present in default export
- [ ] Re-import inserts all entities under target campaign (`campaignId` = target)
- [ ] Second import of same bundle: all entities skipped (identical `updatedAt`) — toast shows `skipped: N`
- [ ] Private notes excluded from default export; present when `includePrivate=true`
- [ ] `contentHash` present in bundle and matches SHA-256 of contents (if Web Crypto available)
- [ ] Import preview shows correct entity counts before merge executes

---

## Constraints

- This sub-spec is verification-only — write no new production code unless fixing a discovered bug
- All fixes must be made in the file responsible for the root cause (listed in "What to Fix" table)
- Document any bugs found and their fixes in a comment at the top of the affected file
