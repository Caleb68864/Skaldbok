# Phase Spec — SS-09: Scope Collectors

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 2.1 — Feature B: Scope Collectors
**Depends on:** SS-02 (Zod schemas — bundle.ts), SS-04 (Repositories) must be completed first.
**Delivery order note:** Step 9 in execution sequence. Required by SS-11 (bundle serializer) and SS-15 (hook integration).

---

## Objective

Implement three scope collector functions that query IndexedDB and assemble all entities belonging to a given export scope (character, session, or campaign). Each collector returns a `BundleContents` object matching `bundleEnvelopeSchema.contents`. No collector throws — errors caught internally.

---

## File to Create

- `src/utils/export/collectors.ts` — **create new**

---

## Implementation Steps

### Step 1: Inspect existing repositories and patterns

**CRITICAL — Read the actual repository files before writing any code.** The method names in the pseudocode below are WRONG. Here are the known correct names (verify by reading the files):
- `noteRepository`: `getNotesBySession(sessionId)`, `getNotesByCampaign(campaignId)`, `getNoteById(id)`
- `sessionRepository`: `getSessionById(id)`, `getSessionsByCampaign(campaignId)`
- `campaignRepository`: `getCampaignById(id)`
- `characterRepository`: `getById(id)` (this one uses the short name)
- `partyRepository`: `getPartyByCampaign(campaignId)` — returns a single party, NOT an array. No `listBySession` exists.
- `partyMemberRepository`: Actually exported from `partyRepository.ts` as `getPartyMembers(partyId)`
- `entityLinkRepository`: `getLinksFrom(fromEntityId, relationshipType?)` and `getLinksTo(toEntityId, relationshipType?)` — there is NO `listByEntity` function. You must call both and combine results.
- `attachmentRepository`: `getAttachmentsByNote(noteId)` — there is NO `getById(id)`

Also inspect how entity links are structured: what fields link a note to a character, and which direction (`fromEntityType`/`fromEntityId` vs `toEntityType`/`toEntityId`).

### Step 2: Define shared helper types

```typescript
import { BundleContents } from '../../types/bundle';

type CollectorResult =
  | { success: true; contents: BundleContents }
  | { success: false; error: string; partialContents?: Partial<BundleContents> };
```

### Step 3: Implement `collectCharacterBundle`

```typescript
export async function collectCharacterBundle(characterId: string): Promise<CollectorResult> {
  try {
    // 1. Load the character record
    const character = await characterRepository.getById(characterId);
    if (!character) return { success: false, error: `Character not found: ${characterId}` };

    // 2. Load entity links FROM or TO this characterId
    const linksFrom = await entityLinkRepository.listByEntity('character', characterId, 'from');
    const linksTo = await entityLinkRepository.listByEntity('character', characterId, 'to');
    const allLinks = [...linksFrom, ...linksTo];

    // 3. Collect note IDs from entity links
    const noteIds = allLinks
      .filter(l => l.fromEntityType === 'note' || l.toEntityType === 'note')
      .map(l => l.fromEntityType === 'note' ? l.fromEntityId : l.toEntityId);

    // 4. Load notes by collected IDs
    const notes = (await Promise.all(noteIds.map(id => noteRepository.getById(id))))
      .filter((n): n is Note => n !== undefined);

    // 5. Load attachments for those notes
    const attachments = (await Promise.all(
      noteIds.map(id => attachmentRepository.listByNote(id))
    )).flat();

    return {
      success: true,
      contents: {
        characters: [character],
        notes,
        entityLinks: allLinks,
        attachments,
      },
    };
  } catch (err) {
    console.error('[collectors] collectCharacterBundle error', err);
    return { success: false, error: String(err) };
  }
}
```

### Step 4: Implement `collectSessionBundle`

```typescript
export async function collectSessionBundle(sessionId: string): Promise<CollectorResult> {
  try {
    // 1. Load session
    const session = await sessionRepository.getById(sessionId);
    if (!session) return { success: false, error: `Session not found: ${sessionId}` };

    // 2. Load notes by sessionId
    const notes = await noteRepository.listBySession(sessionId);
    const noteIds = notes.map(n => n.id);

    // 3. Load encounters by sessionId
    const encounters = await encounterRepository.listBySession(sessionId);

    // 4. Load creature templates referenced by encounter participants
    const creatureIds = new Set(
      encounters
        .flatMap(e => e.participants)
        .map(p => p.linkedCreatureId)
        .filter((id): id is string => id !== undefined)
    );
    const creatureTemplates = (await Promise.all(
      [...creatureIds].map(id => creatureTemplateRepository.getById(id))
    )).filter((t): t is CreatureTemplate => t !== undefined);

    // 5. Load active party + party members
    const parties = await partyRepository.listBySession(sessionId); // or listByCampaign
    const partyMemberSets = await Promise.all(parties.map(p => partyMemberRepository.listByParty(p.id)));
    const partyMembers = partyMemberSets.flat();

    // 6. Load characters linked to party members
    const characterIds = new Set(partyMembers.map(pm => pm.characterId).filter(Boolean));
    const characters = (await Promise.all(
      [...characterIds].map(id => characterRepository.getById(id))
    )).filter((c): c is CharacterRecord => c !== undefined);

    // 7. Load entity links for notes + encounters
    const entityIds = [...noteIds, ...encounters.map(e => e.id)];
    const entityLinks = (await Promise.all(
      entityIds.map(id => entityLinkRepository.listByEntity('note', id, 'both'))
    )).flat();

    // 8. Load attachments for notes
    const attachments = (await Promise.all(
      noteIds.map(id => attachmentRepository.listByNote(id))
    )).flat();

    return {
      success: true,
      contents: {
        sessions: [session],
        notes,
        encounters,
        creatureTemplates,
        parties,
        partyMembers,
        characters,
        entityLinks,
        attachments,
      },
    };
  } catch (err) {
    console.error('[collectors] collectSessionBundle error', err);
    return { success: false, error: String(err) };
  }
}
```

### Step 5: Implement `collectCampaignBundle`

```typescript
export async function collectCampaignBundle(campaignId: string): Promise<CollectorResult> {
  try {
    // 1. Campaign
    const campaign = await campaignRepository.getById(campaignId);
    if (!campaign) return { success: false, error: `Campaign not found: ${campaignId}` };

    // 2. All sessions
    const sessions = await sessionRepository.listByCampaign(campaignId);
    const sessionIds = sessions.map(s => s.id);

    // 3. All notes (by campaign)
    const notes = await noteRepository.listByCampaign(campaignId);
    const noteIds = notes.map(n => n.id);

    // 4. All creature templates
    const creatureTemplates = await creatureTemplateRepository.listByCampaign(campaignId);

    // 5. All encounters
    const encounters = await encounterRepository.listByCampaign(campaignId);

    // 6. All parties + party members
    const parties = await partyRepository.listByCampaign(campaignId);
    const partyMemberSets = await Promise.all(parties.map(p => partyMemberRepository.listByParty(p.id)));
    const partyMembers = partyMemberSets.flat();

    // 7. All characters
    const characterIds = new Set(partyMembers.map(pm => pm.characterId).filter(Boolean));
    const characters = (await Promise.all(
      [...characterIds].map(id => characterRepository.getById(id))
    )).filter((c): c is CharacterRecord => c !== undefined);

    // 8. All entity links (for all notes + encounters)
    const entityIds = [...noteIds, ...encounters.map(e => e.id)];
    const entityLinks = (await Promise.all(
      entityIds.flatMap(id => [
        entityLinkRepository.listByEntity('note', id, 'both'),
        entityLinkRepository.listByEntity('encounter', id, 'both'),
      ])
    )).flat();

    // Deduplicate entity links by id
    const uniqueEntityLinks = [...new Map(entityLinks.map(l => [l.id, l])).values()];

    // 9. All attachments
    const attachments = (await Promise.all(
      noteIds.map(id => attachmentRepository.listByNote(id))
    )).flat();

    return {
      success: true,
      contents: {
        campaign,
        sessions,
        notes,
        creatureTemplates,
        encounters,
        parties,
        partyMembers,
        characters,
        entityLinks: uniqueEntityLinks,
        attachments,
      },
    };
  } catch (err) {
    console.error('[collectors] collectCampaignBundle error', err);
    return { success: false, error: String(err) };
  }
}
```

### Step 6: Adjust repository method names — MANDATORY

**The pseudocode above uses WRONG method names.** You MUST read the actual repository files and fix every call. Key corrections:
- `noteRepository.listBySession` → `getNotesBySession`
- `noteRepository.listByCampaign` → `getNotesByCampaign`
- `noteRepository.getById` → `getNoteById`
- `sessionRepository.getById` → `getSessionById`
- `sessionRepository.listByCampaign` → `getSessionsByCampaign`
- `campaignRepository.getById` → `getCampaignById`
- `entityLinkRepository.listByEntity(type, id, dir)` → call `getLinksFrom(id)` AND `getLinksTo(id)` separately, combine results
- `partyRepository.listBySession(sessionId)` → use `getPartyByCampaign(session.campaignId)` and wrap in array
- `partyMemberRepository.listByParty(id)` → `getPartyMembers(id)` from partyRepository
- `attachmentRepository.listByNote(id)` → `getAttachmentsByNote(id)`

---

## Verification Commands

```bash
npx tsc --noEmit
```

**Manual verification:**
- Call `collectCharacterBundle(characterId)` in DevTools console — verify returned `contents` contains character + linked notes + attachments.
- Call `collectSessionBundle(sessionId)` — verify encounters are included with correct `sessionId`.
- Call `collectCampaignBundle(campaignId)` — verify all entity types are present.

---

## Acceptance Criteria

- [ ] `collectCharacterBundle` includes notes linked to character via entity links (from OR to)
- [ ] `collectSessionBundle` includes encounters with matching `sessionId`
- [ ] `collectSessionBundle` includes creature templates referenced by those encounters' participants' `linkedCreatureId`
- [ ] `collectCampaignBundle` includes all creature templates and encounters for the campaign
- [ ] No collector throws — all errors caught and returned in result pattern
- [ ] Each collector returns a shape matching `bundleEnvelopeSchema.contents` (all fields optional)
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- No new npm dependencies
- No collector may throw — all errors must be caught and returned as `{ success: false, error: string }`
- Use only existing repository function names (do not invent new repository methods)
- Adjust all import paths to match actual file locations
- Deduplication of entity links required in campaign collector
