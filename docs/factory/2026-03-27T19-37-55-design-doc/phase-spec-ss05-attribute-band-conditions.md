# Phase Spec — SS-05: Attribute Band & Conditions

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-05
**Priority:** P0 | **Impact:** 5 | **Risk:** 2
**Dependency:** SS-03 (PrintableSheet component must exist; this section is rendered inside it).

---

## Objective

Render the 6 core attributes and 6 conditions. These are the most-referenced mechanical values during play. Attributes appear as large numbered boxes; conditions appear as diamond markers with labels.

---

## Files to Modify

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Add: attribute band + conditions JSX |
| `src/styles/print-sheet.css` | Add: attribute band and condition styles |

---

## Field Mapping

### Attributes (lowercase keys)
| Label | Source Key |
|---|---|
| STR | `character.attributes['str']` |
| CON | `character.attributes['con']` |
| AGL | `character.attributes['agl']` |
| INT | `character.attributes['int']` |
| WIL | `character.attributes['wil']` |
| CHA | `character.attributes['cha']` |

### Conditions (lowercase keys)
| Label | Source Key |
|---|---|
| Exhausted | `character.conditions['exhausted']` |
| Sickly | `character.conditions['sickly']` |
| Dazed | `character.conditions['dazed']` |
| Angry | `character.conditions['angry']` |
| Scared | `character.conditions['scared']` |
| Disheartened | `character.conditions['disheartened']` |

---

## Implementation Steps

### 1. Attributes JSX
```jsx
{/* Attribute Band */}
<div className="sheet-attribute-band">
  {[
    { label: 'STR', key: 'str' },
    { label: 'CON', key: 'con' },
    { label: 'AGL', key: 'agl' },
    { label: 'INT', key: 'int' },
    { label: 'WIL', key: 'wil' },
    { label: 'CHA', key: 'cha' },
  ].map(({ label, key }) => (
    <div key={key} className="sheet-attribute-box">
      <div className="sheet-attribute-label">{label}</div>
      <div className="sheet-attribute-value">
        {character.attributes?.[key] != null ? character.attributes[key] : ''}
      </div>
    </div>
  ))}
</div>
```

### 2. Conditions JSX
```jsx
{/* Condition Checkboxes */}
<div className="sheet-conditions">
  {[
    { label: 'Exhausted', key: 'exhausted' },
    { label: 'Sickly',    key: 'sickly' },
    { label: 'Dazed',     key: 'dazed' },
    { label: 'Angry',     key: 'angry' },
    { label: 'Scared',    key: 'scared' },
    { label: 'Disheartened', key: 'disheartened' },
  ].map(({ label, key }) => {
    const active = character.conditions?.[key] === true;
    return (
      <span key={key} className="sheet-condition">
        <span className="sheet-condition-diamond">{active ? '◆' : '◇'}</span>
        <span className="sheet-condition-label">{label}</span>
      </span>
    );
  })}
</div>
```

### 3. CSS Rules
```css
.sheet-attribute-band {
  display: flex;
  gap: 0.08in;
  margin-bottom: 0.05in;
}

.sheet-attribute-box {
  flex: 1;
  border: 1.5px solid currentColor;
  text-align: center;
  padding: 2px;
  min-width: 0;
}

.sheet-attribute-label {
  font-size: 7pt;
  text-transform: uppercase;
  font-family: var(--font-ui, 'Source Serif 4', serif);
  font-weight: bold;
}

.sheet-attribute-value {
  font-size: 18pt;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
  font-weight: bold;
  line-height: 1.1;
  min-height: 1.2em;
}

.sheet-conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.05in 0.15in;
  margin-bottom: 0.05in;
}

.sheet-condition {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 8pt;
}

.sheet-condition-diamond {
  font-size: 10pt;
}

.sheet-condition-label {
  font-family: var(--font-ui, 'Source Serif 4', serif);
}
```

### 4. Undefined Attribute Handling
- If `character.attributes` is undefined or a key is missing, render `''` (empty string) in the value box.
- **Never** render `0`, `null`, or `undefined` as a string — coerce to `''` for missing values.
- Example safe accessor: `character.attributes?.[key] ?? ''`

### 5. Undefined Condition Handling
- If `character.conditions` is undefined or a key is missing, treat as `false` → render `◇` (empty diamond).

---

## Verification

- With full character: all 6 attributes show numbers; active conditions show ◆.
- With empty character: all 6 attribute boxes are blank (no "0"); all conditions show ◇.
- All 6 condition labels are present regardless of character state.
- TypeScript: no implicit `any` on `character.attributes[key]` access.

---

## Acceptance Criteria

- [ ] `5.1` All 6 attribute values display correctly from `character.attributes` (lowercase keys)
- [ ] `5.2` All 6 condition checkboxes display; filled (◆) when `true`, empty (◇) when `false` or missing
- [ ] `5.3` Missing/undefined attributes render as blank (not "0" or error)
