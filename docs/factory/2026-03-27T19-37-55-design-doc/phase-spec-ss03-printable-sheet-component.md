# Phase Spec — SS-03: PrintableSheet (Pure Render Component)

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-03
**Priority:** P0 | **Impact:** 5 | **Risk:** 4
**Dependency:** SS-02 must exist (screen provides props). SS-14 (CSS) should be done concurrently or before for visual correctness.

---

## Objective

Create the pure render component `PrintableSheet`. This component takes `CharacterRecord` in and produces static HTML out. Zero interactivity, zero side effects, no event handlers anywhere in its tree.

---

## Files to Create

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Create: pure render component |

> Co-locating at `src/screens/PrintableSheet.tsx` is also acceptable.

---

## Props Interface

```typescript
interface PrintDerivedValues {
  damageBonus: string;
  aglDamageBonus: string;
  movement: number;
  encumbranceLimit: number;
  hpMax: number;
  wpMax: number;
}

interface PrintableSheetProps {
  character: CharacterRecord;
  system: SystemDefinition;
  derived: PrintDerivedValues;
  colorMode: 'color' | 'bw';
}
```

These types must be imported from existing app type definitions. Do not create new types if they already exist.

---

## Implementation Steps

### 1. Component Shell
```typescript
import React from 'react';
import { CharacterRecord } from '../types/character'; // adjust path as needed
import { SystemDefinition } from '../types/system';   // adjust path as needed

export default function PrintableSheet({ character, system, derived, colorMode }: PrintableSheetProps) {
  const sheetClass = `print-sheet print-sheet--${colorMode}`;
  return (
    <div className={sheetClass}>
      {/* Sections rendered here — see layout below */}
    </div>
  );
}
```

### 2. Layout Structure (top-to-bottom)
The component must render these sections in order inside the `.print-sheet` container:

```
1. <SheetHeader />          (or inline JSX)  — SS-04
2. <AttributeBand />        (or inline JSX)  — SS-05
3. <DerivedStatsRow />      (or inline JSX)  — SS-06
4. Three-column body:
   - Left:   <AbilitiesSpells /> + <Currency />   — SS-08, SS-09
   - Center: <SkillsSection />                    — SS-07
   - Right:  <InventorySection />                 — SS-10
5. Lower section (3 columns):
   - <ArmorHelmet />          — SS-11
   - <WeaponsTable />         — SS-12
   - <ResourceTrackers />     — SS-13
```

Agent may implement sections as sub-functions, inline JSX blocks, or separate files — all are acceptable. The key requirement is that the final DOM renders all sections.

### 3. No Interactivity Rule
- **Zero** `onClick`, `onChange`, `onSubmit`, `onKeyDown`, or any other event handler props anywhere in this component's tree.
- All values must be computed from props only.
- No `useState`, `useEffect`, or any hooks (pure render).

### 4. Handling Undefined Data Gracefully
- `character.attributes['str']` may be undefined → render `''` (blank), not `0` or crash
- `character.skills[key]` may be undefined → render value as `0` or blank, trained as `false`
- `character.heroicAbilities` may be empty array → render blank lines
- `character.weapons` may have fewer than 3 items → render blank rows

---

## Verification

- Render with a fully-populated `CharacterRecord` → no runtime errors, all sections visible.
- Render with a newly-created (empty) `CharacterRecord` → no runtime errors, blank lines visible.
- Inspect DOM → no event handler attributes on any element.
- TypeScript: no implicit `any`, no type errors (`tsc --noEmit`).

---

## Acceptance Criteria

- [ ] `3.1` Component renders without runtime errors for a fully-populated `CharacterRecord`
- [ ] `3.2` Component renders without runtime errors for a mostly-empty `CharacterRecord` (new character)
- [ ] `3.3` `colorMode='bw'` applies `.print-sheet--bw` class; `colorMode='color'` applies `.print-sheet--color`
- [ ] `3.4` No `onClick`, `onChange`, `onSubmit`, or other event handlers in the component tree
- [ ] `3.5` TypeScript: no implicit `any`, no type errors
