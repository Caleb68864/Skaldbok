# Phase Spec — SS-08: Party Model & Member Management (Phase 2)

```yaml
sub-spec: SS-08
title: Party Model & Member Management
stage: 2
priority: P1
score: 89
depends-on: SS-02, SS-03, SS-04, SS-07
run: 2026-03-31T01-23-45-design-doc
```

> **Dependency Order:** Requires **SS-02** (Dexie v3 schema + Party/PartyMember types), **SS-03** (CampaignContext — `activeParty`), **SS-04** (party repository), and **SS-07** (active campaign lifecycle) to be complete first. SS-09 (Notes Hub — spell picker uses party members) benefits from this being complete, but SS-09 can proceed without it if needed.

---

## Intent

Associate characters with a campaign via a party, and identify which character the user is playing in the active session.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-S8-01 | A campaign has one party (created automatically when the campaign is created, or on first member add). |
| AC-S8-02 | User can add an existing character to the campaign party from a "Manage Party" screen/drawer. `partyMember` record is created with `linkedCharacterId` set. |
| AC-S8-03 | User can remove a character from the party. `partyMember` record is deleted. Character record is **NOT** deleted. |
| AC-S8-04 | `CampaignContext.activeParty` reflects the current party members. Party member list is readable from any tab. |
| AC-S8-05 | User can designate which party member is "my character" for the active campaign (`activeCharacterInCampaign`). This is stored in the party or campaign record (not in `AppStateContext`). |
| AC-S8-06 | Character tab continues to work independently of party status. A character not in any party is fully editable. |
| AC-S8-07 | No TypeScript errors in Party screen and repository files. |

---

## Implementation Steps

### 1. Auto-create party on campaign creation

**In `src/features/campaign/CampaignCreateModal.tsx`** (from SS-07):
- After `campaignRepository.createCampaign(...)` succeeds:
  - Call `partyRepository.createParty({ campaignId: newCampaign.id, name: `${newCampaign.name} Party` })`
  - Store `partyId` in campaign record: `campaignRepository.updateCampaign(newCampaign.id, { activePartyId: newParty.id })`

Or alternatively, create the party lazily on first member add (see step 3).

> **Decision for implementor:** Auto-create on campaign creation is simpler and avoids null-checks. Prefer this approach.

### 2. Create `src/features/campaign/ManagePartyDrawer.tsx`

A drawer or screen for managing party members.

#### Layout:

```
[Manage Party]
─────────────────────────────
Current Members:
  • Character A          [Remove]
  • Character B          [Remove]
─────────────────────────────
Add Character:
  [Character picker — lists all characters not already in party]
─────────────────────────────
My Character:
  [Dropdown or radio — pick from current members]
```

#### Actions:

**Add character:**
```ts
const handleAddMember = async (characterId: string) => {
  // Ensure party exists for this campaign
  let party = activeParty;
  if (!party) {
    party = await partyRepository.createParty({ campaignId: activeCampaign.id, name: `${activeCampaign.name} Party` });
    // Update campaign.activePartyId
  }
  await partyRepository.addPartyMember({
    partyId: party.id,
    linkedCharacterId: characterId,
    isActivePlayer: false,
  });
  // Refresh activeParty in CampaignContext (re-call setActiveCampaign or expose a refreshParty action)
};
```

**Remove character:**
```ts
const handleRemoveMember = async (memberId: string) => {
  await partyRepository.removePartyMember(memberId);
  // Refresh activeParty in CampaignContext
};
```

**Set "my character":**
```ts
const handleSetMyCharacter = async (memberId: string) => {
  // Update all party members: isActivePlayer = false
  // Update selected member: isActivePlayer = true
  // OR: store activeCharacterInCampaign as partyMember.id in campaign record
};
```

> Store "my character" as `campaign.activeCharacterMemberId` (a field on the campaign record) — NOT in `AppStateContext`.

### 3. Character picker in ManagePartyDrawer

- Query all characters from the existing `characters` Dexie table (use existing character repository pattern)
- Filter out characters already in the party (`activeParty?.members?.map(m => m.linkedCharacterId)`)
- Display as a scrollable list; each item tappable (≥ 44×44 px)

### 4. "Manage Party" access point

- Add a "Manage Party" entry in the **More** tab (from SS-01 bottom nav)
  - OR: add to Session tab as a contextual action when a campaign is active
- When tapped, opens `ManagePartyDrawer`

### 5. Update `CampaignContext` for party refresh (SS-03 extension)

Add a `refreshParty()` action to `CampaignContext` (or extend `setActiveCampaign` to re-fetch party):
```ts
const refreshParty = async () => {
  if (!activeCampaign) return;
  const party = await partyRepository.getPartyByCampaign(activeCampaign.id);
  const members = party ? await partyRepository.getPartyMembers(party.id) : [];
  setActiveParty(party ? { ...party, members } : null);
};
```

Export `refreshParty` from `CampaignContextValue`.

### 6. Verify Character tab independence (AC-S8-06)

- Character tab (`/character/sheet` etc.) must not depend on `activeParty` being non-null
- All character screens use `AppStateContext.activeCharacterId` which is independent
- Confirm no character screen imports `useCampaignContext` in a way that breaks when `activeParty` is null

---

## Verification Commands

```
# TypeScript check
npx tsc --noEmit

# Manual flow verification:
# 1. Create campaign → party is auto-created in IndexedDB (parties table)
# 2. Open "Manage Party" drawer
# 3. Add Character A → partyMembers table shows new record with linkedCharacterId
# 4. Remove Character A → partyMember record deleted; character record intact in characters table
# 5. Add Character B, set as "My Character" → isActivePlayer = true in DB (or campaign.activeCharacterMemberId set)
# 6. Open Character tab → renders without error regardless of party state
# 7. CampaignContext.activeParty reflects current members after add/remove
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Create** | `src/features/campaign/ManagePartyDrawer.tsx` |
| **Modify** | `src/features/campaign/CampaignCreateModal.tsx` — auto-create party on campaign creation |
| **Modify** | `src/features/campaign/CampaignContext.tsx` — add `refreshParty()` action |
| **Modify** | `src/types/campaign.ts` — add `activeCharacterMemberId?: string` field to Campaign type |
| **Modify** | Router/More tab — add "Manage Party" navigation entry |

---

## Cross-Cutting Constraints (apply to this sub-spec)

- `XC-01` Zero TypeScript errors
- `XC-02` All new IDs use `generateId()`; timestamps use `nowISO()`
- `XC-03` Inline `style={{}}` with CSS variables
- `XC-04` Named exports only
- `XC-05` Any new hooks return `{ fn1, fn2 }` — no array returns
- `XC-06` `showToast()` for user-facing errors
