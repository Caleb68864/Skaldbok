---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 5
title: "Bundled Dragonbane System and Blank Character"
date: 2026-03-22
dependencies: ["4"]
---

# Sub-Spec 5: Bundled Dragonbane System and Blank Character

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Create the Dragonbane system definition JSON containing all game mechanical definitions (attributes, conditions, resources, skill categories with skills) and a blank character template that validates against the Zod character schema. The system JSON must contain zero copyrighted rules text -- only mechanical definitions (names, ranges, categories).

Domain reference (from project memory):
- 6 attributes: STR, CON, AGL, INT, WIL, CHA (range 3-18)
- HP = CON, WP = WIL
- 6 conditions: Exhausted(STR), Sickly(CON), Dazed(AGL), Angry(INT), Scared(WIL), Disheartened(CHA)
- 20 core skills + 10 weapon skills + 3 magic schools
- Death rolls: at 0 HP, track successes/failures (3 of either ends it)

## Interface Contracts

### Provides
- `src/systems/dragonbane/system.json`: Complete Dragonbane SystemDefinition JSON
- `sample-data/dragonbane.blank.character.json`: Blank character template conforming to CharacterRecord schema

### Requires
- From sub-spec 4: `SystemDefinition` type (for shape reference), `characterRecordSchema` (for validation of blank character)

### Shared State
- The system.json will be seeded into IndexedDB by sub-spec 7's startup hydration logic.

## Implementation Steps

### Step 1: Create Dragonbane system definition JSON
- **File:** `src/systems/dragonbane/system.json`
- **Action:** create
- **Changes:** Create JSON conforming to `SystemDefinition` type:
  - `id`: `"dragonbane"`
  - `version`: `1`
  - `name`: `"dragonbane"`
  - `displayName`: `"Dragonbane"`
  - `attributes`: Array of 6 AttributeDefinitions (STR/CON/AGL/INT/WIL/CHA, min 3, max 18)
  - `conditions`: Array of 6 ConditionDefinitions with linkedAttributeId references
  - `resources`: Array of 3 ResourceDefinitions:
    - HP (derivedFrom: "con", min: 0, defaultMax: 10)
    - WP (derivedFrom: "wil", min: 0, defaultMax: 10)
    - deathRolls (min: 0, defaultMax: 3) -- tracks both success and failure counts
  - `skillCategories`: Array with categories:
    - Core Skills (20): Acrobatics, Awareness, Bartering, Beast Lore, Bluffing, Bushcraft, Crafting, Evade, Healing, Hunting & Fishing, Languages, Myths & Legends, Performance, Persuasion, Riding, Seamanship, Sleight of Hand, Sneaking, Spot Hidden, Swimming
    - Weapon Skills (10): Axes, Bows, Brawling, Crossbows, Hammers, Knives, Slings, Spears, Staves, Swords
    - Magic Schools (3): Animism, Elementalism, Mentalism (baseChance: 0)
  - Core skills get baseChance from linked attribute (varies by skill)
  - Weapon skills get baseChance based on linked attribute
  - Zero copyrighted rules text -- only names and mechanical values

### Step 2: Create blank character template
- **File:** `sample-data/dragonbane.blank.character.json`
- **Action:** create
- **Changes:** Create a valid CharacterRecord JSON:
  - `id`: `"blank-template"`
  - `schemaVersion`: `1`
  - `systemId`: `"dragonbane"`
  - `name`: `"New Adventurer"`
  - `metadata`: `{ kin: "", profession: "", age: "Adult", weakness: "", appearance: "", notes: "" }`
  - `attributes`: All 6 set to 10 (middle of 3-18 range)
  - `conditions`: All 6 set to false
  - `resources`: HP `{ current: 10, max: 10 }`, WP `{ current: 10, max: 10 }`, deathRolls `{ current: 0, max: 3 }`
  - `skills`: Empty record (values populated when user trains skills)
  - `weapons`: empty array
  - `armor`: null, `helmet`: null
  - `inventory`: empty array, `tinyItems`: empty array
  - `memento`: `""`
  - `coins`: `{ gold: 0, silver: 0, copper: 0 }`
  - `spells`: empty array, `heroicAbilities`: empty array
  - `derivedOverrides`: empty record
  - `uiState`: `{ expandedSections: [] }`
  - `createdAt` and `updatedAt`: placeholder ISO strings

### Step 3: Create a system index module
- **File:** `src/systems/dragonbane/index.ts`
- **Action:** create
- **Changes:** Import and re-export the system.json with proper typing:
  ```ts
  import systemData from './system.json';
  import type { SystemDefinition } from '../../types/system';
  export const dragonbaneSystem: SystemDefinition = systemData as SystemDefinition;
  ```

### Step 4: Verify schema validation
- **Run:** `npx tsc --noEmit`
- **Expected:** Type-check passes. The blank character JSON structure matches CharacterRecord.

### Step 5: Commit
- **Stage:** `git add src/systems/dragonbane/ sample-data/`
- **Message:** `feat: bundled dragonbane system and blank character`

## Acceptance Criteria

- `[STRUCTURAL]` system.json contains definitions for 6 attributes (STR/CON/AGL/INT/WIL/CHA), 6 conditions, HP/WP/deathRolls resources, and a skill list grouped by category (REQ-013)
- `[STRUCTURAL]` system.json contains zero sentences of copyrighted rules text (REQ-013)
- `[BEHAVIORAL]` dragonbane.blank.character.json passes Zod character schema validation (REQ-014)
- `[STRUCTURAL]` Blank character includes schemaVersion and systemId fields (REQ-032)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify JSON validity and schema compliance manually or with a script.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Verify system.json structure: Parse and check for 6 attributes, 6 conditions, 3 resource types, 33 skills across categories
  - Verify no copyrighted text: Read system.json, confirm only names and numbers -- no sentences or paragraphs
  - Verify blank character: Parse with Zod schema, should return success

## Patterns to Follow

- JSON files live alongside their TypeScript index modules for clean imports.
- System definitions are read-only data -- they should never be mutated at runtime.
- Skill baseChance values: Core skills typically have a base chance tied to an attribute fraction (e.g., AGL/4). Since we store only the base chance number, use sensible defaults (e.g., 5 for most core skills, 0 for magic schools).

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/systems/dragonbane/system.json | Create | Dragonbane system definition data |
| src/systems/dragonbane/index.ts | Create | Typed re-export of system data |
| sample-data/dragonbane.blank.character.json | Create | Blank character template |
