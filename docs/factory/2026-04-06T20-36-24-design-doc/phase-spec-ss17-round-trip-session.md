# Phase Spec — SS-17: Round-Trip Test — Session with Encounters

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 3.2 — Integration: Round-Trip Test — Session with Encounters
**Depends on:** ALL Feature A (SS-01 through SS-08) and ALL Feature B (SS-09 through SS-15) must be completed first. SS-16 (character round-trip) should be passing.
**Delivery order note:** Step 17 in execution sequence. Integration verification — no new code written unless bugs discovered.

---

## Objective

Verify the complete session export → import round-trip with encounters, creature templates, notes, and entity links. Confirm that all encounter participants resolve their `linkedCreatureId` to imported creature templates, and that encounter-note entity links are preserved.

---

## Scenario

Session with:
- 1 combat encounter with 2 participants (each with a `linkedCreatureId` pointing to creature templates)
- 1 exploration encounter with 2 participants + 3 linked notes
- 3 notes created while the exploration encounter was active (auto-linked via entity links)
- Party with 2 PCs (party members linked to characters)

Export → import to a **different** campaign.

---

## Verification Steps

### Step 1: Setup

In the running app:
1. Create a session in Campaign A.
2. Start a combat encounter → add 2 participants from the bestiary (with `linkedCreatureId` values).
3. End the combat encounter.
4. Start an exploration encounter → add 2 participants.
5. Create 3 notes during the exploration encounter (verify they auto-link to the encounter).
6. End the exploration encounter.
7. End the session.

### Step 2: Export session

1. Navigate to the session screen.
2. Tap "Export session".
3. Receive `.skaldmark.json`.
4. Inspect the file:

```typescript
const bundle = JSON.parse(fileContents);

assert(bundle.version === 1);
assert(bundle.type === 'session');
assert(bundle.contents.sessions?.length === 1);
assert(bundle.contents.encounters?.length === 2); // combat + exploration
assert(bundle.contents.creatureTemplates?.length >= 2); // templates linked by participants
assert(bundle.contents.notes?.length === 3); // auto-linked notes

// Verify combat encounter has participants with linkedCreatureId
const combat = bundle.contents.encounters.find(e => e.type === 'combat');
assert(combat.participants.every(p => p.linkedCreatureId !== undefined));
assert(combat.participants.every(p =>
  bundle.contents.creatureTemplates.some(t => t.id === p.linkedCreatureId)
));

// Verify exploration encounter notes are linked
const exploration = bundle.contents.encounters.find(e => e.type === 'exploration');
const explorationLinks = bundle.contents.entityLinks.filter(
  l => l.fromEntityType === 'encounter' && l.fromEntityId === exploration.id
);
assert(explorationLinks.length === 3);
```

### Step 3: Import to Campaign B

1. Navigate to Campaign B settings.
2. Tap "Import" → select the session file.
3. In ImportPreview:
   - Verify entity counts: 1 session, 2 encounters, N creature templates, 3 notes, N entity links.
   - Select Campaign B as target campaign.
   - Tap "Import".
4. Verify toast: `"Imported N new, updated 0, skipped 0"`.

### Step 4: Verify re-parenting

In Campaign B, verify:
1. Session appears in Campaign B session list.
2. Session has correct `campaignId = Campaign B ID`.
3. Both encounters have `campaignId = Campaign B ID`.
4. All notes have `campaignId = Campaign B ID`.
5. All creature templates have `campaignId = Campaign B ID`.

```typescript
// In IndexedDB:
const encounters = await encounterRepository.listByCampaign(campaignBId);
assert(encounters.length === 2);
assert(encounters.every(e => e.campaignId === campaignBId));
```

### Step 5: Verify encounter participant resolution

For each encounter participant with `linkedCreatureId`:
1. Call `creatureTemplateRepository.getById(participant.linkedCreatureId)`.
2. Verify it returns the imported template (not undefined).
3. Open the encounter in the UI → open a participant's stat drawer → verify template stats appear.

### Step 6: Verify encounter-note entity links

1. Open the exploration encounter in Campaign B.
2. Verify the 3 notes appear in the encounter notes feed.
3. In IndexedDB, verify entity links: `fromEntityType: 'encounter', fromEntityId: explorationEncounterId, toEntityType: 'note'`.

---

## What to Fix If Verification Fails

| Failure | Fix Location |
|---------|-------------|
| Creature templates missing from bundle | SS-09 (collectors.ts — `linkedCreatureId` traversal) |
| Encounter-note links missing from bundle | SS-09 (collectors.ts — entity link collection) |
| `campaignId` not re-parented | SS-13 (mergeEngine.ts — `applyReparenting`) |
| `sessionId` cleared when it shouldn't be | SS-13 (mergeEngine.ts — session presence check) |
| Participant `linkedCreatureId` unresolvable after import | SS-13 (mergeEngine.ts — processing order: templates before encounters) |
| Notes not linked to encounter after import | SS-13 (mergeEngine.ts — entity links processing) |

---

## Acceptance Criteria

- [ ] Bundle contains session, both encounters (combat + exploration), participants, creature templates referenced by participants, notes, and entity links
- [ ] Import under different campaign: all entities re-parented to `targetCampaignId`
- [ ] Encounter participants resolve `linkedCreatureId` to imported creature templates (not undefined)
- [ ] Encounter-note entity links preserved: 3 notes appear in exploration encounter's notes feed post-import
- [ ] `sessionId` preserved (session IS in the bundle, so `sessionId` should NOT be cleared)
- [ ] `npm run build` passes after any bug fixes

---

## Constraints

- Verification-only — no new production code unless fixing a discovered bug
- Root cause fixes go to the responsible file (see "What to Fix" table)
- Both encounters must be verified independently (combat type + non-combat type)
