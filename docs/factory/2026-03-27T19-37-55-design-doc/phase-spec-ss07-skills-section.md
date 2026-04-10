# Phase Spec — SS-07: Skills Section

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-07
**Priority:** P0 | **Impact:** 5 | **Risk:** 3
**Dependency:** SS-03 (PrintableSheet component must exist). `system` prop must contain the canonical skill definitions.

---

## Objective

Render the complete skills list — the primary mechanical section. Players reference these on every roll. Must list all canonical general (20) and weapon (10) skills from the system definition in correct order, plus up to 6 secondary skill slots.

---

## Files to Modify

| File | Action |
|---|---|
| `src/components/PrintableSheet.tsx` | Add: skills section JSX |
| `src/styles/print-sheet.css` | Add: skills layout styles |

---

## Skill Groups

1. **General Skills** — 20 canonical skills from `system.skills` (filtered by type `'general'` or by system's ordering)
2. **Weapon Skills** — 10 canonical weapon skills from `system.skills` (filtered by type `'weapon'`)
3. **Secondary Skills** — up to 6 slots; show existing secondary/custom skills, blank lines for remainder

---

## Field Mapping

For each skill key in the system's canonical order:
```
skill key                              → e.g. 'acrobatics', 'beast_lore', 'spot_hidden'
system.skills[key].name               → display name (e.g. "Acrobatics", "Beast Lore")
character.skills[key]?.value          → skill value (number), default: 0 or ''
character.skills[key]?.trained        → whether trained (boolean), default: false
```

---

## Implementation Steps

### 1. Derive Ordered Skill Lists
```typescript
// Inside PrintableSheet component or helper
const allSystemSkills = system?.skills ?? {};
// system.skills is likely keyed by skill id; use system's canonical order array if available.
// If system provides an ordered array like system.skillOrder, use that.
// Otherwise sort by skill type then alphabetically.

const generalSkills = Object.entries(allSystemSkills)
  .filter(([, def]) => def.type === 'general' || def.category === 'general')
  .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0));

const weaponSkills = Object.entries(allSystemSkills)
  .filter(([, def]) => def.type === 'weapon' || def.category === 'weapon')
  .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0));

const secondarySkills = Object.entries(character.skills ?? {})
  .filter(([key]) => !allSystemSkills[key]); // custom/secondary skills not in system
const secondarySlots = 6;
```

> **Important:** Check the actual `SystemDefinition` type to understand how skills are structured. Adapt the filtering/sorting logic accordingly. If the system definition provides a different structure, follow that structure — correctness over adherence to this example code.

### 2. Skill Row JSX Helper
```jsx
function SkillRow({ skillKey, name, value, trained }: {
  skillKey: string;
  name: string;
  value: number | string;
  trained: boolean;
}) {
  return (
    <div className="sheet-skill-row">
      <span className="sheet-skill-trained">{trained ? '◆' : '◇'}</span>
      <span className="sheet-skill-name">{name}</span>
      <span className="sheet-skill-value">{value}</span>
    </div>
  );
}
```

### 3. Full Skills Section JSX
```jsx
{/* Skills Section — center column */}
<div className="sheet-skills-section">
  <div className="sheet-section-header">General Skills</div>
  {generalSkills.map(([key, def]) => {
    const charSkill = character.skills?.[key];
    return (
      <SkillRow
        key={key}
        skillKey={key}
        name={def.name}
        value={charSkill?.value ?? ''}
        trained={charSkill?.trained ?? false}
      />
    );
  })}

  <div className="sheet-section-header">Weapon Skills</div>
  {weaponSkills.map(([key, def]) => {
    const charSkill = character.skills?.[key];
    return (
      <SkillRow
        key={key}
        skillKey={key}
        name={def.name}
        value={charSkill?.value ?? ''}
        trained={charSkill?.trained ?? false}
      />
    );
  })}

  <div className="sheet-section-header">Secondary Skills</div>
  {Array.from({ length: secondarySlots }).map((_, i) => {
    const [key, charSkill] = secondarySkills[i] ?? [null, null];
    const def = key ? allSystemSkills[key] : null;
    return (
      <SkillRow
        key={i}
        skillKey={key ?? `secondary-${i}`}
        name={def?.name ?? charSkill?.name ?? ''}
        value={charSkill?.value ?? ''}
        trained={charSkill?.trained ?? false}
      />
    );
  })}
</div>
```

### 4. CSS Rules
```css
.sheet-skills-section {
  overflow: hidden;
}

.sheet-section-header {
  font-family: var(--font-ui, 'Source Serif 4', serif);
  font-size: 7pt;
  text-transform: uppercase;
  font-weight: bold;
  border-bottom: 1px solid currentColor;
  margin: 2px 0 1px 0;
  letter-spacing: 0.05em;
}

.sheet-skill-row {
  display: flex;
  align-items: center;
  gap: 3px;
  border-bottom: 0.5px solid rgba(0,0,0,0.2);
  min-height: 12px;
  padding: 0 1px;
}

.sheet-skill-trained {
  font-size: 8pt;
  width: 10px;
  flex-shrink: 0;
}

.sheet-skill-name {
  flex: 1;
  font-size: 7.5pt;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-skill-value {
  font-size: 8pt;
  font-weight: bold;
  min-width: 20px;
  text-align: right;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
}
```

### 5. No Advancement Checkboxes
The spec explicitly omits advancement checkboxes. Do **not** add checkboxes or squares after skill values.

### 6. Undefined Skill Handling
- If `character.skills[key]` is missing → `value = ''` and `trained = false`.
- Do not crash on missing skill keys.

---

## Verification

- With system loaded: 20 general skills are listed in system canonical order.
- With system loaded: 10 weapon skills are listed.
- Trained skills show ◆; untrained show ◇.
- With partial skills data: missing skills show blank value, ◇ trained indicator.
- No advancement checkboxes are visible.
- Secondary skills section shows 6 slots (some blank if fewer than 6 custom skills).

---

## Acceptance Criteria

- [ ] `7.1` All 20 general skills are listed in canonical system order
- [ ] `7.2` All 10 weapon skills are listed
- [ ] `7.3` Trained indicator is filled (◆) for trained skills, empty (◇) for untrained
- [ ] `7.4` Skill values display correctly (numeric)
- [ ] `7.5` Secondary skills section shows up to 6 slots; existing skills populate, remainder are blank lines
- [ ] `7.6` No advancement checkboxes are present
