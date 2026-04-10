---
date: 2026-04-03
topic: "Temporary stat modifiers for spells and effects"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-04-03
tags:
  - design
  - temp-stat-modifiers
---

# Temporary Stat Modifiers -- Design

## Summary

Add a system for tracking temporary stat modifications (e.g., Power Fist boosting STR, Stone Skin adding armor) that overlays on base character values without mutating them. Modifiers are duration-aware and integrate with the rest system to remind users when effects expire. Both manual entry and spell quick-apply are supported.

## Approach Selected

**Blend of Overlay Modifiers + Buff Chips** — Central `tempModifiers[]` data array on `CharacterRecord` (clean separation of base vs. temporary values) with a visual chip-based UI for managing active modifiers (compact, discoverable, consistent with existing conditions UI pattern).

## Architecture

```
┌─────────────────────────────────────────────┐
│            CharacterRecord                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │attributes│  │ resources│  │tempModifiers│ │
│  │{str: 14} │  │{hp: ...} │  │[{...},{..}]│ │
│  └────┬─────┘  └────┬─────┘  └─────┬──────┘ │
└───────┼──────────────┼──────────────┼────────┘
        │              │              │
        ▼              ▼              ▼
┌─────────────────────────────────────────────┐
│         getEffectiveValue(stat, char)       │
│  base value + SUM(matching modifiers)       │
└──────────────────────┬──────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  ┌──────────┐  ┌───────────┐  ┌──────────┐
  │ StatField│  │ BuffChips │  │ RestModal│
  │ (display)│  │ (manage)  │  │ (expiry) │
  └──────────┘  └───────────┘  └──────────┘
```

Key components:
1. **TempModifier data** — stored on `CharacterRecord`, persisted to IndexedDB alongside everything else
2. **Effective value resolver** — utility that takes a stat key + character and returns base + modifier sum
3. **Buff Chip UI** — colored chips on Sheet screen for viewing/managing active modifiers
4. **Add Modifier Drawer** — manual entry form for ad-hoc effects
5. **Spell Quick-Apply** — optional `effects` template on `Spell` type for auto-creating modifiers on cast
6. **Rest Expiry Integration** — rest modals check for duration-matched modifiers and prompt for removal

## Components

### TempModifier (type)

```typescript
/** Canonical stat keys — flat namespace with resolver map */
type StatKey =
  | 'str' | 'con' | 'agl' | 'int' | 'wil' | 'cha'   // attributes
  | 'armor' | 'helmet'                                  // armor rating
  | 'movement' | 'hpMax' | 'wpMax'                     // derived values
  | string;                                              // skill IDs (e.g. "swords", "acrobatics")

interface TempModifierEffect {
  stat: StatKey;   // flat key resolved by getEffectiveValue()
  delta: number;   // +2, -1, etc.
}

interface TempModifier {
  id: string;
  label: string;                    // "Power Fist", "Potion of Strength"
  effects: TempModifierEffect[];    // one or more stat modifications
  duration: "round" | "stretch" | "shift" | "scene" | "permanent";
  sourceSpellId?: string;           // links back to spell if auto-created
  createdAt: string;                // ISO timestamp
}

/** Spell effect template — lives on the Spell type */
interface SpellEffect {
  stat: StatKey;
  delta: number;
  duration: TempModifier['duration'];  // per-effect duration for mixed spells
}
// Label defaults to spell name. Duration can vary per-effect.
```

**Owns:** The modifier data — what it affects, by how much, for how long, and where it came from.
**Does NOT own:** Applying the modifier to display values.

### getEffectiveValue() (utility in `src/utils/derivedValues.ts`)

- Takes a stat key and character record
- Returns `{ base, modifiers: [{label, delta}], effective }` — base value, list of active modifiers, and final sum
- **Stat key resolver map:**
  - `"str"`, `"con"`, etc. → `character.attributes[key]`
  - `"armor"` → `character.armor?.rating ?? 0`
  - `"helmet"` → `character.helmet?.rating ?? 0`
  - `"movement"`, `"hpMax"`, `"wpMax"` → computed derived value (from existing `computeDerivedValues()`)
  - Skill IDs (e.g. `"swords"`) → `character.skills[key]?.value ?? 0`
- **DerivedOverrides interaction:** Manual overrides take absolute precedence. Temp modifiers stack on top of the effective value (override if present, otherwise computed). Example: override=14, modifier=+2 → effective=16. No override, computed=10, modifier=+2 → effective=12.
- Called by parent components (SheetScreen, SkillsScreen) and results passed as props to display components.

**Owns:** The math of base + modifiers = effective value.
**Does NOT own:** Display, persistence, or modifier lifecycle.

### BuffChipBar (component)

- Renders active `tempModifiers` as colored chips below conditions row on SheetScreen
- Each chip shows: label + total delta summary + duration badge
- Tap chip to expand: full effects list + "Remove" button
- "+" chip at end opens AddModifierDrawer

**Owns:** Visual display and interaction for active modifiers.

### AddModifierDrawer (component)

- Manual entry form: label, stat picker (dropdown of valid stats), delta (+/-), duration picker
- "Add another effect" button for multi-stat spells
- Save appends a `TempModifier` to `character.tempModifiers`

### Spell Quick-Apply

- `Spell` type gets optional `effects?: SpellEffect[]` field (schema defined in TempModifier section above)
- When casting, if `effects` is defined: create a `TempModifier` with `label = spell.name`, `sourceSpellId = spell.id`, and map each `SpellEffect` to a `TempModifierEffect`
- If effects have different durations, group into separate `TempModifier` entries per-duration
- Spells without `effects` work exactly as today — no modifier created

### Rest Expiry Integration

- Before applying rest, check `tempModifiers` for matching duration
- If matches found: dialog listing expiring modifiers with "Remove & Rest" / "Keep & Rest"
- "Keep & Rest" for cases where duration hasn't actually elapsed
- Removed modifiers logged to session log

## Data Flow

### Adding a modifier (manual)
1. User taps "+" chip on BuffChipBar → opens AddModifierDrawer
2. User fills form → taps Save
3. `TempModifier` created with fresh ID and timestamp
4. Appended to `character.tempModifiers` via `updateCharacter()`
5. Autosave persists to IndexedDB (1s debounce)
6. BuffChipBar re-renders with new chip
7. Affected stat fields re-read via `getEffectiveValue()` showing updated effective value

### Adding a modifier (spell quick-apply)
1. User taps "Cast" on a spell with `effects` defined
2. Cast handler creates `TempModifier` from spell template
3. Same persistence flow as manual

### Viewing effective values
1. Stat display components call `getEffectiveValue(statKey, character)`
2. If modifiers active: show effective value with visual indicator (color/arrow)
3. Optional tooltip showing modifier breakdown on tap

### Removing a modifier (manual)
1. Tap buff chip → expand → tap "Remove"
2. Filter modifier out of `tempModifiers` array
3. Stat fields revert to base values; autosave persists

### Removing modifiers (rest expiry)
1. User triggers Round/Stretch/Shift Rest
2. Check `tempModifiers` for matching duration
3. If matches: show confirmation dialog listing expiring effects
4. "Remove & Rest" filters matched modifiers, proceeds with rest
5. "Keep & Rest" skips removal, proceeds with rest
6. Removal + rest both logged to session log

### Persistence
- `tempModifiers` is another field on `CharacterRecord` — existing autosave handles it
- Export/import includes modifiers as part of character JSON
- No new IndexedDB tables or migration needed

## Error Handling

- **Stacking:** Multiple modifiers on same stat are summed. No cap — user applies Dragonbane rules.
- **Invalid stat key:** Modifier renders as chip but has no visible stat effect. Stat picker in AddModifierDrawer presents curated list to minimize this.
- **Accidental removal:** No undo needed — user can re-add manually. Simple enough to not warrant complexity.
- **Rest with no expiring modifiers:** Rest proceeds exactly as today — no dialog interruption.
- **Migration:** Existing characters lack `tempModifiers`. All reads default to `[]` via `?? []`. No migration script needed.
- **Spells without effects template:** Cast works exactly as today. Users can retroactively add effect templates via spell editor.
- **DerivedOverrides conflict:** Manual overrides take absolute precedence over computed values. Temp modifiers add on top of the effective value (override or computed). This is consistent: overrides = permanent user intent, modifiers = temporary spell effects.
- **Partial failure on multi-effect modifier:** Not possible — the modifier is a single atomic append to the array. All effects are stored together and removed together.

## Resolved Decisions

1. **Stat key namespace** — RESOLVED: Flat namespace with resolver map. Keys: `"str"`, `"con"`, `"agl"`, `"int"`, `"wil"`, `"cha"` (attributes), `"armor"`, `"helmet"` (armor ratings), `"movement"`, `"hpMax"`, `"wpMax"` (derived), plus skill IDs like `"swords"`, `"acrobatics"`. The resolver function in `getEffectiveValue()` maps each key to its extraction path on `CharacterRecord`.
2. **DerivedOverrides precedence** — RESOLVED: Manual overrides replace computed value. Temp modifiers add on top of effective (override or computed). Override=14 + modifier=+2 → 16.
3. **SpellEffect schema** — RESOLVED: `{ stat: StatKey, delta: number, duration: TempModifier['duration'] }`. Label defaults to spell name.

## Open Questions

1. **Buff chip placement** — Sheet screen only, or also Skills/Gear screens? Determines integration breadth. Can decide during implementation.
2. **Visual indicator design** — Subtle color shift vs. bold glow/arrow for modified stats. UX polish — can defer.
3. **Session log format** — What modifier add/remove log entries look like. Agent can decide during implementation.

## Approaches Considered

### Approach A: Overlay Modifier Array (selected, blended with B)
Central `tempModifiers[]` on CharacterRecord. Clean separation of base vs. temporary values. Generic — works for any numeric stat. Selected for its data model clarity and extensibility.

### Approach B: Buff/Debuff Chip System (selected, blended with A)
Condition-style colored chips for visual modifier management. Selected for its compact, discoverable UI that's consistent with existing conditions pattern. Blended with A's data model.

### Approach C: Stat-Level Modifier Stacks (rejected)
Per-stat modifier arrays restructuring `attributes` from `Record<string, number>` to complex objects. Rejected because it requires major schema changes, makes multi-stat spells awkward, and lacks a central "what's active" overview.

## Acceptance Criteria

1. User can add a manual temp modifier via AddModifierDrawer (label, stat picker, delta, duration)
2. Active modifiers display as colored chips below the conditions row on SheetScreen
3. Tapping a chip expands it to show full effect details and a "Remove" button
4. Attribute fields on SheetScreen show effective value (base + modifiers) with a visual indicator when modified
5. Derived value fields show effective value respecting override precedence (override > computed) + modifier stacking
6. Round/Stretch/Shift Rest prompts list expiring modifiers with "Remove & Rest" / "Keep & Rest" options
7. Casting a spell with `effects` defined auto-creates the corresponding TempModifier(s)
8. Removing a modifier (manual or rest expiry) reverts stat display to base/override value
9. Export/import includes active modifiers in character JSON
10. "Clear All" action on BuffChipBar removes all active modifiers

## Commander's Intent

**Desired End State:** A player can cast Power Fist, see their STR value update immediately on the sheet, see a "Power Fist" chip in the buff bar, and have the app remind them to clear it when they take a Stretch Rest. The same flow works for any spell, potion, or ad-hoc GM ruling that temporarily modifies a stat.

**Purpose:** During play, temporary stat changes from spells and effects are easy to forget or hard to revert. This feature makes them visible, trackable, and integrated with the rest system so the player doesn't have to manually edit and remember base values.

**Constraints:**
- MUST NOT mutate base attribute values — modifiers are always a separate overlay
- MUST NOT break existing DerivedOverrides behavior — overrides take precedence, modifiers stack on top
- MUST NOT require migration for existing characters — `tempModifiers ?? []` handles missing field
- MUST preserve existing rest flow — modifier expiry dialog is additive, not a replacement
- MUST work on mobile (48px touch targets, drawer-based forms)

**Freedoms:**
- The implementing agent MAY choose the visual indicator style for modified stats (color, arrow, badge)
- The implementing agent MAY decide buff chip placement on screens beyond SheetScreen
- The implementing agent MAY choose session log entry format for modifier events
- The implementing agent MAY decide internal component structure (e.g., whether BuffChipBar is one component or split)

## Execution Guidance

**Observe:** Monitor these signals during implementation:
- TypeScript compiler (`tsc --noEmit`) — zero errors after each component
- Existing rest flow still works after integration (manual test: trigger each rest type)
- Autosave persists modifiers (check IndexedDB via browser devtools)
- Export JSON includes `tempModifiers` array

**Orient:** Codebase conventions to maintain:
- Follow the `updateCharacter(partial)` pattern from `ActiveCharacterContext` for all character mutations
- Pure functions for logic (like `restActions.ts`) — side effects only in components
- CSS uses design token variables (`--color-*`, `--space-*`, `--radius-*`, `--font-size-*`)
- Types in `src/types/`, utilities in `src/utils/`, components in `src/components/`

**Escalate When:**
- A change to `AttributeField` or `DerivedFieldDisplay` props would break other screens
- A new npm dependency is needed
- The stat key resolver needs to handle a case not listed in the design

**Shortcuts (Apply Without Deliberation):**
- Use existing `Chip` component (`src/components/primitives/Chip.tsx`) for buff chips — it already has `active` state styling
- Use existing `Drawer` component (`src/components/primitives/Drawer.tsx`) for AddModifierDrawer
- Use existing `Modal` component (`src/components/primitives/Modal.tsx`) for rest expiry confirmation
- Use `useAutosave` hook — already wired on SheetScreen, handles persistence
- Use `nanoid` or `crypto.randomUUID()` for modifier IDs (check which the project already uses for other IDs)
- Place new types in `src/types/character.ts` alongside existing character types
- Place `getEffectiveValue()` in `src/utils/derivedValues.ts` alongside existing derived value functions
- `AttributeField` gets an optional `modifierDelta?: number` prop for the visual badge — called from SheetScreen which does the `getEffectiveValue()` lookup

## Decision Authority

**Agent Decides Autonomously:**
- File placement and component naming
- Internal state management within AddModifierDrawer
- CSS styling details within existing design system
- Session log entry wording
- "Clear All" button placement and styling
- Whether to split BuffChipBar into sub-components

**Agent Recommends, Human Approves:**
- Changes to existing component APIs (AttributeField props, DerivedFieldDisplay props)
- Buff chip visual design choices (color variant for buffs vs conditions)
- Which screens show BuffChipBar beyond SheetScreen

**Human Decides:**
- Adding new npm dependencies
- UX changes to the rest modal flow
- Scope expansion beyond the 10 acceptance criteria

## War-Game Results

**Most Likely Failure:** Stat key resolution ambiguity — a modifier targets a key the resolver doesn't handle. **Mitigation:** Curated dropdown in AddModifierDrawer (no freeform entry). Spell effect templates use validated keys. Resolver logs a warning for unrecognized keys.

**Scale Stress:** N/A — single-user PWA, no server load concerns.

**Dependency Risk:** If `AttributeField` is refactored by another feature, modifier integration will conflict. Low risk given single-developer project. **Mitigation:** Keep the integration minimal — one optional prop (`modifierDelta`) rather than restructuring the component.

**Maintenance Assessment:** Good. Component boundaries are clear, the overlay pattern is well-understood. The stat key resolver map is the most important piece to document inline — future developers need to extend it when new stat types are added.

## Evaluation Metadata

- Evaluated: 2026-04-03
- Cynefin Domain: Complicated
- Critical Gaps Found: 2 (2 resolved)
- Important Gaps Found: 4 (4 resolved)
- Suggestions: 3 (incorporated)

## Next Steps
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-04-03-temp-stat-modifiers-design.md`)
- [ ] Define initial spell effect templates for common Dragonbane spells (Power Fist, Stone Skin, etc.)
