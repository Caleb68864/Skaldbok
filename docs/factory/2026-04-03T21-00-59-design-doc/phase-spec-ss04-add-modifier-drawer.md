# Phase Spec — SS-04: AddModifierDrawer Component

**Run:** 2026-04-03T21-00-59-design-doc
**Sub-Spec ID:** SS-04
**Priority:** P1
**Dependency:** ⚠️ Requires SS-01 to be complete first (`TempModifier`, `TempModifierEffect`, `StatKey` types must exist in `src/types/character.ts`).
**Effort:** ~60 min

---

## Objective

Create a new drawer-based form component at `src/components/panels/AddModifierDrawer.tsx` that allows users to manually create ad-hoc temporary modifiers. Supports multi-stat effects via a repeating row pattern. Uses the existing `Drawer` primitive.

---

## Files to Create / Modify

- `src/components/panels/AddModifierDrawer.tsx` — **new file** (create)
- No other files modified in this sub-spec

---

## Props Interface

```typescript
interface AddModifierDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: (modifier: Omit<TempModifier, 'id' | 'createdAt'>) => void;
}
```

Note: The caller (SheetScreen) is responsible for appending `id` and `createdAt` when constructing the full `TempModifier`. This component only produces the shape without those two fields.

---

## Implementation Steps

### Step 1 — Read existing primitives

Before writing, read:
- `src/components/primitives/Drawer.tsx` — understand `open`, `onClose`, and children API
- Any existing form in a drawer (e.g., `src/features/notes/QuickNoteDrawer.tsx`) to follow project patterns

### Step 2 — Define local form state

```typescript
interface EffectRow {
  stat: StatKey;
  delta: number | '';   // '' = empty/unset
}

const [label, setLabel] = useState('');
const [duration, setDuration] = useState<TempModifier['duration']>('round');
const [effects, setEffects] = useState<EffectRow[]>([{ stat: 'str', delta: '' }]);
```

Reset all state to defaults when drawer closes (use `useEffect` on `open`).

### Step 3 — Form fields

#### Label input
```tsx
<input
  type="text"
  placeholder="e.g. Power Fist, Stone Skin"
  value={label}
  onChange={e => setLabel(e.target.value)}
  style={{ minHeight: 48 }}
/>
```

#### Duration picker

Use a `<select>` or segmented control with these options:

| Value | Display label |
|-------|--------------|
| `'round'` | Round |
| `'stretch'` | Stretch |
| `'shift'` | Shift |
| `'scene'` | Scene |
| `'permanent'` | Permanent |

#### Effect rows (repeating)

Each row contains:
1. **Stat picker** — `<select>` with curated options (see list below)
2. **Delta input** — `<input type="number">` allowing negative values; minimum height 48px
3. **Remove row** button (only show if more than 1 row exists)

**Curated stat `<select>` options:**

```
--- Attributes ---
STR (value: "str")
CON (value: "con")
AGL (value: "agl")
INT (value: "int")
WIL (value: "wil")
CHA (value: "cha")
--- Armor ---
Armor Rating (value: "armor")
Helmet Rating (value: "helmet")
--- Derived ---
Movement (value: "movement")
Max HP (value: "hpMax")
Max WP (value: "wpMax")
```

#### "Add another effect" button

Appends a new `EffectRow` with default `{ stat: 'str', delta: '' }`.

### Step 4 — Validation logic

```typescript
const isValid = (): boolean => {
  if (!label.trim()) return false;
  if (effects.length === 0) return false;
  return effects.every(e => e.delta !== '' && e.delta !== 0);
};
```

Disable the Save button when `!isValid()`.

### Step 5 — Save handler

```typescript
const handleSave = () => {
  if (!isValid()) return;
  onSave({
    label: label.trim(),
    effects: effects.map(e => ({ stat: e.stat, delta: e.delta as number })),
    duration,
  });
  onClose();
};
```

### Step 6 — Reset on close

```typescript
useEffect(() => {
  if (!open) {
    setLabel('');
    setDuration('round');
    setEffects([{ stat: 'str', delta: '' }]);
  }
}, [open]);
```

### Step 7 — Full JSX structure (outline)

```tsx
<Drawer open={open} onClose={onClose} title="Add Modifier">
  {/* Label */}
  <label>Name</label>
  <input ... />

  {/* Duration */}
  <label>Duration</label>
  <select value={duration} onChange={e => setDuration(e.target.value as TempModifier['duration'])}>
    <option value="round">Round</option>
    <option value="stretch">Stretch</option>
    <option value="shift">Shift</option>
    <option value="scene">Scene</option>
    <option value="permanent">Permanent</option>
  </select>

  {/* Effect rows */}
  <label>Effects</label>
  {effects.map((row, i) => (
    <div key={i} className="effect-row">
      <select value={row.stat} onChange={e => updateEffect(i, 'stat', e.target.value)}>
        {/* curated options */}
      </select>
      <input
        type="number"
        value={row.delta}
        onChange={e => updateEffect(i, 'delta', Number(e.target.value))}
        style={{ minHeight: 48 }}
      />
      {effects.length > 1 && (
        <button onClick={() => removeEffect(i)} style={{ minHeight: 48 }}>✕</button>
      )}
    </div>
  ))}

  <button onClick={addEffect} style={{ minHeight: 48 }}>+ Add another effect</button>

  {/* Actions */}
  <button onClick={onClose} style={{ minHeight: 48 }}>Cancel</button>
  <button onClick={handleSave} disabled={!isValid()} style={{ minHeight: 48 }}>Save</button>
</Drawer>
```

---

## Constraints

- Use the existing `Drawer` primitive from `src/components/primitives/Drawer.tsx` — do not create a custom modal/sheet
- Do NOT add new npm dependencies
- All interactive elements must meet **48px minimum touch target** requirement
- Delta input must allow **negative integers** (use `type="number"` — browser handles negative input)
- Delta of `0` is treated as invalid (no-op modifier makes no sense)

---

## Acceptance Criteria

- [ ] Drawer opens and closes correctly based on `open` prop
- [ ] Label input, duration picker, and at least one effect row are present
- [ ] "Add another effect" button appends a new stat+delta row
- [ ] Stat picker shows curated stat list (attributes, armor, derived — all options listed above)
- [ ] Save button is **disabled** when label is empty or any effect row has an empty/zero delta
- [ ] `onSave` is called with the correct `Omit<TempModifier, 'id' | 'createdAt'>` shape
- [ ] `onClose` is called after a successful save (drawer closes)
- [ ] Form resets to defaults when drawer closes (label clears, duration resets to 'round', effects reset to one empty row)
- [ ] All inputs and buttons meet **48px** touch target height requirement
- [ ] Uses existing `Drawer` primitive from `src/components/primitives/Drawer.tsx`
- [ ] `tsc --noEmit` passes after this change

---

## Verification Steps

1. Run `tsc --noEmit` — expect zero errors
2. Open drawer → Save button is disabled (empty label)
3. Enter label → Save still disabled (empty delta)
4. Enter delta 0 → Save still disabled
5. Enter delta 2 → Save enabled
6. Press Save → `onSave` called with `{ label, effects: [{ stat: 'str', delta: 2 }], duration: 'round' }`
7. Press "Add another effect" → second row appears
8. Close drawer → form resets on reopen

---

## Notes for Worker Agent

- Read `src/components/primitives/Drawer.tsx` **before writing any code** — understand whether it takes `title` as a prop or expects a header child, and what its exact open/close API looks like.
- The `updateEffect` / `removeEffect` / `addEffect` helpers should be small inline functions or `useCallback`s — keep them simple.
- Agent authority: if character skills cannot be easily injected (no context available), omit skill IDs from the stat picker entirely and only show the curated attributes/armor/derived list. The spec permits this fallback.
- Do NOT import from SheetScreen or any screen-level module — this is a pure UI component.
