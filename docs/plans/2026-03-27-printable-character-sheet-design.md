---
date: 2026-03-27
topic: "Printable Character Sheet"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-03-27
tags:
  - design
  - printable-character-sheet
---

# Printable Character Sheet -- Design

## Summary
Add a print-friendly page to Skaldmark that renders the active character's data as a static, non-interactive sheet mimicking the official Dragonbane character sheet PDF. The page supports both color and black-and-white printing via a toggle in a floating toolbar. The layout closely follows the official PDF's structure (header, attribute band, 3-column body, lower equipment/trackers section) on a single letter-size portrait page.

## Approach Selected
**Dedicated Print Route with Standalone CSS** -- a new `/print` route renders a pure React component with its own print-optimized CSS. The existing HTML prototype (`dragonbane_character_sheet.html`) serves as structural reference and starting point, restyled toward the official PDF's layout and proportions.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  App (React Router)                                     │
│                                                         │
│  /library  /sheet  /skills  ...  /print  <-- NEW ROUTE  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  PrintableSheetScreen                             │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  PrintableSheet (pure render component)     │  │  │
│  │  │  - Reads CharacterRecord from context       │  │  │
│  │  │  - Zero interactivity (no onClick, etc.)    │  │  │
│  │  │  - Fixed 8.5" x 11" layout                  │  │  │
│  │  │  - Dedicated print-sheet.css                │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  Floating toolbar (hidden on print):              │  │
│  │    [Print] [Back] [Color / B&W toggle]            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

Key decisions:
- `/print` route renders **outside** `AppLayout` -- no TopBar or BottomNav. This is a new routing pattern: add a sibling route object at the same level as the AppLayout route in `src/routes/index.tsx`
- `PrintableSheet` is a pure render component: `CharacterRecord` in, static HTML out
- Dedicated `print-sheet.css` with fixed dimensions, `@page` rules, `print-color-adjust: exact`. This is an intentional exception to the codebase's inline-styles convention — print CSS requires `@page` rules and `@media print` blocks that cannot be expressed inline
- No dependency on the app's dark theme CSS variables
- A "Print" button on the Sheet screen navigates to `/print`; browser Ctrl+P also works since the CSS handles it
- **Fonts:** Use the app's existing font stack (`--font-display: Marcellus`, `--font-ui: Source Serif 4`, `--font-text: Source Sans 3`) rather than the HTML prototype's fonts (Cinzel, Crimson Text). This avoids a separate font loading dependency and keeps the print page working offline (PWA). The app fonts are similar enough in feel to work well for a print sheet

## Components

### PrintableSheetScreen (screen-level)
- **Owns:** Route handling, reading `ActiveCharacterContext`, the floating toolbar
- **Does NOT own:** Layout or rendering of the sheet itself
- **Behavior:** If no active character, redirects to `/library`. Otherwise renders `PrintableSheet` with character data. Floating toolbar has Print, Back, and Color/B&W toggle buttons -- all hidden via `@media print`

### PrintableSheet (pure render)
- **Owns:** The entire 8.5" x 11" sheet layout, all visual sections
- **Does NOT own:** Data fetching, navigation, any interactivity
- **Props:** `character: CharacterRecord`, `system: SystemDefinition`, `colorMode: 'color' | 'bw'`
- **Sections rendered:**

| Section | Content | Layout Position |
|---------|---------|----------------|
| Header | "DRAGONBANE" styled text with teal/green decorative bar, Name, Player, Kin, Age, Profession, Weakness, Appearance | Top |
| Attributes | 6 attribute values (STR/CON/AGL/INT/WIL/CHA) + condition checkboxes (diamond markers) | Band below header |
| Derived Stats | Damage Bonus STR, Damage Bonus AGL, Movement, Encumbrance Limit | Row below attributes |
| Abilities & Spells | List of ability/spell names (left column) | Main body, left |
| Currency | Gold, Silver, Copper (below abilities) | Main body, left bottom |
| Skills | General skills (20) + Weapon skills (10) + Secondary skills, with trained diamonds + values. No advancement checkboxes. | Main body, center |
| Inventory | 10 inventory slots + Memento + Tiny Items | Main body, right |
| Armor & Helmet | Name, rating, bane-on lists | Lower left |
| Weapons | Table: Name / Grip / Range / Damage / Durability / Features (3 rows) | Lower center |
| Resource Trackers | Round Rest / Stretch Rest checkboxes, WP dots, HP dots, Death Rolls (successes/failures) | Lower right |

### Route Registration
- Add `/print` to router config as a top-level route (not nested under `AppLayout`)

## Data Flow

```
ActiveCharacterContext
        |
        v
PrintableSheetScreen
  |  reads: character via useActiveCharacter()
  |    -> returns { character, isLoading } (CharacterRecord | null)
  |  reads: system via useSystemDefinition(character?.systemId ?? 'dragonbane')
  |    -> returns { system } (SystemDefinition | null)
  |  computes: derived values via computeDerivedValues(character) from src/utils/derivedValues.ts
  |  state: colorMode ('color' | 'bw')
  |
  |  if isLoading -> show loading indicator
  |  if !character -> navigate('/library'); return null
  |
  v
PrintableSheet (props: character, system, derived, colorMode)
  |
  |  Field mapping (verified against src/types/character.ts):
  |
  |  character.name                    -> Name field
  |  character.metadata.kin            -> Kin field
  |  character.metadata.profession     -> Profession field
  |  character.metadata.age            -> Age field
  |  character.metadata.weakness       -> Weakness field
  |  character.metadata.appearance     -> Appearance field
  |  character.attributes['str']       -> STR value (lowercase keys)
  |  character.conditions['exhausted'] -> Exhausted checkbox (filled/empty)
  |  character.skills['acrobatics']    -> { value: number, trained: boolean }
  |  character.resources['hp']         -> { current: number, max: number }
  |  character.resources['wp']         -> { current: number, max: number }
  |  character.weapons[0..N]           -> Weapon table rows (show up to 3)
  |  character.armor                   -> ArmorPiece | null
  |  character.helmet                  -> ArmorPiece | null
  |  character.inventory               -> InventoryItem[] (show up to 10)
  |  character.tinyItems               -> string[]
  |  character.memento                 -> string (top-level, NOT in metadata)
  |  character.spells                  -> Spell[]
  |  character.heroicAbilities         -> HeroicAbility[]
  |  character.coins.gold              -> number (NOT metadata.gold)
  |  character.coins.silver            -> number
  |  character.coins.copper            -> number
  |  character.portraitUri             -> optional portrait image
  |
  |  Derived values (computed, NOT stored on character):
  |  Use getDerivedValue(character, key) to respect derivedOverrides:
  |    getDerivedValue(character, 'damageBonus').effective   -> STR damage bonus
  |    getDerivedValue(character, 'aglDamageBonus').effective -> AGL damage bonus
  |    getDerivedValue(character, 'movement').effective       -> movement rate
  |    getDerivedValue(character, 'encumbranceLimit').effective -> encumbrance limit
  |
  v
Static HTML -> @media print -> Paper
```

Derived values (damage bonuses, movement, encumbrance) are computed on-the-fly via `computeDerivedValues()` in `src/utils/derivedValues.ts`. The `getDerivedValue()` helper respects user overrides stored in `character.derivedOverrides`. Skill ordering follows the system definition's canonical order.

## Error Handling

1. **No active character** -- redirect to `/library` on mount
2. **Missing optional data** -- render blank lines (matching the official PDF's empty-field style). No "N/A" placeholders
3. **HP/WP dot overflow** -- grid with `repeat(9, 1fr)` columns, wraps naturally for high values
4. **Secondary skills** -- render as many as exist, blank lines up to 6 slots
5. **Print color fidelity** -- `print-color-adjust: exact` and `-webkit-print-color-adjust: exact` on the sheet container
6. **Single page constraint** -- `@page { size: letter portrait; margin: 0.25in; }` with sheet constrained to fit. No page 2.

## Color Mode

The floating toolbar includes a Color / B&W toggle:
- **Color mode:** Teal headers, parchment background, red HP bar, green WP bar -- similar to the official color PDF
- **B&W mode:** Black borders, white/light gray backgrounds, no color fills -- similar to the official printer-friendly PDF
- Implemented via CSS class on the sheet container (`print-sheet--color` vs `print-sheet--bw`)
- Toggle state only affects the current print session, no persistence needed

## Open Questions

- **Dragon artwork:** Skipped for now. Stylized "DRAGONBANE" text with a decorative green bar/banner evokes the feel without requiring complex SVG art. Can revisit later.
- **Advancement checkboxes:** Omitted to match the official sheet, which does not include them.

## Approaches Considered

### Approach A: Dedicated Print Route with Standalone CSS (Selected)
New `/print` route with a pure render component and its own CSS file. Uses the HTML prototype as structural reference, restyled toward the official PDF.
- Selected because: best balance of development speed and visual fidelity. Clean separation from app theme.

### Approach B: Port HTML Prototype Directly
Convert the existing `dragonbane_character_sheet.html` into a React component as-is.
- Not selected because: the prototype's visual style (colored parchment, teal/gold accents) diverges from the official PDF. Tailwind CDN classes would need remapping. Better to use it as reference than a direct port.

### Approach C: Pixel-Perfect PDF Recreation
Build from scratch to match the official PDF exactly, including dragon artwork and ornate borders.
- Not selected because: the dragon illustration and decorative artwork would require significant SVG recreation effort for diminishing returns. The layout and structure can match closely without reproducing the artwork.

## Acceptance Criteria

1. All sections from the official PDF are present and populated from CharacterRecord data
2. Sheet fits on exactly one printed letter-size portrait page with no overflow to page 2
3. Color/B&W toggle switches all colored elements (headers, resource bars, backgrounds)
4. Printed output is legible at standard letter size — no text smaller than ~8px equivalent
5. Blank/empty fields render as empty lines matching the official PDF's empty-field style — no "N/A" or placeholder text
6. Navigating to `/print` with no active character redirects to `/library`
7. The floating toolbar (Print, Back, Color/B&W) is hidden when printing
8. Resource dots (HP/WP) correctly show filled dots for current value and empty dots for remaining

## Commander's Intent

**Desired End State:** A user can navigate to the print page from the Sheet screen, see their character's data laid out in a single-page format closely matching the official Dragonbane character sheet, toggle between color and B&W, and print or save as PDF.

**Purpose:** Players need a paper reference at the table. The digital app is the source of truth, but a printout matching the official sheet format is familiar and functional for in-person play.

**Constraints:**
- MUST render all data from the existing CharacterRecord — no new data fields
- MUST fit on one letter-size portrait page
- MUST NOT include interactive elements (no toggles, no edits, no state mutations)
- MUST NOT depend on external font CDNs (use app's bundled fonts for PWA offline support)
- MUST work in Chrome print. Firefox and Safari are nice-to-have.

**Freedoms:**
- The implementing agent MAY adjust font sizes, spacing, and grid proportions to fit content on one page
- The implementing agent MAY simplify ornamental elements (borders, decorative lines) from the prototype
- The implementing agent MAY choose whether to render the portrait image or skip it
- The implementing agent MAY decide internal JSX structure (sub-functions, inline rendering, etc.)

## Execution Guidance

**Observe (signals to monitor):**
- TypeScript compiler errors after each file change
- Chrome Print Preview (Ctrl+P) after each major section is implemented — this is the primary validation loop
- Whether the sheet overflows to page 2 as content sections are added

**Orient (codebase conventions to follow):**
- Screens are default-exported functional components in `src/screens/NameScreen.tsx`
- Use `useActiveCharacter()` hook → returns `{ character, updateCharacter, isLoading }`
- Use `useSystemDefinition(character?.systemId ?? 'dragonbane')` → returns `{ system }`
- Standard "no character" guard pattern:
  ```
  if (isLoading) return <div>Loading...</div>;
  if (!character) { navigate('/library'); return null; }
  ```
- The print CSS file is an intentional exception to the inline-styles convention
- Route registration: add a sibling route object to the existing AppLayout route in `src/routes/index.tsx`:
  ```
  export const routes: RouteObject[] = [
    { path: '/print', element: <PrintableSheetScreen /> },  // NEW: outside AppLayout
    {
      element: <AppLayout />,
      children: [ ... existing routes ... ],
    },
  ];
  ```

**Escalate When:**
- A new npm dependency would be required
- The CharacterRecord type needs modification
- Content cannot fit on one page without removing sections

**Shortcuts (apply without deliberation):**
- Use `getDerivedValue(character, key).effective` for all derived stats (it handles overrides)
- Use `character.coins.gold` / `.silver` / `.copper` for currency (NOT metadata)
- Use `character.memento` directly (top-level string, NOT in metadata)
- Attribute keys are lowercase: `character.attributes['str']`, `character.attributes['con']`, etc.
- Skill keys are snake_case: `character.skills['beast_lore']`, `character.skills['spot_hidden']`, etc.
- Reference the HTML prototype at `C:\Users\CalebBennett\Documents\Notes\DragonBane\08_Build\html\dragonbane_character_sheet.html` for layout structure and section proportions

## Decision Authority

**Agent Decides Autonomously:**
- CSS class names, HTML structure, grid layout details
- Font sizes and spacing to fit one page
- How to render dots, diamonds, checkboxes, and decorative elements
- Internal component structure (sub-functions vs inline JSX)
- Section proportions and spacing

**Agent Recommends, Human Approves:**
- Any deviations from the official PDF section layout order
- Whether to include the character portrait on the print page

**Human Decides:**
- Visual fidelity trade-offs (what to simplify or omit)
- Whether to add a Print button to the Sheet screen in this same scope or as a separate task
- Scope changes (adding features beyond what's specified)

## War-Game Results

**Most Likely Failure:** Print layout overflowing to page 2 when a character has many spells/abilities or long weapon feature text. The official PDF has fixed space; HTML can grow. **Mitigation:** Use `overflow: hidden` and fixed heights for variable-length sections (abilities list, inventory). Scale font sizes if needed. Test with a fully-loaded character.

**Scale Stress:** N/A for current scope.

**Dependency Risk:** Minimal. The print page uses the app's existing fonts (already bundled) and reads from existing context providers. No new external dependencies.

**Maintenance Assessment:** Good. A pure render component with dedicated CSS is easy to understand and modify. The separation from the app theme means app theme changes won't break print layout. The verified field mapping table in the Data Flow section prevents type mismatches.

## Evaluation Metadata
- Evaluated: 2026-03-27
- Cynefin Domain: Clear
- Critical Gaps Found: 0
- Important Gaps Found: 4 (4 resolved)
- Suggestions: 3

## Next Steps
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-27-printable-character-sheet-design.md`)
- [ ] Add Print button to Sheet screen (can be done in the same scope or separately)
