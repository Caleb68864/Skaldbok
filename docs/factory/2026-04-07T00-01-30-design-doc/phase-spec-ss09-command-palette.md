# Phase Spec — SS-09 · Command Palette

**Run:** `2026-04-07T00-01-30-design-doc`
**Sub-spec:** SS-09
**Phase:** 3 — Discovery
**Priority:** 6/10

---

## Dependency Order

> ⚠️ **Depends on SS-04 and SS-08 being completed first.**
> The KB context (SS-04) provides the MiniSearch index via `useKBSearch`. The KB screen routing (SS-08) provides the `/kb/{nodeId}` navigation targets.

---

## Intent

Create a full-screen search overlay accessible from anywhere in the app. Implemented as a component that can be triggered by a prop/callback from the parent. Auto-focused search input, fuzzy search across all `kb_nodes`, tap to navigate.

**FAB placement note:** FAB placement and icon are human-approved decisions. Implement the `CommandPalette` component and `useCommandPalette` hook only. Leave the FAB integration (where in the shell to place the trigger button) as a secondary step — document the expected usage at the bottom of this spec.

---

## Files to Create

| File | Exports |
|---|---|
| `src/features/kb/CommandPalette.tsx` | `CommandPalette` — full-screen overlay component |
| `src/features/kb/useCommandPalette.ts` | `useCommandPalette()` — `{ isOpen, open, close }` state hook |

## Files to Modify

*(none — FAB integration is a separate human decision)*

---

## Implementation Steps

### Step 1 — Create `src/features/kb/useCommandPalette.ts`

```typescript
import { useState, useCallback } from 'react';

export interface UseCommandPaletteReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export function useCommandPalette(): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return { isOpen, open, close };
}
```

### Step 2 — Create `src/features/kb/CommandPalette.tsx`

```typescript
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useKBSearch } from './useKBSearch';
import type { KBNode } from '../../storage/db/client';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
}

export function CommandPalette({ isOpen, onClose, campaignId }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const results = useKBSearch(query, campaignId);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery(''); // reset query on open
    }
  }, [isOpen]);

  // Swipe-down dismissal
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 80) onClose(); // swipe down > 80px = dismiss
  };

  if (!isOpen) return null;

  const handleResultTap = (node: KBNode) => {
    navigate(`/kb/${node.id}`);
    onClose();
  };

  // Quick actions for empty/initial state
  const quickActions = [
    { label: 'New note', action: () => { navigate('/note/new'); onClose(); } },
    { label: 'Graph view', action: () => { navigate('/kb?view=graph'); onClose(); } },
    { label: 'Export all', action: () => { /* trigger export */ onClose(); } },
  ];

  const content = (
    <div
      className="/* full screen overlay with z-index above shell */"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Backdrop — tap to dismiss */}
      <div
        className="/* semi-transparent backdrop */"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette panel */}
      <div className="/* panel — white, rounded top, slides up */">
        {/* Search input */}
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search notes, characters, locations..."
          className="/* full-width search input */"
        />

        {/* Results or quick actions */}
        {query.trim() === '' ? (
          <div>
            <p className="/* section label */">Quick actions</p>
            {quickActions.map(action => (
              <button key={action.label} onClick={action.action}>
                {action.label}
              </button>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div>No results for "{query}"</div>
        ) : (
          <ul>
            {results.map(node => (
              <li key={node.id}>
                <button onClick={() => handleResultTap(node)}>
                  <span>{node.label}</span>
                  <span className="/* type badge */">{node.type}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  // Render via React portal to avoid z-index conflicts with ShellLayout
  return createPortal(content, document.body);
}
```

#### Search Timing

`useKBSearch` is already debounced (or should be). Results must appear within 100ms of typing. Since MiniSearch is in-memory, this should be near-instant after index build. No additional debounce is needed at the palette level.

#### Styling

Use Tailwind utility classes. Key visual requirements:
- Full-screen overlay with a semi-transparent backdrop.
- Palette panel slides up from the bottom or covers from the top (mobile-first).
- High z-index to appear above ShellLayout, bottom nav, etc.
- Match the project's existing visual style (dark/light mode as applicable).

---

## Acceptance Criteria

1. `npm run build` succeeds with zero TypeScript errors.
2. When `isOpen={true}`, the palette renders as a full-screen overlay with auto-focused search input.
3. Typing in the search input shows matching `kb_nodes` (title + type badge) within 100ms.
4. Search handles typos and partial matches (fuzzy via MiniSearch).
5. Tapping a result navigates to `/kb/{nodeId}` and calls `onClose`.
6. Tapping the overlay background calls `onClose`.
7. Swipe-down gesture on mobile dismisses the palette (calls `onClose`).
8. Supported quick actions displayed in empty/initial state: "New note" (→ `/note/new`), "Graph view" (→ `/kb?view=graph`), "Export all".
9. The palette is rendered via a React portal to avoid z-index conflicts with ShellLayout.
10. `useCommandPalette` hook correctly initializes `isOpen: false` and toggles via `open()` / `close()`.

---

## Expected Usage (for human FAB integration)

Once the component is complete, the human can wire it up anywhere in the shell:

```typescript
// In ShellLayout or KnowledgeBaseScreen or any parent:
import { CommandPalette } from '../features/kb/CommandPalette';
import { useCommandPalette } from '../features/kb/useCommandPalette';

const { isOpen, open, close } = useCommandPalette();

return (
  <>
    {/* existing shell content */}
    <FAB icon={<SearchIcon />} onClick={open} />
    <CommandPalette isOpen={isOpen} onClose={close} campaignId={campaignId} />
  </>
);
```

---

## Verification Commands

```bash
# TypeScript build check
npm run build

# (Manual) Wire up CommandPalette to a test button in any screen:
# const { isOpen, open, close } = useCommandPalette();
# <button onClick={open}>Open Palette</button>
# <CommandPalette isOpen={isOpen} onClose={close} campaignId={campaignId} />
#
# Tests:
# 1. Click button — confirm overlay opens with auto-focused input
# 2. Type "bjorn" — confirm fuzzy results appear within 100ms
# 3. Tap a result — confirm navigation to /kb/{nodeId}
# 4. Tap backdrop — confirm overlay closes
# 5. Swipe down on mobile — confirm overlay closes
# 6. Empty input — confirm quick actions (New note, Graph view, Export all) show
# 7. Inspect DOM — confirm portal renders at document.body level
```

---

## Constraints / Notes

- The palette is rendered via `createPortal(content, document.body)` to avoid z-index issues.
- No new npm dependencies. MiniSearch (added in SS-04) is the only search library.
- The `useKBSearch` hook (SS-04) must be called inside a component that has access to the MiniSearch index. If `CommandPalette` is rendered outside `<KnowledgeBaseProvider>`, `useKBSearch` may need to be called independently (not via context). Verify this works given where the palette is rendered.
- Swipe detection uses a simple `touchstart`/`touchend` delta — 80px threshold is a reasonable default.
- Correctness over speed. No shell commands. Cross-platform.
