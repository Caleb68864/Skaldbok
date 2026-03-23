# Phase Spec: SS-08 — MagicScreen Spell Preparation System

## Dependency Order
**Dependencies:** SS-01 (`spell.prepared` type, `castingTime`), SS-02 (`computeMaxPreparedSpells`, `isMetalEquipped`)
**Blocks:** None (independent of SS-09 integration; can run in parallel with SS-03–SS-07)

## Objective
Upgrade the MagicScreen with spell preparation toggling, prepared/grimoire filtering, INT-based limit enforcement, power level casting with dynamic WP cost, magic trick handling, reaction spell rules, and metal equipment warnings.

## Files to Modify
- `src/screens/MagicScreen.tsx` (or equivalent magic screen file)
- `src/theme/theme.css` — add magic-specific styles

## Acceptance Criteria
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

## Implementation Steps
1. Open `src/screens/MagicScreen.tsx`.
2. Add state for active filter tab: `const [filter, setFilter] = useState<'prepared' | 'grimoire'>('prepared');`
3. Add state for per-spell power level selection (UI-only, not persisted): `const [powerLevels, setPowerLevels] = useState<Record<string, number>>({});` (default level 1 per spell).
4. Compute derived values:
   - `maxPrepared = computeMaxPreparedSpells(character)`
   - `preparedCount = character.spells?.filter(s => s.prepared && !isMagicTrick(s)).length ?? 0`
   - `metalBlocked = isMetalEquipped(character)`
   - `currentWP = character.resources?.wp?.current ?? 0`
   - `overLimit = preparedCount > maxPrepared`
5. Render header:
   - "X/Y Prepared" counter.
   - If `overLimit`, warning: "You have {preparedCount} prepared but can only hold {maxPrepared}. Please unprepare {preparedCount - maxPrepared} spells."
6. Render tab/filter toggle: "Prepared" | "Grimoire" buttons (≥ 44px).
7. Render metal warning banner at top if `metalBlocked`.
8. Filter spells based on active tab:
   - "Prepared": show `spell.prepared === true` spells + magic tricks.
   - "Grimoire": show all spells.
9. For each spell card:
   - **Magic tricks**: Show name, "1 WP", "Always available", "Auto-succeed" note. No prepare/unprepare toggle, no power level selector.
   - **Regular spells**: Show name, prepare/unprepare button, power level selector (1/2/3), dynamic WP cost.
   - **Prepare button**: If `prepared`, show "Unprepare". If not prepared and `preparedCount < maxPrepared`, show "Prepare". If at limit, button disabled + "X/Y prepared. Unprepare a spell first."
   - **Power level selector**: Three buttons/segments (1/2/3). Highlight selected. Gray out levels where `currentWP < level × 2`. Display WP cost: `{selectedLevel × 2} WP`.
   - **Reaction spells**: Show "Must be prepared" badge. In grimoire view, if not prepared, show as non-castable.
10. Prepare/unprepare handler:
    - Toggle `spell.prepared` on the character's spells array.
    - Call `updateCharacter` to persist.
11. Add CSS to `theme.css`:
    - `.magic-filter-tabs` — tab toggle styling, ≥ 44px.
    - `.power-level-selector` — segmented control or button group.
    - `.power-level-disabled` — grayed out state.
    - `.metal-warning-banner` — reuse from SS-04 or define shared class.
    - `.reaction-badge` — "Must be prepared" badge styling.
    - `.prepare-button` — prepare/unprepare button styling.
    - Theme-aware via CSS custom properties.
12. Ensure power level is NOT persisted to the spell record — it's UI-only state reset on unmount.
13. Keep file under 400 lines. If the file would exceed 400 lines, extract spell card rendering into a `SpellCard` sub-component.

## Constraints
- Power level is a cast-time UI choice, not persisted on the spell. The `rank` field (spell complexity) is separate and display-only if present.
- No auto-unprepare when INT drops. Only warn.
- Magic tricks are always prepared — hide prepare/unprepare toggle for them.
- All interactive elements ≥ 44px touch targets.
- No new npm dependencies.
- Changes persist through `updateCharacter` via ActiveCharacterContext.

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Build succeeds
npx vite build
```

## Verification Checklist
- [ ] Prepared/Grimoire tab filter exists and works
- [ ] "X/Y Prepared" counter displayed in header
- [ ] Prepare button works and persists `spell.prepared = true`
- [ ] Prepare button disabled at limit with "X/Y prepared. Unprepare a spell first."
- [ ] Unprepare button works and persists `spell.prepared = false`
- [ ] Magic tricks: no prepare toggle, no power level selector, "1 WP", "Always available"
- [ ] Power level selector (1/2/3) per non-trick spell
- [ ] WP cost updates dynamically: `powerLevel × 2`
- [ ] Higher power levels grayed when insufficient WP
- [ ] Metal warning banner at top when metal equipped
- [ ] Reaction spells flagged "Must be prepared"
- [ ] Over-limit warning shown when INT drops below prepared count
- [ ] Power level NOT persisted to spell record
- [ ] All interactive elements ≥ 44px touch targets
- [ ] CSS added to `theme.css` with theme-aware properties
- [ ] File under 400 lines (or spell card extracted)
- [ ] `npx tsc --noEmit` passes
