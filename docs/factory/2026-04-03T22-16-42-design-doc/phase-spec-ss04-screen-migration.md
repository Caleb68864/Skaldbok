# Phase Spec — SS-04: Phase 4 Screen Migration

**Run:** 2026-04-03T22-16-42-design-doc
**Sub-Spec:** SS-04
**Score:** 80 | Priority: Must | Risk: Low
**Dependency:** ⚠️ DEPENDS ON SS-01 (Foundation), SS-02 (Primitives), AND SS-03 (Shell) — do not begin until all three prior phase gates pass.

---

## Intent

Migrate all 12 screens from inline `style={{}}` props to Tailwind classes using the primitives and shell components established in Phases 1-3. This is primarily a mechanical substitution — no structural changes to routes, data models, or repositories.

---

## Migration Order (Strict)

| Order | Screen File | Rationale |
|-------|-------------|-----------|
| 1 | `SheetScreen` | Validates primitive components in real usage first |
| 2 | `SkillsScreen` | Builds on SheetScreen patterns |
| 3 | `GearScreen` | — |
| 4 | `MagicScreen` | — |
| 5 | `SessionScreen` | — |
| 6 | `ReferenceScreen` | — |
| 7 | `SettingsScreen` | — |
| 8 | `ProfileScreen` | — |
| 9 | `LibraryScreen` | — |
| 10 | `NoteEditor` | — |
| 11+ | Any remaining screens | Complete the full set |

> **SheetScreen MUST be committed and verified before SkillsScreen begins.** See criterion 4.6.

---

## File Paths to Modify

All files under `src/screens/`. Representative paths:
- `src/screens/SheetScreen.tsx`
- `src/screens/SkillsScreen.tsx`
- `src/screens/GearScreen.tsx`
- `src/screens/MagicScreen.tsx`
- `src/screens/SessionScreen.tsx`
- `src/screens/ReferenceScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/screens/ProfileScreen.tsx`
- `src/screens/LibraryScreen.tsx`
- `src/screens/NoteEditor.tsx`
- Any additional screen files found under `src/screens/`

Also `src/components/panels/` — screen-specific panel components migrate alongside their parent screens.

**DO NOT MODIFY:**
- `src/db/` — any Dexie schema files
- `src/repositories/` — any repository files
- `src/App.tsx` route structure (read-only)
- `src/theme/theme.css`
- `src/styles/fonts.css`
- `src/components/primitives/GameIcon.tsx`

---

## Per-Screen Migration Protocol

For EACH screen, execute these steps in order:

1. **Replace all `style={{...}}` props** with equivalent Tailwind utility classes.
2. **Replace any hand-rolled Modal/Drawer/Toast** with shadcn Dialog/Sheet/Toast from `src/components/ui/`.
3. **Grep check**: `grep -n "style={{" <screen-file>` — must return 0 matches before committing.
4. **Visual review**: check the screen in dark, parchment, and light themes. No visual regressions.
5. **Build check**: `tsc -b && vite build` — both must exit 0.
6. **Commit** the screen with a descriptive message before moving to the next screen.

---

## Implementation Steps

### General Pattern

For each `style={{ property: value }}` occurrence:

| Inline style | Tailwind equivalent |
|--------------|---------------------|
| `style={{ display: 'flex' }}` | `className="flex"` |
| `style={{ flexDirection: 'column' }}` | `className="flex-col"` |
| `style={{ gap: '8px' }}` | `className="gap-2"` |
| `style={{ padding: '16px' }}` | `className="p-4"` |
| `style={{ margin: '8px 0' }}` | `className="my-2"` |
| `style={{ color: 'var(--color-accent)' }}` | `className="text-accent"` |
| `style={{ background: 'var(--color-surface)' }}` | `className="bg-surface"` |
| `style={{ borderRadius: '12px' }}` | `className="rounded-xl"` |
| `style={{ fontWeight: 'bold' }}` | `className="font-bold"` |
| `style={{ fontSize: '14px' }}` | `className="text-sm"` |
| Conditional inline color | Use `cn()` with conditional classes |

### Dynamic / Conditional Styles

For conditionally applied styles (e.g., `style={{ color: isActive ? '#c4973b' : '#888' }}`):
- Convert to conditional Tailwind classes: `cn(isActive ? 'text-accent' : 'text-muted')`
- Use `cn()` from `src/lib/utils.ts`

### Existing Component Replacement

- Any screen using a hand-rolled `<Modal>` or `<Drawer>` → replace with `<Dialog>` or `<Sheet>` from `src/components/ui/`
- Any screen using an inline `<Toast>` trigger → use `showToast()` API
- Any screen using a hand-rolled card layout → replace with `<Card>` from `src/components/ui/card.tsx`

---

## Acceptance Criteria

| ID | Criterion | Verification Command / Method |
|----|-----------|-------------------------------|
| 4.1 | Zero `style={{` occurrences across all 12 migrated screens | `grep -rn "style={{" src/screens/` returns 0 matches |
| 4.2 | All three themes render without visual glitches on each screen | Manual review OR screenshot comparison in dark/parchment/light |
| 4.3 | All existing features functional after migration | Smoke test: create character, add skill, record session, view reference — all work |
| 4.4 | No route structure changes | `grep -rn "Route\|path=" src/App.tsx` shows same routes as before migration |
| 4.5 | No Dexie schema or repository changes | `git diff HEAD~N -- src/db/ src/repositories/` shows no changes |
| 4.6 | SheetScreen migrated first and validated before proceeding | SheetScreen commit precedes SkillsScreen commit in git log |
| 4.7 | `tsc -b && vite build` pass after each screen migration | Build logs show success per screen |

---

## Verification Commands

```bash
# Final check: zero inline styles across all screens
grep -rn "style={{" src/screens/

# Also check panels directory
grep -rn "style={{" src/components/panels/

# Confirm no route changes
grep -rn "Route\|path=" src/App.tsx

# Confirm no data layer changes
git diff HEAD -- src/db/ src/repositories/

# TypeScript + build
tsc -b
vite build
```

---

## Notes

- Do NOT change component prop APIs during this migration — prop signature changes require human approval.
- Do NOT add new routes or remove existing routes.
- Do NOT touch any Dexie schema, migration, or repository file.
- If a screen has logic that is tightly coupled to an inline style (e.g., a calculated pixel width based on runtime data), leave a `// TODO: refactor dynamic style` comment and use an inline style only as a last resort for that specific property — but zero inline styles is the target.
