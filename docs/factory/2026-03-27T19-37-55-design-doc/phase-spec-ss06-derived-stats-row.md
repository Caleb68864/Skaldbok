# Phase Spec — SS-06: Derived Stats Row

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-06
**Priority:** P1 | **Impact:** 4 | **Risk:** 2
**Dependency:** SS-03 (PrintableSheet component must exist). SS-02 must compute `derived` prop via `getDerivedValue()` before these values are available.

---

## Objective

Render the 4 derived stats that players reference frequently in combat and exploration. These values must come from the `derived` prop (pre-computed in `PrintableSheetScreen` via `getDerivedValue()`) so that user overrides are respected.

---

## Files to Modify

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Add: derived stats row JSX |
| `src/styles/print-sheet.css` | Add: derived stats layout styles |

---

## Field Mapping

| Display Label | Prop Source |
|---|---|
| Damage Bonus (STR) | `derived.damageBonus` (e.g., "+D4", "+D6", "+0") |
| Damage Bonus (AGL) | `derived.aglDamageBonus` |
| Movement | `derived.movement` |
| Encumbrance Limit | `derived.encumbranceLimit` |

All 4 values come from the `derived` prop passed in from `PrintableSheetScreen` — **not** computed inside `PrintableSheet` itself.

---

## Implementation Steps

### 1. JSX Structure
```jsx
{/* Derived Stats Row */}
<div className="sheet-derived-row">
  <div className="sheet-derived-field">
    <span className="sheet-derived-label">Damage Bonus (STR)</span>
    <span className="sheet-derived-value">{derived.damageBonus}</span>
  </div>
  <div className="sheet-derived-field">
    <span className="sheet-derived-label">Damage Bonus (AGL)</span>
    <span className="sheet-derived-value">{derived.aglDamageBonus}</span>
  </div>
  <div className="sheet-derived-field">
    <span className="sheet-derived-label">Movement</span>
    <span className="sheet-derived-value">{derived.movement}</span>
  </div>
  <div className="sheet-derived-field">
    <span className="sheet-derived-label">Encumbrance Limit</span>
    <span className="sheet-derived-value">{derived.encumbranceLimit}</span>
  </div>
</div>
```

### 2. CSS Rules
```css
.sheet-derived-row {
  display: flex;
  gap: 0.1in;
  margin-bottom: 0.08in;
  border-top: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  padding: 3px 0;
}

.sheet-derived-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border-right: 1px solid currentColor;
  padding: 0 4px;
}

.sheet-derived-field:last-child {
  border-right: none;
}

.sheet-derived-label {
  font-size: 7pt;
  text-transform: uppercase;
  font-family: var(--font-ui, 'Source Serif 4', serif);
  opacity: 0.8;
  line-height: 1.2;
}

.sheet-derived-value {
  font-size: 12pt;
  font-weight: bold;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
}
```

### 3. Value Rendering Notes
- `derived.damageBonus` and `derived.aglDamageBonus` are strings (e.g., `"+D4"`, `"+0"`) — render as-is.
- `derived.movement` and `derived.encumbranceLimit` are numbers — render directly.
- No transformation needed; the `PrintableSheetScreen` already calls `getDerivedValue()` and passes results in.

---

## Verification

- With full character: all 4 derived stats display the correct computed values.
- With a character that has `derivedOverrides`: overridden values appear (since `getDerivedValue()` handles this in the screen layer).
- All 4 labels are clearly readable (font size 7pt+).
- Row is visually distinct from attribute band and body sections.

---

## Acceptance Criteria

- [ ] `6.1` All 4 derived stats display with correct values for the active character
- [ ] `6.2` Override values (from `character.derivedOverrides`) are reflected (passed via `derived` prop computed with `getDerivedValue()`)
- [ ] `6.3` Derived stats are clearly labeled and legible
