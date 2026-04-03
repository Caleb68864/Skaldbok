# Spec: Temporary Stat Modifiers

**Run:** 2026-04-03T21-00-59-design-doc
**Phase:** forge
**Source Design Doc:** `docs/plans/2026-04-03-temp-stat-modifiers-design.md`
**Cynefin:** Complicated
**Score:** 94 / 100

---

## Intent Hierarchy

```
STRATEGIC INTENT
└── Players can track temporary stat changes during play without manually editing base values
    └── OPERATIONAL INTENT
        ├── Modifiers are overlaid on CharacterRecord — base values never mutate
        ├── A chip-based UI makes active effects visible and removable in one tap
        ├── The rest system automatically surfaces expiring modifiers
        └── Spell casting auto-creates modifiers when effect templates are defined
            └── TACTICAL INTENT
                ├── SS-1: TempModifier type + CharacterRecord schema extension
                ├── SS-2: getEffectiveValue() utility
                ├── SS-3: BuffChipBar component
                ├── SS-4: AddModifierDrawer component
                ├── SS-5: SheetScreen integration (stat display + chip bar)
                ├── SS-6: Rest expiry integration
                └── SS-7: Spell quick-apply
```

---

## Scoring Rubric

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Completeness | 25% | 96 | All 10 ACs mapped; open questions annotated with agent authority |
| Implementability | 25% | 95 | Exact file paths, existing primitives identified, no new deps needed |
| Correctness | 20% | 93 | Data model clean; override precedence fully specified |
| Risk Coverage | 15% | 90 | War-game results and escalation triggers defined |
| Testability | 15% | 92 | Each AC has a verifiable check; tsc gate specified |

**Composite: 94 / 100**

---

## Sub-Spec Index

| ID | Name | Priority | Complexity | AC Coverage |
|----|------|----------|------------|-------------|
| SS-1 | TempModifier type + schema | P0 | Low | AC-9 |
| SS-2 | getEffectiveValue() utility | P0 | Medium | AC-4, AC-5, AC-8 |
| SS-3 | BuffChipBar component | P1 | Medium | AC-2, AC-3, AC-10 |
| SS-4 | AddModifierDrawer component | P1 | Medium | AC-1 |
| SS-5 | SheetScreen integration | P1 | Medium | AC-1, AC-2, AC-4, AC-5 |
| SS-6 | Rest expiry integration | P2 | Medium | AC-6, AC-8 |
| SS-7 | Spell quick-apply | P2 | Low | AC-7 |

---

## SS-1 — TempModifier Type + CharacterRecord Schema Extension

**File:** `src/types/character.ts`
**Priority:** P0 — all other sub-specs depend on this
**Effort:** ~30 min

### Intent
Extend the `CharacterRecord` type with a `tempModifiers` field that stores active temporary stat modifications as an overlay array. The base attribute values (`attributes`, `resources`, armor, skills) are **never mutated** by this system.

### Types to Add

```typescript
/** Flat stat key namespace resolved by getEffectiveValue() */
export type StatKey =
  | 'str' | 'con' | 'agl' | 'int' | 'wil' | 'cha'   // attributes
  | 'armor' | 'helmet'                                  // armor ratings
  | 'movement' | 'hpMax' | 'wpMax'                     // derived
  | string;                                              // skill IDs (e.g. "swords")

export interface TempModifierEffect {
  stat: StatKey;
  delta: number;   // positive = buff, negative = debuff
}

export interface TempModifier {
  id: string;                   // nanoid or crypto.randomUUID()
  label: string;                // e.g. "Power Fist", "Stone Skin"
  effects: TempModifierEffect[];
  duration: 'round' | 'stretch' | 'shift' | 'scene' | 'permanent';
  sourceSpellId?: string;       // populated when created via spell quick-apply
  createdAt: string;            // ISO 8601 via nowISO()
}

/** Added to Spell type */
export interface SpellEffect {
  stat: StatKey;
  delta: number;
  duration: TempModifier['duration'];
}
```

### CharacterRecord Change

Add to `CharacterRecord`:
```typescript
tempModifiers?: TempModifier[];   // undefined on old records → treated as []
```

Add to `Spell` (already in `CharacterRecord`):
```typescript
effects?: SpellEffect[];   // optional — spells without this work unchanged
```

### Acceptance Criteria

- [ ] `TempModifier`, `TempModifierEffect`, `StatKey`, `SpellEffect` are exported from `src/types/character.ts`
- [ ] `CharacterRecord.tempModifiers` is typed as `TempModifier[] | undefined`
- [ ] `Spell.effects` is typed as `SpellEffect[] | undefined`
- [ ] `tsc --noEmit` passes with zero errors after this change
- [ ] Existing characters without `tempModifiers` are handled via `?? []` at all read sites (no migration needed)

### Constraints
- Do NOT use Zod here — `character.ts` uses plain TypeScript interfaces, not Zod schemas
- Do NOT change `attributes`, `resources`, or any existing field types

---

## SS-2 — getEffectiveValue() Utility

**File:** `src/utils/derivedValues.ts`
**Priority:** P0 — required before any display integration
**Effort:** ~45 min

### Intent
Provide a pure function that resolves a stat's effective value for a character by summing base value + all active modifier deltas for that stat. Returns structured result (base, modifiers list, effective) so callers can display breakdown.

### Function Signature

```typescript
export interface EffectiveValueResult {
  base: number;
  modifiers: Array<{ label: string; delta: number }>;
  effective: number;
  isModified: boolean;   // convenience — true if modifiers.length > 0
}

export function getEffectiveValue(
  stat: StatKey,
  character: CharacterRecord
): EffectiveValueResult
```

### Stat Key Resolver Map

| Key | Extraction path |
|-----|----------------|
| `'str'` `'con'` `'agl'` `'int'` `'wil'` `'cha'` | `character.attributes[key] ?? 0` |
| `'armor'` | `character.armor?.rating ?? 0` |
| `'helmet'` | `character.helmet?.rating ?? 0` |
| `'movement'` | `getDerivedValue('movement', character).effective` |
| `'hpMax'` | `getDerivedValue('hpMax', character).effective` |
| `'wpMax'` | `getDerivedValue('wpMax', character).effective` |
| skill ID (e.g. `'swords'`) | `character.skills?.[key]?.value ?? 0` |
| unrecognized | `0` + `console.warn('getEffectiveValue: unknown stat key', key)` |

### Override Precedence Rule

For derived stats (`movement`, `hpMax`, `wpMax`), the resolver already calls `getDerivedValue()` which applies `DerivedOverrides`. This means:

- **Override present:** `base = override value` (override already baked in via `getDerivedValue`)
- **No override:** `base = computed value`
- **Modifier stacking:** `effective = base + sum(deltas)` in all cases

This is consistent with the design: overrides = permanent user intent, temp modifiers = temporary overlay on top.

### Logic

```typescript
export function getEffectiveValue(stat: StatKey, character: CharacterRecord): EffectiveValueResult {
  const base = resolveBase(stat, character);           // resolver map above
  const active = character.tempModifiers ?? [];
  const modifiers = active
    .flatMap(m => m.effects.filter(e => e.stat === stat).map(e => ({ label: m.label, delta: e.delta })));
  const sum = modifiers.reduce((acc, m) => acc + m.delta, 0);
  return {
    base,
    modifiers,
    effective: base + sum,
    isModified: modifiers.length > 0,
  };
}
```

### Acceptance Criteria

- [ ] Returns `{ base, modifiers, effective, isModified }` for all stat keys in the resolver map
- [ ] Handles `character.tempModifiers === undefined` gracefully (defaults to `[]`)
- [ ] Multiple modifiers on the same stat are summed (no cap)
- [ ] For `movement`, `hpMax`, `wpMax`: uses `getDerivedValue()` to get base (respects override precedence)
- [ ] Unrecognized stat key: returns `base: 0`, logs warning, does not throw
- [ ] Function is pure — no side effects, no mutations
- [ ] `tsc --noEmit` passes after this change

### Escalation Triggers
- If `getDerivedValue()` signature needs to change, escalate — don't modify it
- If a stat key not in the resolver map is needed during implementation, escalate

---

## SS-3 — BuffChipBar Component

**File:** `src/components/panels/BuffChipBar.tsx` (new file)
**Priority:** P1
**Effort:** ~60 min

### Intent
Render active `tempModifiers` as compact colored chips below the conditions row on SheetScreen. Each chip is tappable to reveal details and a Remove button. A trailing "+" chip opens AddModifierDrawer. A "Clear All" control removes all active modifiers at once.

### Props

```typescript
interface BuffChipBarProps {
  modifiers: TempModifier[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onAdd: () => void;   // opens AddModifierDrawer
}
```

### Chip Display

Each chip (use existing `Chip` primitive from `src/components/primitives/Chip.tsx`):
- **Label:** `modifier.label`
- **Delta summary:** sum of all `effects[].delta` formatted as `+2` / `-1` (show sign always)
- **Duration badge:** abbreviated — `RND` / `STR` / `SHI` / `SCN` / `∞`
- **Color:** agent may choose a color variant that distinguishes buffs (positive delta sum) from debuffs (negative delta sum). Check existing `Chip` variant props.

### Expanded State

Tapping a chip toggles an expanded card beneath it (or inline expansion) showing:
- Full effects list: `"STR +2, CON -1"` style
- Duration: full label
- "Remove" button (48px touch target minimum)

### "+" Chip

Always the last item in the row. Calls `onAdd`.

### "Clear All"

Rendered as a small text button or icon button to the right of the chip row. Only visible when `modifiers.length > 0`. Calls `onClearAll`.

Agent may choose exact placement (e.g., trailing in the row, or in a section header action slot).

### Acceptance Criteria

- [ ] Renders one chip per active modifier with label, delta summary, and duration badge
- [ ] Tapping a chip shows expanded view with full effects and Remove button
- [ ] Remove button calls `onRemove(modifier.id)`
- [ ] "+" chip calls `onAdd`
- [ ] "Clear All" calls `onClearAll` and is only visible when modifiers exist
- [ ] All interactive elements have ≥ 48px touch target
- [ ] Uses CSS design token variables (`--color-*`, `--space-*`, `--radius-*`)
- [ ] Renders empty state gracefully (just "+" chip, no Clear All) when `modifiers.length === 0`
- [ ] `tsc --noEmit` passes

---

## SS-4 — AddModifierDrawer Component

**File:** `src/components/panels/AddModifierDrawer.tsx` (new file)
**Priority:** P1
**Effort:** ~60 min

### Intent
Manual entry form for creating ad-hoc temp modifiers. Supports multi-stat effects ("Add another effect" button). Uses existing `Drawer` primitive.

### Props

```typescript
interface AddModifierDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: (modifier: Omit<TempModifier, 'id' | 'createdAt'>) => void;
}
```

### Form Fields

| Field | Control | Notes |
|-------|---------|-------|
| Label | Text input | Required. Placeholder: "e.g. Power Fist, Stone Skin" |
| Duration | Select / segmented control | Options: Round / Stretch / Shift / Scene / Permanent |
| Effects | Repeating row: stat picker + delta input | Min 1 row. "Add another effect" adds row |
| Stat picker | `<select>` with curated options | See curated stat list below |
| Delta | Number input | Signed integer. Show +/- toggle or allow negative |

### Curated Stat Dropdown Options

```
Attributes: STR (str), CON (con), AGL (agl), INT (int), WIL (wil), CHA (cha)
Armor: Armor Rating (armor), Helmet Rating (helmet)
Derived: Movement (movement), Max HP (hpMax), Max WP (wpMax)
Skills: [dynamically populated from character.skills keys, if available via prop or context]
```

If character skills cannot be injected, show a text fallback: "Skill ID (type manually)" with a free-text input. Agent decides which is simpler.

### Validation

- Label: non-empty string required
- Each effect: stat selected + delta is non-zero integer
- At least one effect required
- "Save" button disabled when validation fails

### Save Behavior

Calls `onSave({ label, effects, duration })`. Caller creates `TempModifier` with `id` and `createdAt`. Drawer closes on save.

### Acceptance Criteria

- [ ] Drawer opens/closes correctly with `open` prop
- [ ] Label input, duration picker, and at least one effect row are present
- [ ] "Add another effect" appends a new stat+delta row
- [ ] Stat picker shows curated stat list (attributes, armor, derived)
- [ ] Save button is disabled when label is empty or no valid effects
- [ ] `onSave` is called with correct `Omit<TempModifier, 'id' | 'createdAt'>` shape
- [ ] All inputs meet 48px touch target requirement
- [ ] Uses existing `Drawer` primitive from `src/components/primitives/Drawer.tsx`
- [ ] `tsc --noEmit` passes

---

## SS-5 — SheetScreen Integration

**File:** `src/screens/SheetScreen.tsx`
**Priority:** P1 — gates user-visible AC verification
**Effort:** ~90 min

### Intent
Wire `BuffChipBar` into SheetScreen below the conditions row, connect add/remove/clear-all actions to `updateCharacter()`, and update attribute/derived value display fields to show effective values with a visual modifier indicator when active.

### Modifier CRUD Handlers (in SheetScreen)

```typescript
// Add modifier
const handleAddModifier = (partial: Omit<TempModifier, 'id' | 'createdAt'>) => {
  const newMod: TempModifier = {
    ...partial,
    id: crypto.randomUUID(),   // or nanoid() — check what project uses elsewhere
    createdAt: nowISO(),
  };
  updateCharacter({ tempModifiers: [...(character.tempModifiers ?? []), newMod] });
};

// Remove one modifier
const handleRemoveModifier = (id: string) => {
  updateCharacter({ tempModifiers: (character.tempModifiers ?? []).filter(m => m.id !== id) });
};

// Clear all modifiers
const handleClearAllModifiers = () => {
  updateCharacter({ tempModifiers: [] });
};
```

### Attribute Display Integration

For each displayed attribute (`str`, `con`, `agl`, `int`, `wil`, `cha`):

1. Call `getEffectiveValue(statKey, character)` in SheetScreen render
2. Pass `effective` value to the display component as the shown value
3. If `isModified`, pass an optional `modifierDelta` prop (sum of deltas) to `AttributeField` for visual indicator

`AttributeField` gets one new **optional** prop: `modifierDelta?: number`

When `modifierDelta` is defined and non-zero:
- Show effective value (not base)
- Render a small badge or color indicator (agent chooses style — color shift, arrow, badge)
- Must be visually distinct from base-only display

> **Agent Recommends, Human Approves:** Changes to `AttributeField` props. If the existing `AttributeField` is complex or shared, consider wrapping rather than modifying.

### Derived Value Display Integration

For `movement`, `hpMax`, `wpMax` (wherever displayed on SheetScreen):
- Same pattern: `getEffectiveValue()` → pass effective value + optional indicator
- Override precedence is already handled inside `getEffectiveValue()` (delegates to `getDerivedValue()`)

### BuffChipBar Placement

Render `<BuffChipBar>` immediately below the conditions display row on SheetScreen. Agent may also add it to SkillsScreen and GearScreen — this is an agent-authority decision.

### State

Add to SheetScreen local state:
```typescript
const [addModifierOpen, setAddModifierOpen] = useState(false);
```

### Acceptance Criteria

- [ ] `BuffChipBar` renders below conditions row on SheetScreen
- [ ] Tapping "+" opens `AddModifierDrawer`; saving calls `handleAddModifier` and updates character
- [ ] Chip Remove calls `handleRemoveModifier`; Clear All calls `handleClearAllModifiers`
- [ ] Attribute fields show effective value (base + modifier sum) when modifiers are active
- [ ] Attribute fields show a visual indicator (modifierDelta badge/color) when modified
- [ ] Attribute fields revert to base value display when all modifiers are removed
- [ ] Derived fields (`movement`, `hpMax`, `wpMax`) also respect modifier stacking
- [ ] `updateCharacter()` is used for all mutations (no direct state manipulation)
- [ ] Autosave persists `tempModifiers` (verify via browser devtools IndexedDB)
- [ ] `tsc --noEmit` passes

---

## SS-6 — Rest Expiry Integration

**Files:** `src/screens/SheetScreen.tsx`, `src/utils/restActions.ts`
**Priority:** P2
**Effort:** ~60 min

### Intent
Before applying a Round/Stretch/Shift Rest, check for modifiers with matching duration. If found, show a confirmation dialog listing expiring effects with two choices: "Remove & Rest" (clears them, applies rest) or "Keep & Rest" (skips removal, applies rest). Both paths log to session log.

### Duration Matching

| Rest Type | Matching modifier durations |
|-----------|---------------------------|
| Round Rest | `'round'` |
| Stretch Rest | `'stretch'` |
| Shift Rest | `'shift'` |

> `'scene'` and `'permanent'` are never auto-expired by rests.

### Flow (in SheetScreen)

The existing rest flow uses modal state booleans (`roundRestOpen`, `stretchRestOpen`, `shiftRestOpen`). Add an intermediate "expiry check" step:

1. User taps rest button → check for matching modifiers
2. **If none:** proceed with existing rest flow unchanged
3. **If matches found:** open rest expiry modal first
4. Modal lists expiring modifier labels and their effects
5. "Remove & Rest" → filter out matching modifiers → apply rest → log both
6. "Keep & Rest" → apply rest → log rest (no modifier removal)

### Rest Expiry Modal State

```typescript
const [expiryCheck, setExpiryCheck] = useState<{
  restType: 'round' | 'stretch' | 'shift';
  expiring: TempModifier[];
} | null>(null);
```

### Session Log Entries (Agent Decides Format)

Agent chooses wording. Suggested patterns:
- Modifier removed via rest: `"[modifier.label] expired (${restType} rest)"`
- Log via `useSessionLog().logRest()` or a new `logModifierExpiry()` if needed

If `logRest` doesn't support modifier details, agent may extend `useSessionLog` with a `logModifierExpiry(characterName, modifierLabel, restType)` function — this is within agent authority.

### Acceptance Criteria

- [ ] Round Rest: prompts modifier expiry dialog if any `duration === 'round'` modifiers are active
- [ ] Stretch Rest: prompts for `duration === 'stretch'` modifiers
- [ ] Shift Rest: prompts for `duration === 'shift'` modifiers
- [ ] "Remove & Rest" removes matched modifiers from `tempModifiers` and applies rest normally
- [ ] "Keep & Rest" skips removal and applies rest normally
- [ ] Existing rest flow is unchanged when no matching modifiers exist (no dialog interruption)
- [ ] `'scene'` and `'permanent'` modifiers are never auto-prompted for removal by rests
- [ ] Removed modifiers are logged to session log
- [ ] Uses existing `Modal` primitive from `src/components/primitives/Modal.tsx`
- [ ] `tsc --noEmit` passes

---

## SS-7 — Spell Quick-Apply

**Files:** `src/screens/SheetScreen.tsx` (or wherever cast action lives)
**Priority:** P2
**Effort:** ~30 min

### Intent
When a spell with `effects?: SpellEffect[]` defined is cast, automatically create one or more `TempModifier` entries. Spells without `effects` work exactly as today.

### Grouping Rule

If a spell's `effects` array contains items with different `duration` values, group into separate `TempModifier` entries (one per distinct duration). If all effects share the same duration, create one `TempModifier`.

### Cast Handler Extension

```typescript
// After existing spell cast logic:
if (spell.effects && spell.effects.length > 0) {
  const byDuration = groupBy(spell.effects, e => e.duration);
  const newModifiers: TempModifier[] = Object.entries(byDuration).map(([dur, effs]) => ({
    id: crypto.randomUUID(),
    label: spell.name,
    effects: effs.map(e => ({ stat: e.stat, delta: e.delta })),
    duration: dur as TempModifier['duration'],
    sourceSpellId: spell.id,
    createdAt: nowISO(),
  }));
  updateCharacter({
    tempModifiers: [...(character.tempModifiers ?? []), ...newModifiers],
  });
}
```

(`groupBy` — use a simple inline implementation or check if lodash/similar is already a project dep. Do NOT add new npm deps.)

### Acceptance Criteria

- [ ] Casting a spell with `effects` defined creates corresponding `TempModifier(s)` in `character.tempModifiers`
- [ ] `sourceSpellId` is populated with the spell's `id`
- [ ] `label` defaults to `spell.name`
- [ ] Effects with different durations are grouped into separate `TempModifier` entries
- [ ] Casting a spell without `effects` creates no modifier (existing behavior unchanged)
- [ ] New modifiers appear in `BuffChipBar` immediately after cast
- [ ] `tsc --noEmit` passes

---

## Full Acceptance Criteria Map

| AC # | Statement | Sub-Spec | Verifiable Check |
|------|-----------|----------|-----------------|
| AC-1 | User can add a manual temp modifier via AddModifierDrawer (label, stat picker, delta, duration) | SS-4, SS-5 | Open drawer, fill form, save — chip appears in BuffChipBar |
| AC-2 | Active modifiers display as colored chips below the conditions row on SheetScreen | SS-3, SS-5 | Add modifier → chip row visible below conditions |
| AC-3 | Tapping a chip expands it to show full effect details and a "Remove" button | SS-3 | Tap chip → expanded view with effects list and Remove |
| AC-4 | Attribute fields on SheetScreen show effective value (base + modifiers) with a visual indicator | SS-2, SS-5 | Add STR+2 modifier → STR field shows base+2 with indicator |
| AC-5 | Derived value fields show effective value respecting override precedence + modifier stacking | SS-2, SS-5 | Set movement override → add movement modifier → shows override+delta |
| AC-6 | Round/Stretch/Shift Rest prompts list expiring modifiers with "Remove & Rest" / "Keep & Rest" | SS-6 | Add Round modifier → trigger Round Rest → modal appears |
| AC-7 | Casting a spell with `effects` defined auto-creates the corresponding TempModifier(s) | SS-7 | Cast a spell with effects → chip appears without manual entry |
| AC-8 | Removing a modifier (manual or rest expiry) reverts stat display to base/override value | SS-2, SS-3, SS-6 | Remove modifier → stat field returns to base display |
| AC-9 | Export/import includes active modifiers in character JSON | SS-1 | Export character → JSON contains `tempModifiers` array |
| AC-10 | "Clear All" action on BuffChipBar removes all active modifiers | SS-3, SS-5 | Add 3 modifiers → Clear All → chip bar empty |

---

## Cross-Cutting Constraints

| Constraint | Enforcement |
|-----------|-------------|
| MUST NOT mutate base attribute values | `getEffectiveValue()` is read-only; all mutations go through `updateCharacter()` on the overlay array |
| MUST NOT break DerivedOverrides behavior | `getEffectiveValue()` delegates to `getDerivedValue()` for derived stats — overrides already handled |
| MUST NOT require migration | All read sites use `character.tempModifiers ?? []` |
| MUST preserve existing rest flow | Rest expiry dialog is additive — only appears when matching modifiers exist |
| MUST work on mobile | 48px touch targets; drawer-based forms; chip interactions tested on small viewport |
| No shell commands | All code written inline; no build scripts required |
| Cross-platform | No OS-specific APIs; uses `crypto.randomUUID()` (available in modern browsers) |

---

## Implementation Order

```
SS-1 (types)  ──▶  SS-2 (utility)  ──▶  SS-3 (BuffChipBar)  ──┐
                                    ──▶  SS-4 (AddModifierDrawer) ──┤──▶  SS-5 (SheetScreen)  ──▶  SS-6 (Rest)
                                                                    │                               SS-7 (Spells)
                                                                    └───────────────────────────────────────────▶
```

P0 → P1 → P2. Each step is independently compilable. Run `tsc --noEmit` after each sub-spec.

---

## Escalation Triggers

Escalate to human **before proceeding** if:
- A change to `AttributeField` or `DerivedFieldDisplay` props would break other screens (check all import sites first)
- A new npm dependency is needed (no new deps should be required)
- A stat key arises during implementation that isn't in the resolver map
- The existing `Chip` primitive lacks the styling flexibility needed for buff chips

---

## Open Questions (Agent Authority)

| Question | Authority | Guidance |
|----------|-----------|---------|
| Buff chip placement on Skills/Gear screens | Agent decides | SheetScreen is the minimum; add to others if it feels natural |
| Visual indicator style for modified stats | Agent decides | Color shift (e.g. `--color-accent`) or small delta badge (e.g. `+2`) — both acceptable |
| Session log format for modifier events | Agent decides | Keep it concise; should be scannable in the session log list |
| Whether to split BuffChipBar into sub-components | Agent decides | One file is fine unless it exceeds ~200 lines |
| Clear All button placement | Agent decides | Section header action or trailing chip row item |

---

## War-Game Mitigations

| Risk | Mitigation |
|------|-----------|
| Stat key resolution ambiguity | Curated dropdown in AddModifierDrawer (no freeform for common stats); resolver logs warning for unknown keys |
| AttributeField prop conflict | Add `modifierDelta?: number` as optional prop — zero impact on existing callers |
| Modifier lost on character switch | `updateCharacter()` persists to IndexedDB; autosave handles it |
| Spell cast handler doesn't exist as one function | Locate cast action in SheetScreen; if scattered, add modifier creation at the same call site as WP deduction |
