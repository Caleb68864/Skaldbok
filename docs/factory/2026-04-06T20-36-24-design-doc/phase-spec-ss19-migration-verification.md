# Phase Spec — SS-19: Migration Verification

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 3.4 — Integration: Migration Verification
**Depends on:** SS-01 (Dexie v6 migration), SS-07 (CombatEncounterView), SS-08 (NPC note deprecation) must be completed first.
**Delivery order note:** Step 19 — final step in execution sequence. Run `npm run build` as final verification.

---

## Objective

Verify that the Dexie v6 migration runs correctly from a v5 state, produces the expected encounter and creature template records, archives the source notes, and that the app renders migrated data correctly. Verify migrations are idempotent (flags prevent re-runs). Final build check.

---

## Scenario

App is opened with pre-existing Dexie v5 data containing:
- At least 2 combat notes (with `type: 'combat'` and `typeData` containing rounds/events/participants)
- At least 2 NPC notes (with `type: 'npc'` and `typeData` containing stats)

After opening the app with the v6 schema code active, the migration should:
1. Run automatically
2. Create encounter entities from combat notes
3. Create creature template entities from NPC notes
4. Archive both types of source notes
5. Set migration flags

---

## Verification Steps

### Step 1: Prepare v5 state (if not already present)

If real v5 data is not available, simulate it by temporarily downgrading the Dexie version in `client.ts`, adding sample data, and then re-applying the v6 code. Alternatively, use the IndexedDB panel in DevTools to manually add sample records to the `notes` table with `type: 'combat'` and `type: 'npc'` before the migration runs.

**Sample combat note (for v5):**
```json
{
  "id": "test-combat-1",
  "type": "combat",
  "campaignId": "campaign-1",
  "sessionId": "session-1",
  "title": "Battle at the Bridge",
  "status": "active",
  "createdAt": "2026-04-01T10:00:00Z",
  "updatedAt": "2026-04-01T11:00:00Z",
  "typeData": {
    "currentRound": 3,
    "participants": [{"id": "p1", "name": "Goblin", "hp": 8}],
    "events": [{"round": 1, "type": "attack", "actorId": "p1"}]
  }
}
```

**Sample NPC note (for v5):**
```json
{
  "id": "test-npc-1",
  "type": "npc",
  "campaignId": "campaign-1",
  "title": "Old Gustav",
  "tags": ["innkeeper", "friendly"],
  "status": "active",
  "createdAt": "2026-04-01T09:00:00Z",
  "updatedAt": "2026-04-01T09:30:00Z",
  "typeData": {
    "role": "Innkeeper",
    "affiliation": "Merchant Guild",
    "hp": 15,
    "armor": 2,
    "movement": 8
  }
}
```

### Step 2: Trigger migration

Open (or refresh) the app. The Dexie v6 upgrade handler should run automatically.

In DevTools → Application → IndexedDB → verify:
- `encounters` table exists
- `creatureTemplates` table exists
- `notes` table has `visibility` in its index path (visible in the table schema)
- `meta` table has entries: `{ key: 'migration_v6_combat', value: true }` and `{ key: 'migration_v6_npc', value: true }`

### Step 3: Verify combat note migration

```typescript
// In DevTools console:
const encounters = await db.table('encounters').toArray();
// Should contain at least 2 encounters (one per combat note)
const encounter = encounters.find(e => e.title === 'Battle at the Bridge');
assert(encounter !== undefined);
assert(encounter.type === 'combat');
assert(encounter.status === 'ended'); // migration sets ended status
assert(encounter.combatData.currentRound === 3);
assert(encounter.combatData.events.length > 0);
assert(encounter.participants.length > 0);
assert(encounter.sessionId === 'session-1');
assert(encounter.campaignId === 'campaign-1');

// Source note archived
const sourceNote = await db.table('notes').get('test-combat-1');
assert(sourceNote.status === 'archived');
assert(sourceNote.type === 'combat'); // type unchanged — only status archived
```

### Step 4: Verify NPC note migration

```typescript
const templates = await db.table('creatureTemplates').toArray();
const template = templates.find(t => t.name === 'Old Gustav');
assert(template !== undefined);
assert(template.category === 'npc');
assert(template.role === 'Innkeeper');
assert(template.affiliation === 'Merchant Guild');
assert(template.stats.hp === 15);
assert(template.stats.armor === 2);
assert(template.stats.movement === 8);
assert(template.tags.includes('innkeeper'));
assert(template.campaignId === 'campaign-1');
assert(template.status === 'active');

// Source note archived
const sourceNote = await db.table('notes').get('test-npc-1');
assert(sourceNote.status === 'archived');
```

### Step 5: Verify migration idempotency

1. Close and reopen the app (or call `db.open()` again).
2. Verify the migrations do NOT re-run:
   - Encounter count does not double.
   - Creature template count does not double.
   - `meta` flags remain set.

Confirm by watching the DevTools console for `[migration_v6_combat]` log messages — they should only appear once.

### Step 6: Verify CombatTimeline renders from encounter entities

1. Navigate to a session that had combat notes.
2. Open the encounter history — migrated combat encounter appears.
3. Tap the combat encounter → `CombatEncounterView` renders.
4. Verify:
   - Correct number of rounds displayed.
   - Events appear in timeline.
   - Participants listed.

If `CombatTimeline` renders incorrectly, the fix is in SS-07 (`CombatEncounterView.tsx`) — the adapter mapping.

### Step 7: Verify NPC note type removed from picker

1. Open `QuickNoteDrawer` (or any new-note creation flow).
2. Confirm `'npc'` is NOT present in the type picker options.

If it is present, the fix is in SS-08 (`QuickNoteDrawer.tsx`).

### Step 8: Verify archived notes still accessible

1. Open Notes view for the campaign.
2. Enable "Show archived".
3. Verify archived combat notes appear (with their original content intact).
4. Verify archived NPC notes appear (with their original content intact).

### Step 9: Final build check

```bash
npm run build
```

Must complete with no errors. If errors exist, fix them in the responsible file before marking this sub-spec complete.

---

## What to Fix If Verification Fails

| Failure | Fix Location |
|---------|-------------|
| `encounters` table missing | SS-01 (client.ts — schema definition) |
| Migration runs again on re-open | SS-01 (client.ts — flag check logic) |
| Source notes not archived | SS-01 (client.ts — `update(note.id, { status: 'archived' })`) |
| `combatData` missing from encounter | SS-01 (client.ts — mapping from `typeData`) |
| Template stats wrong | SS-01 (client.ts — NPC → template mapping) |
| CombatTimeline blank/error | SS-07 (CombatEncounterView.tsx — adapter) |
| NPC still in picker | SS-08 (QuickNoteDrawer.tsx) |
| `npm run build` fails | Identify error location and fix in responsible SS file |

---

## Acceptance Criteria

- [ ] Pre-migration: app on Dexie v5 with combat notes and NPC notes (confirmed via IndexedDB before migration)
- [ ] Post-migration (v6): combat notes exist as archived + new encounter entities created with correct `combatData`, `participants`, `sessionId`, `campaignId`
- [ ] Post-migration (v6): NPC notes exist as archived + new creature template entities created with correct stats and tags
- [ ] `CombatTimeline` renders correctly from encounter entities (not note `typeData`)
- [ ] Migration flags set (`migration_v6_combat: true`, `migration_v6_npc: true` in `meta` table)
- [ ] Re-opening app does NOT re-run migrations (entity counts do not double)
- [ ] NPC type NOT present in new-note type picker
- [ ] Archived combat and NPC notes remain viewable in notes list with "Show archived"
- [ ] `npm run build` succeeds with no errors after all changes

---

## Constraints

- Verification-only — no new production code unless fixing a discovered bug
- `npm run build` must be the absolute final action — verify all SS files compile together
- Any bug fixes must be isolated to the SS responsible for the broken behavior
- Do not delete or modify migration flag logic — migrations must remain idempotent
