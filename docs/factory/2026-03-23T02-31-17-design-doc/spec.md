# Spec: Combat Dashboard and Martial Character Enhancements

## Meta
- Client: Caleb Bennett (personal)
- Project: Skaldmark — The Adventurer's Ledger
- Repo: C:\Users\CalebBennett\Documents\GitHub\Skaldmark
- Date: 2026-03-23
- Author: Forge Dark Factory
- Quality Score: 26/30
  - Outcome: 5/5
  - Scope: 5/5
  - Decision guidance: 5/5
  - Edges: 4/5
  - Criteria: 4/5
  - Decomposition: 3/5
- Status: draft

## Outcome

The Skaldmark TTRPG PWA's Combat screen is transformed from a basic resource tracker into a purpose-built combat dashboard for fighters, knights, and other martial characters. The Weapon type gains enhanced modeling (STR requirements, damage types, durability/damaged tracking, shields as first-class items via `isShield` flag). A new WeaponRackPanel displays rich weapon cards with combined damage + bonus, STR requirement checks, durability tracking, and shield sub-cards. A new HeroicAbilityPanel provides interactive ability activation with automatic WP deduction, skill requirement checking, and confirmation dialogs. All Combat panels (Resources, Weapon Rack, Heroic Abilities, Conditions, Death Rolls, Rest & Recovery) are wrapped in the same DraggableCardContainer system used by the Sheet screen, with per-character card order stored in `uiState.combatCardOrder` and per-character visibility stored in `uiState.combatPanelVisibility`. Settings gains a "Combat Panels" section for toggling panels. Done means: all panels render and reorder correctly, weapon cards show combined damage + bonus with STR requirement checks, heroic abilities activate with WP deduction and requirement validation, shield cards render distinctly from weapons, the app builds with `vite build`, touch targets >= 44px, and all three themes render correctly.

## Intent

Trade-Off Hierarchy:
1. **Correctness of Dragonbane combat rules over feature completeness** — STR requirement thresholds (full/half), damage bonus derivation (STR for melee, AGL for ranged), and WP deduction for heroic abilities must faithfully represent core rules. An inaccurate combat dashboard misleads players during gameplay.
2. **Data integrity over UX polish** — panel order, visibility, weapon damaged state, and heroic ability WP costs persist to IndexedDB per character. Never lose user configuration or combat state across app restarts.
3. **Touch usability over information density** — every interactive element (drag handles, activate buttons, mark-damaged buttons, panel headers) must meet the 44px minimum touch target. Dashboard panels scroll vertically; never shrink targets to fit more content.
4. **Additive architecture over refactors** — new panels extend the existing card/SectionPanel pattern. New character fields are optional additions to `CharacterRecord`. Reuse the existing DraggableCardContainer from the Sheet dashboard design. Do not restructure existing context providers, state shape, or component hierarchies.
5. **Cross-platform consistency over platform-specific polish** — drag-and-drop reuses the same pointer-event-based DraggableCardContainer as the Sheet. No platform-specific APIs. CSS-only animations preferred.

Decision Boundaries — stop and escalate if:
- A change would require modifying the Dexie database schema version or migration logic beyond adding new optional fields to `CharacterRecord`
- The shield modeling decision (separate field vs `isShield` flag) requires breaking changes to weapon CRUD on the Gear screen beyond adding new fields to the weapon editor
- Any component file exceeds 400 lines after changes
- A new npm dependency would be required
- The STR requirement check yields incorrect results for edge STR values (1, 9, 18)
- Heroic ability activation cannot be implemented without modifying the existing Magic screen's heroic ability data flows

Decide autonomously for everything else.

## Context

Skaldmark is a Dragonbane TTRPG character sheet PWA built with React + TypeScript + Vite. It uses IndexedDB (via Dexie) for persistence, a three-theme system (dark/parchment/light) via CSS custom properties, and a play/edit mode toggle. The app currently has Sheet, Skills, Gear, Magic, Combat, Reference, and Settings screens.

The Sheet screen was recently upgraded to a configurable dashboard with DraggableCardContainer for panel reordering (SS from prior factory run). This spec builds the equivalent combat-focused dashboard.

Key architectural decisions from the design:
- **Combat dashboard** extends the existing panel-based layout pattern used on SheetScreen. Resources are always visible at the top. WeaponRack and HeroicAbilities are new purpose-built panels. Conditions, Death Rolls, and Rest & Recovery are existing panels made reorderable.
- **Panel configuration** (order, visibility) is stored per-character in `character.uiState.combatCardOrder` / `combatPanelVisibility` and persists to IndexedDB.
- **Weapon enhancements** add STR requirements, damage types, durability/damaged tracking, and shield identification to the existing `Weapon` type. These are all optional fields for backward compatibility.
- **Heroic ability enhancements** add WP cost, skill requirement references, and requirement threshold to the existing `HeroicAbility` type. These enable interactive activation with automatic WP deduction.
- **Shield modeling** uses an `isShield` flag on the `Weapon` type (simpler data model, avoids a separate `shield` field on `CharacterRecord`). Shields are displayed as distinct sub-cards within the WeaponRackPanel.
- **DraggableCardContainer** is reused from the Sheet dashboard design — same component, different order/visibility arrays.

Key files (existing):
- `src/screens/CombatScreen.tsx` — current combat screen (will become dashboard host)
- `src/types/character.ts` — character data model (Weapon, HeroicAbility, ArmorPiece, CharacterUiState)
- `src/utils/derivedValues.ts` — computed character values (HP, WP, movement, damage bonus, AGL damage bonus)
- `src/context/ActiveCharacterContext.tsx` — current character data and updates
- `src/context/AppStateContext.tsx` — app-wide settings and state
- `src/components/panels/DraggableCardContainer.tsx` — drag-and-drop panel reordering (from Sheet dashboard)
- `src/components/fields/CombatResourcePanel.tsx` — oversized HP/WP counters
- `src/components/fields/QuickConditionPanel.tsx` — large condition toggles
- `src/theme/theme.css` — all design tokens and component CSS

Key files (new):
- `src/components/panels/WeaponRackPanel.tsx` — rich weapon display with STR checks, damage combos, shields
- `src/components/panels/HeroicAbilityPanel.tsx` — interactive ability activation with WP deduction
- `src/components/fields/ShieldCard.tsx` — shield-specific sub-component within WeaponRackPanel

## Requirements

1. REQ-001: CombatScreen renders all panels (Resources, Weapon Rack, Heroic Abilities, Conditions, Death Rolls, Rest & Recovery) wrapped in DraggableCardContainer with drag-and-drop reordering in edit mode.
2. REQ-002: Panel order is stored per-character in `character.uiState.combatCardOrder` and persists to IndexedDB.
3. REQ-003: Panel visibility is stored per-character in `character.uiState.combatPanelVisibility` and persists to IndexedDB.
4. REQ-004: `Weapon` type gains optional fields: `damageType` (`'bludgeoning' | 'slashing' | 'piercing' | null`), `strRequirement` (`number | null`), `damaged` (`boolean`), `isShield` (`boolean`).
5. REQ-005: `HeroicAbility` type gains optional fields: `wpCost` (`number`), `requirement` (`string | null`), `requirementSkillId` (`string | null`), `requirementSkillLevel` (`number | null`).
6. REQ-006: `ArmorPiece` type gains optional field: `metal` (`boolean`), shared with mage design for metal/magic warnings.
7. REQ-007: `CharacterUiState` gains fields: `combatCardOrder` (`string[]`), `combatPanelVisibility` (`Record<string, boolean>`).
8. REQ-008: WeaponRackPanel displays each equipped weapon as a rich card: name, weapon type, damage dice + damage bonus combined (STR-based for melee, AGL-based for ranged), grip, range, and features.
9. REQ-009: WeaponRackPanel shows damage type badge (bludgeoning/slashing/piercing) only when `damageType` is set on the weapon.
10. REQ-010: WeaponRackPanel shows durability rating and damaged status (green checkmark vs red "DAMAGED" badge) only when `durability` is set on the weapon.
11. REQ-011: WeaponRackPanel performs STR requirement check: STR >= requirement shows green checkmark, STR < requirement but >= half shows yellow "Bane on attacks & parries", STR < half requirement shows red "Cannot use".
12. REQ-012: WeaponRackPanel skips STR requirement display when `strRequirement` is null/undefined.
13. REQ-013: Shields (weapons with `isShield === true`) are displayed as distinct sub-cards within the WeaponRackPanel showing name, durability, and damaged status.
14. REQ-014: WeaponRackPanel provides "Mark Damaged" and "Repair" buttons in play mode for quick durability state tracking.
15. REQ-015: HeroicAbilityPanel displays each heroic ability as an action card: name, WP cost, one-line effect summary, and "Activate" button.
16. REQ-016: Tapping "Activate" on a heroic ability deducts `wpCost` from character's current WP and shows a toast notification: "Activated {name}! (-{cost} WP)".
17. REQ-017: The "Activate" button is disabled (grayed out) when `currentWP < ability.wpCost`.
18. REQ-018: HeroicAbilityPanel checks skill requirements: if `requirementSkillId` is set, it shows a green/red status badge based on whether the character's skill value meets `requirementSkillLevel`.
19. REQ-019: When a skill requirement is not met, tapping "Activate" shows a confirmation dialog: "Requirement not met. Activate anyway?" before proceeding.
20. REQ-020: HeroicAbilityPanel supports add/edit/delete of abilities in edit mode using a drawer editor.
21. REQ-021: Passive heroic abilities (those with `wpCost === 0` or `wpCost` undefined) display normally without an "Activate" button.
22. REQ-022: Settings screen gains a "Combat Panels" section with toggles for: Weapon Rack, Heroic Abilities, Conditions, Death Rolls, Rest & Recovery.
23. REQ-023: Resources panel on CombatScreen cannot be toggled off (always visible).
24. REQ-024: Default panel visibility: Resources ON, Weapon Rack ON, Heroic Abilities ON, Conditions ON, Death Rolls ON, Rest & Recovery ON.
25. REQ-025: Damage bonus calculation for WeaponRackPanel uses existing `computeDamageBonus(character)` for melee weapons and `computeAGLDamageBonus(character)` for ranged weapons.
26. REQ-026: All new type fields are optional (`?:` syntax) so existing characters load without migration errors.
27. REQ-027: The app builds cleanly with `vite build` after all changes.
28. REQ-028: All interactive elements maintain >= 44px touch targets.
29. REQ-029: All features render correctly across dark, parchment, and light themes.
30. REQ-030: Heroic ability changes (activation, WP deduction) flow through ActiveCharacterContext and autosave.
31. REQ-031: Weapon damaged state changes (mark damaged, repair) flow through ActiveCharacterContext and autosave.
32. REQ-032: WeaponRackPanel shows empty state "No weapons equipped. Equip weapons on the Gear screen." with navigation affordance when no weapons are equipped.
33. REQ-033: HeroicAbilityPanel shows empty state "No heroic abilities. Add them in edit mode." when no abilities exist.

## Sub-Specs

### SS-1: Character Type Extensions — Weapon, HeroicAbility, ArmorPiece, and Combat UI State Fields

- **Scope:** Extend `Weapon`, `HeroicAbility`, `ArmorPiece`, and `CharacterUiState` types with new optional fields for combat dashboard features. All new fields are optional to maintain backward compatibility with existing persisted characters.
- **Files likely touched:** `src/types/character.ts`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` `Weapon` interface gains optional fields: `damageType?: 'bludgeoning' | 'slashing' | 'piercing' | null`, `strRequirement?: number | null`, `damaged?: boolean`, `isShield?: boolean`. (REQ-004)
  2. `[STRUCTURAL]` `HeroicAbility` interface gains optional fields: `wpCost?: number`, `requirement?: string | null`, `requirementSkillId?: string | null`, `requirementSkillLevel?: number | null`. (REQ-005)
  3. `[STRUCTURAL]` `ArmorPiece` interface gains optional field: `metal?: boolean`. (REQ-006)
  4. `[STRUCTURAL]` `CharacterUiState` interface gains fields: `combatCardOrder?: string[]`, `combatPanelVisibility?: Record<string, boolean>`. (REQ-007)
  5. `[BEHAVIORAL]` All new fields use `?:` syntax so existing characters load without migration errors. (REQ-026)
  6. `[BEHAVIORAL]` The existing `durability` field on `Weapon` is preserved as-is. The new `damaged` field coexists alongside it (durability = max rating, damaged = boolean broken state). (REQ-004)
- **Dependencies:** None (foundational — all other sub-specs depend on this)
- **Constraints:** Additive only. No removal or rename of existing fields. No Dexie migration changes.

### SS-2: WeaponRackPanel — Rich Weapon Display with STR Checks and Damage Combos

- **Scope:** Create a new panel component that reads equipped weapons from character data and displays rich weapon cards with combined damage + bonus, STR requirement validation, durability tracking, damage type badges, and shield sub-cards.
- **Files likely touched:** `src/components/panels/WeaponRackPanel.tsx` (new), `src/components/fields/ShieldCard.tsx` (new), `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` Panel reads `character.weapons.filter(w => w.equipped)` and renders a card for each equipped weapon. (REQ-008)
  2. `[STRUCTURAL]` Each weapon card displays: name, damage dice, combined damage bonus (e.g., "D8 + D4"), grip (1H/2H), range, and features list. (REQ-008)
  3. `[BEHAVIORAL]` Melee weapons show damage bonus from `computeDamageBonus(character)` (STR-based). Ranged weapons show bonus from `computeAGLDamageBonus(character)` (AGL-based). Bonus of "+0" is not displayed. (REQ-025)
  4. `[STRUCTURAL]` Damage type badge (bludgeoning/slashing/piercing) is shown only when `weapon.damageType` is set (not null/undefined). (REQ-009)
  5. `[STRUCTURAL]` Durability rating and damaged status are shown only when `weapon.durability` is set. Green checkmark for OK, red "DAMAGED" badge when `weapon.damaged === true`. (REQ-010)
  6. `[BEHAVIORAL]` STR requirement check: when `weapon.strRequirement` is set, compares against `character.attributes['str']`. Green checkmark if STR >= requirement. Yellow "Bane" badge if STR < requirement but >= requirement/2. Red "Cannot use" badge if STR < requirement/2. (REQ-011)
  7. `[BEHAVIORAL]` STR requirement display is skipped entirely when `weapon.strRequirement` is null or undefined. (REQ-012)
  8. `[STRUCTURAL]` Weapons with `isShield === true` render as distinct shield sub-cards showing name, durability, and damaged status — not as full weapon cards. (REQ-013)
  9. `[BEHAVIORAL]` In play mode, each non-shield weapon with durability has "Mark Damaged" / "Repair" toggle buttons. Shields also have these buttons. (REQ-014)
  10. `[BEHAVIORAL]` "Mark Damaged" sets `weapon.damaged = true`; "Repair" sets `weapon.damaged = false`. Changes persist via `updateCharacter()`. (REQ-031)
  11. `[STRUCTURAL]` When no weapons are equipped, shows empty state: "No weapons equipped. Equip weapons on the Gear screen." with tap-to-navigate. (REQ-032)
  12. `[STRUCTURAL]` Panel uses the existing `SectionPanel` or card styling pattern for visual consistency. (REQ-029)
  13. `[STRUCTURAL]` All interactive elements (damage/repair buttons) have >= 44px touch targets. (REQ-028)
- **Dependencies:** SS-1 (type fields for damageType, strRequirement, damaged, isShield)
- **Constraints:** Read-only for weapon CRUD (adding/editing weapons is the Gear screen's responsibility). Equip/unequip is also the Gear screen's responsibility. Only damaged state toggling is allowed on the Combat screen.

### SS-3: HeroicAbilityPanel — Interactive Ability Activation with WP Deduction

- **Scope:** Create a new panel component that displays heroic abilities as action cards with interactive "Activate" buttons that deduct WP, check skill requirements, and handle edge cases (insufficient WP, unmet requirements, passive abilities).
- **Files likely touched:** `src/components/panels/HeroicAbilityPanel.tsx` (new), `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` Panel reads `character.heroicAbilities` and renders each as an action card: name, WP cost, one-line summary (`ability.summary`). (REQ-015)
  2. `[BEHAVIORAL]` Tapping "Activate" deducts `ability.wpCost` from `character.resources.wp.current` via `updateCharacter()`. A toast is shown: "Activated {name}! (-{cost} WP)". (REQ-016, REQ-030)
  3. `[BEHAVIORAL]` "Activate" button is disabled (grayed styling, non-interactive) when `character.resources.wp.current < ability.wpCost`. (REQ-017)
  4. `[BEHAVIORAL]` When `ability.requirementSkillId` is set, the panel looks up the character's skill value for that ID. A green badge is shown if `skillValue >= ability.requirementSkillLevel`; a red badge is shown otherwise. (REQ-018)
  5. `[BEHAVIORAL]` When skill requirement is not met but WP is sufficient, tapping "Activate" shows a confirmation dialog: "Requirement not met. Activate anyway?" Only proceeds on confirmation. (REQ-019)
  6. `[BEHAVIORAL]` In edit mode, an "Add" button opens a drawer editor for creating/editing/deleting heroic abilities. Fields: name, summary, wpCost, requirement (text), requirementSkillId (dropdown from system skills), requirementSkillLevel (number). (REQ-020)
  7. `[STRUCTURAL]` Passive abilities (`wpCost === 0` or `wpCost` undefined) display name and summary without an "Activate" button. (REQ-021)
  8. `[STRUCTURAL]` When no heroic abilities exist, shows empty state: "No heroic abilities. Add them in edit mode." (REQ-033)
  9. `[BEHAVIORAL]` Multiple activations in the same session are unrestricted — Dragonbane allows combining multiple abilities. (REQ-016)
  10. `[BEHAVIORAL]` WP deduction flows through ActiveCharacterContext and triggers autosave. Changes are reflected on other screens (Sheet, etc.) without manual refresh. (REQ-030)
  11. `[STRUCTURAL]` All interactive elements (Activate buttons, Add button, drawer controls) have >= 44px touch targets. (REQ-028)
- **Dependencies:** SS-1 (HeroicAbility type fields for wpCost, requirementSkillId, requirementSkillLevel)
- **Constraints:** This panel does NOT own the WP display (that's the Resources panel). It only deducts WP. The drawer editor pattern should match the existing Magic screen's drawer.

### SS-4: CombatScreen Dashboard Integration — DraggableCardContainer and Panel Wiring

- **Scope:** Refactor CombatScreen to wrap all panels (Resources, Weapon Rack, Heroic Abilities, Conditions, Death Rolls, Rest & Recovery) in the existing DraggableCardContainer component. Wire up per-character card order and visibility persistence.
- **Files likely touched:** `src/screens/CombatScreen.tsx`, `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` CombatScreen renders all six panels wrapped in `DraggableCardContainer` with panel keys: `'resources'`, `'weaponRack'`, `'heroicAbilities'`, `'conditions'`, `'deathRolls'`, `'restRecovery'`. (REQ-001)
  2. `[BEHAVIORAL]` In edit mode, drag handles appear on each panel. Dragging reorders panels and writes new order to `character.uiState.combatCardOrder` via `updateCharacter()`. (REQ-001, REQ-002)
  3. `[BEHAVIORAL]` Panel order persists to IndexedDB and is restored on next load. (REQ-002)
  4. `[BEHAVIORAL]` Panel visibility respects `character.uiState.combatPanelVisibility` — hidden panels are not rendered but retain order position. (REQ-003)
  5. `[BEHAVIORAL]` The Resources panel (`'resources'` key) cannot be toggled off and is always rendered regardless of visibility settings. (REQ-023)
  6. `[BEHAVIORAL]` Default visibility for new characters (when `combatPanelVisibility` is undefined): all panels ON. (REQ-024)
  7. `[BEHAVIORAL]` Panels not present in the `combatCardOrder` array are appended at the end in default order. (REQ-001)
  8. `[STRUCTURAL]` CombatScreen delegates panel rendering to child components (WeaponRackPanel, HeroicAbilityPanel, existing condition/death/rest panels) to stay under 400 lines.
  9. `[STRUCTURAL]` Drag handles have >= 44px touch targets. (REQ-028)
  10. `[BEHAVIORAL]` Existing Combat screen functionality (HP/WP counters, condition toggles, death rolls, rest modals) continues to work unchanged. (REQ-001)
- **Dependencies:** SS-1 (uiState fields), SS-2 (WeaponRackPanel), SS-3 (HeroicAbilityPanel)
- **Constraints:** Reuses the existing DraggableCardContainer component — same component as SheetScreen with a different order array. No external drag library. Must not break existing CombatScreen features.

### SS-5: Settings Screen — Combat Panels Toggle Section

- **Scope:** Add a "Combat Panels" section to the Settings screen with toggles for each optional combat panel. Toggling writes to the active character's `combatPanelVisibility`.
- **Files likely touched:** `src/screens/SettingsScreen.tsx`, `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` SettingsScreen gains a "Combat Panels" section with toggle switches for: Weapon Rack, Heroic Abilities, Conditions, Death Rolls, Rest & Recovery. (REQ-022)
  2. `[BEHAVIORAL]` Toggling a panel off sets `combatPanelVisibility[panelKey] = false` for the active character and persists via `updateCharacter()`. (REQ-003, REQ-022)
  3. `[BEHAVIORAL]` Toggling a panel on sets `combatPanelVisibility[panelKey] = true` (or removes the key). Panel restores to its previous position in the card order. (REQ-003)
  4. `[STRUCTURAL]` Resources panel is NOT in the toggle list (it cannot be hidden). (REQ-023)
  5. `[BEHAVIORAL]` Default state: all toggles ON for characters without existing `combatPanelVisibility`. (REQ-024)
  6. `[STRUCTURAL]` Toggle switches have >= 44px touch targets. (REQ-028)
  7. `[BEHAVIORAL]` If no character is active, the "Combat Panels" section is hidden or disabled with a message. (REQ-022)
- **Dependencies:** SS-1 (uiState fields), SS-4 (CombatScreen reads visibility)
- **Constraints:** Uses existing toggle/card patterns from Settings. Follows the same pattern as "Sheet Panels" section from the prior factory run.

### SS-6: Gear Screen Weapon Editor — New Fields for STR Requirement, Damage Type, Damaged, Shield

- **Scope:** Extend the Gear screen's weapon drawer editor to include new fields for STR requirement, damage type, damaged state, and isShield flag. These fields populate the data that WeaponRackPanel displays.
- **Files likely touched:** `src/screens/GearScreen.tsx`, `src/components/fields/WeaponCard.tsx`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` Weapon editor drawer includes a "Damage Type" selector with options: None, Bludgeoning, Slashing, Piercing. Saves to `weapon.damageType`. (REQ-004, REQ-009)
  2. `[STRUCTURAL]` Weapon editor drawer includes a "STR Requirement" number input. Saves to `weapon.strRequirement`. Empty/zero treated as null. (REQ-004, REQ-011)
  3. `[STRUCTURAL]` Weapon editor drawer includes a "Shield" toggle. When enabled, sets `weapon.isShield = true`. (REQ-004, REQ-013)
  4. `[STRUCTURAL]` Weapon editor drawer includes a "Damaged" toggle for quick marking. Saves to `weapon.damaged`. (REQ-004, REQ-010)
  5. `[BEHAVIORAL]` New fields default to null/false/undefined for newly created weapons. (REQ-026)
  6. `[BEHAVIORAL]` Existing weapons without the new fields load and edit without errors — undefined fields are treated as their default values. (REQ-026)
  7. `[STRUCTURAL]` All new editor fields have >= 44px touch targets. (REQ-028)
  8. `[BEHAVIORAL]` Saving a weapon with new fields persists correctly and the data is immediately available on the Combat screen's WeaponRackPanel. (REQ-008)
- **Dependencies:** SS-1 (type fields)
- **Constraints:** The weapon editor is on the Gear screen, not the Combat screen. Combat screen only has quick "Mark Damaged" / "Repair" toggles. Full weapon CRUD stays on Gear.

### SS-7: Build Verification and Theme Polish

- **Scope:** Verify all new panels and features render correctly across all three themes. Ensure the app builds cleanly with `vite build`. Final touch-target audit.
- **Files likely touched:** `src/theme/theme.css`, any component files needing theme adjustments
- **Acceptance Criteria:**
  1. `[MECHANICAL]` `vite build` succeeds with zero errors. (REQ-027)
  2. `[BEHAVIORAL]` WeaponRackPanel renders correctly in dark, parchment, and light themes — damage type badges, STR requirement badges, and damaged indicators are legible in all themes. (REQ-029)
  3. `[BEHAVIORAL]` HeroicAbilityPanel renders correctly in all three themes — disabled/grayed buttons are distinguishable from active buttons. (REQ-029)
  4. `[BEHAVIORAL]` Combat panel drag handles render correctly in all themes. (REQ-029)
  5. `[BEHAVIORAL]` Settings "Combat Panels" toggles render correctly in all themes. (REQ-029)
  6. `[STRUCTURAL]` All new interactive elements verified at >= 44px effective touch area. (REQ-028)
  7. `[BEHAVIORAL]` Rotating between portrait and landscape does not break any new panel layouts. (REQ-028)
- **Dependencies:** SS-2, SS-3, SS-4, SS-5, SS-6

## Edge Cases

### Weapon Rack

| Scenario | Behavior |
|----------|----------|
| No weapons equipped | "No weapons equipped. Equip weapons on the Gear screen." with tap-to-navigate. |
| All weapons damaged | All shown with red "DAMAGED" badges. Mark Damaged buttons become Repair buttons. |
| No STR requirement set | Skip STR check display entirely for that weapon. |
| No damage type set | Don't show damage type badge. |
| No durability value | Don't show durability section or damaged state. |
| Shield equipped | Shown as distinct shield sub-card, not as a regular weapon card. |
| Weapon with +0 damage bonus | Bonus portion not displayed — only base damage dice shown (e.g., "D8" not "D8 + 0"). |
| STR exactly at half requirement | Half-requirement edge: `STR >= Math.ceil(requirement / 2)` → yellow "Bane". `STR < Math.ceil(requirement / 2)` → red "Cannot use". |
| `strRequirement` is 1 | Half is 1. Green if STR >= 1 (always). Edge case effectively means no restriction. |
| `damaged` is undefined on existing weapon | Treated as `false` (not damaged). |
| `isShield` is undefined on existing weapon | Treated as `false` (not a shield). |
| Ranged weapon with STR requirement | STR check still applies (some crossbows require STR). Display uses AGL bonus for damage. |

### Heroic Abilities

| Scenario | Behavior |
|----------|----------|
| No heroic abilities | Empty state: "No heroic abilities. Add them in edit mode." |
| WP at 0 | All abilities with WP cost > 0 grayed out. Passive abilities (wpCost 0 or undefined) shown normally without Activate button. |
| Skill requirement not met | Warning badge + confirmation dialog: "Requirement not met. Activate anyway?" Button still tappable for override. |
| Multiple activations same round | No restriction — Dragonbane allows combining multiple heroic abilities. |
| WP would go below 0 | Button disabled when `currentWP < wpCost`. Cannot over-deduct. |
| `wpCost` is undefined on existing ability | Treated as passive ability (no Activate button). |
| `requirementSkillId` not found in character skills | Treated as requirement not met (red badge). Confirmation dialog still allows activation. |
| `requirementSkillLevel` is undefined but `requirementSkillId` is set | Default requirement threshold to 12 (standard Dragonbane heroic ability threshold). |
| Heroic ability with wpCost 0 explicitly | Shown as passive — no Activate button, no WP deduction. |

### Panel System

| Scenario | Behavior |
|----------|----------|
| Default visibility (new character) | All panels ON. |
| `combatCardOrder` is undefined | All panels rendered in default order: resources, weaponRack, heroicAbilities, conditions, deathRolls, restRecovery. |
| `combatPanelVisibility` is undefined | All panels visible (default ON). |
| Panel key in order array has no matching panel | Silently skipped (defensive coding). |
| New panel added in future | Appears at end of card order if not present in array. |
| Resources panel forced off via direct data edit | Code enforces Resources always visible regardless of visibility settings. |
| DraggableCardContainer shared with Sheet | Same component, different order/visibility arrays. No conflict. |

### WP Deduction

| Scenario | Behavior |
|----------|----------|
| WP deducted on Combat, reflected on Sheet | Changes flow through ActiveCharacterContext — Sheet's ResourceTracker updates automatically. |
| Rapid activations | Autosave debounce coalesces rapid WP changes into a single write. |
| WP deduction during death rolls (HP = 0) | Heroic abilities still functional — no restriction tied to HP. |

## Out of Scope

- Initiative tracking or turn order management
- Dice rolling for attacks, parries, or ability checks
- Weapon CRUD (add/edit/delete weapons) — that's the Gear screen's responsibility
- Equip/unequip weapons — that's the Gear screen's responsibility
- Heroic ability reference data pre-population (users enter abilities manually for now — see Open Question 1)
- Animated attack/parry sequences
- Condition effect descriptions or automated condition application
- Monster/NPC stat blocks or encounter management
- Armor/helmet management on the Combat screen (armor display is existing, not enhanced here)
- Pre-populated heroic ability database from Dragonbane rules (copyright constraint)
- Automated durability reduction from parrying (manual "Mark Damaged" only)
- Rest & Recovery logic changes (existing functionality, just made reorderable)

## Open Questions (from design, deferred)

1. **Heroic ability reference data**: Should we pre-populate a reference list of all Dragonbane heroic abilities? Deferred — users enter manually. Reference data would reduce typing but requires rules text curation.
2. **Damage type as optional rule**: Current decision: nullable field, always available, no toggle needed. Revisit if users find the field confusing for non-Dragonbane-2024 content.
3. **Heroic abilities location**: Currently editable on Magic screen. This spec adds edit capability to Combat screen's HeroicAbilityPanel too. Both screens can manage abilities. Long-term may need a single source.
4. **Weapon editor expansion**: New fields (STR requirement, damage type, damaged, isShield) are shown always in the editor (not conditionally). Simple approach; revisit if the editor becomes too crowded.

## Constraints

**Musts:**
- All three themes (dark, parchment, light) render correctly for all new panels and combat features
- Touch targets >= 44px on all interactive elements (drag handles, activate buttons, mark-damaged buttons, editor controls)
- Panel order and visibility persist to IndexedDB per character
- STR requirement thresholds match Dragonbane rules: full STR = OK, half-to-full = Bane, below half = Cannot use
- Damage bonus uses existing `computeDamageBonus` (STR) for melee and `computeAGLDamageBonus` (AGL) for ranged
- WP deduction for heroic abilities is exact and cannot overdraw below 0
- `vite build` succeeds cleanly after all changes
- Cross-platform: works in Chrome, Safari, Firefox (mobile and desktop)
- All new type fields are optional to avoid breaking existing persisted data

**Must-Nots:**
- Must not add new npm dependencies
- Must not break existing consumers of ActiveCharacterContext or AppStateContext
- Must not break existing CombatScreen functionality (HP/WP counters, conditions, death rolls, rest)
- Must not own weapon CRUD — that stays on the Gear screen
- Must not auto-reduce weapon durability (manual "Mark Damaged" only)
- Must not bundle copyrighted Dragonbane rules text for heroic abilities
- Must not use `any` type in TypeScript
