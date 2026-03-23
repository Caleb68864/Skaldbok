---
date: 2026-03-22
topic: "Sheet dashboard panels and magic preparation system"
author: Caleb Bennett
status: draft
tags:
  - design
  - sheet-dashboard-and-magic-system
---

# Sheet Dashboard Panels and Magic Preparation System -- Design

## Summary

Enhance the Sheet screen from a sparse attribute viewer into a configurable gameplay dashboard with pinned skills, prepared spells, equipped gear summary, and custom note cards. Simultaneously, upgrade the Magic screen with a full spell preparation system based on Dragonbane core rules (prepared spells limited by INT base chance, grimoire casting at double time, magic tricks always prepared). All Sheet panels are toggleable in Settings and drag-and-drop reorderable per character.

## Approach Selected

**Dashboard Panels** — discrete collapsible card sections added below existing Sheet content, with configurable visibility and drag-and-drop reordering. Chosen because it naturally extends the existing card-based layout pattern, gives each piece of info room to breathe, conditionally hides irrelevant sections, and works well on mobile.

## Architecture

The Sheet screen becomes a configurable dashboard with two tiers:

**Core panels (always visible):**
- Identity (portrait, name, kin, profession)
- Attributes (6 attrs with stepper controls)
- Conditions (6 toggles linked to attributes)
- Resources (HP/WP trackers)
- Derived Values (movement, damage bonus, etc.)

**Optional panels (toggleable, reorderable):**
- Equipped Gear — weapon name + damage, armor name + rating, metal warning
- Pinned Skills — user-selected 5-6 skills with values
- Prepared Spells — compact list with WP cost, grayed when insufficient WP or metal equipped
- Custom Note Cards — user-created freeform text cards

All panels wrapped in a `DraggableCardContainer` that enables long-press drag reordering in edit mode. Card order and visibility stored per-character in `uiState`.

Settings screen gets a new "Sheet Panels" section with toggles for each optional panel.

```
┌──────────────────────────────┐
│         TopBar (mode)        │
├──────────────────────────────┤
│  Identity Card               │  ← Always visible
│  Attributes Card             │  ← Always visible
│  Conditions Card             │  ← Always visible
│  Resources Card              │  ← Always visible
│  Derived Values Card         │  ← Always visible
│  ╔════════════════════════╗  │
│  ║ Equipped Gear          ║  │  ← Toggleable, reorderable
│  ║ Sword: D8 slash        ║  │
│  ║ Leather: AR 2          ║  │
│  ║ ⚠ Metal equipped!      ║  │     (conditional)
│  ╚════════════════════════╝  │
│  ╔════════════════════════╗  │
│  ║ Pinned Skills          ║  │  ← Toggleable, reorderable
│  ║ Awareness ····· 12     ║  │
│  ║ Sneaking ······  8     ║  │
│  ╚════════════════════════╝  │
│  ╔════════════════════════╗  │
│  ║ Prepared Spells 3/5    ║  │  ← Toggleable, reorderable
│  ║ Fireball      2 WP     ║  │     grayed if WP < cost
│  ║ Gust of Wind  2 WP     ║  │     blocked if metal equipped
│  ╚════════════════════════╝  │
│  ╔════════════════════════╗  │
│  ║ Custom Note Card       ║  │  ← User-created, reorderable
│  ║ (freeform text)        ║  │
│  ╚════════════════════════╝  │
├──────────────────────────────┤
│       BottomNav              │
└──────────────────────────────┘
```

## Components

### New Components

**1. EquippedGearPanel**
- Reads equipped weapons, armor, helmet from character data
- Displays: weapon name + damage die, armor name + armor rating, helmet name + AR
- Shows metal warning banner if any equipped item is metal AND character has spells
- Display only — equipment changes happen on Gear screen
- Tapping navigates to Gear screen

**2. PinnedSkillsPanel**
- Reads pinned skill IDs from `character.uiState.pinnedSkills: string[]`
- Looks up each skill's value and trained status from character data
- Displays: skill name + value, trained indicator
- In edit mode: shows a picker to add/remove pinned skills (max 6)
- Does NOT edit skill values — that's the Skills screen

**3. PreparedSpellsPanel**
- Reads spells where `prepared === true`
- Displays: "Prepared X/Y" header (Y = INT base chance), spell name + WP cost (base: 2 WP)
- Graying logic:
  - Dim/faded if `currentWP < spell.wpCost` (base cost)
  - Red/blocked if metal equipment is equipped (takes precedence over WP dimming)
- Tapping a spell navigates to Magic screen
- Auto-hides if character has zero spells

**4. CustomNoteCard**
- User-created card with `title` + `body` (plain text)
- Stored in `character.uiState.sheetCustomCards: { id, title, body }[]`
- In edit mode: add new card, edit title/body, delete card

**5. DraggableCardContainer**
- Wraps all Sheet panels (core + optional)
- In edit mode: enables long-press drag to reorder via drag handle icon
- Stores card order in `character.uiState.sheetCardOrder: string[]`
- Card keys: `'identity'`, `'attributes'`, `'conditions'`, `'resources'`, `'derived'`, `'gear'`, `'skills'`, `'spells'`, `'custom-{id}'`
- Cards not in order array appear at end (handles new cards gracefully)

### Modified Components / Types

**CharacterRecord type — new fields:**
- `spells[].prepared: boolean` — whether the spell is prepared (memorized)
- `spells[].rank: number` — spell rank (1-3), separate from power level
- `spells[].requirements: string[]` — casting requirements (Word, Gesture, Focus, Ingredient)
- `spells[].castingTime: 'action' | 'reaction' | 'ritual'` — casting time category
- `weapons[].metal: boolean` — whether the weapon is metal
- `armor.metal: boolean` / `helmet.metal: boolean` — whether armor/helmet is metal
- `uiState.pinnedSkills: string[]`
- `uiState.sheetCardOrder: string[]`
- `uiState.sheetCustomCards: { id: string, title: string, body: string }[]`
- `uiState.sheetPanelVisibility: Record<string, boolean>`

**MagicScreen — major enhancements:**
- Split view: "Prepared" vs "Grimoire" (all learned) tabs/filter
- "X/Y Prepared" counter in header (Y = INT base chance from `computeMaxPreparedSpells`)
- Toggle spell prepared status with limit enforcement
- Power level selector (1-3) on each spell card for casting — WP cost updates dynamically (powerLevel × 2)
- Magic tricks section: always available, 1 WP, auto-succeed, no power level selector
- Metal warning banner when metal gear equipped
- Reaction spells flagged as "must be prepared" (cannot cast from grimoire)

**derivedValues.ts — new function:**
- `computeMaxPreparedSpells(character)` → returns INT base chance (3-7)

**Settings screen — new section:**
- "Sheet Panels" with toggles for: Equipped Gear, Pinned Skills, Prepared Spells

## Data Flow

### Spell Preparation Flow

```
Magic Screen (edit mode)
  ├─ User taps "Prepare" on a learned spell
  │   ├─ preparedCount < maxPreparedSpells?
  │   │   ├─ Yes → spell.prepared = true → updateCharacter()
  │   │   └─ No → "Limit reached (X/Y). Unprepare a spell first."
  │   └─ Magic tricks always prepared (toggle hidden)
  ├─ User taps "Unprepare" on a prepared spell
  │   └─ spell.prepared = false → updateCharacter()
  └─ Changes flow through ActiveCharacterContext → autosave
      └─ Sheet's PreparedSpellsPanel reads updated spells
```

### Power Level Casting Flow (Magic Screen)

```
User selects spell to cast
  ├─ Power level stepper: 1 / 2 / 3
  ├─ WP cost display updates: powerLevel × 2
  ├─ Higher levels grayed if WP insufficient
  └─ Magic tricks: no power level selector, always 1 WP
```

### Pinned Skills Flow

```
Sheet (edit mode) → PinnedSkillsPanel
  ├─ Open skill picker (shows all system skills)
  ├─ Toggle pins (max 6 enforced)
  └─ updateCharacter({ uiState: { pinnedSkills: [...] } })
```

### Card Reordering Flow

```
Sheet (edit mode) → DraggableCardContainer
  ├─ User taps drag handle → drag mode
  ├─ Drag card to new position
  └─ updateCharacter({ uiState: { sheetCardOrder: [...] } })
```

### Metal Detection Flow

```
Utility: isMetalEquipped(character) → boolean
  ├─ Checks equipped weapons for metal === true
  ├─ Checks equipped armor/helmet for metal === true
  └─ Used by:
      ├─ PreparedSpellsPanel → all spells get "blocked" red styling
      ├─ EquippedGearPanel → shows warning banner
      └─ MagicScreen → shows warning banner
      (Only shown if character has spells)
```

## Error Handling

### Spell Preparation

| Scenario | Behavior |
|----------|----------|
| Preparing beyond limit | Button disabled + message: "X/Y prepared. Unprepare a spell first." |
| INT drops below prepared count | Warning: "You have X prepared but can only hold Y. Please unprepare Z spells." No auto-unprepare. |
| No spells learned | PreparedSpellsPanel hidden entirely |
| All spells are magic tricks | Panel shows tricks with note "Magic tricks are always prepared" — no X/Y counter |
| Character has spells but 0 WP | All spells dimmed (not blocked). Player may recover WP or use Power from Body. |
| Metal equipped + 0 WP | "Blocked" (metal) styling takes precedence over WP dimming |

### Pinned Skills

| Scenario | Behavior |
|----------|----------|
| Pinned skill ID no longer in system | Silently dropped from pinned list |
| No skills pinned | Edit mode: "Pin up to 6 skills for quick reference" |
| Skill value is 0 and untrained | Still shown if pinned |

### Card Ordering

| Scenario | Behavior |
|----------|----------|
| New panel appears (first spell learned) | Appended to end of card order |
| Panel toggled off | Stays in order array, not rendered. Toggling on restores position. |
| Custom card deleted | Removed from both order and custom cards arrays |
| Drag on small screens | Use drag handle icon, not long-press on whole card, to avoid scroll conflicts |

### Metal Detection

| Scenario | Behavior |
|----------|----------|
| No metal flag on existing items | Default `metal: false`. New items get the field in editor. |
| Character has no spells | Metal warning not shown even if metal equipped |

## Open Questions

1. **Spell `rank` vs `powerLevel`**: Core rules distinguish rank (spell complexity, 1-3) from power level (WP cost multiplier, chosen at cast time, 1-3). Current model has `powerLevel` as a static field. Recommendation: rename existing `powerLevel` to `rank`, and make power level a cast-time choice (not stored on the spell). Decision needed during implementation.

2. **Spell `requirements` and `castingTime` fields**: Worth adding now for completeness, or defer to a later pass? Adding now means the Spell editor UI needs more fields.

3. **Drag-and-drop library**: `@dnd-kit/core` is the standard React choice with good touch support. Confirm during implementation.

4. **Custom card content format**: Plain text only for now. Markdown support can be added later if users want it.

5. **Power from the Body UI**: The 0 WP state could offer a "Power from Body" action (roll die, gain WP, take HP damage). This is a gameplay action — belongs on Combat or Magic screen, not Sheet. Design separately if desired.

## Approaches Considered

**Approach A: Dashboard Panels (Selected)**
Discrete collapsible card sections below existing Sheet content. Each panel is its own card, toggleable in settings, drag-and-drop reorderable. Follows existing card-based layout pattern.

**Approach B: Smart Summary Strip**
Single dense summary strip near the top of the Sheet with all glance info in one horizontal/compact area. Rejected: too cramped for the amount of info needed, harder to scan individual sections on mobile.

**Approach C: Contextual Footer Cards**
Sticky cards near bottom above nav bar. Rejected: limited bottom real estate, could conflict with bottom nav, feels disconnected from character data.

## Next Steps

- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-22-sheet-dashboard-and-magic-system-design.md`)
- [ ] Decide on spell rank vs powerLevel field naming during spec writing
- [ ] Update project memory with spell preparation mechanics for future reference
