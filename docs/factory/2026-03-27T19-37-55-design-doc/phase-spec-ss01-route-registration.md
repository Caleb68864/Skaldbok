# Phase Spec — SS-01: Route Registration

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-01
**Priority:** P0 | **Impact:** 5 | **Risk:** 2
**Dependency:** None — implement first; all other sub-specs depend on this.

---

## Objective

Register the `/print` route outside of `AppLayout` so it renders without TopBar or BottomNav chrome. This is the foundational route that all other sub-specs depend on.

---

## Files to Modify

| File | Action |
|---|---|
| `src/routes/index.tsx` | Modify: add `/print` route before AppLayout |

---

## Implementation Steps

1. Open `src/routes/index.tsx`.
2. Add an import for `PrintableSheetScreen`:
   ```typescript
   import PrintableSheetScreen from '../screens/PrintableSheetScreen';
   ```
3. In the `routes` array, insert a new `RouteObject` **before** the existing `AppLayout` route object:
   ```typescript
   export const routes: RouteObject[] = [
     { path: '/print', element: <PrintableSheetScreen /> },  // NEW — must be before AppLayout
     {
       element: <AppLayout />,
       children: [ ...existing routes... ],
     },
   ];
   ```
4. Do NOT move or alter any existing route definitions inside `AppLayout`.
5. Confirm there is no `*` catch-all at the top level that would intercept `/print` before it reaches the new route entry.
6. Run TypeScript check: `tsc --noEmit` (no shell; verify mentally / rely on IDE).

### Why placement matters
React Router matches routes in array order. Placing `/print` before the `AppLayout` wrapper ensures it is matched first, preventing the `*` catch-all inside `AppLayout`'s children from capturing it.

---

## Verification Commands

> Note: No shell commands per mission constraints. Verify by:
- Loading `/print` in the browser dev server and confirming NO TopBar or BottomNav is visible.
- Loading `/library`, `/sheet`, `/skills` and confirming they still render with AppLayout chrome.
- Checking TypeScript output in IDE (zero errors in `src/routes/index.tsx`).

---

## Acceptance Criteria

- [ ] `1.1` Navigating to `/print` renders `PrintableSheetScreen` without any TopBar or BottomNav chrome
- [ ] `1.2` All existing routes (`/library`, `/sheet`, `/skills`, etc.) continue to work unchanged
- [ ] `1.3` TypeScript compiles without errors after the route change
