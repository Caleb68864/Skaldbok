# Spec: Sheet Dashboard Panels and Magic Preparation System

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

The Skaldmark TTRPG PWA's Sheet screen is transformed from a flat attribute viewer into a configurable gameplay dashboard with five core panels (Identity, Attributes, Conditions, Resources, Derived Values) and four toggleable optional panels (Equipped Gear, Pinned Skills, Prepared Spells, Custom Note Cards). All panels are wrapped in a drag-and-drop reorderable container that stores card order and visibility per character. Simultaneously, the Magic screen gains a full Dragonbane spell preparation system: prepared-vs-grimoire filtering, INT-based preparation limit enforcement, power-level casting with dynamic WP cost, magic-trick handling, and metal-equipment warnings. Settings gains a "Sheet Panels" section for toggling optional panels. The character data model is extended with spell preparation fields (`prepared`, `rank`, `requirements`, `castingTime`), metal flags on equipment, and UI state fields for panel configuration. Done means: all panels render and toggle correctly, spell preparation enforces INT-based limits, power level casting computes WP cost dynamically, metal detection blocks spells visually, drag-and-drop reordering persists per character, the app builds with `vite build`, touch targets ≥ 44px, and all three themes render correctly.

## Intent

Trade-Off Hierarchy:
1. **Correctness of Dragonbane magic rules over feature completeness** — spell preparation limits (INT base chance), grimoire casting penalties, magic trick always-prepared status, and metal interference must faithfully represent core rules. An inaccurate magic system misleads players during gameplay.
2. **Data integrity over UX polish** — panel order, visibility, pinned skills, custom cards, and spell preparation state persist to IndexedDB per character. Never lose user configuration or spell preparation state across app restarts.
3. **Touch usability over information density** — every interactive element (drag handles, toggles, spell cards, panel headers) must meet the 44px minimum touch target. Dashboard panels scroll vertically; never shrink targets to fit more content.
4. **Additive architecture over refactors** — new panels extend the existing card/SectionPanel pattern. New character fields are optional additions to `CharacterRecord`. Do not restructure existing context providers, state shape, or component hierarchies.
5. **Cross-platform consistency over platform-specific polish** — drag-and-drop must work via pointer events (touch + mouse). No platform-specific APIs. CSS-only animations preferred.

Decision Boundaries — stop and escalate if:
- A change would require modifying the Dexie database schema version or migration logic beyond adding new optional fields to `CharacterRecord`
- The spell `rank` vs `powerLevel` distinction requires a breaking rename of existing `powerLevel` field on persisted data (see Open Question 1)
- Any component file exceeds 400 lines after changes
- A new npm dependency would be required (including `@dnd-kit/core` — implement drag via native pointer events first)
- The INT base chance formula yields values outside the 3–7 range for any valid attribute score (1–18)
- Metal detection logic cannot be implemented without modifying existing Gear screen data entry flows

Decide autonomously for everything else.

## Context

Skaldmark is a Dragonbane TTRPG character sheet PWA built with React + TypeScript + Vite. It uses IndexedDB (via Dexie) for persistence, a three-theme system (dark/parchment/light) via CSS custom properties, and a play/edit mode toggle. The app currently has Sheet, Skills, Gear, Magic, Combat, Reference, and Settings screens.

Key architectural decisions from the design:
- **Dashboard panels** extend the existing card-based layout pattern on SheetScreen. Core panels (Identity, Attributes, Conditions, Resources, Derived Values) are always visible. Optional panels (Equipped Gear, Pinned Skills, Prepared Spells, Custom Note Cards) are toggleable and reorderable.
- **Panel configuration** (order, visibility, pinned skills, custom cards) is stored per-character in `character.uiState` and persists to IndexedDB.
- **Spell preparation** follows Dragonbane rules: maximum prepared spells = INT base chance (3–7), magic tricks always prepared, grimoire spells castable at double time, reaction spells must be prepared.
- **Power level** is a cast-time choice (1–3), not stored on the spell. WP cost = powerLevel × 2. Magic tricks cost 1 WP with no power level selector.
- **Metal detection** is a cross-cutting concern: `isMetalEquipped(character)` checks weapons, armor, helmet for `metal: true` and surfaces warnings on EquippedGearPanel, PreparedSpellsPanel, and MagicScreen.

Key files (existing):
- `src/screens/SheetScreen.tsx` — main character sheet (will become dashboard host)
- `src/screens/SettingsScreen.tsx` — app settings
- `src/types/character.ts` — character data model
- `src/utils/derivedValues.ts` — computed character values (HP, WP, movement, damage bonus)
- `src/context/ActiveCharacterContext.tsx` — current character data and updates
- `src/context/AppStateContext.tsx` — app-wide settings and state
- `src/theme/theme.css` — all design tokens and component CSS

Key files (new):
- `src/components/panels/EquippedGearPanel.tsx` — equipped gear summary card
- `src/components/panels/PinnedSkillsPanel.tsx` — pinned skills quick-reference card
- `src/components/panels/PreparedSpellsPanel.tsx` — prepared spells compact list
- `src/components/panels/CustomNoteCard.tsx` — user-created freeform text card
- `src/components/panels/DraggableCardContainer.tsx` — drag-and-drop panel wrapper
- `src/utils/metalDetection.ts` — metal equipment detection utility

## Requirements

1. REQ-001: SheetScreen renders core panels (Identity, Attributes, Conditions, Resources, Derived Values) that are always visible and cannot be toggled off.
2. REQ-002: SheetScreen renders optional panels (Equipped Gear, Pinned Skills, Prepared Spells, Custom Note Cards) that are individually toggleable via Settings.
3. REQ-003: All SheetScreen panels (core + optional) are wrapped in a DraggableCardContainer that supports long-press drag reordering via drag handle in edit mode.
4. REQ-004: Panel order is stored per-character in `character.uiState.sheetCardOrder` and persists to IndexedDB.
5. REQ-005: Panel visibility is stored per-character in `character.uiState.sheetPanelVisibility` and persists to IndexedDB.
6. REQ-006: EquippedGearPanel displays equipped weapon name + damage die, armor name + armor rating, helmet name + AR.
7. REQ-007: EquippedGearPanel shows a metal warning banner when any equipped item has `metal: true` AND the character has spells.
8. REQ-008: PinnedSkillsPanel reads pinned skill IDs from `character.uiState.pinnedSkills` and displays skill name + value + trained indicator.
9. REQ-009: PinnedSkillsPanel supports adding/removing pinned skills (max 6) in edit mode via a skill picker.
10. REQ-010: PreparedSpellsPanel displays "Prepared X/Y" header where Y = INT base chance, and lists prepared spells with WP cost.
11. REQ-011: PreparedSpellsPanel dims spells when `currentWP < spell.wpCost` and shows red/blocked styling when metal equipment is equipped (metal takes precedence).
12. REQ-012: PreparedSpellsPanel auto-hides when the character has zero spells.
13. REQ-013: CustomNoteCard allows user-created cards with title + body (plain text), stored in `character.uiState.sheetCustomCards`.
14. REQ-014: CustomNoteCard supports add, edit, and delete in edit mode.
15. REQ-015: MagicScreen gains a split view with "Prepared" vs "Grimoire" tabs/filter.
16. REQ-016: MagicScreen displays "X/Y Prepared" counter where Y = `computeMaxPreparedSpells(character)` (INT base chance).
17. REQ-017: MagicScreen enforces preparation limit: preparing beyond limit shows "X/Y prepared. Unprepare a spell first." with button disabled.
18. REQ-018: MagicScreen provides a power level selector (1–3) per spell card with dynamic WP cost display (powerLevel × 2).
19. REQ-019: Magic tricks section on MagicScreen: always available, 1 WP cost, auto-succeed, no power level selector.
20. REQ-020: MagicScreen shows metal warning banner when metal gear is equipped.
21. REQ-021: Reaction spells on MagicScreen are flagged as "must be prepared" (cannot cast from grimoire).
22. REQ-022: `computeMaxPreparedSpells(character)` in `derivedValues.ts` returns INT base chance (attribute value → 3–7 via existing `getSkillBaseChance` mapping).
23. REQ-023: `CharacterRecord` type gains spell fields: `spells[].prepared`, `spells[].rank`, `spells[].requirements`, `spells[].castingTime`.
24. REQ-024: `CharacterRecord` type gains equipment metal flags: `weapons[].metal`, `armor.metal`, `helmet.metal`.
25. REQ-025: `CharacterRecord` type gains UI state fields: `uiState.pinnedSkills`, `uiState.sheetCardOrder`, `uiState.sheetCustomCards`, `uiState.sheetPanelVisibility`.
26. REQ-026: `isMetalEquipped(character)` utility function checks all equipped items for `metal: true`.
27. REQ-027: Settings screen gains a "Sheet Panels" section with toggles for Equipped Gear, Pinned Skills, and Prepared Spells.
28. REQ-028: New panels absent from the card order array appear at the end (handles new cards gracefully).
29. REQ-029: Panels toggled off remain in the order array but are not rendered; toggling on restores position.
30. REQ-030: The app builds cleanly with `vite build` after all changes.
31. REQ-031: All interactive elements maintain ≥ 44px touch targets.
32. REQ-032: All features render correctly across dark, parchment, and light themes.
33. REQ-033: Drag reordering uses drag handle icons (not long-press on whole card) to avoid scroll conflicts on mobile.

## Sub-Specs

### SS-1: Character Type Extensions — Spell, Equipment, and UI State Fields

- **Scope:** Extend `CharacterRecord` and related types with new optional fields for spell preparation, equipment metal flags, and dashboard UI state. All new fields are optional to maintain backward compatibility with existing persisted characters.
- **Files likely touched:** `src/types/character.ts`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` `Spell` interface gains optional fields: `prepared: boolean`, `rank: number` (1–3), `requirements: string[]`, `castingTime: 'action' | 'reaction' | 'ritual'`.
  2. `[STRUCTURAL]` `Weapon` interface gains optional field: `metal: boolean`.
  3. `[STRUCTURAL]` `ArmorPiece` interface gains optional field: `metal: boolean`.
  4. `[STRUCTURAL]` `CharacterUiState` interface gains fields: `pinnedSkills: string[]`, `sheetCardOrder: string[]`, `sheetCustomCards: { id: string; title: string; body: string }[]`, `sheetPanelVisibility: Record<string, boolean>`.
  5. `[BEHAVIORAL]` All new fields are optional (use `?:` syntax) so existing characters load without migration errors.
  6. `[STRUCTURAL]` A `CustomCard` type or inline type is defined for `sheetCustomCards` entries with `id`, `title`, and `body` fields.
  7. `[BEHAVIORAL]` The existing `powerLevel` field on `Spell` is preserved as-is (no breaking rename). The new `rank` field coexists alongside it. Open Question 1 deferred.
- **Dependencies:** None (foundational — all other sub-specs depend on this)
- **Constraints:** Additive only. No removal or rename of existing fields. No Dexie migration changes.

### SS-2: Derived Values — `computeMaxPreparedSpells` and Metal Detection Utility

- **Scope:** Add a `computeMaxPreparedSpells` function to `derivedValues.ts` that returns the INT base chance (3–7) for spell preparation limits. Create a standalone `isMetalEquipped` utility for cross-cutting metal detection.
- **Files likely touched:** `src/utils/derivedValues.ts`, `src/utils/metalDetection.ts` (new)
- **Acceptance Criteria:**
  1. `[BEHAVIORAL]` `computeMaxPreparedSpells(character)` returns the INT base chance using the existing `getSkillBaseChance` mapping: INT 1–5 → 3, INT 6–8 → 4, INT 9–12 → 5, INT 13–15 → 6, INT 16–18 → 7.
  2. `[BEHAVIORAL]` If character has no INT attribute (edge case), defaults to base chance 5 (INT 10 equivalent).
  3. `[BEHAVIORAL]` `isMetalEquipped(character)` returns `true` if any equipped weapon has `metal === true`, or equipped armor has `metal === true`, or equipped helmet has `metal === true`.
  4. `[BEHAVIORAL]` `isMetalEquipped` returns `false` if no metal flags are set (backward compatibility with existing items where `metal` is undefined — default `false`).
  5. `[BEHAVIORAL]` `isMetalEquipped` only checks currently equipped items (`equipped === true`), not all inventory items.
  6. `[STRUCTURAL]` Both functions are exported and importable by panel components and MagicScreen.
  7. `[STRUCTURAL]` Both functions are pure (no side effects, no context dependency) — they take a `CharacterRecord` and return a value.
- **Dependencies:** SS-1 (type definitions for `metal` flags)
- **Constraints:** `computeMaxPreparedSpells` must reuse the existing `getSkillBaseChance` function, not duplicate the mapping. `isMetalEquipped` in a separate utility file to keep `derivedValues.ts` focused.

### SS-3: DraggableCardContainer — Drag-and-Drop Panel Reordering

- **Scope:** Create a container component that wraps SheetScreen panels and enables drag-and-drop reordering in edit mode via drag handle icons. Card order persists per character.
- **Files likely touched:** `src/components/panels/DraggableCardContainer.tsx` (new), `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` `DraggableCardContainer` accepts children as an ordered list of panel elements, each identified by a string key (e.g., `'identity'`, `'attributes'`, `'gear'`, `'custom-{id}'`).
  2. `[BEHAVIORAL]` In play mode, panels render in the stored order without drag handles or drag affordances.
  3. `[BEHAVIORAL]` In edit mode, each panel displays a drag handle icon (≡ or ⠿ style) that initiates drag-and-drop on pointer down.
  4. `[BEHAVIORAL]` Dragging a panel visually moves it in the list. On drop, the new order is written to `character.uiState.sheetCardOrder` via `updateCharacter()`.
  5. `[BEHAVIORAL]` Panels not present in the `sheetCardOrder` array are appended at the end in a deterministic default order.
  6. `[BEHAVIORAL]` Panels with `sheetPanelVisibility[key] === false` are excluded from rendering but retain their position in the order array.
  7. `[STRUCTURAL]` Drag handles have ≥ 44px touch targets and are visually distinct from panel content.
  8. `[BEHAVIORAL]` Drag is implemented via pointer events (`pointerdown`, `pointermove`, `pointerup`) for cross-platform touch + mouse support. No external drag library.
  9. `[BEHAVIORAL]` Dragging a panel does not conflict with vertical page scrolling — only the drag handle initiates drag.
  10. `[STRUCTURAL]` During drag, the dragged panel has a visual lift effect (shadow or scale) to indicate it is being moved.
- **Dependencies:** SS-1 (uiState type fields)
- **Constraints:** No external npm dependency for drag-and-drop. Pointer-event-based implementation. Must work on mobile Chrome, Safari, Firefox, and desktop browsers.

### SS-4: EquippedGearPanel — Equipment Summary Card

- **Scope:** Create a read-only panel that summarizes equipped weapons, armor, and helmet with damage/rating info and a conditional metal warning banner.
- **Files likely touched:** `src/components/panels/EquippedGearPanel.tsx` (new), `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` Panel displays each equipped weapon as: weapon name + damage die (e.g., "Sword: D8 slash").
  2. `[STRUCTURAL]` Panel displays equipped armor as: armor name + armor rating (e.g., "Leather: AR 2").
  3. `[STRUCTURAL]` Panel displays equipped helmet as: helmet name + AR (e.g., "Iron Helm: AR 1").
  4. `[BEHAVIORAL]` If no weapons/armor/helmet are equipped, the corresponding row is omitted (not shown as empty).
  5. `[STRUCTURAL]` A metal warning banner ("⚠ Metal equipped — spells blocked!") is displayed when `isMetalEquipped(character)` returns `true` AND the character has at least one spell.
  6. `[BEHAVIORAL]` Metal warning banner is NOT shown if character has no spells (metal is irrelevant for non-casters).
  7. `[BEHAVIORAL]` Tapping the panel (or a "View Gear" link) navigates to the Gear screen.
  8. `[STRUCTURAL]` Panel is read-only in both play and edit mode (gear changes happen on the Gear screen).
  9. `[STRUCTURAL]` Panel uses the existing `SectionPanel` or card styling pattern for visual consistency.
- **Dependencies:** SS-1 (metal type fields), SS-2 (isMetalEquipped utility)
- **Constraints:** Display-only component. No inline editing of equipment.

### SS-5: PinnedSkillsPanel — Quick-Reference Skills Card

- **Scope:** Create a panel that displays a user-selected set of pinned skills (max 6) with their values and trained status. Supports add/remove via a picker in edit mode.
- **Files likely touched:** `src/components/panels/PinnedSkillsPanel.tsx` (new), `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` Panel reads `character.uiState.pinnedSkills` (array of skill IDs) and looks up each skill's value and trained status.
  2. `[STRUCTURAL]` Each pinned skill displays: skill name, skill value, trained indicator (e.g., checkmark or filled dot).
  3. `[BEHAVIORAL]` In edit mode, a "+" button or "Edit Pins" action opens a skill picker showing all system skills with toggle checkboxes.
  4. `[BEHAVIORAL]` The picker enforces a maximum of 6 pinned skills. Attempting to add a 7th shows a message: "Maximum 6 pinned skills."
  5. `[BEHAVIORAL]` Pinned skill changes persist via `updateCharacter({ uiState: { pinnedSkills: [...] } })`.
  6. `[BEHAVIORAL]` If a pinned skill ID no longer exists in the system skill list, it is silently dropped from the displayed list (not an error).
  7. `[STRUCTURAL]` When no skills are pinned, edit mode shows: "Pin up to 6 skills for quick reference."
  8. `[BEHAVIORAL]` Skills with value 0 and untrained are still shown if pinned (user explicitly chose them).
  9. `[STRUCTURAL]` Panel does NOT allow editing skill values — that is the Skills screen's responsibility.
  10. `[STRUCTURAL]` Skill picker and "+" button have ≥ 44px touch targets.
- **Dependencies:** SS-1 (uiState.pinnedSkills type)
- **Constraints:** Read-only for skill values. Picker can be a modal or inline dropdown. Max 6 is a hard limit.

### SS-6: PreparedSpellsPanel — Compact Spell List for Sheet Dashboard

- **Scope:** Create a panel that displays the character's prepared spells with WP cost, grayed/blocked status based on WP and metal equipment, and a preparation count header.
- **Files likely touched:** `src/components/panels/PreparedSpellsPanel.tsx` (new), `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` Panel header displays "Prepared X/Y" where X = count of spells with `prepared === true`, Y = `computeMaxPreparedSpells(character)`.
  2. `[STRUCTURAL]` Each prepared spell displays: spell name, WP cost (base: 2 WP).
  3. `[BEHAVIORAL]` Spells are dimmed/faded when `character.resources.wp.current < spell.wpCost` (insufficient WP).
  4. `[BEHAVIORAL]` All spells show red/blocked styling when `isMetalEquipped(character)` returns `true`. Metal blocking takes visual precedence over WP dimming.
  5. `[BEHAVIORAL]` Tapping a spell navigates to the Magic screen.
  6. `[BEHAVIORAL]` Panel is completely hidden (not rendered) when the character has zero spells.
  7. `[BEHAVIORAL]` If all spells are magic tricks, the panel shows tricks with a note "Magic tricks are always prepared" and no X/Y counter.
  8. `[STRUCTURAL]` Panel uses compact styling suitable for a dashboard summary (not full spell detail).
  9. `[BEHAVIORAL]` When character has spells but 0 WP: all spells are dimmed (not blocked). Metal blocking is separate from WP dimming.
- **Dependencies:** SS-1 (spell.prepared type), SS-2 (computeMaxPreparedSpells, isMetalEquipped)
- **Constraints:** Read-only on the Sheet. Spell preparation toggling happens on MagicScreen only.

### SS-7: CustomNoteCard — User-Created Freeform Text Cards

- **Scope:** Create a user-creatable card with title + body text, stored per character. Supports add, edit, and delete in edit mode.
- **Files likely touched:** `src/components/panels/CustomNoteCard.tsx` (new), `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` Each custom card displays a title and body (plain text).
  2. `[BEHAVIORAL]` In edit mode, card title and body are editable inline (text inputs/textareas).
  3. `[BEHAVIORAL]` In edit mode, an "Add Note Card" button creates a new card with default title "New Note" and empty body.
  4. `[BEHAVIORAL]` In edit mode, each card has a delete action (button or icon) with confirmation.
  5. `[BEHAVIORAL]` Custom cards are stored in `character.uiState.sheetCustomCards` as `{ id, title, body }[]` and persist to IndexedDB.
  6. `[BEHAVIORAL]` Each custom card has a unique `id` generated at creation time (UUID or timestamp-based).
  7. `[BEHAVIORAL]` Deleting a custom card removes it from both `sheetCustomCards` and `sheetCardOrder` arrays.
  8. `[STRUCTURAL]` In play mode, cards are read-only (no edit affordances, no add/delete buttons).
  9. `[STRUCTURAL]` Custom cards integrate with the DraggableCardContainer using keys `'custom-{id}'`.
  10. `[STRUCTURAL]` Add button and delete button have ≥ 44px touch targets.
- **Dependencies:** SS-1 (uiState.sheetCustomCards type), SS-3 (DraggableCardContainer integration)
- **Constraints:** Plain text only (no Markdown rendering). Card IDs must be stable for drag ordering.

### SS-8: MagicScreen — Spell Preparation System

- **Scope:** Upgrade the MagicScreen with spell preparation toggling, prepared/grimoire filtering, INT-based limit enforcement, power level casting, magic trick handling, and metal warnings.
- **Files likely touched:** `src/screens/MagicScreen.tsx` (or equivalent magic screen), `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` MagicScreen has a tab/filter toggle: "Prepared" shows only `spell.prepared === true` spells; "Grimoire" shows all learned spells.
  2. `[STRUCTURAL]` Header displays "X/Y Prepared" counter (Y = `computeMaxPreparedSpells(character)`).
  3. `[BEHAVIORAL]` Tapping "Prepare" on an unprepared spell sets `spell.prepared = true` if `preparedCount < maxPreparedSpells`. Change persists via `updateCharacter()`.
  4. `[BEHAVIORAL]` If `preparedCount >= maxPreparedSpells`, the Prepare button is disabled and a message reads: "X/Y prepared. Unprepare a spell first."
  5. `[BEHAVIORAL]` Tapping "Unprepare" on a prepared spell sets `spell.prepared = false` and persists.
  6. `[BEHAVIORAL]` Magic tricks are always considered prepared. The prepare/unprepare toggle is hidden for magic tricks.
  7. `[STRUCTURAL]` Each non-trick spell card has a power level selector (1 / 2 / 3). WP cost display updates dynamically: `powerLevel × 2`.
  8. `[BEHAVIORAL]` Higher power levels are grayed out if `currentWP < powerLevel × 2`.
  9. `[STRUCTURAL]` Magic tricks display: always available, 1 WP, no power level selector, auto-succeed note.
  10. `[STRUCTURAL]` A metal warning banner is displayed at the top of MagicScreen when `isMetalEquipped(character)` returns `true`.
  11. `[BEHAVIORAL]` Reaction spells are flagged with a "Must be prepared" badge. If not prepared, they cannot be cast from the grimoire view.
  12. `[BEHAVIORAL]` When INT drops below the current prepared count (e.g., via attribute edit), a warning appears: "You have X prepared but can only hold Y. Please unprepare Z spells." No auto-unprepare.
  13. `[BEHAVIORAL]` Spell preparation changes flow through ActiveCharacterContext → autosave → PreparedSpellsPanel on Sheet updates automatically.
  14. `[STRUCTURAL]` All interactive elements (prepare buttons, power level selectors, tabs) have ≥ 44px touch targets.
- **Dependencies:** SS-1 (spell.prepared type), SS-2 (computeMaxPreparedSpells, isMetalEquipped)
- **Constraints:** Power level is a cast-time UI choice, not persisted on the spell. The `rank` field (spell complexity) is separate and display-only if present.

### SS-9: SheetScreen Dashboard Integration and Settings Panel Toggles

- **Scope:** Integrate all new panels into SheetScreen via DraggableCardContainer. Add "Sheet Panels" toggle section to SettingsScreen.
- **Files likely touched:** `src/screens/SheetScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` SheetScreen renders all core panels (Identity, Attributes, Conditions, Resources, Derived Values) at the top, followed by optional panels in the order specified by `character.uiState.sheetCardOrder`.
  2. `[STRUCTURAL]` All panels are wrapped in `DraggableCardContainer`.
  3. `[BEHAVIORAL]` Optional panels respect `character.uiState.sheetPanelVisibility` — hidden panels are not rendered but retain order position.
  4. `[BEHAVIORAL]` Core panels cannot be hidden (they are always rendered regardless of visibility settings).
  5. `[STRUCTURAL]` SettingsScreen gains a "Sheet Panels" section with toggle switches for: Equipped Gear, Pinned Skills, Prepared Spells.
  6. `[BEHAVIORAL]` Toggling a panel off in Settings sets `sheetPanelVisibility[panelKey] = false` for the active character and persists.
  7. `[BEHAVIORAL]` Toggling a panel on restores it to its previous position in the card order.
  8. `[BEHAVIORAL]` Default visibility for new characters: all optional panels ON.
  9. `[BEHAVIORAL]` When a new panel type first becomes relevant (e.g., first spell learned), it appears at the end of the card order.
  10. `[STRUCTURAL]` Custom Note Cards are not in the Settings toggles (they are managed individually via add/delete on SheetScreen).
  11. `[STRUCTURAL]` Settings toggles have ≥ 44px touch targets.
- **Dependencies:** SS-3 (DraggableCardContainer), SS-4 (EquippedGearPanel), SS-5 (PinnedSkillsPanel), SS-6 (PreparedSpellsPanel), SS-7 (CustomNoteCard)
- **Constraints:** SheetScreen should remain under 400 lines by delegating panel rendering to child components. Settings uses existing toggle/card patterns.

## Edge Cases

### Spell Preparation

| Scenario | Behavior |
|----------|----------|
| Preparing beyond limit | Button disabled + message: "X/Y prepared. Unprepare a spell first." |
| INT drops below prepared count | Warning: "You have X prepared but can only hold Y. Please unprepare Z spells." No auto-unprepare. |
| No spells learned | PreparedSpellsPanel hidden entirely on Sheet. MagicScreen shows empty state. |
| All spells are magic tricks | Panel shows tricks with note "Magic tricks are always prepared" — no X/Y counter. |
| Character has spells but 0 WP | All spells dimmed (not blocked). Player may recover WP via rest or Power from Body. |
| Metal equipped + 0 WP | "Blocked" (metal) styling takes precedence over WP dimming. |
| Reaction spell not prepared | Flagged "Must be prepared" on grimoire view. Cannot be cast from grimoire. |
| Spell with undefined `prepared` | Treated as `prepared === false` (backward compatibility). |

### Pinned Skills

| Scenario | Behavior |
|----------|----------|
| Pinned skill ID no longer in system | Silently dropped from displayed list on next render. |
| No skills pinned | Edit mode: "Pin up to 6 skills for quick reference." Play mode: panel shows empty state or hides. |
| Attempting to pin 7th skill | Picker shows message: "Maximum 6 pinned skills." Toggle disabled. |
| Skill value is 0 and untrained | Still shown if pinned — user explicitly chose it. |
| `pinnedSkills` is undefined | Treated as empty array `[]` (backward compatibility). |

### Card Ordering

| Scenario | Behavior |
|----------|----------|
| New panel appears (first spell learned) | Appended to end of card order array. |
| Panel toggled off | Stays in order array, not rendered. Toggling on restores position. |
| Custom card deleted | Removed from both `sheetCustomCards` and `sheetCardOrder` arrays. |
| Drag on small screens | Drag handle icon used, not long-press on whole card, to avoid scroll conflicts. |
| `sheetCardOrder` is undefined | All panels rendered in default order: core first, then optional in definition order. |
| Card key in order array has no matching panel | Silently skipped (e.g., leftover `custom-{id}` after deletion). |

### Metal Detection

| Scenario | Behavior |
|----------|----------|
| No metal flag on existing items | Default `metal: false` (undefined treated as false). |
| Character has no spells | Metal warning not shown even if metal equipped. |
| Multiple metal items equipped | Single warning banner (not one per item). |
| Metal flag added to item later | Warning appears on next render. No stale cache. |

### Power Level Casting

| Scenario | Behavior |
|----------|----------|
| WP = 3, select power level 2 (cost 4) | Power level 2 and 3 grayed out. Only level 1 available. |
| WP = 0 | All power levels grayed. Spell dimmed. |
| Magic trick | No power level selector shown. Fixed 1 WP cost. |

## Out of Scope

- Grimoire casting time penalty display (double time noted in rules but no timer UI)
- Spell editor UI for new `rank`, `requirements`, `castingTime` fields (deferred — fields added to type for future use)
- Power from the Body action (gameplay action, separate design)
- Animated card drag transitions beyond basic lift effect
- Markdown rendering in custom note cards
- In-app dice rolling for any feature
- Spell search or filtering within MagicScreen (beyond prepared/grimoire tabs)
- Renaming `powerLevel` to `rank` on existing persisted data (deferred per Open Question 1)
- Drag-and-drop for core panel reordering relative to each other (core panels maintain fixed internal order)
- Multi-character panel configurations (each character has independent panel state)
- `@dnd-kit/core` or any external drag library

## Constraints

**Musts:**
- All three themes (dark, parchment, light) render correctly for all new panels and magic features
- Touch targets ≥ 44px on all interactive elements (drag handles, toggles, buttons, spell cards)
- Panel order and visibility persist to IndexedDB per character
- Spell preparation limits match Dragonbane INT base chance rules (3–7)
- Metal detection returns false for items without the `metal` field (backward compatibility)
- `vite build` succeeds cleanly after all changes
- Cross-platform: works in Chrome, Safari, Firefox (mobile and desktop)
- All new type fields are optional to avoid breaking existing persisted data

**Must-Nots:**
- Must not add new npm dependencies
- Must not break existing consumers of ActiveCharacterContext or AppStateContext
- Must not auto-unprepare spells when INT drops (user decision)
- Must not persist power level selection on the spell record (cast-time choice only)
- Must not rename or remove existing `powerLevel` field on `Spell` type
- Must not modify the Dexie migration history beyond adding optional fields
- Must not allow editing skill values from PinnedSkillsPanel or equipment from EquippedGearPanel

**Preferences:**
- Prefer pointer events over touch events for drag implementation (cross-platform)
- Prefer CSS custom properties for theme-aware styling on new panels
- Prefer existing `SectionPanel` or card styling pattern for visual consistency
- Prefer `updateCharacter()` via ActiveCharacterContext for all persistence
- Prefer compact/summary display on Sheet panels (full detail on dedicated screens)
- Prefer inline content editing for custom note cards (no modal)

**Escalation Triggers:**
- Any single component file exceeds 400 lines
- Drag-and-drop via pointer events has irreconcilable scroll conflicts on iOS Safari
- `getSkillBaseChance` mapping produces unexpected values for INT attribute range
- Metal detection requires Gear screen modifications to add the `metal` field to items
- Dexie schema migration complexity exceeds adding optional fields

## Verification

End-to-end verification: After all sub-specs are implemented, confirm that:

1. `vite build` completes with no errors from the project root.
2. SheetScreen renders core panels (Identity, Attributes, Conditions, Resources, Derived Values) that cannot be toggled off.
3. SheetScreen renders optional panels (Equipped Gear, Pinned Skills, Prepared Spells) when enabled in Settings.
4. Optional panels can be toggled on/off in Settings → "Sheet Panels" section.
5. In edit mode, drag handles appear on all panels and drag-reorder works.
6. Card order persists across app restarts (stored in IndexedDB per character).
7. EquippedGearPanel shows weapon damage, armor rating, helmet AR for equipped items.
8. EquippedGearPanel shows metal warning banner when metal item equipped AND character has spells.
9. PinnedSkillsPanel displays up to 6 pinned skills with values and trained indicators.
10. Skill picker in edit mode allows adding/removing pinned skills with max 6 enforcement.
11. PreparedSpellsPanel shows "Prepared X/Y" header with correct INT base chance.
12. PreparedSpellsPanel dims spells when WP insufficient, blocks (red) when metal equipped.
13. PreparedSpellsPanel auto-hides when character has no spells.
14. Custom note cards can be added, edited, and deleted in edit mode.
15. Custom note cards display as read-only in play mode.
16. MagicScreen has Prepared/Grimoire tab filter.
17. MagicScreen enforces preparation limit with disabled button and message when at capacity.
18. Power level selector (1–3) updates WP cost dynamically (powerLevel × 2).
19. Magic tricks show as always available, 1 WP, no power level selector.
20. Metal warning banner appears on MagicScreen when metal gear equipped.
21. Reaction spells flagged "must be prepared" on grimoire view.
22. `computeMaxPreparedSpells` returns correct INT base chance (3–7) for all INT values 1–18.
23. `isMetalEquipped` returns correct boolean for all equipment combinations.
24. All new type fields are optional and existing characters load without errors.
25. Panels not in the order array appear at the end in default order.
26. Toggling a panel off and on restores its previous position in the order.
27. All interactive elements have ≥ 44px touch targets.
28. All three themes render correctly with all new panels and magic features.
29. Dragging via handle does not conflict with page scrolling.
30. No `pointer-events` are intercepted by decorative elements.
