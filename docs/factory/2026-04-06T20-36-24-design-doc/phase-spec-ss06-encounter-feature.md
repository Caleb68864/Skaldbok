# Phase Spec — SS-06: Encounter Feature

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 1.3 — Feature A: Encounter Feature
**Depends on:** SS-04 (repositories), SS-02 (Zod schemas), SS-03 (entity link types) must be completed first.
**Delivery order note:** Step 6 in execution sequence. SS-07 (Combat timeline) builds on this.

---

## Objective

Build encounter creation, participant management, note auto-linking, and rendering for combat, social, and exploration encounter types. Users must be able to start encounters from the session screen, add participants from the bestiary or party, quick-create participants, and record stats in ≤ 3 taps.

---

## Files to Create

- `src/features/encounters/EncounterListItem.tsx` — **create new**
- `src/features/encounters/EncounterScreen.tsx` — **create new**
- `src/features/encounters/ParticipantDrawer.tsx` — **create new**
- `src/features/encounters/QuickCreateParticipantFlow.tsx` — **create new**
- `src/features/encounters/useEncounter.ts` — **create new**
- `src/features/encounters/useEncounterList.ts` — **create new**

## Files to Modify

- Session screen (`src/screens/SessionScreen.tsx` or similar) — add encounter entry points, encounter history list, end-session prompt

---

## Implementation Steps

### Step 1: Inspect existing patterns

Before writing, inspect:
- Session screen to understand layout, active session state, and how notes are attached
- `entityLinkRepository.ts` to confirm the `create` function signature
- Note creation flow to understand where auto-linking hooks can be added
- Existing drawer/sheet components (shadcn/ui `Sheet` or `Drawer`)

### Step 2: Implement `useEncounterList.ts`

```typescript
// Lists encounters for a given session; tracks active encounter
export function useEncounterList(sessionId: string) {
  // Load encounters via encounterRepository.listBySession(sessionId)
  // Derive: activeEncounter = encounters.find(e => e.status === 'active') ?? null
  // Return: { encounters, activeEncounter, refresh }
}
```

### Step 3: Implement `useEncounter.ts`

```typescript
export function useEncounter(encounterId: string | null, sessionId: string, campaignId: string) {
  // State: encounter, participants, linkedNotes
  // Load encounter from repository
  // Load linked notes via entityLinkRepository.listByEntity('encounter', encounterId)
  //   → resolve note IDs → load notes

  const startEncounter = async (type: 'combat' | 'social' | 'exploration', title: string) => {
    // encounterRepository.create({ sessionId, campaignId, type, title, status: 'active', ... })
    // Set new encounter as current
  };

  const endEncounter = async () => {
    // encounterRepository.end(encounterId)
  };

  const addParticipantFromTemplate = async (templateId: string) => {
    // Load template from creatureTemplateRepository.getById(templateId)
    // encounterRepository.addParticipant(encounterId, {
    //   name: template.name, type: 'npc'|'monster', linkedCreatureId: templateId,
    //   instanceState: { currentHp: template.stats.hp }, sortOrder: next
    // })
  };

  const addParticipantFromCharacter = async (characterId: string) => {
    // Load character name
    // encounterRepository.addParticipant(encounterId, {
    //   name, type: 'pc', linkedCharacterId: characterId,
    //   instanceState: {}, sortOrder: next
    // })
  };

  const quickCreateParticipant = async (name: string, stats: Partial<...>) => {
    // If name matches existing template → prompt handled in QuickCreateParticipantFlow
    // Create CreatureTemplate via creatureTemplateRepository.create(...)
    // Add participant linked to new template
  };

  const updateParticipantState = async (participantId: string, patch: Partial<EncounterParticipant['instanceState']>) => {
    // encounterRepository.updateParticipant(encounterId, participantId, { instanceState: { ...existing, ...patch } })
  };

  return { encounter, participants, linkedNotes, startEncounter, endEncounter,
           addParticipantFromTemplate, addParticipantFromCharacter,
           quickCreateParticipant, updateParticipantState };
}
```

### Step 4: Note Auto-Linking

When a note is created while an encounter is active for the session, automatically create an entity link. Locate the note creation flow (`useNoteActions.ts` or equivalent) and add:

```typescript
// After note is created:
if (activeEncounterId) {
  await entityLinkRepository.create({
    fromEntityType: 'encounter',
    fromEntityId: activeEncounterId,
    toEntityType: 'note',
    toEntityId: noteId,
    relationshipType: 'contains',
  });
}
```

The active encounter ID must be available in the note creation context (pass via context, prop, or look up from `useEncounterList`).

### Step 5: Implement `ParticipantDrawer.tsx`

A bottom sheet / drawer (shadcn/ui `Sheet`) that opens when a participant row is tapped.

Layout:
- Header: participant name + type badge
- Template stats section (read-only): HP base, Armor, Movement, Attacks list, Abilities list
- Instance state section (editable):
  - Current HP (number input — auto-saves on blur or Enter)
  - Conditions (tag-style multi-select or text chips)
  - Notes (text area — auto-saves)
- Close button

**Tap-to-record flow (≤ 3 taps):**
1. Tap participant row (tap 1) → drawer opens
2. Tap stat field e.g. "Current HP" input (tap 2) → field focused
3. Type value → auto-save on blur (tap 3 = done / close)

### Step 6: Implement `QuickCreateParticipantFlow.tsx`

An inline form (bottom sheet or modal):
1. Name input (required)
2. HP, Armor, Movement (number inputs, optional)
3. "Add" button

On submit:
- Check if a template with the same name exists for this campaign
- If match found: show prompt — "Link to existing '[name]' or create new?"
  - Link → `addParticipantFromTemplate(existingTemplateId)`
  - Create new → create template + participant
- If no match: create template + participant directly

### Step 7: Implement `EncounterScreen.tsx`

Renders the active encounter or a past encounter:
- **Header:** Encounter title, type badge, status, start/end time
- **Participant list:** rows (tappable → `ParticipantDrawer`); sorted by `sortOrder`
- **Add participant button:** opens search (bestiary templates) + "From party" + "Quick create"
- **Notes feed:** linked notes displayed below participants (social/exploration encounters)
- **Combat type:** renders `CombatEncounterView` (SS-07) — do NOT implement combat logic here
- **"End Encounter" button:** calls `endEncounter()`; confirm dialog

### Step 8: Implement `EncounterListItem.tsx`

A compact list-item row showing:
- Encounter title
- Type badge
- Status badge (active / ended)
- Start time
- Participant count
- Tap → navigate to `EncounterScreen`

### Step 9: Wire session screen

Add to session screen:
- "Start Encounter" button → shows type picker (combat / social / exploration) + title input → calls `startEncounter`
- Encounter history section → list of `EncounterListItem` for session
- On "End Session": prompt "There is an active encounter. End it now or carry over?"
  - End → `encounterRepository.end(activeEncounterId)`
  - Carry over → leave encounter `status: 'active'`

---

## Verification Commands

```bash
npx tsc --noEmit
npm run build
```

**Manual verification:**
- Start a social encounter from session screen — verify it appears in encounter history.
- Add participant from bestiary — verify participant appears in list.
- Add participant from party — verify participant appears as `type: 'pc'`.
- Quick-create participant — verify template created + participant linked.
- Tap participant row — drawer opens, stats visible.
- Edit "Current HP" in drawer — saves without closing; tap done/close (≤ 3 taps total from list).
- Create a note while encounter is active — verify entity link created in IndexedDB.
- Linked notes appear in encounter notes feed.
- End encounter — `status: 'ended'`, `endedAt` set; encounter appears in past encounters list.
- End session with active encounter — prompt appears.

---

## Acceptance Criteria

- [ ] User can start encounter (combat/social/exploration) from session screen with title
- [ ] User can add participant from bestiary by searching templates
- [ ] User can add participant from current party (PCs)
- [ ] User can quick-create participant — creates template + participant in ≤ 3 taps
- [ ] Tapping participant opens stat drawer: template stats (read-only) + instance state (editable)
- [ ] Recording armor via stat drawer completes in ≤ 3 taps
- [ ] Notes created while encounter is active are auto-linked to that encounter via entity links
- [ ] Linked notes appear in encounter's notes feed
- [ ] Social/exploration encounters show participant list + linked notes feed
- [ ] Ending encounter sets `status: 'ended'` and `endedAt` timestamp
- [ ] Past encounters browsable from session screen with participants and notes
- [ ] Session end prompts to end active encounters or carry them over
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- No new npm dependencies
- Use existing UI components (shadcn/ui, Tailwind v4, Lucide icons)
- Combat encounter rendering delegated entirely to `CombatEncounterView` (SS-07) — do not re-implement
- Note auto-linking must use `entityLinkRepository.create` with exact field names specified
- `quickCreateParticipant` must check for existing template name match before creating new
- Auto-save on stat input blur (not on every keystroke)
