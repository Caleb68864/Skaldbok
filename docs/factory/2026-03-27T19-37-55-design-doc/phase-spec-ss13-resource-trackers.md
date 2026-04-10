# Phase Spec — SS-13: Resource Trackers (HP, WP, Death Rolls)

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-13
**Priority:** P0 | **Impact:** 5 | **Risk:** 3
**Dependency:** SS-03 (PrintableSheet component must exist). SS-14 (CSS) needed for dot color styling.

---

## Objective

Render HP and WP dots with correct filled/empty state, rest checkboxes, and death roll boxes. HP and WP are the most-referenced values during play. Death rolls must always be visible — even at full HP.

---

## Files to Modify

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Add: resource trackers JSX (in lower section, right column) |
| `src/styles/print-sheet.css` | Add: dot grid, HP/WP, death roll, rest checkbox styles |

---

## Field Mapping

```
character.resources['hp'].current  → number of filled HP dots
character.resources['hp'].max      → total HP dots (= derived.hpMax = CON)
character.resources['wp'].current  → number of filled WP dots
character.resources['wp'].max      → total WP dots (= derived.wpMax = WIL)
```

Use `derived.hpMax` and `derived.wpMax` (from the `derived` prop) as the authoritative max values since they reflect user overrides.

---

## Implementation Steps

### 1. Dot Renderer Helper
```typescript
function DotTracker({
  label,
  current,
  max,
  filledClass,
}: {
  label: string;
  current: number;
  max: number;
  filledClass: string; // 'hp-dot-filled' or 'wp-dot-filled'
}) {
  const safeCurrent = Math.max(0, Math.min(current, max));
  return (
    <div className="sheet-dot-tracker">
      <div className="sheet-dot-label">{label}</div>
      <div className="sheet-dot-grid">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`sheet-dot ${i < safeCurrent ? filledClass : 'dot-empty'}`}
          />
        ))}
      </div>
    </div>
  );
}
```

### 2. Full Resource Trackers JSX
```jsx
{/* Resource Trackers — Lower section, right column */}
<div className="sheet-resource-trackers">
  <div className="sheet-section-header">Hit Points &amp; Willpower</div>

  <DotTracker
    label="HP"
    current={character.resources?.['hp']?.current ?? 0}
    max={derived.hpMax}
    filledClass="hp-dot-filled"
  />

  <DotTracker
    label="WP"
    current={character.resources?.['wp']?.current ?? 0}
    max={derived.wpMax}
    filledClass="wp-dot-filled"
  />

  {/* Rest Checkboxes */}
  <div className="sheet-rest-row">
    <label className="sheet-rest-checkbox">
      <span className="sheet-checkbox-box" />
      <span className="sheet-checkbox-label">Round Rest</span>
    </label>
    <label className="sheet-rest-checkbox">
      <span className="sheet-checkbox-box" />
      <span className="sheet-checkbox-label">Stretch Rest</span>
    </label>
  </div>

  {/* Death Rolls */}
  <div className="sheet-death-rolls">
    <div className="sheet-section-header">Death Rolls</div>
    <div className="sheet-death-roll-row">
      <span className="sheet-death-label">Success</span>
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className="sheet-checkbox-box" />
      ))}
    </div>
    <div className="sheet-death-roll-row">
      <span className="sheet-death-label">Failure</span>
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className="sheet-checkbox-box" />
      ))}
    </div>
  </div>
</div>
```

### 3. CSS Rules
```css
/* Dot grid */
.sheet-dot-tracker {
  margin-bottom: 4px;
}

.sheet-dot-label {
  font-size: 7pt;
  text-transform: uppercase;
  font-family: var(--font-ui, 'Source Serif 4', serif);
  font-weight: bold;
  margin-bottom: 2px;
}

.sheet-dot-grid {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 2px;
}

.sheet-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid currentColor;
  display: inline-block;
}

.dot-empty {
  background-color: transparent;
}

/* HP dot colors */
.print-sheet--color .hp-dot-filled {
  background-color: #c0392b; /* red */
  border-color: #c0392b;
}

/* WP dot colors */
.print-sheet--color .wp-dot-filled {
  background-color: #27ae60; /* green */
  border-color: #27ae60;
}

/* B&W mode dots */
.print-sheet--bw .hp-dot-filled,
.print-sheet--bw .wp-dot-filled {
  background-color: #333333;
  border-color: #333333;
}

/* Rest checkboxes */
.sheet-rest-row {
  display: flex;
  gap: 0.15in;
  margin: 4px 0;
}

.sheet-rest-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 7.5pt;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
}

.sheet-checkbox-box {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 1px solid currentColor;
  flex-shrink: 0;
}

.sheet-checkbox-label {
  font-family: var(--font-ui, 'Source Serif 4', serif);
  font-size: 7.5pt;
}

/* Death rolls */
.sheet-death-rolls {
  margin-top: 4px;
}

.sheet-death-roll-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 3px;
}

.sheet-death-label {
  font-size: 7pt;
  min-width: 40px;
  font-family: var(--font-ui, 'Source Serif 4', serif);
}
```

### 4. Static Elements
- Rest checkboxes and death roll boxes are **static** — no `onChange`, no interactivity.
- All death roll boxes start unchecked (empty `.sheet-checkbox-box` elements).
- Always render death rolls — do not hide at full HP.

### 5. Edge Cases
- If `derived.hpMax` is 0 or undefined: render 0 dots (no dots, just the label). Do not error.
- If `character.resources['hp']?.current` is undefined: default to 0 filled dots.
- Clamp `current` to `[0, max]` range: `Math.max(0, Math.min(current, max))`.

---

## Verification

- With character HP 8/12: 8 filled dots, 4 empty; 12 total.
- With character WP 3/9: 3 filled green dots, 6 empty; 9 total.
- Color mode: HP dots are red, WP dots are green.
- B&W mode: both HP and WP filled dots are dark gray.
- Round Rest and Stretch Rest checkboxes are visible.
- 3 success + 3 failure death roll boxes are visible and unchecked.
- With empty character (all zeros): no dots shown, rest boxes still visible.

---

## Acceptance Criteria

- [ ] `13.1` HP total dots = `derived.hpMax`; filled dots = `character.resources['hp'].current`
- [ ] `13.2` WP total dots = `derived.wpMax`; filled dots = `character.resources['wp'].current`
- [ ] `13.3` Filled dots visually distinct from empty dots
- [ ] `13.4` HP dots are red (color mode) or dark gray (B&W mode)
- [ ] `13.5` WP dots are green (color mode) or dark gray (B&W mode)
- [ ] `13.6` Death roll boxes (3 success, 3 failure) are present and unchecked
- [ ] `13.7` Round Rest and Stretch Rest checkbox areas are present
