---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 7
title: "App State Context and Startup Hydration"
date: 2026-03-22
dependencies: ["2", "5", "6"]
---

# Sub-Spec 7: App State Context and Startup Hydration

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Implement global app state contexts for settings (theme, mode, activeCharacterId), active character data, and the loaded system definition. Wire up a startup hydration sequence that runs on app mount: load settings from IndexedDB, seed the Dragonbane system if it is absent, and restore the active character if one was previously set. If the database is empty (first launch), boot cleanly and redirect to the Character Library.

## Interface Contracts

### Provides
- `src/context/AppStateContext.tsx`: Exports `AppStateProvider` and `useAppState()` hook returning `{ settings, updateSettings, isLoading }`
- `src/context/ActiveCharacterContext.tsx`: Exports `ActiveCharacterProvider` and `useActiveCharacter()` hook returning `{ character, setCharacter, updateCharacter, clearCharacter, isLoading }`
- `src/features/settings/useAppSettings.ts`: Exports `useAppSettings()` hook for reading/writing settings to IndexedDB
- `src/features/systems/useSystemDefinition.ts`: Exports `useSystemDefinition(systemId)` hook returning the loaded system definition
- `src/app/AppProviders.tsx` (modified): Wraps app in AppStateProvider > ActiveCharacterProvider
- `src/app/App.tsx` (modified): Shows loading state during hydration, then renders routes

### Requires
- From sub-spec 2: `ThemeProvider` (already in AppProviders), `useTheme` hook
- From sub-spec 5: `dragonbaneSystem` export from `src/systems/dragonbane/index.ts`
- From sub-spec 6: All repository functions (characterRepository, systemRepository, settingsRepository)

### Shared State
- IndexedDB `appSettings` store: single record with `activeCharacterId`, `theme`, `mode`
- IndexedDB `systems` store: seeded with Dragonbane system on first launch
- React context: `AppStateContext` and `ActiveCharacterContext` available to all descendants

## Implementation Steps

### Step 1: Create useAppSettings hook
- **File:** `src/features/settings/useAppSettings.ts`
- **Action:** create
- **Changes:** Hook that:
  1. On mount, loads settings from `settingsRepository.get()`
  2. If no settings found, creates default settings: `{ schemaVersion: 1, activeCharacterId: null, theme: 'dark', mode: 'play', wakeLockEnabled: false }`
  3. Provides `updateSettings(partial)` that merges, persists, and updates local state
  4. Returns `{ settings, updateSettings, isLoading }`

### Step 2: Create useSystemDefinition hook
- **File:** `src/features/systems/useSystemDefinition.ts`
- **Action:** create
- **Changes:** Hook that:
  1. Accepts a `systemId` parameter
  2. On mount, checks `systemRepository.getById(systemId)`
  3. If not found and systemId is `'dragonbane'`, seeds from bundled data and returns it
  4. Returns `{ system, isLoading, error }`

### Step 3: Create AppStateContext
- **File:** `src/context/AppStateContext.tsx`
- **Action:** create
- **Changes:**
  - Create React context with `AppStateProvider` that:
    1. Uses `useAppSettings()` internally
    2. On settings load, syncs theme to ThemeProvider via `useTheme().setTheme()`
    3. Seeds Dragonbane system if absent (call `systemRepository.getById('dragonbane')`, if null, `systemRepository.save(dragonbaneSystem)`)
  - Export `useAppState()` hook

### Step 4: Create ActiveCharacterContext
- **File:** `src/context/ActiveCharacterContext.tsx`
- **Action:** create
- **Changes:**
  - Create React context with `ActiveCharacterProvider` that:
    1. Reads `activeCharacterId` from `useAppState().settings`
    2. If an ID is set, loads the character from `characterRepository.getById(id)`
    3. If character not found (deleted), clears `activeCharacterId` in settings
    4. Provides `setCharacter(id)`: persists `activeCharacterId` to settings, loads character
    5. Provides `updateCharacter(partial)`: merges updates into current character state (does NOT persist -- autosave handles that)
    6. Provides `clearCharacter()`: sets `activeCharacterId` to null
  - Export `useActiveCharacter()` hook

### Step 5: Wire providers into AppProviders
- **File:** `src/app/AppProviders.tsx`
- **Action:** modify
- **Changes:** Nest providers in order: `<ThemeProvider>` > `<AppStateProvider>` > `<ActiveCharacterProvider>` > `{children}`

### Step 6: Add loading gate to App
- **File:** `src/app/App.tsx`
- **Action:** modify
- **Changes:** Check `useAppState().isLoading` -- if true, show a centered loading spinner/message. Once loaded, render routes normally. If no active character and on a character-specific route, redirect to /library.

### Step 7: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes. App builds without errors.

### Step 8: Commit
- **Stage:** `git add src/context/ src/features/settings/ src/features/systems/ src/app/AppProviders.tsx src/app/App.tsx`
- **Message:** `feat: app state context and startup hydration`

## Acceptance Criteria

- `[BEHAVIORAL]` On first launch, the Dragonbane system definition is seeded into IndexedDB (REQ-017)
- `[BEHAVIORAL]` After setting a character as active and reloading the page, the same character is restored (REQ-017)
- `[BEHAVIORAL]` Theme preference from previous session is restored on startup (REQ-017)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - First launch: Open app in browser, open DevTools > Application > IndexedDB > skaldbok-db > systems -- should contain dragonbane entry
  - Theme persistence: Set theme to parchment, reload -- should stay parchment
  - Active character: Create a character (sub-spec 8), set active, reload -- same character shown

## Patterns to Follow

- Provider nesting order matters: ThemeProvider outermost (no DB dependency), AppStateProvider next (loads settings), ActiveCharacterProvider innermost (depends on settings for activeCharacterId).
- Use a loading gate pattern: don't render children until hydration is complete to avoid flash of wrong state.
- Settings use a singleton record in IndexedDB (id: 'default') -- not a key-value store.
- System seeding is idempotent: only seed if `getById('dragonbane')` returns undefined.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/features/settings/useAppSettings.ts | Create | Settings load/save hook |
| src/features/systems/useSystemDefinition.ts | Create | System definition loader with seeding |
| src/context/AppStateContext.tsx | Create | Global app state context and provider |
| src/context/ActiveCharacterContext.tsx | Create | Active character context and provider |
| src/app/AppProviders.tsx | Modify | Add state providers to provider tree |
| src/app/App.tsx | Modify | Add loading gate during hydration |
