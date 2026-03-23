# Phase Spec: SS-08 — TopBar Mode Toggle Fix and Bottom Nav Configuration

## Dependencies
- **SS-02** (ProfileScreen) — Profile tab registration as optional bottom nav tab. Can implement the configurable infrastructure first and add Profile tab entry when SS-02 is ready.

## Objective
Fix the TopBar mode toggle positioning to prevent overlap with other buttons. Add configurable bottom nav tab visibility in Settings.

## Requirements Covered
REQ-018, REQ-019, REQ-020, REQ-021

## Files to Modify
- `src/components/layout/TopBar.tsx` — dedicated layout slot for mode toggle
- `src/components/layout/BottomNav.tsx` — configurable tab visibility
- `src/screens/SettingsScreen.tsx` (or equivalent) — "Bottom Navigation" settings section
- `src/context/AppStateContext.tsx` — tab visibility settings in persisted settings
- `src/theme/theme.css` — TopBar layout fixes, narrow screen responsive styles

## Acceptance Criteria
1. `[STRUCTURAL]` The mode toggle button occupies a dedicated slot in the TopBar layout, not inside the actions button group.
2. `[BEHAVIORAL]` The mode toggle does not overlap fullscreen, wake-lock, or hamburger buttons at any viewport width >= 320px.
3. `[STRUCTURAL]` On narrow screens (<360px), the mode toggle collapses to icon-only (no label text).
4. `[STRUCTURAL]` SettingsScreen has a "Bottom Navigation" section with toggle switches for each tab.
5. `[BEHAVIORAL]` Toggling a tab off removes it from the bottom nav but the screen remains accessible via hamburger menu.
6. `[BEHAVIORAL]` Default visible tabs: Sheet, Skills, Gear, Magic, Combat, Reference (6 tabs). Profile is optional 7th.
7. `[BEHAVIORAL]` If all tabs are hidden, the hamburger menu remains the fallback navigation.
8. `[STRUCTURAL]` On screens <360px wide, bottom nav uses icon-only mode.
9. `[BEHAVIORAL]` Tab visibility settings persist to IndexedDB/settings.
10. `[STRUCTURAL]` All bottom nav tabs maintain >= 44px touch targets.

## Implementation Steps

1. **Fix TopBar layout**:
   - Restructure TopBar to have three layout zones: left (hamburger/back), center (title or mode toggle), right (action buttons).
   - Mode toggle gets its own dedicated slot, separate from the action button group.
   - Use flexbox with `justify-content: space-between` or CSS grid for reliable spacing.
   - Test at 320px viewport width: no overlap.

2. **Add narrow screen mode toggle**:
   - Media query `@media (max-width: 359px)`: hide label text, show icon only.
   - Mode toggle remains functional at all widths.

3. **Add tab visibility settings to AppStateContext**:
   - Extend settings with `bottomNavTabs: Record<string, boolean>` (or array).
   - Defaults: Sheet=true, Skills=true, Gear=true, Magic=true, Combat=true, Reference=true, Profile=false.
   - Persists to IndexedDB with existing settings infrastructure.

4. **Update BottomNav**:
   - Read `bottomNavTabs` from AppStateContext.
   - Filter tabs based on visibility settings.
   - On screens <360px: icon-only mode (hide labels).
   - Maintain >= 44px touch targets.

5. **Add Settings section**:
   - "Bottom Navigation" section in SettingsScreen.
   - Toggle switch for each tab (Sheet, Skills, Gear, Magic, Combat, Reference, Profile).
   - Toggling updates `bottomNavTabs` in settings.

6. **Ensure hamburger menu fallback**:
   - All screens remain listed in hamburger menu regardless of bottom nav visibility.
   - If all tabs hidden, hamburger is only navigation.

7. **Add CSS**: TopBar layout fixes, narrow screen responsive rules, bottom nav icon-only mode in `theme.css`.

## Edge Cases
- All bottom nav tabs hidden: hamburger menu remains fallback.
- TopBar on very narrow screens (<360px): mode toggle collapses to icon-only.
- Mode toggle does not overlap other buttons at any width >= 320px.
- Tab visibility settings persist across app restarts.
- Theme switch: all new UI adapts via CSS custom properties.

## Constraints
- TopBar layout fix must not change mode toggle functionality.
- Settings persistence uses existing settings infrastructure.
- No new npm dependencies.
- Touch targets >= 44px on all interactive elements.
- Components must not exceed 400 lines.

## Verification Commands
```bash
# Build check
npx vite build

# Verify TopBar layout changes
grep -r "mode-toggle\|toggle-slot\|dedicated" src/components/layout/TopBar.tsx

# Verify narrow screen media query
grep -r "360px\|max-width.*359\|icon-only" src/theme/theme.css

# Verify BottomNav configurability
grep -r "bottomNavTabs\|tabVisibility\|visible" src/components/layout/BottomNav.tsx

# Verify Settings section
grep -r "Bottom Navigation\|bottomNavTabs\|tab.*toggle" src/screens/SettingsScreen.tsx

# Verify hamburger menu fallback
grep -r "hamburger\|menu" src/components/layout/
```
