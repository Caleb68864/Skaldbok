# Phase Spec — SS-11: Armor & Helmet Section

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-11
**Priority:** P2 | **Impact:** 3 | **Risk:** 2
**Dependency:** SS-03 (PrintableSheet component must exist; this section renders inside it, in the lower section).

---

## Objective

Display armor and helmet equipment data with name, rating, and features/bane-on fields. Null armor or helmet renders gracefully as blank lines — no errors or "None" text.

---

## Files to Modify

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Add: armor & helmet section JSX (in lower 3-column section) |
| `src/styles/print-sheet.css` | Add: armor/helmet layout styles |

---

## Field Mapping

```
character.armor?.name         → Armor name
character.armor?.rating       → Armor rating (number)
character.armor?.features     → Features/bane-on text
character.helmet?.name        → Helmet name
character.helmet?.rating      → Helmet rating (number)
character.helmet?.features    → Features/bane-on text
```

If `character.armor` is `null` or `undefined`, all armor fields render as blank.
If `character.helmet` is `null` or `undefined`, all helmet fields render as blank.

---

## Implementation Steps

### 1. JSX Structure
```jsx
{/* Armor & Helmet — Lower section, left column */}
<div className="sheet-armor-section">
  <div className="sheet-section-header">Armor &amp; Helmet</div>

  {/* Armor row */}
  <div className="sheet-equipment-row">
    <span className="sheet-equipment-type-label">Armor</span>
    <div className="sheet-equipment-fields">
      <div className="sheet-equipment-field sheet-equipment-name">
        <span className="sheet-field-label">Name</span>
        <span className="sheet-field-value">{character.armor?.name ?? ''}</span>
      </div>
      <div className="sheet-equipment-field sheet-equipment-rating">
        <span className="sheet-field-label">Rating</span>
        <span className="sheet-field-value">{character.armor?.rating ?? ''}</span>
      </div>
      <div className="sheet-equipment-field sheet-equipment-features">
        <span className="sheet-field-label">Features / Bane-on</span>
        <span className="sheet-field-value">{character.armor?.features ?? ''}</span>
      </div>
    </div>
  </div>

  {/* Helmet row */}
  <div className="sheet-equipment-row">
    <span className="sheet-equipment-type-label">Helmet</span>
    <div className="sheet-equipment-fields">
      <div className="sheet-equipment-field sheet-equipment-name">
        <span className="sheet-field-label">Name</span>
        <span className="sheet-field-value">{character.helmet?.name ?? ''}</span>
      </div>
      <div className="sheet-equipment-field sheet-equipment-rating">
        <span className="sheet-field-label">Rating</span>
        <span className="sheet-field-value">{character.helmet?.rating ?? ''}</span>
      </div>
      <div className="sheet-equipment-field sheet-equipment-features">
        <span className="sheet-field-label">Features / Bane-on</span>
        <span className="sheet-field-value">{character.helmet?.features ?? ''}</span>
      </div>
    </div>
  </div>
</div>
```

### 2. CSS Rules
```css
.sheet-armor-section {
  margin-bottom: 0.05in;
}

.sheet-equipment-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 3px;
}

.sheet-equipment-type-label {
  font-size: 7pt;
  font-family: var(--font-ui, 'Source Serif 4', serif);
  font-weight: bold;
  text-transform: uppercase;
  min-width: 32px;
  flex-shrink: 0;
  padding-top: 8px; /* align with fields */
}

.sheet-equipment-fields {
  display: flex;
  flex: 1;
  gap: 3px;
}

.sheet-equipment-field {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid currentColor;
  padding-bottom: 1px;
}

.sheet-equipment-name {
  flex: 3;
}

.sheet-equipment-rating {
  flex: 1;
}

.sheet-equipment-features {
  flex: 3;
}

.sheet-field-label {
  font-size: 6.5pt;
  text-transform: uppercase;
  opacity: 0.65;
  font-family: var(--font-ui, 'Source Serif 4', serif);
}

.sheet-field-value {
  font-size: 8.5pt;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
  min-height: 0.9em;
}
```

### 3. Null Safety Rules
- Use optional chaining (`?.`) for all armor and helmet field accesses.
- Use `?? ''` (nullish coalescing with empty string) as the default for all text fields.
- Use `?? ''` for rating too — render blank rather than `0` when undefined (rating 0 is unusual for a missing item).
- Never render "None", "N/A", "null", or "undefined" text.

---

## Verification

- With character with both armor and helmet equipped: all fields show correct values.
- With character with no armor (`character.armor` is null): armor name, rating, features all blank.
- With character with no helmet: helmet fields all blank.
- No console errors when accessing null armor/helmet properties.

---

## Acceptance Criteria

- [ ] `11.1` Armor name, rating, and features display from `character.armor`
- [ ] `11.2` Helmet name, rating, and features display from `character.helmet`
- [ ] `11.3` Null armor/helmet renders as blank lines (not an error or "None")
