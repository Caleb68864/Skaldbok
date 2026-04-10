# Spec: Printable Character Sheet
**Run:** 2026-03-27T19-37-55-design-doc
**Phase:** forge
**Date:** 2026-03-27
**Author:** forge-agent (from design doc by Caleb Bennett)
**Status:** ready-to-implement

---

## Intent Hierarchy

```
MISSION (Why this exists)
  Players need a paper reference at the table. The digital app is the
  source of truth, but a printout matching the official Dragonbane sheet
  format is familiar and functional for in-person play.

GOAL (What success looks like)
  A user navigates to /print, sees their character's data in a single-page
  layout closely matching the official Dragonbane character sheet, toggles
  between color and B&W, and prints or saves as PDF.

CONSTRAINTS (Non-negotiables)
  - MUST render all data from the existing CharacterRecord (no new fields)
  - MUST fit on one letter-size portrait page (no page 2)
  - MUST NOT include interactive elements (no toggles, edits, state mutations)
  - MUST NOT depend on external font CDNs (use app's bundled fonts for PWA offline)
  - MUST work in Chrome print. Firefox/Safari are nice-to-have.

FREEDOMS (Agent decides autonomously)
  - CSS class names, HTML structure, grid layout details
  - Font sizes and spacing to fit one page
  - How to render dots, diamonds, checkboxes, and decorative elements
  - Internal component structure (sub-functions vs inline JSX)
  - Section proportions and spacing
  - Whether to render the portrait image or skip it
```

---

## Scored Sub-Specifications

Each sub-spec is scored by **Impact** (1–5, how critical to mission success) and **Risk** (1–5, how likely to go wrong). Higher scores warrant more care.

---

### SUB-SPEC 1 — Route Registration
**Impact:** 5 | **Risk:** 2 | **Priority:** P0

#### Intent
The `/print` route must exist outside `AppLayout` so it renders without TopBar or BottomNav. This is the foundation all other sub-specs depend on.

#### Implementation
- File: `src/routes/index.tsx`
- Add a sibling `RouteObject` **before** the existing `AppLayout` route:
  ```typescript
  import PrintableSheetScreen from '../screens/PrintableSheetScreen';

  export const routes: RouteObject[] = [
    { path: '/print', element: <PrintableSheetScreen /> },  // NEW
    {
      element: <AppLayout />,
      children: [ ...existing routes... ],
    },
  ];
  ```
- The `*` catch-all inside `AppLayout` must NOT capture `/print` — placing the `/print` route before `AppLayout` in the array achieves this via React Router's matching order.

#### Acceptance Criteria
- [ ] `1.1` Navigating to `/print` renders `PrintableSheetScreen` without any TopBar or BottomNav chrome
- [ ] `1.2` All existing routes (`/library`, `/sheet`, `/skills`, etc.) continue to work unchanged
- [ ] `1.3` TypeScript compiles without errors after the route change

---

### SUB-SPEC 2 — PrintableSheetScreen (Screen Container)
**Impact:** 5 | **Risk:** 2 | **Priority:** P0

#### Intent
The screen layer owns: reading context, guarding for no-character, computing derived values, managing the `colorMode` toggle state, and rendering the floating toolbar. It delegates all layout to `PrintableSheet`.

#### File
`src/screens/PrintableSheetScreen.tsx`

#### Implementation
```
PrintableSheetScreen
├── useActiveCharacter() → { character, isLoading }
├── useSystemDefinition(character?.systemId ?? 'dragonbane') → { system }
├── getDerivedValue(character, key).effective for all 4 derived stats
├── useState<'color' | 'bw'>('color') → colorMode
├── Guard: isLoading → <div>Loading...</div>
├── Guard: !character → navigate('/library'); return null
├── Renders: <PrintableSheet character={character} system={system} derived={derived} colorMode={colorMode} />
└── Renders: floating toolbar (hidden via @media print)
       ├── [Print] → window.print()
       ├── [← Back] → navigate(-1)
       └── [Color / B&W] toggle → setColorMode(...)
```

#### Derived Values Object
```typescript
interface PrintDerivedValues {
  damageBonus: string;       // getDerivedValue(character, 'damageBonus').effective
  aglDamageBonus: string;    // getDerivedValue(character, 'aglDamageBonus').effective
  movement: number;          // getDerivedValue(character, 'movement').effective
  encumbranceLimit: number;  // getDerivedValue(character, 'encumbranceLimit').effective
  hpMax: number;             // getDerivedValue(character, 'hpMax').effective
  wpMax: number;             // getDerivedValue(character, 'wpMax').effective
}
```

#### Toolbar Spec
- Position: fixed, bottom-right of viewport, `z-index` high enough to overlay sheet
- Buttons: "Print", "← Back", and a toggle labeled "Color" / "B&W"
- All toolbar elements: `display: none` inside `@media print`
- No persistence of colorMode (session-only state)

#### Acceptance Criteria
- [ ] `2.1` Screen renders `<PrintableSheet>` when a character is active
- [ ] `2.2` Screen redirects to `/library` when no active character on mount
- [ ] `2.3` Floating toolbar shows Print, Back, and Color/B&W buttons
- [ ] `2.4` Clicking Print calls `window.print()`
- [ ] `2.5` Clicking Back navigates to previous route
- [ ] `2.6` Color/B&W toggle changes `colorMode` prop passed to `PrintableSheet`
- [ ] `2.7` Toolbar is not visible in Chrome Print Preview

---

### SUB-SPEC 3 — PrintableSheet (Pure Render Component)
**Impact:** 5 | **Risk:** 4 | **Priority:** P0

#### Intent
A pure render component: `CharacterRecord` in, static HTML out. Zero interactivity, zero side effects. The single source of truth for print layout.

#### File
`src/components/PrintableSheet.tsx` (or `src/screens/PrintableSheet.tsx` — co-locate with screen is acceptable)

#### Props Interface
```typescript
interface PrintableSheetProps {
  character: CharacterRecord;
  system: SystemDefinition;
  derived: PrintDerivedValues;
  colorMode: 'color' | 'bw';
}
```

#### Layout Structure (top-to-bottom, single page)
```
┌──────────────────────────────────────────────────────┐  ← @page margin 0.25in
│  HEADER                                              │
│  "DRAGONBANE" display text + decorative bar          │
│  Name | Player | Kin | Age | Profession              │
│  Weakness | Appearance                               │
├──────────────────────────────────────────────────────┤
│  ATTRIBUTE BAND                                      │
│  STR | CON | AGL | INT | WIL | CHA  (6 boxes)       │
│  + condition checkboxes below: Exhausted Sickly      │
│    Dazed Angry Scared Disheartened                   │
├──────────────────────────────────────────────────────┤
│  DERIVED STATS ROW                                   │
│  Damage Bonus STR | Damage Bonus AGL                 │
│  Movement | Encumbrance Limit                        │
├───────────────┬──────────────────┬───────────────────┤
│  LEFT COL     │  CENTER COL      │  RIGHT COL        │
│               │                  │                   │
│  Abilities &  │  Skills          │  Inventory        │
│  Spells       │  (General 20 +   │  (10 slots +      │
│               │  Weapon 10 +     │  Memento +        │
│  ─────────    │  Secondary 6)    │  Tiny Items)      │
│  Currency     │                  │                   │
│  Gold Silver  │                  │                   │
│  Copper       │                  │                   │
├───────────────┴──────────────────┴───────────────────┤
│  LOWER SECTION (3 columns)                           │
│  Armor & Helmet | Weapons Table | Resource Trackers  │
└──────────────────────────────────────────────────────┘
```

#### Color Mode CSS Classes
- Container class: `print-sheet--color` or `print-sheet--bw` (driven by `colorMode` prop)
- Color mode: teal headers, parchment/cream background (`#f5f0e8`), red HP, green WP
- B&W mode: black borders, white backgrounds, no color fills

#### Acceptance Criteria
- [ ] `3.1` Component renders without runtime errors for a fully-populated `CharacterRecord`
- [ ] `3.2` Component renders without runtime errors for a mostly-empty `CharacterRecord` (new character)
- [ ] `3.3` `colorMode='bw'` applies `.print-sheet--bw` class; `colorMode='color'` applies `.print-sheet--color`
- [ ] `3.4` No `onClick`, `onChange`, `onSubmit`, or other event handlers in the component tree
- [ ] `3.5` TypeScript: no implicit `any`, no type errors

---

### SUB-SPEC 4 — Header Section
**Impact:** 4 | **Risk:** 2 | **Priority:** P1

#### Intent
Visual identity of the sheet. Establishes the Dragonbane aesthetic and contains identity fields.

#### Field Mapping
| Display Label | Source |
|---|---|
| Name | `character.name` |
| Player | *(leave blank — not in CharacterRecord)* |
| Kin | `character.metadata.kin` |
| Age | `character.metadata.age` |
| Profession | `character.metadata.profession` |
| Weakness | `character.metadata.weakness` |
| Appearance | `character.metadata.appearance` |

#### Visual Requirements
- "DRAGONBANE" rendered in `var(--font-display)` (Marcellus) at a large size
- Decorative horizontal bar/banner in teal (color mode) or dark gray (B&W mode)
- Fields laid out as labeled lines matching the official PDF style
- Empty fields render as blank underlines — no "N/A" text

#### Acceptance Criteria
- [ ] `4.1` All 6 identity fields (Name, Kin, Age, Profession, Weakness, Appearance) are present and populated
- [ ] `4.2` Empty metadata fields render as blank lines (not "N/A" or placeholder)
- [ ] `4.3` "Player" field renders as blank line (not an error or missing element)
- [ ] `4.4` Header is visually distinct (larger text, decorative element) from body sections

---

### SUB-SPEC 5 — Attribute Band & Conditions
**Impact:** 5 | **Risk:** 2 | **Priority:** P0

#### Intent
Core mechanical data. Attributes drive almost every roll; conditions affect character capabilities.

#### Attribute Field Mapping (lowercase keys)
| Label | Source Key |
|---|---|
| STR | `character.attributes['str']` |
| CON | `character.attributes['con']` |
| AGL | `character.attributes['agl']` |
| INT | `character.attributes['int']` |
| WIL | `character.attributes['wil']` |
| CHA | `character.attributes['cha']` |

#### Condition Field Mapping (lowercase keys)
| Label | Source Key |
|---|---|
| Exhausted | `character.conditions['exhausted']` |
| Sickly | `character.conditions['sickly']` |
| Dazed | `character.conditions['dazed']` |
| Angry | `character.conditions['angry']` |
| Scared | `character.conditions['scared']` |
| Disheartened | `character.conditions['disheartened']` |

#### Rendering Rules
- Each attribute: large number in a labeled box
- Each condition: diamond marker (◆ filled if true, ◇ empty if false), followed by label
- Default attribute value if undefined: `''` (blank, not 0)

#### Acceptance Criteria
- [ ] `5.1` All 6 attribute values display correctly from `character.attributes` (lowercase keys)
- [ ] `5.2` All 6 condition checkboxes display; filled when `true`, empty when `false` or missing
- [ ] `5.3` Missing/undefined attributes render as blank (not "0" or error)

---

### SUB-SPEC 6 — Derived Stats Row
**Impact:** 4 | **Risk:** 2 | **Priority:** P1

#### Intent
Derived values that players reference frequently in combat and exploration. Must use `getDerivedValue()` to respect user overrides.

#### Field Mapping
| Label | Source |
|---|---|
| Damage Bonus (STR) | `derived.damageBonus` (e.g. "+D4", "+D6", "+0") |
| Damage Bonus (AGL) | `derived.aglDamageBonus` |
| Movement | `derived.movement` |
| Encumbrance Limit | `derived.encumbranceLimit` |

#### Acceptance Criteria
- [ ] `6.1` All 4 derived stats display with correct values for the active character
- [ ] `6.2` Override values (from `character.derivedOverrides`) are reflected (passed via `derived` prop computed with `getDerivedValue()`)
- [ ] `6.3` Derived stats are clearly labeled and legible

---

### SUB-SPEC 7 — Skills Section
**Impact:** 5 | **Risk:** 3 | **Priority:** P0

#### Intent
Skills are the primary mechanical section. Players reference these on every roll. Must be complete and correctly ordered.

#### Skill Groups to Render
1. **General Skills** (20 canonical skills from system definition)
2. **Weapon Skills** (10 canonical weapon skills from system definition)
3. **Secondary Skills** (render up to 6 slots; show existing skills, blank lines for remainder)

#### Skill Field Mapping
For each skill in `system.skills` canonical order:
```
skill key         → e.g. 'acrobatics', 'beast_lore', 'spot_hidden'
character.skills[key].value    → skill value (number)
character.skills[key].trained  → whether trained (boolean)
```

#### Rendering Rules
- Each skill row: trained indicator (diamond ◆/◇) + skill name + value
- **No advancement checkboxes** (omitted intentionally, per design doc)
- Skill name from `system.skills[key].name` or a formatted version of the key
- If `character.skills[key]` is undefined: show 0 or blank value, show untrained
- Follow system's canonical skill ordering

#### Acceptance Criteria
- [ ] `7.1` All 20 general skills are listed in canonical system order
- [ ] `7.2` All 10 weapon skills are listed
- [ ] `7.3` Trained indicator is filled (◆) for trained skills, empty (◇) for untrained
- [ ] `7.4` Skill values display correctly (numeric)
- [ ] `7.5` Secondary skills section shows up to 6 slots; existing skills populate, remainder are blank lines
- [ ] `7.6` No advancement checkboxes are present

---

### SUB-SPEC 8 — Abilities & Spells Section
**Impact:** 3 | **Risk:** 2 | **Priority:** P2

#### Intent
Lists the character's heroic abilities and known spells for quick reference. Names only — no mechanical detail needed.

#### Field Mapping
- `character.heroicAbilities` → HeroicAbility[] → render `ability.name`
- `character.spells` → Spell[] → render `spell.name`

#### Rendering Rules
- Label "Abilities & Spells" (or split as "Abilities" / "Spells")
- Render names as a list; blank lines below to fill fixed height
- If both lists are empty, render all blank lines
- Use `overflow: hidden` on the container — fixed height, no overflow to page 2
- Enough slots for ~8–10 entries total (or split per type)

#### Acceptance Criteria
- [ ] `8.1` All heroic ability names are listed
- [ ] `8.2` All spell names are listed
- [ ] `8.3` Empty slots render as blank lines (not hidden)
- [ ] `8.4` Section does not grow beyond its allocated vertical space

---

### SUB-SPEC 9 — Currency Section
**Impact:** 2 | **Risk:** 1 | **Priority:** P3

#### Intent
Quick coin reference. Uses correct top-level field (NOT `metadata`).

#### Field Mapping
| Label | Source |
|---|---|
| Gold | `character.coins.gold` |
| Silver | `character.coins.silver` |
| Copper | `character.coins.copper` |

#### Acceptance Criteria
- [ ] `9.1` Gold, Silver, Copper values display from `character.coins` (NOT `character.metadata`)
- [ ] `9.2` Value `0` renders as `0` (not blank)

---

### SUB-SPEC 10 — Inventory Section
**Impact:** 3 | **Risk:** 2 | **Priority:** P2

#### Intent
Gear tracking. Fixed 10-slot grid matching the official PDF.

#### Field Mapping
- `character.inventory` → InventoryItem[] → show `item.name` (up to 10 items)
- `character.memento` → string → single labeled slot (**top-level field, NOT `metadata.memento`**)
- `character.tinyItems` → string[] → list in Tiny Items area

#### Rendering Rules
- 10 numbered inventory slots; items fill from top, unused slots = blank lines
- Memento: one labeled line below or beside inventory
- Tiny Items: a small labeled area (comma-joined names or list)
- `overflow: hidden` on container

#### Acceptance Criteria
- [ ] `10.1` Up to 10 inventory items display by name
- [ ] `10.2` Memento reads from `character.memento` (top-level, not metadata)
- [ ] `10.3` Tiny items display in a dedicated labeled area
- [ ] `10.4` Unused inventory slots render as blank lines (not hidden)
- [ ] `10.5` More than 10 items do not overflow the section (truncate/clip silently)

---

### SUB-SPEC 11 — Armor & Helmet Section
**Impact:** 3 | **Risk:** 2 | **Priority:** P2

#### Field Mapping
```
character.armor?.name     → Armor name
character.armor?.rating   → Armor rating
character.armor?.features → Bane-on / features text
character.helmet?.name    → Helmet name
character.helmet?.rating  → Helmet rating
character.helmet?.features → Bane-on / features text
```

#### Rendering Rules
- Two sub-rows: Armor and Helmet
- Fields: Name, Rating, Features/Bane-on
- If `null`, all fields render as blank lines

#### Acceptance Criteria
- [ ] `11.1` Armor name, rating, and features display from `character.armor`
- [ ] `11.2` Helmet name, rating, and features display from `character.helmet`
- [ ] `11.3` Null armor/helmet renders as blank lines (not an error or "None")

---

### SUB-SPEC 12 — Weapons Table
**Impact:** 4 | **Risk:** 2 | **Priority:** P1

#### Intent
Combat reference. The table must match official PDF column structure.

#### Field Mapping
For `character.weapons[0..2]` (up to 3 weapons):
| Column | Source |
|---|---|
| Name | `weapon.name` |
| Grip | `weapon.grip` (display as "1H" / "2H") |
| Range | `weapon.range` |
| Damage | `weapon.damage` |
| Durability | `weapon.durability` |
| Features | `weapon.features` |

#### Rendering Rules
- Table with 6 columns: Name / Grip / Range / Damage / Durability / Features
- Show exactly 3 rows; populate from `character.weapons`, leave remaining rows blank
- Column headers match official PDF labels
- If fewer than 3 weapons, remaining rows are blank lines

#### Acceptance Criteria
- [ ] `12.1` Table has columns: Name, Grip, Range, Damage, Durability, Features
- [ ] `12.2` Up to 3 weapons populate the table from `character.weapons`
- [ ] `12.3` Grip displays as "1H" for one-handed, "2H" for two-handed
- [ ] `12.4` Remaining rows (< 3 weapons) render as blank lines
- [ ] `12.5` More than 3 weapons do not overflow the table

---

### SUB-SPEC 13 — Resource Trackers (HP, WP, Death Rolls)
**Impact:** 5 | **Risk:** 3 | **Priority:** P0

#### Intent
HP and WP are the most-referenced values during play. Dots must accurately reflect current vs. max. Death rolls are critical at 0 HP.

#### Field Mapping
```
character.resources['hp'].current → filled HP dots
character.resources['hp'].max     → total HP dots (= derived.hpMax = CON)
character.resources['wp'].current → filled WP dots
character.resources['wp'].max     → total WP dots (= derived.wpMax = WIL)
```

#### Dot Rendering Rules
- Render `max` dots total
- First `current` dots: filled (●)
- Remaining dots: empty (○)
- Layout: `display: grid; grid-template-columns: repeat(9, 1fr)` (wraps for high values)
- HP dots: red fill in color mode, dark gray in B&W
- WP dots: green fill in color mode, dark gray in B&W

#### Rest Checkboxes
- Round Rest: render checkbox (unchecked, static — no interaction)
- Stretch Rest: render checkbox (unchecked, static)

#### Death Rolls
- 3 success boxes + 3 failure boxes (static, all unchecked)
- Always render (even at full HP — the print sheet shows all elements)

#### Acceptance Criteria
- [ ] `13.1` HP total dots = `derived.hpMax`; filled dots = `character.resources['hp'].current`
- [ ] `13.2` WP total dots = `derived.wpMax`; filled dots = `character.resources['wp'].current`
- [ ] `13.3` Filled dots visually distinct from empty dots
- [ ] `13.4` HP dots are red (color mode) or dark gray (B&W mode)
- [ ] `13.5` WP dots are green (color mode) or dark gray (B&W mode)
- [ ] `13.6` Death roll boxes (3 success, 3 failure) are present and unchecked
- [ ] `13.7` Round Rest and Stretch Rest checkbox areas are present

---

### SUB-SPEC 14 — Print CSS (`print-sheet.css`)
**Impact:** 5 | **Risk:** 4 | **Priority:** P0

#### Intent
The CSS layer is what makes this a real printable sheet. One-page constraint, paper dimensions, and color fidelity all depend on getting this right.

#### Required CSS Rules
```css
/* Page setup */
@page {
  size: letter portrait;
  margin: 0.25in;
}

/* Sheet container */
.print-sheet {
  width: 8.5in;
  height: 11in;
  overflow: hidden;
  box-sizing: border-box;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

/* Hide toolbar on print */
@media print {
  .print-toolbar { display: none !important; }
  body { margin: 0; padding: 0; }
}

/* Color mode */
.print-sheet--color {
  background-color: #f5f0e8; /* parchment */
}
.print-sheet--color .sheet-header { background-color: #2a7a7a; /* teal */ }
.print-sheet--color .hp-dot-filled { background-color: #c0392b; }
.print-sheet--color .wp-dot-filled { background-color: #27ae60; }

/* B&W mode */
.print-sheet--bw {
  background-color: #ffffff;
}
.print-sheet--bw .sheet-header { background-color: #1a1a1a; color: #ffffff; }
.print-sheet--bw .hp-dot-filled { background-color: #333333; }
.print-sheet--bw .wp-dot-filled { background-color: #333333; }
```

#### Font Usage
- `--font-display`: Marcellus (for "DRAGONBANE" title and section headers)
- `--font-ui`: Source Serif 4 (for labels)
- `--font-text`: Source Sans 3 (for values and body text)
- **No external font CDN links** — the app's bundled fonts are used via CSS custom properties

#### Minimum Text Size
- No text below 7pt / ~9px equivalent on screen

#### Acceptance Criteria
- [ ] `14.1` `@page { size: letter portrait; margin: 0.25in; }` is defined
- [ ] `14.2` `.print-sheet` has `width: 8.5in; height: 11in; overflow: hidden`
- [ ] `14.3` `print-color-adjust: exact` and `-webkit-print-color-adjust: exact` are set
- [ ] `14.4` `@media print` hides `.print-toolbar`
- [ ] `14.5` Color and B&W mode classes produce visually distinct outputs
- [ ] `14.6` No external font CDN `@import` or `<link>` tags
- [ ] `14.7` No text is smaller than 7pt / 9px on screen

---

### SUB-SPEC 15 — Single-Page Constraint
**Impact:** 5 | **Risk:** 5 | **Priority:** P0

#### Intent
The most likely failure mode is content overflowing to page 2. This sub-spec defines the mitigation strategy.

#### Strategy
1. The `.print-sheet` container is `height: 11in; overflow: hidden` — hard stop
2. Variable-length sections (abilities/spells, inventory, secondary skills) use `overflow: hidden` with fixed heights
3. Font size baseline: ~8–9px (7–8pt) for dense data sections
4. If overflow still occurs during testing, agent may:
   - Reduce font size in data sections (minimum 7pt)
   - Reduce padding/margin between sections
   - Reduce number of blank slots shown (e.g., secondary skills from 6 to 4)

#### Warning Signals (to monitor in Chrome Print Preview)
- Page count > 1
- Clipped section headers at bottom of page
- Missing lower section (weapons/trackers/armor)

#### Acceptance Criteria
- [ ] `15.1` Chrome Print Preview (Ctrl+P) shows exactly 1 page for a fully-populated character
- [ ] `15.2` Chrome Print Preview shows exactly 1 page for an empty character
- [ ] `15.3` All 10 major sections are visible within the single page (no section is cut off)

---

## Full Acceptance Criteria Checklist

The following 8 criteria are from the original design doc. All must pass for the implementation to be considered complete.

| # | Criterion | Sub-Spec |
|---|---|---|
| AC-1 | All sections from the official PDF are present and populated from CharacterRecord data | 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 |
| AC-2 | Sheet fits on exactly one printed letter-size portrait page with no overflow to page 2 | 14, 15 |
| AC-3 | Color/B&W toggle switches all colored elements (headers, resource bars, backgrounds) | 3, 14 |
| AC-4 | Printed output is legible at standard letter size — no text smaller than ~8px equivalent | 14 |
| AC-5 | Blank/empty fields render as empty lines — no "N/A" or placeholder text | 4, 8, 10, 11, 12 |
| AC-6 | Navigating to `/print` with no active character redirects to `/library` | 2 |
| AC-7 | The floating toolbar (Print, Back, Color/B&W) is hidden when printing | 2, 14 |
| AC-8 | Resource dots (HP/WP) correctly show filled dots for current value and empty dots for remaining | 13 |

---

## Files to Create / Modify

| File | Action | Sub-Specs |
|---|---|---|
| `src/routes/index.tsx` | Modify: add `/print` route before AppLayout | 1 |
| `src/screens/PrintableSheetScreen.tsx` | Create: screen container | 2 |
| `src/components/PrintableSheet.tsx` | Create: pure render component | 3–13 |
| `src/styles/print-sheet.css` | Create: print-optimized CSS | 14, 15 |

> Note: CSS file location (`src/styles/` vs `src/`) is agent's choice; import it in `PrintableSheetScreen.tsx` or `PrintableSheet.tsx`.

---

## Key Codebase Conventions

### Hooks
```typescript
// Active character
const { character, isLoading } = useActiveCharacter();
// from: src/context/ActiveCharacterContext.tsx

// System definition
const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');
// from: src/features/systems/useSystemDefinition.ts

// Derived values (handles overrides)
getDerivedValue(character, 'damageBonus').effective    // → string e.g. "+D4"
getDerivedValue(character, 'aglDamageBonus').effective // → string e.g. "+0"
getDerivedValue(character, 'movement').effective       // → number 10
getDerivedValue(character, 'encumbranceLimit').effective // → number e.g. 8
getDerivedValue(character, 'hpMax').effective          // → number (= CON)
getDerivedValue(character, 'wpMax').effective          // → number (= WIL)
// from: src/utils/derivedValues.ts
```

### No-Character Guard Pattern
```typescript
if (isLoading) return <div>Loading...</div>;
if (!character) { navigate('/library'); return null; }
```

### Field Key Conventions
- Attribute keys: **lowercase** — `'str'`, `'con'`, `'agl'`, `'int'`, `'wil'`, `'cha'`
- Condition keys: **lowercase** — `'exhausted'`, `'sickly'`, `'dazed'`, `'angry'`, `'scared'`, `'disheartened'`
- Skill keys: **snake_case** — `'beast_lore'`, `'spot_hidden'`, `'acrobatics'`
- Coins: `character.coins.gold` / `.silver` / `.copper` (**NOT** `character.metadata.gold`)
- Memento: `character.memento` (**top-level string, NOT** `character.metadata.memento`)

### Inline Styles Exception
The print CSS file (`print-sheet.css`) is an **intentional exception** to the codebase's inline-styles convention. `@page` rules and `@media print` blocks cannot be expressed as inline styles.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sheet overflows to page 2 with many spells/abilities | High | Critical | `overflow: hidden` + fixed heights on variable sections; reduce font sizes |
| CSS font variables not resolving in print context | Medium | High | Test in Chrome Print Preview early; fall back to font-family stacks |
| `getDerivedValue` returning unexpected types | Low | Medium | Coerce to string/number at render point |
| Skill key mismatches (wrong snake_case) | Medium | Medium | Pull skill names from `system.skills` keyed object; log unknown keys |
| TypeScript errors in new screen | Low | Low | Follow existing screen patterns; run `tsc --noEmit` after each file |

---

## Escalation Triggers

Implementing agent MUST stop and report to human if:
1. A new npm dependency would be required to implement any part of this spec
2. The `CharacterRecord` type needs modification to add missing fields
3. Content cannot fit on one page after applying all mitigation strategies (font reduction, padding reduction, slot reduction)
4. The system definition's `skills` structure differs significantly from what this spec assumes

---

## Scoring Summary

| Sub-Spec | Description | Impact | Risk | Priority |
|---|---|---|---|---|
| 1 | Route Registration | 5 | 2 | P0 |
| 2 | PrintableSheetScreen | 5 | 2 | P0 |
| 3 | PrintableSheet Component | 5 | 4 | P0 |
| 4 | Header Section | 4 | 2 | P1 |
| 5 | Attribute Band & Conditions | 5 | 2 | P0 |
| 6 | Derived Stats Row | 4 | 2 | P1 |
| 7 | Skills Section | 5 | 3 | P0 |
| 8 | Abilities & Spells | 3 | 2 | P2 |
| 9 | Currency | 2 | 1 | P3 |
| 10 | Inventory | 3 | 2 | P2 |
| 11 | Armor & Helmet | 3 | 2 | P2 |
| 12 | Weapons Table | 4 | 2 | P1 |
| 13 | Resource Trackers | 5 | 3 | P0 |
| 14 | Print CSS | 5 | 4 | P0 |
| 15 | Single-Page Constraint | 5 | 5 | P0 |

**P0 sub-specs (must pass):** 1, 2, 3, 5, 7, 13, 14, 15
**P1 sub-specs (should pass):** 4, 6, 12
**P2 sub-specs (nice to have):** 8, 10, 11
**P3 sub-specs (low priority):** 9

---

*Spec generated by forge-agent from design doc authored by Caleb Bennett, 2026-03-27*
