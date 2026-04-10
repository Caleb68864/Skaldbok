# Phase Spec — SS-08: Abilities & Spells Section

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-08
**Priority:** P2 | **Impact:** 3 | **Risk:** 2
**Dependency:** SS-03 (PrintableSheet component must exist; this section renders inside it).

---

## Objective

List the character's heroic abilities and known spells for quick reference. Names only — no mechanical detail. Fixed height, no overflow.

---

## Files to Modify

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Add: abilities & spells section JSX |
| `src/styles/print-sheet.css` | Add: abilities/spells layout styles |

---

## Field Mapping

| Source | Display |
|---|---|
| `character.heroicAbilities` → `HeroicAbility[]` | Render `ability.name` for each |
| `character.spells` → `Spell[]` | Render `spell.name` for each |

---

## Implementation Steps

### 1. JSX Structure
```jsx
{/* Abilities & Spells — Left column, upper portion */}
<div className="sheet-abilities-spells">
  <div className="sheet-section-header">Abilities</div>
  {(character.heroicAbilities ?? []).map((ability, i) => (
    <div key={i} className="sheet-ability-row">
      {ability.name}
    </div>
  ))}
  {/* Blank filler lines for abilities */}
  {Array.from({ length: Math.max(0, 5 - (character.heroicAbilities?.length ?? 0)) }).map((_, i) => (
    <div key={`ability-blank-${i}`} className="sheet-ability-row sheet-blank-row">&nbsp;</div>
  ))}

  <div className="sheet-section-header">Spells</div>
  {(character.spells ?? []).map((spell, i) => (
    <div key={i} className="sheet-ability-row">
      {spell.name}
    </div>
  ))}
  {/* Blank filler lines for spells */}
  {Array.from({ length: Math.max(0, 5 - (character.spells?.length ?? 0)) }).map((_, i) => (
    <div key={`spell-blank-${i}`} className="sheet-ability-row sheet-blank-row">&nbsp;</div>
  ))}
</div>
```

> Agent may adjust slot counts (5 for abilities, 5 for spells) to fit page height — minimum 3 each. The key requirement is that the section has fixed height and overflow is hidden.

### 2. CSS Rules
```css
.sheet-abilities-spells {
  overflow: hidden;
  /* Height set to match left column allocation — adjust as needed for single-page fit */
}

.sheet-ability-row {
  font-size: 8pt;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
  border-bottom: 0.5px solid rgba(0,0,0,0.25);
  min-height: 13px;
  padding: 1px 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-blank-row {
  /* Same as .sheet-ability-row — blank lines must still render */
  color: transparent; /* hides &nbsp; visually while maintaining height */
}
```

### 3. Empty State
- If both `character.heroicAbilities` and `character.spells` are empty arrays, all slots render as blank lines.
- Blank lines must still render with visible bottom borders (underlines) — do not hide them.

### 4. Overflow Prevention
- Use `overflow: hidden` on the container.
- If a character has many abilities + spells, entries beyond the slot count will be silently clipped.
- Do **not** use `overflow: scroll` or `overflow: auto` (would show scrollbars in print).

---

## Verification

- With a character who has 3 heroic abilities and 2 spells: those names appear; remaining slots are blank underlines.
- With empty character: all slots are blank underlines.
- With 10+ abilities: section does not grow or overflow its container.
- Section header labels "Abilities" and "Spells" (or combined "Abilities & Spells") are visible.

---

## Acceptance Criteria

- [ ] `8.1` All heroic ability names are listed
- [ ] `8.2` All spell names are listed
- [ ] `8.3` Empty slots render as blank lines (not hidden)
- [ ] `8.4` Section does not grow beyond its allocated vertical space
