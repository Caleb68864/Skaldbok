# Phase Spec — SS-12: Weapons Table

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-12
**Priority:** P1 | **Impact:** 4 | **Risk:** 2
**Dependency:** SS-03 (PrintableSheet component must exist; this section renders in the lower area).

---

## Objective

Render a 6-column weapons table for up to 3 weapons. The table must match the official PDF column structure. Rows beyond the character's weapon count render as blank lines.

---

## Files to Modify

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Add: weapons table JSX (in lower section, center column) |
| `src/styles/print-sheet.css` | Add: weapons table styles |

---

## Field Mapping

For `character.weapons[0..2]` (up to 3 weapons):

| Column | Source |
|---|---|
| Name | `weapon.name` |
| Grip | `weapon.grip` — display as "1H" or "2H" |
| Range | `weapon.range` |
| Damage | `weapon.damage` |
| Durability | `weapon.durability` |
| Features | `weapon.features` |

---

## Implementation Steps

### 1. Grip Normalization Helper
```typescript
function formatGrip(grip: string | undefined): string {
  if (!grip) return '';
  const lower = grip.toLowerCase();
  if (lower.includes('2') || lower.includes('two')) return '2H';
  if (lower.includes('1') || lower.includes('one')) return '1H';
  return grip; // pass-through for unexpected values
}
```

### 2. JSX Structure
```jsx
{/* Weapons Table — Lower section, center column */}
<div className="sheet-weapons">
  <div className="sheet-section-header">Weapons</div>
  <table className="sheet-weapons-table">
    <thead>
      <tr>
        <th className="col-name">Name</th>
        <th className="col-grip">Grip</th>
        <th className="col-range">Range</th>
        <th className="col-damage">Damage</th>
        <th className="col-durability">Dur.</th>
        <th className="col-features">Features</th>
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: 3 }).map((_, i) => {
        const weapon = character.weapons?.[i];
        return (
          <tr key={i} className={weapon ? '' : 'sheet-blank-row'}>
            <td>{weapon?.name ?? ''}</td>
            <td>{weapon ? formatGrip(weapon.grip) : ''}</td>
            <td>{weapon?.range ?? ''}</td>
            <td>{weapon?.damage ?? ''}</td>
            <td>{weapon?.durability ?? ''}</td>
            <td>{weapon?.features ?? ''}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
```

### 3. CSS Rules
```css
.sheet-weapons {
  margin-bottom: 0.05in;
}

.sheet-weapons-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 7.5pt;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
}

.sheet-weapons-table th {
  font-size: 6.5pt;
  text-transform: uppercase;
  font-family: var(--font-ui, 'Source Serif 4', serif);
  border-bottom: 1.5px solid currentColor;
  padding: 1px 2px;
  text-align: left;
}

.sheet-weapons-table td {
  border-bottom: 0.5px solid rgba(0,0,0,0.25);
  padding: 1px 2px;
  min-height: 14px;
}

.sheet-weapons-table .col-name     { width: 25%; }
.sheet-weapons-table .col-grip     { width: 7%; }
.sheet-weapons-table .col-range    { width: 12%; }
.sheet-weapons-table .col-damage   { width: 12%; }
.sheet-weapons-table .col-durability { width: 8%; }
.sheet-weapons-table .col-features { width: 36%; }

/* Blank rows still render with correct height */
.sheet-weapons-table .sheet-blank-row td {
  min-height: 14px;
}
```

### 4. Row Count Rules
- Always render exactly 3 rows regardless of weapon count.
- First `character.weapons.length` rows are populated; remainder are blank.
- If character has > 3 weapons: only first 3 are shown (silently truncated).

---

## Verification

- With character with 2 weapons: rows 1 and 2 populated, row 3 is blank.
- With character with 4 weapons: only first 3 shown, no overflow.
- With empty character: all 3 rows are blank.
- Grip column: one-handed weapon shows "1H"; two-handed shows "2H".
- Column headers match: Name, Grip, Range, Damage, Dur. (or Durability), Features.

---

## Acceptance Criteria

- [ ] `12.1` Table has columns: Name, Grip, Range, Damage, Durability, Features
- [ ] `12.2` Up to 3 weapons populate the table from `character.weapons`
- [ ] `12.3` Grip displays as "1H" for one-handed, "2H" for two-handed
- [ ] `12.4` Remaining rows (< 3 weapons) render as blank lines
- [ ] `12.5` More than 3 weapons do not overflow the table
