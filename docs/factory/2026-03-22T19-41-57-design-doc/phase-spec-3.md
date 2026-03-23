# Phase 3: Reference Tab & Navigation

**Run ID**: `2026-03-22T19-41-57-design-doc`
**Phase**: 3 of 4
**Sub-Specs**: SS-01 (Reference Tab — Full Dragonbane Reference Data), SS-05 (Navigation Improvements)
**Priority**: P0 + P1
**Combined Score**: 40 / 100

---

## Dependencies

```
(none) ──→ SS-01 (Reference Tab) ──→ SS-05 (Navigation — reference must be reachable)
```

**Upstream**: No hard dependencies on Phase 1 or 2. SS-01 can technically run in parallel, but is sequenced here due to its size and to avoid merge conflicts.
**Downstream**: SS-05 depends on SS-01 being complete (no point making Reference navigable if the tab is empty).

**Internal ordering**: SS-01 first (build the reference content), then SS-05 (make it navigable).

---

## Rationale

The Reference Tab (SS-01) is the highest-scoring single sub-spec at 30 points and is P0 Critical. It represents the largest feature addition in this spec. Navigation improvements (SS-05) are tightly coupled — they make SS-01 accessible to users. Grouping them ensures the reference tab is both built and reachable in a single phase.

---

## Implementation Steps

### Step 3.1: Create Reference Data Module (SS-01)

**New file**: `src/data/dragonbaneReference.ts`

**Action**: Convert the YAML reference data into a TypeScript constant. Since the project does not have a YAML parser dependency and the spec says "bundled as static JSON/TS module," hardcode the data as a typed TypeScript object.

**Structure**:
```ts
export interface ReferenceSection {
  id: string;
  title: string;
  type: 'table' | 'key_value_list' | 'rules_text';
  columns?: string[];          // for table type
  rows?: Record<string, string>[]; // for table type
  items?: { label: string; description: string }[]; // for key_value_list
  paragraphs?: string[];       // for rules_text
  footnote?: string;           // optional (e.g., conditions footnote)
}

export interface ReferencePage {
  title: string;
  sections: string[]; // section IDs
}

export const referencePages: ReferencePage[] = [ ... ];
export const referenceSections: ReferenceSection[] = [ ... ];
```

**Data completeness**: All 15 sections must be included with exact values from the YAML:

| # | Section ID | Type | Count |
|---|-----------|------|-------|
| 1 | `measuring_time` | table | 3 rows |
| 2 | `free_actions` | key_value_list | 4 items |
| 3 | `actions` | key_value_list | 16 items |
| 4 | `severe_injuries` | table | 14 rows |
| 5 | `attributes` | table | 6 rows |
| 6 | `skills` | table | 31 rows |
| 7 | `healing_and_rest` | table | 3 rows |
| 8 | `conditions` | table | 6 rows + footnote |
| 9 | `fear` | table | 8 rows |
| 10 | `skill_level_base_chance` | table | 5 rows |
| 11 | `typical_npcs` | table | 11 rows |
| 12 | `common_animals` | table | 11 rows |
| 13 | `npc_attribute_guidelines` | rules_text | 5 paragraphs |
| 14 | `creating_npcs` | table | 20 rows |
| 15 | `mishaps` | table | 12 rows |

**Source**: `dragonbane_reference_sheet.yaml` (if present in repo) or Dragonbane official reference sheet content. Values must match exactly.

### Step 3.2: Create Reference Section Renderers (SS-01)

**New file**: `src/components/fields/ReferenceTable.tsx`
**New file**: `src/components/fields/ReferenceKeyValueList.tsx`
**New file**: `src/components/fields/ReferenceRulesText.tsx`

Or, a single component with switch rendering:

**New file**: `src/components/fields/ReferenceSectionRenderer.tsx`

**Rendering rules** (from blueprint):
- **Section headers**: Dark green (`#2f5b1f`) bar with white uppercase text
- **Table headers**: Lighter green (`#9bc07b`) background, bold text
- **Table body**: Alternating row striping (`#ffffff` / `#e4eddc`)
- **Key-value lists**: Bold label (20% width), body text (80% width)
- **Rules text**: Freeform paragraphs with standard text styling

**CSS approach**: Use inline styles for now (consistent with current codebase). These will be migrated to CSS modules in Phase 4 (SS-06). Alternatively, add theme CSS variables for reference-specific colors and use them.

**Add theme variables** to `src/theme/theme.css`:
```css
--ref-header-bg: #2f5b1f;
--ref-header-text: #ffffff;
--ref-table-header-bg: #9bc07b;
--ref-row-even: #ffffff;
--ref-row-odd: #e4eddc;
```

### Step 3.3: Extend ReferenceScreen with Reference Data (SS-01)

**File**: `src/screens/ReferenceScreen.tsx`

**Current behavior**: Renders user-created reference notes only (CRUD with referenceNoteRepository).

**New behavior**: Two-tab layout within ReferenceScreen:
1. **"Game Reference" tab** — Renders all 15 sections from the static data module using SectionPanel (collapsible) for each section, grouped by page
2. **"My Notes" tab** — Existing user notes functionality (preserved exactly as-is)

**Layout**:
```tsx
<div>
  {/* Tab switcher */}
  <div style={{ display: 'flex', gap: 8 }}>
    <button onClick={() => setTab('reference')}>Game Reference</button>
    <button onClick={() => setTab('notes')}>My Notes</button>
  </div>

  {tab === 'reference' && (
    <div>
      <input placeholder="Search reference..." onChange={handleSearch} />
      {filteredSections.map(section => (
        <SectionPanel key={section.id} title={section.title}>
          <ReferenceSectionRenderer section={section} />
        </SectionPanel>
      ))}
    </div>
  )}

  {tab === 'notes' && (
    /* Existing notes UI — moved here unchanged */
  )}
</div>
```

### Step 3.4: Implement Search/Filter (SS-01)

**Action**: Add a search input at the top of the Game Reference tab that filters sections by:
- Section title match
- Content match (row values, item labels/descriptions, paragraph text)

**Implementation**:
```ts
const [searchQuery, setSearchQuery] = useState('');

const filteredSections = useMemo(() => {
  if (!searchQuery.trim()) return referenceSections;
  const q = searchQuery.toLowerCase();
  return referenceSections.filter(section => {
    if (section.title.toLowerCase().includes(q)) return true;
    if (section.rows?.some(row => Object.values(row).some(v => v.toLowerCase().includes(q)))) return true;
    if (section.items?.some(item => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))) return true;
    if (section.paragraphs?.some(p => p.toLowerCase().includes(q))) return true;
    return false;
  });
}, [searchQuery]);
```

### Step 3.5: Add Navigation to Reference & Settings (SS-05)

**Recommended approach**: Option B — TopBar overflow menu (hamburger menu).

**File**: `src/components/layout/TopBar.tsx`

**Action**: Add a hamburger/overflow menu button (☰ or ⋮) to the TopBar that opens a dropdown/overlay with:
- **Reference** → `/reference`
- **Settings** → `/settings`

**Implementation**:
```tsx
const [menuOpen, setMenuOpen] = useState(false);

// In the TopBar render:
<button onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">☰</button>

{menuOpen && (
  <nav style={{ position: 'absolute', top: '100%', right: 0, ... }}>
    <NavLink to="/reference" onClick={() => setMenuOpen(false)}>
      📖 Reference
    </NavLink>
    <NavLink to="/settings" onClick={() => setMenuOpen(false)}>
      ⚙️ Settings
    </NavLink>
  </nav>
)}
```

**Active state**: Use React Router's `NavLink` with `className` callback to apply active styling when on `/reference` or `/settings`.

**Click-outside-to-close**: Add an overlay backdrop or `useEffect` with click-outside detection to close the menu.

### Step 3.6: Update TopBar Styling (SS-05)

**File**: `src/theme/theme.css`

**Action**: Add styles for the overflow menu:
```css
.topbar-menu { /* dropdown container */ }
.topbar-menu__item { /* menu item */ }
.topbar-menu__item--active { /* active route indicator */ }
```

---

## Acceptance Criteria Checklist

| AC | Description | Verification |
|----|-------------|-------------|
| AC-01.1 | ReferenceScreen renders all 15 sections | Count rendered SectionPanel components |
| AC-01.2 | Each section displays correct title matching YAML | Spot-check titles against YAML |
| AC-01.3 | Table sections render with column headers and all rows | Count rows: Severe Injuries=14, Skills=31, etc. |
| AC-01.4 | Key-value list sections render with bold labels | Check free_actions (4 items) and actions (16 items) |
| AC-01.5 | Rules text sections render as paragraphs | npc_attribute_guidelines has 5 paragraphs |
| AC-01.6 | Conditions section includes footnote | "Bane on all rolls..." footnote visible |
| AC-01.7 | Reference sections use Dragonbane theme colors | Green header bars, alternating row stripes |
| AC-01.8 | User-created reference notes remain accessible | "My Notes" tab works as before |
| AC-01.9 | Section content is searchable or filterable | Search input filters sections |
| AC-01.10 | Data values match YAML exactly | Spot-check: Severe Injuries=14 entries d20 1-2 through 20; Skills=31; Typical NPCs=11 incl 3 boss |
| AC-05.1 | Reference screen reachable via visible UI element | TopBar menu contains Reference link |
| AC-05.2 | Settings screen reachable via visible UI element | TopBar menu contains Settings link |
| AC-05.3 | Navigation element visible on all screen sizes | Menu button in TopBar (always visible) |
| AC-05.4 | Active state styling on Reference/Settings routes | NavLink active class applied |
| AC-05.5 | Back navigation returns to previous screen | Browser back button works (React Router handles this) |

---

## Verification Commands

```bash
# 1. Reference data module exists with all 15 sections
grep -c "id:" src/data/dragonbaneReference.ts
# Expected: 15 section IDs

# 2. ReferenceScreen imports reference data
grep -n "dragonbaneReference\|referenceSections" src/screens/ReferenceScreen.tsx
# Expected: Import present

# 3. SectionPanel used for reference sections
grep -c "SectionPanel" src/screens/ReferenceScreen.tsx
# Expected: Multiple occurrences

# 4. Search functionality exists
grep -n "searchQuery\|Search\|filter" src/screens/ReferenceScreen.tsx
# Expected: Search state and filter logic

# 5. TopBar has menu for Reference/Settings
grep -n "reference\|settings\|menuOpen\|☰" src/components/layout/TopBar.tsx
# Expected: Menu button and NavLinks

# 6. User notes tab preserved
grep -n "referenceNoteRepository\|My Notes\|notes" src/screens/ReferenceScreen.tsx
# Expected: Notes functionality still present

# 7. TypeScript check
npx tsc --noEmit

# 8. Build check
npm run build
```

---

## Risk Notes

- **High complexity**: SS-01 is the largest sub-spec (30 points). The reference data module will be substantial (~500+ lines of typed data).
- **Data accuracy**: All reference data must be verified against the YAML source. Typos or missing entries will fail AC-01.10.
- **Existing notes**: The ReferenceScreen refactor must preserve the existing notes CRUD functionality completely. Test that notes can still be created, edited, and deleted after the refactor.
- **TopBar space**: Adding a menu button to the TopBar must not break existing layout (mode toggle, fullscreen, wake lock buttons). Ensure adequate spacing.
- **Mobile UX**: The overflow menu must be usable on small screens (touch targets ≥ 44px per theme variable).
