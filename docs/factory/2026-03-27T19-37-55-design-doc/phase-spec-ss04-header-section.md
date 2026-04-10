# Phase Spec — SS-04: Header Section

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-04
**Priority:** P1 | **Impact:** 4 | **Risk:** 2
**Dependency:** SS-03 (PrintableSheet component must exist; this section is rendered inside it).

---

## Objective

Render the visual identity header of the character sheet. It establishes the Dragonbane aesthetic and contains all identity fields. Matches the style of the official Dragonbane PDF header.

---

## Files to Modify

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Add: header section JSX (inside component or as sub-function) |
| `src/styles/print-sheet.css` | Add: header layout and style rules |

---

## Field Mapping

| Display Label | Source |
|---|---|
| Name | `character.name` |
| Player | *(blank — not in CharacterRecord)* |
| Kin | `character.metadata.kin` |
| Age | `character.metadata.age` |
| Profession | `character.metadata.profession` |
| Weakness | `character.metadata.weakness` |
| Appearance | `character.metadata.appearance` |

---

## Implementation Steps

### 1. HTML Structure
```jsx
<div className="sheet-header">
  <div className="sheet-title">DRAGONBANE</div>
  <div className="sheet-header-bar" />  {/* decorative teal/gray bar */}
  <div className="sheet-identity-row">
    <div className="sheet-field">
      <span className="sheet-label">Name</span>
      <span className="sheet-value">{character.name || ''}</span>
    </div>
    <div className="sheet-field">
      <span className="sheet-label">Player</span>
      <span className="sheet-value">{/* intentionally blank */}</span>
    </div>
    <div className="sheet-field">
      <span className="sheet-label">Kin</span>
      <span className="sheet-value">{character.metadata?.kin || ''}</span>
    </div>
    <div className="sheet-field">
      <span className="sheet-label">Age</span>
      <span className="sheet-value">{character.metadata?.age || ''}</span>
    </div>
    <div className="sheet-field">
      <span className="sheet-label">Profession</span>
      <span className="sheet-value">{character.metadata?.profession || ''}</span>
    </div>
  </div>
  <div className="sheet-identity-row">
    <div className="sheet-field sheet-field--wide">
      <span className="sheet-label">Weakness</span>
      <span className="sheet-value">{character.metadata?.weakness || ''}</span>
    </div>
    <div className="sheet-field sheet-field--wide">
      <span className="sheet-label">Appearance</span>
      <span className="sheet-value">{character.metadata?.appearance || ''}</span>
    </div>
  </div>
</div>
```

### 2. CSS Rules to Add
```css
.sheet-header {
  margin-bottom: 0.1in;
}

.sheet-title {
  font-family: var(--font-display, 'Marcellus', serif);
  font-size: 28pt;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  line-height: 1;
}

.sheet-header-bar {
  height: 6px;
  margin: 4px 0;
}

/* Color mode: teal bar */
.print-sheet--color .sheet-header-bar {
  background-color: #2a7a7a;
}

/* B&W mode: dark gray bar */
.print-sheet--bw .sheet-header-bar {
  background-color: #1a1a1a;
}

.sheet-identity-row {
  display: flex;
  gap: 0.15in;
  margin-bottom: 2px;
}

.sheet-field {
  display: flex;
  flex-direction: column;
  flex: 1;
  border-bottom: 1px solid currentColor;
  min-width: 0;
}

.sheet-field--wide {
  flex: 2;
}

.sheet-label {
  font-size: 7pt;
  text-transform: uppercase;
  opacity: 0.7;
}

.sheet-value {
  font-size: 9pt;
  min-height: 1em;
}
```

### 3. Empty Field Rule
- When a field value is `undefined`, `null`, or `''`, render as an empty `<span>` — do NOT render "N/A", "(none)", or any placeholder text.
- The `border-bottom` on `.sheet-field` creates the visible blank underline.

### 4. Player Field
- The "Player" field does not exist in `CharacterRecord`. Always render it as a blank line (empty `sheet-value` span). This is intentional per spec.

---

## Verification

- Check: "DRAGONBANE" title renders in display font (Marcellus) at large size.
- Check: All 6 identity fields (Name, Kin, Age, Profession, Weakness, Appearance) are present.
- Check: Player field is present as a blank line.
- Check: With a new character (empty metadata), all fields show as blank underlines — no "N/A".
- Check: Color mode shows teal bar; B&W mode shows dark gray bar.

---

## Acceptance Criteria

- [ ] `4.1` All 6 identity fields (Name, Kin, Age, Profession, Weakness, Appearance) are present and populated
- [ ] `4.2` Empty metadata fields render as blank lines (not "N/A" or placeholder)
- [ ] `4.3` "Player" field renders as blank line (not an error or missing element)
- [ ] `4.4` Header is visually distinct (larger text, decorative element) from body sections
