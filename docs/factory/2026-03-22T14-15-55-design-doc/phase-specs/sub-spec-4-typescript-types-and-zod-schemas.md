---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 4
title: "TypeScript Types and Zod Schemas"
date: 2026-03-22
dependencies: ["none"]
---

# Sub-Spec 4: TypeScript Types and Zod Schemas

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Define all domain TypeScript interfaces and types for the core data model: SystemDefinition, CharacterRecord, AppSettings, and all their nested sub-types. Create corresponding Zod validation schemas that produce human-readable error messages on validation failure. Types and schemas are the foundation that sub-specs 5, 6, 7, and 15 depend on.

## Interface Contracts

### Provides
- `src/types/system.ts`: Exports `SystemDefinition`, `AttributeDefinition`, `ConditionDefinition`, `ResourceDefinition`, `SkillDefinition`, `SkillCategory`, `SectionLayout`
- `src/types/character.ts`: Exports `CharacterRecord`, `CharacterMetadata`, `CharacterValues`, `CharacterConditions`, `CharacterResources`, `CharacterSkill`, `Weapon`, `ArmorPiece`, `InventoryItem`, `Spell`, `HeroicAbility`, `DerivedOverrides`, `CharacterUiState`
- `src/types/settings.ts`: Exports `AppSettings`, `ModeName`
- `src/types/common.ts`: Exports shared types like `Timestamped`, `Versioned`, `ID`
- `schemas/system.schema.ts`: Exports `systemDefinitionSchema` (Zod schema)
- `schemas/character.schema.ts`: Exports `characterRecordSchema` (Zod schema)
- `schemas/settings.schema.ts`: Exports `appSettingsSchema` (Zod schema)

### Requires
None -- no dependencies. (Zod is installed in sub-spec 1 but this sub-spec can be worked on in parallel since it only defines types/schemas.)

### Shared State
None.

## Implementation Steps

### Step 1: Create common types
- **File:** `src/types/common.ts`
- **Action:** create
- **Changes:** Define shared utility types:
  ```ts
  export type ID = string;
  export interface Timestamped {
    createdAt: string; // ISO 8601
    updatedAt: string; // ISO 8601
  }
  export interface Versioned {
    schemaVersion: number;
  }
  ```

### Step 2: Create system definition types
- **File:** `src/types/system.ts`
- **Action:** create
- **Changes:** Define the SystemDefinition type tree:
  - `SystemDefinition`: `{ id: string, version: number, name: string, displayName: string, attributes: AttributeDefinition[], conditions: ConditionDefinition[], resources: ResourceDefinition[], skillCategories: SkillCategory[], sectionLayouts?: SectionLayout[] }`
  - `AttributeDefinition`: `{ id: string, name: string, abbreviation: string, min: number, max: number }`
  - `ConditionDefinition`: `{ id: string, name: string, linkedAttributeId: string, description: string }`
  - `ResourceDefinition`: `{ id: string, name: string, derivedFrom?: string, min: number, defaultMax: number }`
  - `SkillCategory`: `{ id: string, name: string, skills: SkillDefinition[] }`
  - `SkillDefinition`: `{ id: string, name: string, baseChance: number, linkedAttributeId?: string }`
  - `SectionLayout`: `{ id: string, label: string, sections: string[] }`

### Step 3: Create character record types
- **File:** `src/types/character.ts`
- **Action:** create
- **Changes:** Define the CharacterRecord type tree:
  - `CharacterRecord`: `Versioned & Timestamped & { id: ID, systemId: string, name: string, metadata: CharacterMetadata, attributes: Record<string, number>, conditions: Record<string, boolean>, resources: Record<string, { current: number, max: number }>, skills: Record<string, CharacterSkill>, weapons: Weapon[], armor: ArmorPiece | null, helmet: ArmorPiece | null, inventory: InventoryItem[], tinyItems: string[], memento: string, coins: { gold: number, silver: number, copper: number }, spells: Spell[], heroicAbilities: HeroicAbility[], derivedOverrides: DerivedOverrides, uiState: CharacterUiState }`
  - `CharacterMetadata`: `{ kin: string, profession: string, age: string, weakness: string, appearance: string, notes: string }`
  - `CharacterSkill`: `{ value: number, trained: boolean }`
  - `Weapon`: `{ id: ID, name: string, grip: 'one-handed' | 'two-handed', range: string, damage: string, durability: number, features: string, equipped: boolean }`
  - `ArmorPiece`: `{ id: ID, name: string, rating: number, features: string, equipped: boolean }`
  - `InventoryItem`: `{ id: ID, name: string, weight: number, quantity: number, description: string }`
  - `Spell`: `{ id: ID, name: string, school: string, powerLevel: number, wpCost: number, range: string, duration: string, summary: string }`
  - `HeroicAbility`: `{ id: ID, name: string, summary: string }`
  - `DerivedOverrides`: `Record<string, number | null>` (null = use auto-calculated)
  - `CharacterUiState`: `{ expandedSections: string[] }`

### Step 4: Create settings types
- **File:** `src/types/settings.ts`
- **Action:** create
- **Changes:** Define AppSettings:
  - `ModeName`: `'play' | 'edit'`
  - `AppSettings`: `Versioned & { activeCharacterId: ID | null, theme: 'dark' | 'parchment' | 'light', mode: ModeName, wakeLockEnabled: boolean }`

### Step 5: Create Zod schema for system definitions
- **File:** `schemas/system.schema.ts`
- **Action:** create
- **Changes:** Build Zod schemas mirroring the TypeScript types from Step 2. Use `.describe()` on fields for human-readable messages. Export `systemDefinitionSchema`.

### Step 6: Create Zod schema for character records
- **File:** `schemas/character.schema.ts`
- **Action:** create
- **Changes:** Build Zod schemas mirroring CharacterRecord types. Key validations:
  - `schemaVersion` must be a positive integer
  - `id` must be a non-empty string
  - `systemId` must be a non-empty string
  - `attributes` values must be numbers
  - `resources.current` must be >= 0
  - Use `.describe()` for human-readable field descriptions
  - Export `characterRecordSchema`

### Step 7: Create Zod schema for app settings
- **File:** `schemas/settings.schema.ts`
- **Action:** create
- **Changes:** Build Zod schema for AppSettings. Export `appSettingsSchema`.

### Step 8: Create barrel export
- **File:** `src/types/index.ts`
- **Action:** create
- **Changes:** Re-export all types from common, system, character, settings modules.

### Step 9: Verify type-check
- **Run:** `npx tsc --noEmit`
- **Expected:** Zero errors.

### Step 10: Commit
- **Stage:** `git add src/types/ schemas/`
- **Message:** `feat: typescript types and zod schemas`

## Acceptance Criteria

- `[MECHANICAL]` `npx tsc --noEmit` passes after types are added (REQ-011)
- `[STRUCTURAL]` SystemDefinition type includes id, version, name, displayName, attributes, conditions, resources, skills, and themesSupported fields (REQ-011)
- `[STRUCTURAL]` CharacterRecord type includes id, schemaVersion, systemId, name, metadata, values, conditions, resources, skills, spells, heroicAbilities, weapons, inventory, derivedOverrides, uiState, and timestamps (REQ-011)
- `[BEHAVIORAL]` Zod character schema accepts a valid sample character JSON and returns typed output (REQ-012)
- `[BEHAVIORAL]` Zod character schema rejects an object missing required fields and produces a human-readable error message (REQ-012)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework configured -- verify by writing a small validation script or inline checks.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Type-check: `npx tsc --noEmit` exits 0
  - Schema validation: Import schema in a temporary script, parse a valid object (should succeed), parse an invalid object (should produce readable errors)

## Patterns to Follow

- Use `z.infer<typeof schema>` to derive TypeScript types from Zod schemas where convenient, but maintain explicit TypeScript type definitions as the primary contract (schemas validate against those types).
- Use Zod `.describe()` method on fields that need human-readable labels in error messages.
- Use `Record<string, T>` for dynamic key maps (attributes, conditions, resources, skills).
- Avoid `any` -- use `unknown` with type narrowing per project constraints.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/types/common.ts | Create | Shared utility types (ID, Timestamped, Versioned) |
| src/types/system.ts | Create | SystemDefinition and related types |
| src/types/character.ts | Create | CharacterRecord and all nested types |
| src/types/settings.ts | Create | AppSettings and ModeName types |
| src/types/index.ts | Create | Barrel re-export |
| schemas/system.schema.ts | Create | Zod schema for system definitions |
| schemas/character.schema.ts | Create | Zod schema for character records |
| schemas/settings.schema.ts | Create | Zod schema for app settings |
