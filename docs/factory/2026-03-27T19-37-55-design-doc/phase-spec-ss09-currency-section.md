# Phase Spec — SS-09: Currency Section

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-09
**Priority:** P3 | **Impact:** 2 | **Risk:** 1
**Dependency:** SS-03 (PrintableSheet component must exist; this section renders inside it).

---

## Objective

Display the character's coin amounts (Gold, Silver, Copper) for quick reference. Simple labeled value display. Uses the correct top-level `character.coins` field — NOT `character.metadata`.

---

## Files to Modify

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Add: currency section JSX |
| `src/styles/print-sheet.css` | Add: currency layout styles |

---

## Field Mapping

| Display Label | Source | Note |
|---|---|---|
| Gold | `character.coins.gold` | Top-level field |
| Silver | `character.coins.silver` | Top-level field |
| Copper | `character.coins.copper` | Top-level field |

> **Critical:** Use `character.coins.gold` / `.silver` / `.copper` — NOT `character.metadata.gold`. This is a common mistake.

---

## Implementation Steps

### 1. JSX Structure
```jsx
{/* Currency Section — Left column, below Abilities & Spells */}
<div className="sheet-currency">
  <div className="sheet-section-header">Currency</div>
  <div className="sheet-currency-row">
    <div className="sheet-currency-field">
      <span className="sheet-currency-label">Gold</span>
      <span className="sheet-currency-value">{character.coins?.gold ?? 0}</span>
    </div>
    <div className="sheet-currency-field">
      <span className="sheet-currency-label">Silver</span>
      <span className="sheet-currency-value">{character.coins?.silver ?? 0}</span>
    </div>
    <div className="sheet-currency-field">
      <span className="sheet-currency-label">Copper</span>
      <span className="sheet-currency-value">{character.coins?.copper ?? 0}</span>
    </div>
  </div>
</div>
```

### 2. CSS Rules
```css
.sheet-currency {
  margin-top: 0.05in;
}

.sheet-currency-row {
  display: flex;
  gap: 0.05in;
}

.sheet-currency-field {
  flex: 1;
  border: 1px solid currentColor;
  text-align: center;
  padding: 2px 3px;
}

.sheet-currency-label {
  display: block;
  font-size: 7pt;
  text-transform: uppercase;
  font-family: var(--font-ui, 'Source Serif 4', serif);
  opacity: 0.7;
}

.sheet-currency-value {
  display: block;
  font-size: 10pt;
  font-weight: bold;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
}
```

### 3. Zero Value Rendering
- A value of `0` must render as `0` — not blank, not hidden.
- Use `?? 0` (nullish coalescing with 0) for the default, NOT `|| 0` (which would convert falsy non-zero values).
- Safe accessor: `character.coins?.gold ?? 0`

---

## Verification

- With character that has gold=5, silver=10, copper=3: all 3 values display correctly.
- With new character (no coins set): all 3 fields display `0`.
- Values come from `character.coins.*` — inspect in browser dev tools to confirm.

---

## Acceptance Criteria

- [ ] `9.1` Gold, Silver, Copper values display from `character.coins` (NOT `character.metadata`)
- [ ] `9.2` Value `0` renders as `0` (not blank)
