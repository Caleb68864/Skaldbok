# Phase Spec — SS-03: BuffChipBar Component

**Run:** 2026-04-03T21-00-59-design-doc
**Sub-Spec ID:** SS-03
**Priority:** P1
**Dependency:** ⚠️ Requires SS-01 to be complete first (`TempModifier` type must exist). SS-02 is not required by this component directly.
**Effort:** ~60 min

---

## Objective

Create a new `BuffChipBar` component at `src/components/panels/BuffChipBar.tsx` that renders active `tempModifiers` as compact colored chips. Each chip is tappable to expand details and show a Remove button. A trailing "+" chip opens the `AddModifierDrawer`. A "Clear All" button removes all active modifiers at once.

---

## Files to Create / Modify

- `src/components/panels/BuffChipBar.tsx` — **new file** (create)
- No other files modified in this sub-spec

---

## Props Interface

```typescript
interface BuffChipBarProps {
  modifiers: TempModifier[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onAdd: () => void;   // opens AddModifierDrawer
}
```

---

## Implementation Steps

### Step 1 — Read existing primitives first

Before writing any code, read these files to understand available components and design tokens:

- `src/components/primitives/Chip.tsx` — understand variant props available (color variants for buff vs. debuff)
- Any existing panel component in `src/components/panels/` — follow patterns for layout and token usage

### Step 2 — Implement the component

**Duration abbreviation helper (private):**

```typescript
const DURATION_ABBREV: Record<TempModifier['duration'], string> = {
  round:     'RND',
  stretch:   'STR',
  shift:     'SHI',
  scene:     'SCN',
  permanent: '∞',
};
```

**Delta summary helper (private):**

```typescript
function sumDelta(modifier: TempModifier): number {
  return modifier.effects.reduce((acc, e) => acc + e.delta, 0);
}

function formatDelta(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
```

**Chip color rule:**
- Positive delta sum → buff variant (e.g. `variant="success"` or `variant="accent"` — check Chip props)
- Negative delta sum → debuff variant (e.g. `variant="danger"` or `variant="warning"`)
- Zero or mixed → neutral variant

**Expanded state:** Use `useState<string | null>(null)` for `expandedId`. Tapping a chip sets `expandedId` to its `id` (or `null` to collapse). Tapping the same chip again collapses it.

**Full effects label format:** `"STR +2, CON -1"` — join each effect as `"${e.stat.toUpperCase()} ${formatDelta(e.delta)}"`.

**Duration full label:**

```typescript
const DURATION_LABEL: Record<TempModifier['duration'], string> = {
  round:     'Round',
  stretch:   'Stretch',
  shift:     'Shift',
  scene:     'Scene',
  permanent: 'Permanent',
};
```

### Step 3 — Component structure (JSX outline)

```tsx
<div className="buff-chip-bar">
  {modifiers.map(mod => (
    <div key={mod.id} className="buff-chip-wrapper">
      <Chip
        label={`${mod.label} ${formatDelta(sumDelta(mod))} · ${DURATION_ABBREV[mod.duration]}`}
        variant={sumDelta(mod) >= 0 ? 'buff' : 'debuff'}   // adjust to actual Chip variant names
        onPress={() => setExpandedId(prev => prev === mod.id ? null : mod.id)}
      />
      {expandedId === mod.id && (
        <div className="buff-chip-expanded">
          <p>{mod.effects.map(e => `${e.stat.toUpperCase()} ${formatDelta(e.delta)}`).join(', ')}</p>
          <p>Duration: {DURATION_LABEL[mod.duration]}</p>
          <button
            className="buff-chip-remove"
            style={{ minHeight: 48, minWidth: 48 }}
            onClick={() => { onRemove(mod.id); setExpandedId(null); }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  ))}

  {/* "+" chip — always last */}
  <Chip label="+" variant="neutral" onPress={onAdd} />

  {/* Clear All — only when modifiers exist */}
  {modifiers.length > 0 && (
    <button
      className="buff-chip-clear-all"
      style={{ minHeight: 48 }}
      onClick={onClearAll}
    >
      Clear All
    </button>
  )}
</div>
```

> **Agent authority:** You may adjust the exact JSX structure, class names, and layout. The above is a guide, not a hard requirement. Use CSS design token variables (`--color-*`, `--space-*`, `--radius-*`) rather than hardcoded values.

### Step 4 — Styling

Use CSS design token variables throughout:
- Chip colors: `--color-success`, `--color-danger`, `--color-neutral` (or equivalent tokens in the project)
- Spacing: `--space-1`, `--space-2`, etc.
- Border radius: `--radius-pill` or `--radius-md`
- Do NOT use hardcoded hex colors or pixel values that aren't from the token system

---

## Acceptance Criteria

- [ ] Renders one chip per active modifier with label, delta summary (`+2` / `-1`), and duration badge (`RND`, `STR`, etc.)
- [ ] Tapping a chip expands it to show full effects list (e.g. `"STR +2, CON -1"`) and a Remove button
- [ ] Remove button calls `onRemove(modifier.id)` and collapses the expanded view
- [ ] A "+" chip is always present as the last item; pressing it calls `onAdd`
- [ ] "Clear All" button calls `onClearAll` and is **only visible** when `modifiers.length > 0`
- [ ] Empty state (no modifiers): renders only the "+" chip, no Clear All button
- [ ] All interactive elements have a minimum touch target of **48px** in height/width
- [ ] Uses CSS design token variables (`--color-*`, `--space-*`, `--radius-*`) — no hardcoded hex/pixel values
- [ ] Uses the existing `Chip` primitive from `src/components/primitives/Chip.tsx`
- [ ] `tsc --noEmit` passes after this change

---

## Verification Steps

1. Run `tsc --noEmit` — expect zero errors
2. Visual check (in browser): add a modifier → chip appears with correct label and duration badge
3. Tap chip → expanded view shows effect list and Remove button
4. Tap Remove → chip disappears, stat reverts
5. With no modifiers: only "+" chip visible, Clear All hidden
6. With 3 modifiers: Clear All visible; tap it → all chips disappear

---

## Notes for Worker Agent

- Read `src/components/primitives/Chip.tsx` **before writing any code** — understand the actual prop names (e.g. `variant`, `onPress` vs `onClick`, `label` vs `children`). Do not assume the interface.
- If `Chip` does not support the color variants needed for buff/debuff distinction, you may wrap it in a styled `<span>` or add a `className` prop — check what Chip exposes.
- Escalate if `Chip` lacks any `onPress`/`onClick` support (i.e., it is purely presentational with no interaction).
- The component does NOT manage state for `addModifierOpen` — that is the parent (SheetScreen) concern. This component only receives `onAdd` and calls it.
