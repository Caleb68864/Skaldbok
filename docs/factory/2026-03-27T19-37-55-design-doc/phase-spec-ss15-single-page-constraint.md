# Phase Spec — SS-15: Single-Page Constraint

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-15
**Priority:** P0 | **Impact:** 5 | **Risk:** 5
**Dependency:** ALL other sub-specs (SS-01 through SS-14) must be complete before this constraint can be verified and tuned. This is the final integration and fit check.

---

## Objective

Ensure the sheet fits on exactly one letter-size portrait page in Chrome Print Preview — for both a fully-populated character and an empty character. This is the highest-risk sub-spec because overflow is the most likely failure mode when sections have variable-length content.

---

## Files to Modify

| File | Action |
|---|---|
| `src/styles/print-sheet.css` | Adjust: font sizes, padding, section heights as needed |
| `src/components/PrintableSheet.tsx` | Adjust: slot counts, grid layout proportions as needed |

---

## Strategy: Hard Container + Overflow Hidden

The primary mitigation is already baked into the architecture:

1. **Hard container:** `.print-sheet { height: 11in; overflow: hidden; }` — content beyond 11in is cut off.
2. **Variable-length section clipping:** abilities/spells, inventory, secondary skills all use `overflow: hidden` with fixed heights.
3. **Font size baseline:** ~8–9pt for dense data sections; minimum 7pt.

This sub-spec is about **verifying** the fit and **adjusting** if needed.

---

## Implementation Steps

### Step 1: Initial Render Check
After all other sub-specs are implemented, open `/print` with:
- (a) A fully-populated character (all fields filled, multiple weapons, spells, abilities, 10 inventory items)
- (b) An empty/new character (minimal data)

### Step 2: Open Chrome Print Preview
Press `Ctrl+P` (or `Cmd+P` on Mac). Observe:
- Is the page count exactly 1?
- Is the lower section (weapons/trackers/armor) visible?
- Are all section headers visible (not clipped)?

### Step 3: Apply Mitigations If Overflow Detected

#### Mitigation A: Reduce font sizes in dense sections
```css
/* In print-sheet.css — apply if overflow occurs */
.sheet-skill-row { font-size: 7pt; min-height: 11px; }
.sheet-inventory-slot { font-size: 7.5pt; min-height: 11px; }
.sheet-ability-row { font-size: 7.5pt; min-height: 11px; }
```

#### Mitigation B: Reduce padding/margins between sections
```css
/* Reduce vertical breathing room */
.sheet-attribute-band { margin-bottom: 0.03in; }
.sheet-derived-row { padding: 2px 0; }
.sheet-section-header { margin: 1px 0; }
```

#### Mitigation C: Reduce blank slot counts
In `PrintableSheet.tsx`:
- Secondary skills: reduce from 6 to 4 slots if needed
- Abilities: reduce from 5 to 3 slots if needed
- Spells: reduce from 5 to 3 slots if needed

#### Mitigation D: Compact the 3-column body layout
```css
/* Tighter column layout */
.sheet-body-columns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.08in;
}
```

### Step 4: Verify All 10 Sections Are Visible
The following sections must all be visible within the single page — none clipped or missing:
1. Header (identity fields)
2. Attribute band + conditions
3. Derived stats row
4. Abilities & spells (left column)
5. Skills (center column)
6. Inventory (right column)
7. Armor & helmet (lower left)
8. Weapons table (lower center)
9. Resource trackers (lower right)
10. Currency (left column, below abilities)

### Step 5: Warning Signals to Check
| Signal | Action |
|---|---|
| Page count > 1 in Print Preview | Apply mitigations A + B; reduce slot counts |
| Section header clipped at bottom of page | Reduce font sizes or padding above that section |
| Lower section (weapons/trackers) missing | Shrink the body columns section height |
| White space gap at bottom of page | Increase slot counts or font size (not a critical failure) |

---

## Escalation Triggers

STOP and report to human (do not continue implementing) if:
1. Content cannot fit on one page after all mitigations (font at 7pt minimum, padding at minimum, slot counts at minimum 3 each)
2. Reducing font size below 7pt would be required
3. An entire section must be removed to fit

These are defined escalation triggers in the spec. Do not silently omit sections.

---

## Verification Commands

No shell commands. Verify by:
- Chrome Print Preview → page count = 1 (both full and empty character)
- Visual inspection → all 10 sections visible, none clipped

---

## Acceptance Criteria

- [ ] `15.1` Chrome Print Preview (Ctrl+P) shows exactly 1 page for a fully-populated character
- [ ] `15.2` Chrome Print Preview shows exactly 1 page for an empty character
- [ ] `15.3` All 10 major sections are visible within the single page (no section is cut off)

---

## Reference: Layout Proportions

As a starting point for the 3-column body grid, consider these approximate vertical allocations:

```
Header:             ~0.8in
Attribute band:     ~0.5in
Derived stats row:  ~0.35in
Body columns:       ~5.5in  ← tallest section; skills drive this
Lower section:      ~2.5in
Margins/gaps:       ~0.35in (from @page margin 0.25in × 2)
─────────────────────────
Total:              ~10.0in (fits within 11in @page with 0.25in margins)
```

Adjust these proportions if sections overflow.
