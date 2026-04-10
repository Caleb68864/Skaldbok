---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 1
title: "Project Scaffold and Routing"
date: 2026-03-22
dependencies: ["none"]
---

# Sub-Spec 1: Project Scaffold and Routing

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Initialize the Vite + React + TypeScript project from scratch (the repo is currently empty of source code). Create the full folder structure specified in the design document. Set up React Router with hash-based routing for all 8 screens plus a catch-all redirect. Create the AppLayout shell with a placeholder TopBar and BottomNav. All screen components are placeholders at this stage -- just enough to prove routing works.

## Interface Contracts

### Provides
- `package.json`: Project dependency manifest with React, React Router, TypeScript, Vite, Zod, Dexie, vite-plugin-pwa
- `vite.config.ts`: Base Vite configuration (PWA plugin will be configured in sub-spec 3)
- `tsconfig.json`: Strict TypeScript configuration with path aliases
- `src/main.tsx`: Application entry point rendering AppProviders > App
- `src/app/App.tsx`: Root component with router outlet
- `src/app/AppProviders.tsx`: Provider wrapper (initially just BrowserRouter)
- `src/app/AppLayout.tsx`: Layout shell with TopBar slot, Outlet, and BottomNav slot
- `src/routes/index.tsx`: Route definitions mapping paths to screen components
- 8 placeholder screen components in `src/screens/`
- `src/components/layout/TopBar.tsx`: Placeholder top bar component
- `src/components/layout/BottomNav.tsx`: Placeholder bottom navigation component

### Requires
None -- no dependencies.

### Shared State
None.

## Implementation Steps

### Step 1: Initialize Vite project and install dependencies
- **File:** `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- **Action:** create
- **Changes:**
  1. Run `npm create vite@latest . -- --template react-ts` in the project root (or manually create the files to avoid interactive prompts)
  2. Install dependencies: `npm install react react-dom react-router-dom dexie zod`
  3. Install dev dependencies: `npm install -D @types/react @types/react-dom typescript vite @vitejs/plugin-react vite-plugin-pwa`
  4. Enable strict mode in `tsconfig.json`: `"strict": true, "noUnusedLocals": true, "noUnusedParameters": true`
  5. Add path alias `@/` -> `src/` in tsconfig.json and vite.config.ts

### Step 2: Create folder structure
- **Action:** create directories
- **Changes:** Create all directories per the design document:
  ```
  src/app/
  src/screens/
  src/components/primitives/
  src/components/fields/
  src/components/layout/
  src/storage/db/
  src/storage/repositories/
  src/systems/dragonbane/
  src/theme/
  src/utils/
  src/types/
  src/hooks/
  src/context/
  src/pwa/
  src/features/settings/
  src/features/characters/
  src/features/systems/
  src/routes/
  schemas/
  sample-data/
  public/icons/
  ```
  Place a `.gitkeep` in each empty directory.

### Step 3: Create placeholder screen components
- **File:** `src/screens/CharacterLibraryScreen.tsx`, `src/screens/SheetScreen.tsx`, `src/screens/SkillsScreen.tsx`, `src/screens/GearScreen.tsx`, `src/screens/MagicScreen.tsx`, `src/screens/CombatScreen.tsx`, `src/screens/ReferenceScreen.tsx`, `src/screens/SettingsScreen.tsx`
- **Action:** create
- **Pattern:** Each screen exports a default React FC that renders a `<div>` with the screen name as an `<h1>`.
- **Changes:** Create 8 files, each following this pattern:
  ```tsx
  export default function CharacterLibraryScreen() {
    return <div><h1>Character Library</h1></div>;
  }
  ```

### Step 4: Create layout components
- **File:** `src/components/layout/TopBar.tsx`, `src/components/layout/BottomNav.tsx`
- **Action:** create
- **Changes:**
  - `TopBar.tsx`: Renders a `<header>` with placeholder text "Skaldbok" and stub buttons for mode toggle, theme toggle, fullscreen, wake lock
  - `BottomNav.tsx`: Renders a `<nav>` with `<NavLink>` elements for Sheet, Skills, Gear, Magic, Combat routes using React Router's NavLink

### Step 5: Create AppLayout, route definitions, and app shell
- **File:** `src/app/AppLayout.tsx`, `src/routes/index.tsx`, `src/app/App.tsx`, `src/app/AppProviders.tsx`, `src/main.tsx`
- **Action:** create
- **Changes:**
  - `AppLayout.tsx`: Renders `<TopBar />`, `<main><Outlet /></main>`, `<BottomNav />` using React Router's `Outlet`
  - `src/routes/index.tsx`: Exports a route configuration array:
    - `/` redirects to `/library`
    - `/library` -> CharacterLibraryScreen
    - `/sheet` -> SheetScreen
    - `/skills` -> SkillsScreen
    - `/gear` -> GearScreen
    - `/magic` -> MagicScreen
    - `/combat` -> CombatScreen
    - `/reference` -> ReferenceScreen
    - `/settings` -> SettingsScreen
    - `*` catch-all redirects to `/library`
  - `AppProviders.tsx`: Wraps children in `<BrowserRouter>`
  - `App.tsx`: Renders `<Routes>` with `<Route element={<AppLayout />}>` wrapping all child routes
  - `main.tsx`: `ReactDOM.createRoot` rendering `<AppProviders><App /></AppProviders>`

### Step 6: Verify build and type-check
- **Run:** `npm install && npx tsc --noEmit && npm run build && npm run dev`
- **Expected:** All commands succeed. Dev server starts and serves the app.

### Step 7: Verify routing
- **Run:** Start dev server, manually navigate to each route path
- **Expected:** Each path renders its corresponding placeholder screen. Unknown routes redirect to /library.

### Step 8: Commit
- **Stage:** `git add package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html src/ schemas/ sample-data/ public/`
- **Message:** `feat: project scaffold and routing`

## Acceptance Criteria

- `[MECHANICAL]` `npm install` succeeds with zero errors (REQ-001)
- `[MECHANICAL]` `npx tsc --noEmit` passes with zero errors (REQ-001)
- `[MECHANICAL]` `npm run dev` starts a local server that serves the app (REQ-001)
- `[STRUCTURAL]` Folder structure matches the design document layout with all specified directories present (REQ-002)
- `[BEHAVIORAL]` Navigating to /library, /sheet, /skills, /gear, /magic, /combat, /reference, /settings renders the corresponding placeholder screen (REQ-003)
- `[BEHAVIORAL]` Navigating to an unknown route shows a fallback or redirects (REQ-003)
- `[STRUCTURAL]` AppLayout contains a top bar area and bottom navigation area (REQ-004)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework configured for V1 -- skip TDD steps, implement directly.
- **Type-check:** `npx tsc --noEmit`
- **Dev server:** `npm run dev`
- **Acceptance:**
  - Verify folder structure: `ls -R src/` should show all required directories
  - Verify routing: Start dev server, navigate to each route in browser
  - Verify type-check: `npx tsc --noEmit` exits 0

## Patterns to Follow

- This is the first sub-spec in a greenfield project. No existing patterns to follow.
- Use Vite's `react-ts` template conventions for initial file structure.
- Use React Router v6 `createBrowserRouter` or `<Routes>/<Route>` pattern.
- All components use named function exports (not default exports with arrow functions): `export default function ComponentName() {}`.

## Files

| File | Action | Purpose |
|------|--------|---------|
| package.json | Create | Project dependencies and scripts |
| tsconfig.json | Create | TypeScript configuration with strict mode |
| tsconfig.app.json | Create | App-specific TS config |
| tsconfig.node.json | Create | Node-specific TS config for Vite |
| vite.config.ts | Create | Vite build configuration |
| index.html | Create | HTML entry point |
| src/main.tsx | Create | React entry point |
| src/app/App.tsx | Create | Root component with routes |
| src/app/AppProviders.tsx | Create | Provider wrapper |
| src/app/AppLayout.tsx | Create | Layout shell with TopBar + Outlet + BottomNav |
| src/routes/index.tsx | Create | Route definitions |
| src/screens/CharacterLibraryScreen.tsx | Create | Placeholder screen |
| src/screens/SheetScreen.tsx | Create | Placeholder screen |
| src/screens/SkillsScreen.tsx | Create | Placeholder screen |
| src/screens/GearScreen.tsx | Create | Placeholder screen |
| src/screens/MagicScreen.tsx | Create | Placeholder screen |
| src/screens/CombatScreen.tsx | Create | Placeholder screen |
| src/screens/ReferenceScreen.tsx | Create | Placeholder screen |
| src/screens/SettingsScreen.tsx | Create | Placeholder screen |
| src/components/layout/TopBar.tsx | Create | Placeholder top bar |
| src/components/layout/BottomNav.tsx | Create | Bottom navigation with NavLinks |
