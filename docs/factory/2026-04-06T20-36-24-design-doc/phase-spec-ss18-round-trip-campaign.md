# Phase Spec — SS-18: Round-Trip Test — Full Campaign

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 3.3 — Integration: Round-Trip Test — Full Campaign
**Depends on:** SS-16 (character round-trip) and SS-17 (session round-trip) must be passing first.
**Delivery order note:** Step 18 in execution sequence. Integration verification — no new code written unless bugs discovered.

---

## Objective

Verify the complete campaign export → import round-trip to a fresh app state. Confirm all entity types are included, all relationships are intact, and the campaign structure is fully restored.

---

## Scenario

Campaign with:
- 2 sessions (each with encounters)
- 1 bestiary (multiple creature templates: monster, npc, animal categories)
- 5 notes across both sessions
- 2 party members linked to characters
- Entity links: notes to encounters, notes to characters
- At least 1 archived NPC note (from migration)

Export → import to fresh app (no existing data).

---

## Verification Steps

### Step 1: Setup

Confirm the app has a campaign with the above structure. This can reuse data created in SS-16 and SS-17 verification, augmented with:
- Multiple creature templates (at least one per category)
- Multiple sessions with different encounter types
- Entity links between different entity types

### Step 2: Export campaign

1. Navigate to Campaign settings.
2. Tap "Export campaign".
3. Receive `.skaldmark.json`.
4. Inspect the bundle:

```typescript
const bundle = JSON.parse(fileContents);

assert(bundle.version === 1);
assert(bundle.type === 'campaign');
assert(bundle.system === 'dragonbane');

const c = bundle.contents;
assert(c.campaign !== undefined);
assert(c.sessions?.length >= 2);
assert(c.creatureTemplates?.length >= 3);
assert(c.encounters?.length >= 2);
assert(c.notes?.length >= 5);
assert(c.parties?.length >= 1);
assert(c.partyMembers?.length >= 2);
assert(c.characters?.length >= 2);
assert(c.entityLinks?.length >= 3);

// Creature templates span all categories
const categories = new Set(c.creatureTemplates.map(t => t.category));
assert(categories.has('monster'));
assert(categories.has('npc'));
assert(categories.has('animal'));
```

### Step 3: Import to fresh app

"Fresh app" simulation: create a completely new campaign (no sessions, no notes, no bestiary). Import the campaign bundle into this context.

Steps:
1. Create a new empty campaign ("Campaign Fresh").
2. Navigate to Campaign Fresh settings → "Import".
3. Select the campaign bundle.
4. In `ImportPreview`:
   - All entity types checked.
   - Select "Campaign Fresh" as target.
   - Verify entity counts match bundle contents.
   - Tap "Import".
5. Verify toast: `"Imported N new, updated 0, skipped 0"`.

### Step 4: Verify campaign structure

After import, verify in "Campaign Fresh":

**Sessions:**
```typescript
const sessions = await sessionRepository.listByCampaign(freshCampaignId);
assert(sessions.length >= 2);
assert(sessions.every(s => s.campaignId === freshCampaignId));
```

**Encounters:**
```typescript
const encounters = await encounterRepository.listByCampaign(freshCampaignId);
assert(encounters.length >= 2);
assert(encounters.every(e => e.campaignId === freshCampaignId));
// Each encounter has correct sessionId (session is in bundle, so sessionId preserved)
assert(encounters.every(e => sessions.some(s => s.id === e.sessionId)));
```

**Creature templates:**
```typescript
const templates = await creatureTemplateRepository.listByCampaign(freshCampaignId);
assert(templates.length >= 3);
assert(templates.every(t => t.campaignId === freshCampaignId));
```

**Notes:**
```typescript
const notes = await noteRepository.listByCampaign(freshCampaignId);
assert(notes.length >= 5);
assert(notes.every(n => n.campaignId === freshCampaignId));
// Each note has a valid sessionId matching an imported session
assert(notes.every(n => !n.sessionId || sessions.some(s => s.id === n.sessionId)));
```

**Party structure:**
```typescript
const parties = await partyRepository.listByCampaign(freshCampaignId);
assert(parties.length >= 1);
const partyMembers = await partyMemberRepository.listByParty(parties[0].id);
assert(partyMembers.length >= 2);
// Party members linked to imported characters
assert(partyMembers.every(pm =>
  characters.some(c => c.id === pm.characterId)
));
```

**Encounter participant resolution:**
```typescript
for (const encounter of encounters) {
  for (const participant of encounter.participants) {
    if (participant.linkedCreatureId) {
      const template = await creatureTemplateRepository.getById(participant.linkedCreatureId);
      assert(template !== undefined, `Template ${participant.linkedCreatureId} unresolvable`);
    }
  }
}
```

**Entity links:**
```typescript
// Spot-check: notes linked to encounters
const explorationEncounter = encounters.find(e => e.type === 'exploration');
if (explorationEncounter) {
  const links = await entityLinkRepository.listByEntity('encounter', explorationEncounter.id);
  assert(links.some(l => l.toEntityType === 'note'));
}
```

### Step 5: UI verification

Navigate through the Campaign Fresh UI:
- [ ] Sessions appear in session list
- [ ] Opening a session → encounters visible in history
- [ ] Opening a combat encounter → CombatTimeline renders correctly
- [ ] Opening an exploration encounter → participant list + linked notes visible
- [ ] Bestiary → all imported templates visible, searchable, and filterable by category
- [ ] Character list → imported characters visible
- [ ] Party structure → party members linked to characters

---

## What to Fix If Verification Fails

| Failure | Fix Location |
|---------|-------------|
| Sessions missing from bundle | SS-09 (collectors.ts — `collectCampaignBundle`) |
| Entity count wrong in ImportPreview | SS-14 (ImportPreview.tsx — `getEntityCount`) |
| Any entity type missing from bundle | SS-09 (collectors.ts — missing entity collection) |
| `campaignId` not applied | SS-13 (mergeEngine.ts — re-parenting) |
| `sessionId` incorrectly cleared | SS-13 (mergeEngine.ts — session presence check) |
| Party member → character link broken | SS-13 (mergeEngine.ts — processing order) |
| Template unresolvable for participant | SS-13 (mergeEngine.ts — creatureTemplates before encounters) |

---

## Acceptance Criteria

- [ ] Bundle includes all entity types: campaign, sessions, parties, partyMembers, characters, creatureTemplates, encounters, notes, entityLinks, attachments
- [ ] Import to fresh campaign inserts all entities (inserted count = total entity count)
- [ ] Campaign structure intact after import: sessions linked to campaign, encounters linked to sessions
- [ ] Creature templates linked to imported campaign; encounter participants resolve to templates
- [ ] Notes linked to sessions and encounters via entity links (encounter notes feed works)
- [ ] Party structure intact: party members linked to characters
- [ ] `npm run build` passes after any bug fixes

---

## Constraints

- Verification-only — no new production code unless fixing a discovered bug
- "Fresh app" = new empty campaign (not a factory reset — existing campaigns unaffected)
- All entity relationships must be verifiable in both the IndexedDB and the UI
