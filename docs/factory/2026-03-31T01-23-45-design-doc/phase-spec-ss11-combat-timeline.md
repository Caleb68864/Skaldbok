# Phase Spec — SS-11: Combat Event Timeline in Session Tab (Phase 4)

```yaml
sub-spec: SS-11
title: Combat Event Timeline
stage: 2
priority: P1
score: 87
depends-on: SS-02, SS-03, SS-04, SS-07, SS-08
run: 2026-03-31T01-23-45-design-doc
```

> **Dependency Order:** Requires **SS-02** (Dexie schema — combat note type), **SS-03** (CampaignContext — active session), **SS-04** (useNoteActions — createNote for combat type), **SS-07** (Session Tab — the combat UI lives here), and **SS-08** (Party Model — spell picker reads party members and active character abilities). Can be implemented after SS-07 and SS-08 are complete.

---

## Intent

Add a combat event journal to the Session tab so the DM can log events by round without managing mechanical state. Events are captured fast; rules are NOT enforced.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-S11-01 | "Start Combat" button appears in Session tab when a session is active. Tapping it creates a `combat`-type note and auto-links it to the session. |
| AC-S11-02 | Combat view shows: current round number; event log (agent chooses chronological or reverse chronological); "Next Round" button. |
| AC-S11-03 | Event types available as tap targets (no typing required for type): `attack`, `spell`, `ability`, `damage`, `heal`, `condition`, `note`. Each event type has a distinct chip/button in the event entry row. |
| AC-S11-04 | "Next Round" increments round counter and inserts a round-separator event in the log. |
| AC-S11-05 | Heroic ability picker: shows abilities from the active character's sheet; tapping an ability logs an ability event for that character. |
| AC-S11-06 | Spell picker: shows all known spells from party members, grouped by character; remaining WP shown next to each character's spells; spells that would exceed remaining WP are dimmed but still visible; tapping a spell logs a spell event; WP is **NOT** auto-deducted (no rule enforcement); "Quick-add spell not on sheet" option available. |
| AC-S11-07 | Combat note is stored in Dexie as a note with `type: "combat"`. `typeData` contains: `{ rounds: [...], participants: [...] }`. |
| AC-S11-08 | No TypeScript errors in combat timeline component files. |

---

## Implementation Steps

### 1. Define combat typeData shape

In `src/types/note.ts` (from SS-02), ensure the `combat` variant of `noteSchema` has:

```ts
z.object({
  type: z.literal('combat'),
  typeData: z.object({
    rounds: z.array(z.object({
      roundNumber: z.number(),
      events: z.array(combatEventSchema),
    })),
    participants: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['character', 'npc', 'monster']),
      linkedCharacterId: z.string().optional(),
    })),
  }),
})
```

Define `combatEventSchema`:
```ts
const combatEventSchema = z.object({
  id: z.string(),
  type: z.enum(['attack', 'spell', 'ability', 'damage', 'heal', 'condition', 'note', 'round-separator']),
  actorId: z.string().optional(),
  actorName: z.string().optional(),
  targetName: z.string().optional(),
  label: z.string(),           // e.g. "Sir Talos attacks", "Fireball", "Blinded"
  value: z.string().optional(), // e.g. damage amount (free text, no enforcement)
  timestamp: z.string(),
});
```

Export `CombatEvent` and `CombatTypeData` types.

### 2. Add "Start Combat" to `SessionScreen.tsx`

When `activeSession` is not null and no active combat note exists:

```tsx
<button
  onClick={handleStartCombat}
  style={{ minHeight: 44, minWidth: 44 }}
>
  ⚔️ Start Combat
</button>
```

```ts
const handleStartCombat = async () => {
  // Create a combat note linked to active session
  await createNote({
    title: `Combat — Round 1`,
    type: 'combat',
    body: null,
    pinned: false,
    status: 'active',
    typeData: { rounds: [{ roundNumber: 1, events: [] }], participants: [] },
  });
  setShowCombatView(true);
};
```

### 3. Create `src/features/combat/CombatTimeline.tsx`

The main combat view component, displayed as a section of the Session tab or as a full-screen overlay when combat is active.

#### Props:
```ts
export interface CombatTimelineProps {
  combatNoteId: string;
  onClose: () => void;
}
```

#### Internal state (synced to Dexie on every change):

```ts
const [rounds, setRounds] = React.useState<CombatRound[]>([]);
const [currentRound, setCurrentRound] = React.useState(1);
```

#### Layout:
```
[Combat — Round {N}]                [✕ End Combat]
─────────────────────────────
[Next Round]
─────────────────────────────
Quick Event:
[Attack] [Spell] [Ability] [Damage] [Heal] [Condition] [Note]
─────────────────────────────
Event Log (reverse chronological):
  Round 2 ────────────────
  Sir Talos: attack → Orc Warrior
  Round 1 ────────────────
  Fireball (Sir Talos)
  Combat started
─────────────────────────────
```

#### Tap any event type chip → opens a mini event form (AC-S11-03):

For most types, a simple one-line form:
- Actor name (optional — prefill from active character)
- Target name (optional text input — no typing required if left blank)
- Label (prefilled with event type name)

For `spell` type: opens Spell Picker (step 5).
For `ability` type: opens Ability Picker (step 4).

#### "Next Round" handler:
```ts
const handleNextRound = async () => {
  const newRoundNumber = currentRound + 1;
  // Insert round-separator event in current round
  const separator: CombatEvent = {
    id: generateId(),
    type: 'round-separator',
    label: `--- Round ${newRoundNumber} begins ---`,
    timestamp: nowISO(),
  };
  // Start new round
  const newRound = { roundNumber: newRoundNumber, events: [] };
  const updatedRounds = [...rounds, newRound];
  setRounds(updatedRounds);
  setCurrentRound(newRoundNumber);
  // Persist to Dexie
  await updateCombatNote(updatedRounds);
};
```

#### Persist helper:
```ts
const updateCombatNote = async (updatedRounds: CombatRound[]) => {
  await noteRepository.updateNote(combatNoteId, {
    typeData: { rounds: updatedRounds, participants },
    title: `Combat — Round ${currentRound}`,
  });
};
```

### 4. Create Ability Picker (AC-S11-05)

**File:** `src/features/combat/AbilityPicker.tsx`

```tsx
export function AbilityPicker({ onSelect }: { onSelect: (abilityName: string) => void }) {
  // Read active character from AppStateContext.activeCharacterId
  // Fetch character from Dexie
  // Read character.abilities or character.heroicAbilities
  // Render as a list of tappable buttons
  return (
    <div>
      {abilities.map(ability => (
        <button
          key={ability.name}
          onClick={() => onSelect(ability.name)}
          style={{ minHeight: 44, width: '100%' }}
        >
          {ability.name}
        </button>
      ))}
    </div>
  );
}
```

- Uses existing character data schema (check `src/types/` for character type)
- Tapping logs an `ability` event: `{ type: 'ability', label: abilityName, actorName: activeCharacter.name, ... }`

### 5. Create Spell Picker (AC-S11-06)

**File:** `src/features/combat/SpellPicker.tsx`

```tsx
export function SpellPicker({ onSelect }: { onSelect: (spellName: string, characterName: string) => void }) {
  // Read party members from CampaignContext.activeParty
  // For each member with linkedCharacterId, fetch character from Dexie
  // Group spells by character
  // Show remaining WP next to each character's spells
  // Dim (opacity: 0.4) spells that would cost more than remaining WP
  //   BUT still render them (no enforcement — user can still tap)

  return (
    <div>
      {partyMembersWithSpells.map(({ member, character, spells, remainingWP }) => (
        <div key={member.id}>
          <h4>{character.name} — WP: {remainingWP}</h4>
          {spells.map(spell => (
            <button
              key={spell.name}
              onClick={() => onSelect(spell.name, character.name)}
              style={{
                minHeight: 44, width: '100%',
                opacity: spell.wpCost > remainingWP ? 0.4 : 1,
              }}
            >
              {spell.name} ({spell.wpCost} WP)
            </button>
          ))}
        </div>
      ))}
      {/* Quick-add spell not on sheet */}
      <QuickAddSpell onAdd={(spellName) => onSelect(spellName, 'Unknown')} />
    </div>
  );
}
```

- WP is **read only** — never deducted (AC-S11-06: no rule enforcement)
- "Quick-add spell not on sheet": a text input for spell name, tapping "Add" logs the spell event

### 6. End Combat

- "End Combat" button in `CombatTimeline`:
  - Sets combat note `status: 'archived'` or adds a final event `{ type: 'note', label: 'Combat ended' }`
  - Calls `onClose()`
  - Session tab returns to normal session view
  - "Start Combat" button reappears (no active combat note)

### 7. Track "active combat note" in Session tab

In `SessionScreen.tsx`:
- After session hydration, check if any `combat`-type note is linked to the session with `status: 'active'`
- If yes: render `CombatTimeline` (or show "Resume Combat" button)
- If no: show "Start Combat" button

---

## Verification Commands

```
# TypeScript check
npx tsc --noEmit

# Manual flow verification (AC-S11-01 through AC-S11-08):
# 1. Start session → "Start Combat" button appears
# 2. Tap "Start Combat" → combat note created in IndexedDB (type: "combat")
# 3. Combat view shows Round 1, event log empty
# 4. Tap [Attack] chip → event entry form opens, optionally fill names → confirm
#    → attack event appears in log
# 5. Tap [Spell] → spell picker opens, shows party members grouped with WP
# 6. Tap a spell that costs more than WP → still tappable, dimmed, logs event (WP unchanged)
# 7. Tap [Next Round] → round counter increments to 2, round separator in log
# 8. Tap [Ability] → ability picker shows active character's abilities
# 9. End Combat → combat note status updated, session tab returns to normal
# 10. Reload app → combat note persists in IndexedDB with correct typeData.rounds structure
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Create** | `src/features/combat/CombatTimeline.tsx` |
| **Create** | `src/features/combat/AbilityPicker.tsx` |
| **Create** | `src/features/combat/SpellPicker.tsx` |
| **Modify** | `src/screens/SessionScreen.tsx` — add "Start Combat" button + active combat detection |
| **Modify** | `src/types/note.ts` — ensure `CombatEvent` and `CombatTypeData` schemas are fully defined |

---

## Cross-Cutting Constraints (apply to this sub-spec)

- `XC-01` Zero TypeScript errors
- `XC-02` All new IDs use `generateId()`; timestamps use `nowISO()`
- `XC-03` Inline `style={{}}` with CSS variables
- `XC-04` Named exports only
- `XC-05` Any new hooks return `{ fn1, fn2 }` — no array returns
- `XC-06` `showToast()` for user-facing errors
- **No rule enforcement**: WP is never auto-deducted; no hit/miss calculation; no spell validation
