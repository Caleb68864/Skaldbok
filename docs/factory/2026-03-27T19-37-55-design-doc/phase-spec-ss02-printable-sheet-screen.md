# Phase Spec — SS-02: PrintableSheetScreen (Screen Container)

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-02
**Priority:** P0 | **Impact:** 5 | **Risk:** 2
**Dependency:** SS-01 must be complete (route must exist before this screen is useful).

---

## Objective

Create the screen container at `src/screens/PrintableSheetScreen.tsx`. This layer owns: reading context, guarding for no-character, computing derived values, managing the `colorMode` toggle state, and rendering the floating print toolbar. It delegates all layout rendering to `PrintableSheet`.

---

## Files to Create

| File | Action |
|---|---|
| `src/screens/PrintableSheetScreen.tsx` | Create: screen container component |

---

## Implementation Steps

### 1. Imports
```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { getDerivedValue } from '../utils/derivedValues';
import PrintableSheet from '../components/PrintableSheet'; // (or co-located path)
import '../styles/print-sheet.css'; // (import CSS here or in PrintableSheet)
```

### 2. Derived Values Interface
Define (or import from a shared types file) the following interface:
```typescript
interface PrintDerivedValues {
  damageBonus: string;
  aglDamageBonus: string;
  movement: number;
  encumbranceLimit: number;
  hpMax: number;
  wpMax: number;
}
```

### 3. Component Body
```typescript
export default function PrintableSheetScreen() {
  const navigate = useNavigate();
  const { character, isLoading } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');
  const [colorMode, setColorMode] = useState<'color' | 'bw'>('color');

  // Guard: loading
  if (isLoading) return <div>Loading...</div>;

  // Guard: no character
  if (!character) {
    navigate('/library');
    return null;
  }

  // Compute derived values
  const derived: PrintDerivedValues = {
    damageBonus: String(getDerivedValue(character, 'damageBonus').effective),
    aglDamageBonus: String(getDerivedValue(character, 'aglDamageBonus').effective),
    movement: Number(getDerivedValue(character, 'movement').effective),
    encumbranceLimit: Number(getDerivedValue(character, 'encumbranceLimit').effective),
    hpMax: Number(getDerivedValue(character, 'hpMax').effective),
    wpMax: Number(getDerivedValue(character, 'wpMax').effective),
  };

  return (
    <>
      <PrintableSheet
        character={character}
        system={system}
        derived={derived}
        colorMode={colorMode}
      />
      {/* Floating toolbar — hidden via @media print in print-sheet.css */}
      <div className="print-toolbar">
        <button onClick={() => navigate(-1)}>← Back</button>
        <button onClick={() => window.print()}>Print</button>
        <button onClick={() => setColorMode(colorMode === 'color' ? 'bw' : 'color')}>
          {colorMode === 'color' ? 'B&W' : 'Color'}
        </button>
      </div>
    </>
  );
}
```

### 4. Toolbar Styles
The toolbar must be:
- `position: fixed`, bottom-right of viewport
- `z-index` high enough to overlay the sheet (e.g., `z-index: 1000`)
- `display: none` inside `@media print` (handled in `print-sheet.css`, class `.print-toolbar`)

If inline styles are needed for positioning before the CSS file is complete, use:
```typescript
style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 1000, display: 'flex', gap: '0.5rem' }}
```

---

## Verification

- Navigate to `/print` with an active character → `PrintableSheet` renders; toolbar is visible.
- Navigate to `/print` with no active character → browser redirects to `/library`.
- Click "Print" → browser print dialog opens.
- Click "← Back" → navigates to previous page.
- Click "B&W" → `colorMode` toggles; label changes to "Color"; sheet changes visually.
- Open Chrome Print Preview → toolbar is not visible in the preview.

---

## Acceptance Criteria

- [ ] `2.1` Screen renders `<PrintableSheet>` when a character is active
- [ ] `2.2` Screen redirects to `/library` when no active character on mount
- [ ] `2.3` Floating toolbar shows Print, Back, and Color/B&W buttons
- [ ] `2.4` Clicking Print calls `window.print()`
- [ ] `2.5` Clicking Back navigates to previous route
- [ ] `2.6` Color/B&W toggle changes `colorMode` prop passed to `PrintableSheet`
- [ ] `2.7` Toolbar is not visible in Chrome Print Preview
