---
date: 2026-03-22
topic: "Combat dashboard and martial character enhancements"
author: Caleb Bennett
status: draft
tags:
  - design
  - combat-dashboard-and-martial-enhancements
---

# Combat Dashboard and Martial Character Enhancements -- Design

## Summary

Transform the Combat screen from a basic resource tracker into a purpose-built combat dashboard for fighters, knights, and other martial characters. Adds enhanced weapon modeling (STR requirements, damage types, durability/damaged tracking, shields as first-class items), interactive heroic ability activation with WP deduction, and reorderable/toggleable panels using the same DraggableCardContainer system as the Sheet screen. The Combat screen becomes the fighter's power screen — the martial equivalent of what the Magic screen is for mages.

## Approach Selected

**Blend of Dashboard + Enhanced Panels** — Purpose-built combat panels with information hierarchy (resources → weapons → abilities → status), using the reorderable/toggleable card system from the Sheet dashboard design. No initiative tracking. Chosen because it delivers a combat companion that feels like a game tool while maintaining UI consistency with the Sheet's panel system.

## Architecture

All panels are reorderable via drag-and-drop (same DraggableCardContainer as Sheet) and toggleable in Settings. Panel order stored per-character in `uiState.combatCardOrder`.

```
┌──────────────────────────────┐
│         TopBar (mode)        │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ Resources (HP/WP bars) │  │  Core panel
│  │ HP: ████████░░ 8/10    │  │
│  │ WP: ████░░░░░░ 4/10    │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Weapon Rack            │  │  Enhanced panel
│  │ ┌──────────────────┐   │  │
│  │ │ Broadsword   ⚔   │   │  │  Active weapon highlighted
│  │ │ D8 slash +D4 STR │   │  │  Damage + bonus combined
│  │ │ Dur: 12  ✓ OK    │   │  │  Durability + damaged state
│  │ │ STR 13 req ✓     │   │  │  Requirement check
│  │ └──────────────────┘   │  │
│  │ ┌──────────────────┐   │  │
│  │ │ Shield      🛡   │   │  │  Shield as its own card
│  │ │ Dur: 8  ✓ OK     │   │  │
│  │ └──────────────────┘   │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Heroic Abilities       │  │  Interactive panel
│  │ ┌──────────────────┐   │  │
│  │ │ Defensive  3 WP  │   │  │  Tap to activate
│  │ │ [Activate]       │   │  │  Auto-deducts WP
│  │ └──────────────────┘   │  │
│  │ ┌──────────────────┐   │  │
│  │ │ Guardian   2 WP  │   │  │  Grayed if WP < cost
│  │ │ [Activate]       │   │  │
│  │ └──────────────────┘   │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Conditions             │  │  Existing, reorderable
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Death Rolls            │  │  Existing, reorderable
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Rest & Recovery        │  │  Existing, reorderable
│  └────────────────────────┘  │
├──────────────────────────────┤
│       BottomNav              │
└──────────────────────────────┘
```

## Components

### New Components

**1. WeaponRackPanel**
- Reads all equipped weapons from character data
- For each weapon, displays a rich card:
  - Name + weapon type icon
  - Damage dice + damage bonus combined (e.g., "D8 + D4") — bonus from STR (melee) or AGL (ranged)
  - Grip (1H/2H), Range
  - Damage type badge (bludgeoning/slashing/piercing) — only if set
  - Durability rating + damaged status (green checkmark vs red "DAMAGED" badge) — only if durability set
  - STR requirement check: green if met, yellow "Bane" if below req, red "Cannot use" if below half
  - Features (Long, Subtle, etc.)
- Shield shown as its own sub-card within the rack
- In play mode: "Mark Damaged" / "Repair" buttons for quick durability tracking
- Does NOT own: weapon CRUD (Gear screen), equip/unequip (Gear screen)

**2. HeroicAbilityPanel**
- Reads heroic abilities from character data
- Displays each ability as an action card:
  - Name + WP cost
  - One-line effect summary
  - "Activate" button → deducts WP from character resources
  - Grayed out if `currentWP < ability.wpCost`
  - Skill requirement status badge (green/red based on character's skill value)
- Confirmation when requirements not met: "Requirement not met. Activate anyway?"
- In edit mode: add/edit/delete abilities (same drawer as Magic screen)
- Does NOT own: WP display (Resources panel)

**3. ShieldCard** (sub-component of WeaponRackPanel)
- Distinct from armor — a shield is for parrying
- Shows: name, durability, damaged status
- Shield Block heroic ability note if relevant

### Modified Types

**Weapon type — new fields:**
```typescript
damageType: 'bludgeoning' | 'slashing' | 'piercing' | null  // optional damage type
strRequirement: number | null    // minimum STR to use without penalty
damaged: boolean                 // broken from parrying, needs CRAFTING repair
isShield: boolean                // distinguishes shields from weapons
```

**HeroicAbility type — enhanced fields:**
```typescript
wpCost: number                   // WP cost to activate
requirement: string | null       // human-readable requirement description
requirementSkillId: string | null    // skill ID for automatic checking
requirementSkillLevel: number | null // minimum level needed (usually 12)
```

**ArmorPiece type — new field:**
```typescript
metal: boolean    // for magic/metal warning (shared with mage design)
```

### Shared Components

- **DraggableCardContainer** — reused from Sheet design (same component, different order arrays)
- **CombatResourcePanel** — existing, no changes
- **QuickConditionPanel** — existing, no changes

### Settings

New "Combat Panels" section:
- Toggle: Weapon Rack, Heroic Abilities, Conditions, Death Rolls, Rest & Recovery
- Card order stored per-character in `uiState.combatCardOrder: string[]`

## Data Flow

### Heroic Ability Activation

```
Combat Screen → HeroicAbilityPanel
  ├─ User taps "Activate"
  │   ├─ currentWP >= wpCost? → deduct WP, show toast: "Activated {name}! (-{cost} WP)"
  │   └─ currentWP < wpCost → button disabled (grayed)
  ├─ Skill requirement check:
  │   ├─ Met → activate button enabled
  │   └─ Not met → warning badge, confirm dialog: "Activate anyway?"
  └─ Changes flow through ActiveCharacterContext → autosave
```

### Weapon Durability / Damage

```
Combat Screen → WeaponRackPanel (play mode)
  ├─ "Mark Damaged" → weapon.damaged = true → red "DAMAGED" badge
  ├─ "Repair" → weapon.damaged = false → normal state
  └─ Changes persist through autosave
```

### STR Requirement Check

```
WeaponRackPanel reads:
  ├─ weapon.strRequirement + character.attributes['str']
  ├─ STR >= requirement → green checkmark
  ├─ STR < requirement, >= half → yellow "Bane on attacks & parries"
  └─ STR < half requirement → red "Cannot use"
```

### Damage Bonus Calculation

```
WeaponRackPanel:
  ├─ Melee weapon → computeDamageBonus(character) [STR-based]
  ├─ Ranged weapon → computeAGLDamageBonus(character) [AGL-based]
  └─ Display combined: "{weapon.damage} + {damageBonus}" (e.g., "D8 + D4")
```

### Panel Reordering

```
Same as Sheet: DraggableCardContainer
  ├─ Edit mode → drag handle visible
  ├─ Long-press + drag to reorder
  └─ updateCharacter({ uiState: { combatCardOrder: [...] } })
```

## Error Handling

### Heroic Abilities

| Scenario | Behavior |
|----------|----------|
| No heroic abilities | Empty state: "No heroic abilities. Add them in edit mode." |
| WP at 0 | All abilities with WP cost > 0 grayed out. Passive abilities (Robust, Focused) shown normally. |
| Skill requirement not met | Warning badge + confirmation dialog. Button still tappable for override. |
| Multiple activations same round | No restriction — Dragonbane allows combining multiple abilities. |
| WP would go below 0 | Button disabled when WP < cost. |

### Weapon Rack

| Scenario | Behavior |
|----------|----------|
| No weapons equipped | "No weapons equipped. Equip weapons on the Gear screen." with tap-to-navigate. |
| All weapons damaged | All shown with red "DAMAGED" badges. |
| No STR requirement set | Skip STR check display for that weapon. |
| No damage type set | Don't show damage type badge. |
| No durability value | Don't show durability section. |
| Shield equipped | Shown as own card, not in armor section. |

### Panel System

| Scenario | Behavior |
|----------|----------|
| Default visibility | Resources ON, Weapon Rack ON, Heroic Abilities ON (if any exist), Death Rolls ON, Conditions ON, Rest & Recovery ON in play mode. |
| DraggableCardContainer shared | Same component as Sheet, different card order array (`combatCardOrder`). |

## Open Questions

1. **Heroic ability reference data**: Should we pre-populate a reference list of all Dragonbane heroic abilities (like system.json has skills), or let users enter everything manually? Reference list = less typing but more data to maintain.

2. **Shield modeling**: Separate field on `CharacterRecord` (like `armor`/`helmet`) vs. `isShield` flag in `weapons` array? Separate field is cleaner for display; flag is simpler data-model-wise.

3. **Damage type as optional rule**: Behind a setting toggle, or always available with a nullable field? Current lean: nullable field, always available, no toggle needed.

4. **Heroic abilities location**: Currently on Magic screen. Should they move to Combat, stay on Magic too, or get their own tab? Most are combat-focused but some (Pathfinder, Lone Wolf) are exploration utilities.

5. **Weapon editor expansion**: Gear screen's Weapon editor needs new fields (STR requirement, damage type, damaged, isShield). Consider whether to show these conditionally or always.

## Approaches Considered

**Approach A: Enhanced Combat Panels**
Incremental upgrades to existing panel layout. Same SectionPanel structure with new sections added. Rejected as standalone: doesn't deliver the "power screen" feeling for fighters.

**Approach B: Combat Dashboard**
Purpose-built dense layout with sticky resource bar, weapon rack, action bar. Rejected as pure approach: too much departure from existing UI patterns.

**Selected: Blend A + B**
Purpose-built combat panels with information hierarchy (B) using the reorderable/toggleable card system (A). Best of both worlds — rich combat experience with consistent UI patterns across Sheet and Combat. Added user's request for drag-and-drop reordering and no initiative tracking.

**Approach C: Minimal Tactical Upgrades**
Data model fixes + light UI additions. Rejected: doesn't change the gameplay experience for fighters.

## Next Steps

- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-22-combat-dashboard-and-martial-enhancements-design.md`)
- [ ] Coordinate with Sheet dashboard design — shared DraggableCardContainer, shared type changes (ArmorPiece.metal, Weapon fields)
- [ ] Decide on heroic ability reference data vs manual entry
- [ ] Decide on shield modeling (separate field vs isShield flag)
