---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 17
title: "Fullscreen, Wake Lock, and Device Utilities"
date: 2026-03-22
dependencies: ["2", "7"]
---

# Sub-Spec 17: Fullscreen, Wake Lock, and Device Utilities

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Implement fullscreen toggle using the Fullscreen API with graceful degradation. Implement wake lock toggle using the Screen Wake Lock API with status indicator, graceful degradation, and handling of revocation (e.g., on tab switch). Wire both into the TopBar. Persist wake lock preference in settings.

## Interface Contracts

### Provides
- `src/hooks/useFullscreen.ts`: Exports `useFullscreen()` returning `{ isFullscreen: boolean, toggleFullscreen: () => void, isSupported: boolean }`
- `src/hooks/useWakeLock.ts`: Exports `useWakeLock()` returning `{ isActive: boolean, toggleWakeLock: () => void, isSupported: boolean }`
- `src/components/layout/TopBar.tsx` (modified): Fullscreen and wake lock toggle buttons with status indicators

### Requires
- From sub-spec 2: `IconButton` primitive for toggle buttons
- From sub-spec 7: `useAppState()` for persisting wake lock preference

### Shared State
- `AppSettings.wakeLockEnabled`: persisted preference for wake lock

## Implementation Steps

### Step 1: Create useFullscreen hook
- **File:** `src/hooks/useFullscreen.ts`
- **Action:** create
- **Changes:**
  - Check `document.fullscreenEnabled` for support
  - `isFullscreen`: tracks `document.fullscreenElement !== null`, listens to `fullscreenchange` event
  - `toggleFullscreen()`: calls `document.documentElement.requestFullscreen()` or `document.exitFullscreen()`
  - `isSupported`: `!!document.documentElement.requestFullscreen`
  - Cleanup: remove event listener on unmount

### Step 2: Create useWakeLock hook
- **File:** `src/hooks/useWakeLock.ts`
- **Action:** create
- **Changes:**
  - Check `'wakeLock' in navigator` for support
  - `isActive`: tracks whether a wake lock sentinel is currently held
  - `toggleWakeLock()`: if active, release sentinel; if inactive, request `navigator.wakeLock.request('screen')`
  - Handle revocation: sentinel has a `release` event -- on revocation, update `isActive` to false
  - Re-acquire on `visibilitychange` if preference is enabled and document becomes visible
  - `isSupported`: `'wakeLock' in navigator`
  - On mount, if settings.wakeLockEnabled is true, auto-acquire
  - Cleanup: release sentinel on unmount

### Step 3: Update TopBar with fullscreen and wake lock toggles
- **File:** `src/components/layout/TopBar.tsx`
- **Action:** modify
- **Changes:**
  - Replace placeholder fullscreen button with functional toggle:
    - If supported: show expand/collapse icon, toggles on click
    - If not supported: hide or show disabled with tooltip "Not supported"
  - Replace placeholder wake lock button with functional toggle:
    - If supported: show lock/unlock icon, toggles on click
    - Active state: show "active" indicator (e.g., colored dot or different icon)
    - If not supported: hide or show disabled
    - If revoked: indicator updates to inactive

### Step 4: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 5: Commit
- **Stage:** `git add src/hooks/useFullscreen.ts src/hooks/useWakeLock.ts src/components/layout/TopBar.tsx`
- **Message:** `feat: fullscreen, wake lock, and device utilities`

## Acceptance Criteria

- `[BEHAVIORAL]` The fullscreen toggle enters fullscreen mode in a supporting browser (REQ-036)
- `[BEHAVIORAL]` If the Fullscreen API is unsupported, the toggle is disabled or hidden with no error thrown (REQ-036)
- `[BEHAVIORAL]` The wake lock toggle activates screen wake lock and shows an "active" indicator (REQ-037)
- `[BEHAVIORAL]` If wake lock is revoked (e.g., tab switch), the indicator updates to reflect the loss (REQ-037)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Fullscreen: Click toggle in Chrome, verify enters fullscreen, click again, verify exits
  - Fullscreen unsupported: Test in an iframe or environment without fullscreen -- verify no error
  - Wake lock: Click toggle, verify indicator shows active (test on Android Chrome for real wake lock)
  - Wake lock revocation: Activate wake lock, switch tabs, return -- verify indicator updated

## Patterns to Follow

- Feature detection pattern: check API existence before using it, never assume browser support.
- Hook return pattern: always return `isSupported` boolean so UI can conditionally render.
- Wake lock re-acquisition on visibility change is a standard pattern for the Screen Wake Lock API.
- Use browser APIs directly -- no polyfills needed since we target modern browsers.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/hooks/useFullscreen.ts | Create | Fullscreen API hook with graceful degradation |
| src/hooks/useWakeLock.ts | Create | Wake Lock API hook with status tracking |
| src/components/layout/TopBar.tsx | Modify | Wire fullscreen and wake lock toggles |
