# Phase 4: Styling Refactor, Orientation & Toast System

**Run ID**: `2026-03-22T19-41-57-design-doc`
**Phase**: 4 of 4
**Sub-Specs**: SS-06 (CSS Modules Refactor), SS-07 (Orientation Media Queries), SS-08 (Toast System)
**Priority**: P2
**Combined Score**: 20 / 100

---

## Dependencies

```
SS-06 (CSS Modules) ──→ SS-07 (Orientation Queries depend on CSS modules existing)
SS-08 (Toast System) ── independent (no dependencies)
Phases 1-3 ──→ Phase 4 (all functional changes land first, then styling refactor)
```

**Upstream**: Phases 1-3 should be complete before this phase. The CSS modules refactor (SS-06) touches almost every component file — doing it last avoids merge conflicts with functional changes in Phases 1-3.
**Downstream**: None — this is the final phase.

**Internal ordering**:
1. SS-08 (Toast System) — independent, can start immediately
2. SS-06 (CSS Modules) — large refactor, bulk of the phase
3. SS-07 (Orientation) — depends on SS-06

---

## Rationale

All P2 items are grouped into this final phase because they are quality-of-life improvements rather than functional requirements. SS-06 (CSS Modules) is intentionally last because it touches every component — doing it after all functional changes minimizes conflicts. SS-07 depends on SS-06. SS-08 is independent but low-priority.

---

## Implementation Steps

### Step 4.1: Create Toast Context and Component (SS-08)

**New file**: `src/context/ToastContext.tsx`

```tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info', duration = 3000) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, variant, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}
```

**New file**: `src/components/primitives/Toast.tsx`

```tsx
interface ToastContainerProps {
  toasts: Toast[];
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <div role="alert" aria-live="polite" style={{
      position: 'fixed',
      bottom: 'calc(var(--touch-target-min) + var(--spacing-md) + 56px)', // above BottomNav
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 300, // above Drawer (201)
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          color: '#fff',
          backgroundColor: variantColor(toast.variant),
          boxShadow: 'var(--shadow-md)',
          minWidth: 200,
          textAlign: 'center',
        }}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function variantColor(variant: ToastVariant): string {
  switch (variant) {
    case 'success': return '#2a6e3f';
    case 'error': return '#8b2020';
    case 'warning': return '#b8860b';
    case 'info': return '#2a4a6e';
  }
}
```

### Step 4.2: Wire ToastProvider into App (SS-08)

**File**: `src/app/AppProviders.tsx`

**Action**: Wrap app tree with `<ToastProvider>`:
```tsx
import { ToastProvider } from '../context/ToastContext';

// In provider tree:
<ToastProvider>
  {/* existing providers and children */}
</ToastProvider>
```

### Step 4.3: Migrate One Modal Feedback to Toast (SS-08)

**Action**: Find one existing Modal-based feedback (e.g., character save confirmation) and replace it with `useToast().showToast('Character saved', 'success')`.

Likely candidate: Look for save confirmations in GearScreen, SheetScreen, or wherever `updateCharacter()` calls show a success modal.

### Step 4.4: CSS Modules — Primitives (SS-06)

**Scope**: Refactor all primitive components from inline styles to CSS modules.

**Components** (in `src/components/primitives/`):
- `Button.tsx` → `Button.module.css`
- `Card.tsx` → `Card.module.css`
- `Modal.tsx` → `Modal.module.css`
- `Drawer.tsx` → `Drawer.module.css`
- `SectionPanel.tsx` → `SectionPanel.module.css`
- `Chip.tsx` → `Chip.module.css`
- `CounterControl.tsx` → `CounterControl.module.css`
- `IconButton.tsx` → `IconButton.module.css`
- `Toast.tsx` → `Toast.module.css` (newly created)

**Pattern for each component**:

1. Create `.module.css` file co-located with component
2. Extract all inline `style={{ ... }}` objects into CSS classes
3. Replace CSS variable references: `var(--spacing-md)` stays as-is (works in CSS modules)
4. Import module: `import styles from './Component.module.css';`
5. Apply: `className={styles.container}` instead of `style={{ ... }}`
6. Use `composes` for shared patterns if beneficial

**Example — Drawer.tsx refactor**:

`Drawer.module.css`:
```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-md);
  z-index: 201;
  max-height: 85vh;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.title {
  font-size: var(--font-size-lg);
  font-weight: bold;
  color: var(--color-text);
}

.closeButton {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  min-height: var(--touch-target-min);
  min-width: var(--touch-target-min);
}

.content {
  padding: var(--spacing-md);
}
```

### Step 4.5: CSS Modules — Layout (SS-06)

**Components**:
- `TopBar.tsx` → `TopBar.module.css`
- `BottomNav.tsx` → `BottomNav.module.css`

**Note**: BottomNav already uses BEM-style class names from `theme.css`. These can be migrated to CSS module classes, or kept if they reference global theme styles. Prefer migration for consistency.

### Step 4.6: CSS Modules — Screens (SS-06)

**Components** (in `src/screens/`):
- `SheetScreen.tsx` → `SheetScreen.module.css`
- `SkillsScreen.tsx` → `SkillsScreen.module.css`
- `GearScreen.tsx` → `GearScreen.module.css`
- `MagicScreen.tsx` → `MagicScreen.module.css`
- `CombatScreen.tsx` → `CombatScreen.module.css`
- `ReferenceScreen.tsx` → `ReferenceScreen.module.css`
- `SettingsScreen.tsx` → `SettingsScreen.module.css`
- `LibraryScreen.tsx` → `LibraryScreen.module.css`

### Step 4.7: CSS Modules — Fields (SS-06)

**Components** (in `src/components/fields/`):
- All field components get co-located `.module.css` files
- This includes the new `ReferenceSectionRenderer.tsx` from Phase 3

### Step 4.8: Orientation Media Queries (SS-07)

**Prerequisite**: SS-06 CSS modules must be in place.

**Action**: Add `@media (orientation: landscape)` queries to key screen modules.

**SheetScreen.module.css** example:
```css
.screenLayout {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

@media (orientation: landscape) {
  .screenLayout {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .attributeSection {
    flex: 1;
    min-width: 300px;
  }

  .skillSection {
    flex: 1;
    min-width: 300px;
  }
}
```

**GearScreen.module.css** example:
```css
@media (orientation: landscape) {
  .gearColumns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }
}
```

**BottomNav.module.css**:
```css
@media (orientation: landscape) {
  .bottomNav {
    /* Optionally reduce height or use compact mode */
    padding-bottom: 0;
  }
}
```

**Global considerations**:
- Ensure no horizontal overflow in landscape
- Touch targets remain ≥ 44px (use `--touch-target-min`)
- Test that BottomNav remains usable in both orientations

---

## Acceptance Criteria Checklist

| AC | Description | Verification |
|----|-------------|-------------|
| AC-08.1 | Toast component exists and renders notifications | File exists, renders visually |
| AC-08.2 | `useToast()` hook provides `showToast()` function | Hook exported and functional |
| AC-08.3 | Toasts auto-dismiss after configurable duration | Default 3s, customizable |
| AC-08.4 | Success and error variants styled differently | Green vs red backgrounds |
| AC-08.5 | Toast is accessible (role="alert" or aria-live) | Check rendered HTML |
| AC-08.6 | Toast renders above BottomNav (z-index correct) | z-index: 300 > drawer's 201 |
| AC-08.7 | At least one Modal-based feedback migrated to toast | Find and migrate one instance |
| AC-06.1 | All primitive components use CSS modules | .module.css files co-located, imports present |
| AC-06.2 | Layout components use CSS modules | TopBar.module.css, BottomNav.module.css exist |
| AC-06.3 | Screen components use CSS modules | All screen .module.css files exist |
| AC-06.4 | CSS modules reference same CSS variables from theme.css | var(--*) references preserved |
| AC-06.5 | No visual regression | Components render identically (manual check) |
| AC-06.6 | Vite CSS module support enabled | Default in Vite — no config needed |
| AC-06.7 | Each .module.css co-located with its component | File adjacency check |
| AC-07.1 | At least one `@media (orientation: landscape)` query exists | Grep confirms |
| AC-07.2 | SheetScreen or GearScreen adapts in landscape | Two-column layout in landscape |
| AC-07.3 | BottomNav remains usable in both orientations | Visual check |
| AC-07.4 | No horizontal overflow or content clipping | Visual check both orientations |
| AC-07.5 | Touch targets >= 44px in both orientations | Min-height/width checks |

---

## Verification Commands

```bash
# 1. Toast component exists
ls src/components/primitives/Toast.tsx src/context/ToastContext.tsx
# Expected: Both files exist

# 2. useToast hook exported
grep -n "export.*useToast" src/context/ToastContext.tsx
# Expected: Export found

# 3. Toast accessibility
grep -n "role=\"alert\"\|aria-live" src/components/primitives/Toast.tsx
# Expected: At least one match

# 4. CSS module files exist for primitives
ls src/components/primitives/*.module.css
# Expected: 8+ .module.css files

# 5. CSS module files exist for layout
ls src/components/layout/*.module.css
# Expected: TopBar.module.css, BottomNav.module.css

# 6. CSS module files exist for screens
ls src/screens/*.module.css
# Expected: 8 .module.css files

# 7. CSS modules import pattern
grep -rn "import styles from" src/components/ src/screens/
# Expected: Multiple matches across components

# 8. CSS variables still used
grep -rn "var(--" src/components/primitives/*.module.css
# Expected: Multiple references to theme variables

# 9. Orientation media query exists
grep -rn "@media.*orientation.*landscape" src/
# Expected: At least one match

# 10. No inline styles remain in primitives (approximate check)
grep -c "style={{" src/components/primitives/*.tsx
# Expected: Significantly reduced (ideally 0, but some dynamic styles may remain)

# 11. Toast migrated from modal
grep -rn "showToast" src/screens/
# Expected: At least one usage

# 12. TypeScript check
npx tsc --noEmit

# 13. Build check
npm run build
```

---

## Risk Notes

- **Highest risk phase**: SS-06 touches every component file. This is the most likely phase to introduce visual regressions.
- **Manual verification required**: AC-06.5 (no visual regression) and AC-07.3/07.4 (orientation layout) require manual visual testing in a browser. Automated checks can only verify file existence and structure.
- **Dynamic styles**: Some inline styles are computed dynamically (e.g., color based on encumbrance level). These cannot be fully moved to CSS modules and should remain as inline `style` props or use CSS custom properties set via JavaScript.
- **Incremental approach**: Consider doing the CSS modules refactor component-by-component and verifying each one rather than batch-converting everything at once.
- **Theme compatibility**: All three themes (Dark, Parchment, Light) must continue to work after the refactor. CSS modules that reference `var(--color-*)` will automatically adapt, but hardcoded colors in CSS modules would break theming.
