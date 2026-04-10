# Phase Spec — SS-10: Inventory Section

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-10
**Priority:** P2 | **Impact:** 3 | **Risk:** 2
**Dependency:** SS-03 (PrintableSheet component must exist; this section renders inside it).

---

## Objective

Render the gear tracking section with a fixed 10-slot grid matching the official PDF. Includes inventory items, the memento slot, and tiny items. Fixed height, no overflow.

---

## Files to Modify

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Add: inventory section JSX |
| `src/styles/print-sheet.css` | Add: inventory layout styles |

---

## Field Mapping

| Display | Source | Note |
|---|---|---|
| Inventory items (10 slots) | `character.inventory` → `InventoryItem[]` | Use `item.name`; max 10 |
| Memento | `character.memento` → `string` | **Top-level field**, NOT `character.metadata.memento` |
| Tiny Items | `character.tinyItems` → `string[]` | List in dedicated area |

> **Critical:** `character.memento` is a top-level string field, NOT `character.metadata.memento`. This is a common mistake.

---

## Implementation Steps

### 1. JSX Structure
```jsx
{/* Inventory Section — Right column */}
<div className="sheet-inventory">
  <div className="sheet-section-header">Inventory</div>

  {/* 10 numbered slots */}
  {Array.from({ length: 10 }).map((_, i) => {
    const item = character.inventory?.[i];
    return (
      <div key={i} className="sheet-inventory-slot">
        <span className="sheet-inventory-number">{i + 1}.</span>
        <span className="sheet-inventory-name">{item?.name ?? ''}</span>
      </div>
    );
  })}

  {/* Memento */}
  <div className="sheet-inventory-slot sheet-inventory-memento">
    <span className="sheet-inventory-label">Memento:</span>
    <span className="sheet-inventory-name">{character.memento ?? ''}</span>
  </div>

  {/* Tiny Items */}
  <div className="sheet-tiny-items">
    <span className="sheet-inventory-label">Tiny Items:</span>
    <span className="sheet-tiny-items-value">
      {(character.tinyItems ?? []).join(', ')}
    </span>
  </div>
</div>
```

### 2. CSS Rules
```css
.sheet-inventory {
  overflow: hidden;
}

.sheet-inventory-slot {
  display: flex;
  align-items: center;
  gap: 3px;
  border-bottom: 0.5px solid rgba(0,0,0,0.25);
  min-height: 12px;
  padding: 1px 2px;
  font-size: 8pt;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
}

.sheet-inventory-number {
  color: rgba(0,0,0,0.5);
  font-size: 7pt;
  min-width: 12px;
  flex-shrink: 0;
}

.sheet-inventory-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-inventory-label {
  font-size: 7pt;
  text-transform: uppercase;
  font-family: var(--font-ui, 'Source Serif 4', serif);
  font-weight: bold;
  margin-right: 3px;
  flex-shrink: 0;
}

.sheet-inventory-memento {
  margin-top: 2px;
  border-top: 1px solid currentColor;
}

.sheet-tiny-items {
  font-size: 7.5pt;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
  border-top: 1px solid currentColor;
  padding-top: 2px;
  overflow: hidden;
}

.sheet-tiny-items-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### 3. Slot Rules
- Always render exactly 10 inventory slots (numbered 1–10).
- Items fill from the top; unused slots are blank (empty string value).
- If character has > 10 items: only the first 10 are shown (silently truncated by the `Array.from({ length: 10 })` approach).
- `overflow: hidden` on the container prevents any page overflow.

### 4. Memento Field Access
- Use `character.memento` (top-level string), NOT `character.metadata?.memento`.
- If undefined: renders as empty (blank line).

---

## Verification

- With character with 7 inventory items: first 7 slots populated, slots 8–10 are blank.
- With character with 12 inventory items: only 10 show, no overflow.
- `character.memento` value appears in the Memento line.
- `character.tinyItems` joined with commas appears in the Tiny Items area.
- With empty character: all 10 slots blank, memento blank, tiny items blank.

---

## Acceptance Criteria

- [ ] `10.1` Up to 10 inventory items display by name
- [ ] `10.2` Memento reads from `character.memento` (top-level, not metadata)
- [ ] `10.3` Tiny items display in a dedicated labeled area
- [ ] `10.4` Unused inventory slots render as blank lines (not hidden)
- [ ] `10.5` More than 10 items do not overflow the section (truncate/clip silently)
