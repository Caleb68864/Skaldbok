# Phase 2: Mode Guards & Armor/Helmet Forms

**Run ID**: `2026-03-22T19-41-57-design-doc`
**Phase**: 2 of 4
**Sub-Specs**: SS-04 (Mode Guard Wiring), SS-02 (Armor/Helmet Edit Forms)
**Priority**: P1
**Combined Score**: 25 / 100

---

## Dependencies

```
Phase 1 (SS-03 encumbrance fix) ──→ SS-02 (armor weight feeds corrected encumbrance)
SS-04 (mode guards) ──→ SS-02 (armor forms respect mode guard)
```

**Upstream**: Phase 1 must be complete (encumbrance formula corrected) before armor weight integration in SS-02.
**Downstream**: None directly, but SS-02 armor forms will benefit from SS-08 toast system (Phase 4) for save confirmations.

**Internal ordering**: SS-04 (mode guards) should be done first within this phase, then SS-02 (armor forms) which depends on the mode guard hooks being wired.

---

## Rationale

Mode guard wiring (SS-04) is a small refactor that enforces consistency and directly unblocks SS-02 (armor/helmet forms must respect mode guards). The armor/helmet forms (SS-02) depend on both the corrected encumbrance formula (Phase 1) and the mode guard hooks (SS-04).

---

## Implementation Steps

### Step 2.1: Wire Mode Guards into GearScreen (SS-04)

**File**: `src/screens/GearScreen.tsx`

**Current code** (approx line 30):
```ts
const isEditMode = settings.mode === 'edit';
```

**Action**: Replace with centralized hook import and usage.

```ts
// Remove inline check
// const isEditMode = settings.mode === 'edit';

// Add import
import { useIsEditMode, useFieldEditable } from '../utils/modeGuards';

// Use hook
const isEditMode = useIsEditMode();
```

**For play-mode-editable fields** (armor.equipped, helmet.equipped toggles):
- Use `useFieldEditable('armor.equipped')` or check with `isFieldEditableInPlayMode('armor.equipped')` to ensure equip toggles remain functional in play mode.
- Current modeGuards.ts already includes `armor.equipped` and `helmet.equipped` in its play-mode-editable prefixes.

**Cleanup**: Remove `settings` destructuring if it was only used for the mode check. If `settings` is used for other purposes (e.g., theme), keep it.

### Step 2.2: Wire Mode Guards into MagicScreen (SS-04)

**File**: `src/screens/MagicScreen.tsx`

**Current code** (approx line 21):
```ts
const isEditMode = settings.mode === 'edit';
```

**Action**: Same refactor as GearScreen — replace with `useIsEditMode()` hook.

```ts
import { useIsEditMode } from '../utils/modeGuards';
const isEditMode = useIsEditMode();
```

### Step 2.3: Verify No Remaining Inline Mode Checks (SS-04)

**Action**: Search both files for any remaining `settings.mode === 'edit'` or `settings.mode === 'play'` patterns. Remove all instances and replace with hook calls.

### Step 2.4: Create Armor Edit Form Drawer (SS-02)

**File**: `src/screens/GearScreen.tsx` (extend existing component)

**New state**:
```ts
const [armorDrawerOpen, setArmorDrawerOpen] = useState(false);
```

**Armor form fields** (inside Drawer component):
- **Name** (text input)
- **Rating / Protection** (number input — damage reduction value)
- **Body Part** (text input — what it covers, e.g., "Torso", "Full Body")
- **Weight** (number input — feeds into encumbrance calculation)
- **Movement Penalty** (number input — optional)
- **Equipped** (toggle — already exists, move into drawer or keep inline)

**Trigger**: Tapping the armor card in edit mode opens the drawer.

**Data flow**:
1. On open: populate form fields from `character.armor` (type `ArmorPiece`)
2. On save: call `updateCharacter()` with updated armor data
3. Armor weight flows into `computeEncumbranceLimit()` via total weight calculation

**Type consideration**: The `ArmorPiece` type in `character.ts` has: `id, name, rating, features, equipped`. It may need extension for `weight`, `bodyPart`, and `movementPenalty`. Check if these fields already exist or need to be added.

**Type extension** (if needed in `src/types/character.ts`):
```ts
export interface ArmorPiece {
  id: string;
  name: string;
  rating: number;
  features?: string;
  equipped: boolean;
  weight?: number;        // NEW — contributes to encumbrance
  bodyPart?: string;      // NEW — coverage area
  movementPenalty?: number; // NEW — movement reduction
}
```

### Step 2.5: Create Helmet Edit Form Drawer (SS-02)

**File**: `src/screens/GearScreen.tsx`

**New state**:
```ts
const [helmetDrawerOpen, setHelmetDrawerOpen] = useState(false);
```

**Helmet form fields**:
- **Name** (text input)
- **Rating / Protection** (number input)
- **Weight** (number input)
- **Equipped** (toggle)

**Data flow**: Same pattern as armor — populate from `character.helmet`, save via `updateCharacter()`.

**Type consideration**: Check if `character.helmet` uses the same `ArmorPiece` type or a separate type. If `ArmorPiece`, the same weight extension applies.

### Step 2.6: Handle Empty Armor/Helmet (SS-02)

**Action**: Ensure that a character with no armor or helmet can create one from scratch.

- If `character.armor` is null/undefined, show an "Add Armor" button in edit mode
- Clicking "Add Armor" creates a default `ArmorPiece` with empty/default values and opens the drawer
- Same pattern for helmet
- Generate unique IDs using `crypto.randomUUID()` or existing ID generation pattern

### Step 2.7: Integrate Armor Weight into Encumbrance (SS-02)

**File**: `src/screens/GearScreen.tsx`

**Action**: Verify that the total weight calculation in GearScreen includes armor and helmet weight. The current encumbrance calculation sums inventory item weights — it should also include:
- `character.armor?.weight ?? 0`
- `character.helmet?.weight ?? 0`

If not already included, add these to the total weight computation.

---

## Acceptance Criteria Checklist

| AC | Description | Verification |
|----|-------------|-------------|
| AC-04.1 | GearScreen uses `useIsEditMode()` from modeGuards.ts | Grep for import and usage |
| AC-04.2 | MagicScreen uses `useIsEditMode()` from modeGuards.ts | Grep for import and usage |
| AC-04.3 | Play-mode-editable fields remain toggleable in play mode | armor.equipped/helmet.equipped toggles work in play mode |
| AC-04.4 | No behavioral regression — edit-only UI hidden in play mode | Visual verification |
| AC-04.5 | No remaining inline `settings.mode === 'edit'` in GearScreen or MagicScreen | Grep confirms zero matches |
| AC-02.1 | Tapping armor card in edit mode opens Drawer | Drawer opens with armor fields |
| AC-02.2 | Tapping helmet card in edit mode opens Drawer | Drawer opens with helmet fields |
| AC-02.3 | Changes persist to IndexedDB via `updateCharacter()` | Save button calls updateCharacter, data persists |
| AC-02.4 | Drawer uses existing `Drawer` primitive component | Import from primitives, not a new component |
| AC-02.5 | Fields disabled / drawer does not open in play mode | Mode guard prevents opening |
| AC-02.6 | Armor weight feeds into encumbrance calculation | Total weight includes armor + helmet weight |
| AC-02.7 | Empty/new character can add armor and helmet | "Add" button creates default piece |

---

## Verification Commands

```bash
# 1. No inline mode checks remaining
grep -rn "settings.mode === 'edit'" src/screens/GearScreen.tsx src/screens/MagicScreen.tsx
# Expected: No matches

# 2. Mode guard hook imported
grep -n "useIsEditMode" src/screens/GearScreen.tsx src/screens/MagicScreen.tsx
# Expected: Import and usage in both files

# 3. Drawer component used for armor/helmet
grep -n "armorDrawerOpen\|helmetDrawerOpen" src/screens/GearScreen.tsx
# Expected: State and Drawer usage found

# 4. Armor weight in encumbrance
grep -n "armor.*weight\|helmet.*weight" src/screens/GearScreen.tsx
# Expected: Weight values included in total calculation

# 5. TypeScript check
npx tsc --noEmit
# Expected: No errors

# 6. Build check
npm run build
# Expected: Build succeeds
```

---

## Risk Notes

- **Medium risk**: Extending `ArmorPiece` type may affect schema validation if Zod schemas enforce strict shapes. Check `schemas/` directory for character schema validation.
- **Migration**: Existing characters without `weight`, `bodyPart`, `movementPenalty` fields on armor will get `undefined` — all new fields should be optional and default gracefully.
- **Drawer stacking**: Ensure armor/helmet drawers don't conflict with existing weapon drawers (only one drawer open at a time).
