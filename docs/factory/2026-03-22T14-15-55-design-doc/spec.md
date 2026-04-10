# Spec: Skaldbok — The Adventurer's Ledger (Dragonbane Character Sheet PWA)

## Meta
- Client: Logic Nebraska (internal)
- Project: Skaldmark
- Repo: C:\Users\CalebBennett\Documents\GitHub\Skaldmark
- Date: 2026-03-22
- Author: Forge Dark Factory
- Quality Score: 27/30
  - Outcome: 5/5
  - Scope: 5/5
  - Decision guidance: 5/5
  - Edges: 4/5
  - Criteria: 4/5
  - Decomposition: 4/5
- Status: draft

## Outcome
The project is done when a user can install the app as a PWA from a local server onto an Android tablet, create and manage multiple Dragonbane characters stored locally in IndexedDB, track HP/WP/conditions/skills/gear/spells during live play using large touch-friendly controls in Play Mode, perform full character editing in Edit Mode, import/export characters as JSON, and use the app entirely offline after initial installation. The app must ship with dark, parchment, and light themes, and must contain zero copyrighted rules text.

## Intent
Trade-Off Hierarchy:
1. Data safety and offline reliability over feature richness
2. Touch usability and readability over visual polish
3. Dragonbane-first correctness over multi-system genericity
4. Boring stable architecture over clever abstractions
5. Finishable V1 scope over future-proofing

Decision Boundaries — stop and escalate if:
- A sub-spec requires adding a backend, cloud sync, or authentication
- A design choice would risk silent data loss or corruption
- Copyrighted rules text would need to be bundled
- A sub-spec scope exceeds 3 files or requires touching code from more than 2 other sub-specs simultaneously
- IndexedDB limitations require a fundamentally different storage approach

Decide autonomously for everything else.

## Context
This is a greenfield project. The repository currently contains only an initial commit with no source code. The design document specifies a tablet-first, offline-first PWA for tracking Dragonbane RPG characters during live tabletop play.

**Tech stack:** React + TypeScript + Vite, vite-plugin-pwa, IndexedDB (via Dexie or thin wrapper), Zod for validation, React Router for client-side routing, CSS variables for theming.

**Key architectural decisions from design:**
- Frontend-only, no backend in V1
- One active character at a time, many stored locally
- Play Mode (limited edits: HP/WP/conditions/death rolls) vs Edit Mode (full access)
- JSON-driven system definitions (Dragonbane bundled, architecture allows future systems)
- Bottom navigation (thumb-friendly) + top action bar
- Screens: Character Library, Sheet, Skills, Gear, Magic, Combat, Reference, Settings

**Dragonbane domain:** 6 attributes (STR/CON/AGL/INT/WIL/CHA), 6 conditions (exhausted/sickly/dazed/angry/scared/disheartened), resources (HP/WP/death rolls/coins), ~30 skills grouped by category, weapons, armor/helmet, inventory, spells (with WP cost), heroic abilities, derived values (movement, damage bonus, encumbrance limit).

## Requirements

1. REQ-001: The app must be scaffolded as a Vite + React + TypeScript project with strict TypeScript enabled.
2. REQ-002: The project folder structure must follow the design document layout (src/app, src/screens, src/components, src/storage, src/systems, src/theme, src/utils, src/types, src/hooks, src/context, src/pwa, src/features, src/routes, schemas, sample-data, public).
3. REQ-003: Client-side routing must support navigation between all screens (Library, Sheet, Skills, Gear, Magic, Combat, Reference, Settings) with unknown-route handling.
4. REQ-004: The app layout must include a top action bar (character name, mode toggle, theme toggle, fullscreen toggle, wake lock toggle, overflow menu) and bottom navigation (Sheet, Skills, Gear, Magic, Combat).
5. REQ-005: Three themes (dark, parchment, light) must be implemented using CSS variables, switchable without page reload, and persisted to localStorage.
6. REQ-006: Dark theme must be the default, parchment theme must have fantasy-inspired styling, and all themes must maintain readable contrast.
7. REQ-007: Primitive UI components must be created: Button, IconButton, Card, Chip, CounterControl, Drawer, Modal, SectionPanel.
8. REQ-008: The app must be configured as an installable PWA with web app manifest, service worker (via vite-plugin-pwa), and offline app-shell caching.
9. REQ-009: After initial installation and caching, the app must function entirely offline for all character operations.
10. REQ-010: A service worker update flow must detect new versions and prompt the user to refresh without silently wiping state.
11. REQ-011: TypeScript domain types must be defined for SystemDefinition, CharacterRecord, AppSettings, and all nested sub-types.
12. REQ-012: Zod validation schemas must be created for system definitions, character records, and app settings, producing human-readable error messages on validation failure.
13. REQ-013: A bundled Dragonbane system definition JSON must include attributes, conditions, resources, skill definitions (grouped by category), and section layout metadata, with no copyrighted rules text.
14. REQ-014: A blank Dragonbane character template JSON must be provided that validates against the character schema.
15. REQ-015: An IndexedDB persistence layer must be implemented with stores for characters, systems, appSettings, referenceNotes, and metadata.
16. REQ-016: Repository interfaces must be created for characters (getAll, getById, save, delete), systems, and settings.
17. REQ-017: On app startup, settings must be loaded, the bundled Dragonbane system must be seeded if absent, and the active character must be restored if one was previously set.
18. REQ-018: An autosave mechanism must debounce character changes and persist them to IndexedDB without blocking the UI.
19. REQ-019: The Character Library screen must support listing all characters, creating a new blank character, duplicating a character, deleting a character (with confirmation dialog), and setting a character as active.
20. REQ-020: Setting a character as active must persist the activeCharacterId and redirect to the Sheet screen.
21. REQ-021: The Sheet screen must display the active character's identity summary, attributes, conditions (as toggles), resources (HP/WP as counters), and derived value stubs.
22. REQ-022: Play Mode must restrict edits to HP, WP, death rolls, conditions, and equipped state only. Edit Mode must allow full editing of all fields.
23. REQ-023: The current mode (Play/Edit) must be visually obvious in the top bar, persist across sessions, and be toggled with a single tap.
24. REQ-024: Fields must visually indicate whether they are editable or locked based on the current mode.
25. REQ-025: The Skills screen must render skills from the Dragonbane system definition merged with character skill values, support grouped display, and provide a toggle between relevant-first and show-all views.
26. REQ-026: The Gear screen must display weapons, armor/helmet summary, inventory items, tiny items, memento, coins, and an encumbrance helper.
27. REQ-027: Complex item editing (weapons, inventory items) must use drawer or modal editors rather than inline dense forms.
28. REQ-028: The Magic screen must display spell cards and heroic ability cards with create/edit/delete support, and include a can-cast filter that shows only spells with WP cost less than or equal to current WP.
29. REQ-029: The Combat screen must provide large HP/WP counters, large condition toggles, death roll tracking, and quick equipped weapon/armor summary, optimized for one-handed tablet use.
30. REQ-030: Character export must serialize the character to a downloadable JSON file.
31. REQ-031: Character import must parse a JSON file, validate it with the Zod schema, show readable errors on failure, and persist on success without overwriting existing characters.
32. REQ-032: Every stored entity (characters, systems) must include a schemaVersion field for future migration support.
33. REQ-033: A migration utility scaffold must exist that reads schemaVersion and routes through a migration pipeline.
34. REQ-034: Derived values (movement, damage bonus, encumbrance limit) must compute automatically from character data and update when inputs change.
35. REQ-035: Users must be able to override derived values in Edit Mode, with overrides visibly marked and resettable to auto-calculated values.
36. REQ-036: A fullscreen toggle must use the Fullscreen API where supported and degrade gracefully where unsupported.
37. REQ-037: A wake lock toggle must use the Screen Wake Lock API where supported, show status, and degrade gracefully where unsupported or revoked.
38. REQ-038: The Reference screen must allow user-authored shorthand note cards stored locally, with no bundled copyrighted rules text.
39. REQ-039: The Settings screen must expose theme selection, mode preference, and import/export helpers.
40. REQ-040: All imported JSON must be treated as untrusted: no script execution, no raw HTML rendering from imported content.
41. REQ-041: Delete operations must require confirmation before execution.
42. REQ-042: Storage write failures must be caught and surfaced to the user, never silently discarding data.
43. REQ-043: The app must support portrait and landscape orientations on tablet without requiring pinch-zoom.
44. REQ-044: Touch targets for interactive elements must be large enough for comfortable tablet use (minimum 44x44px effective area).

## Sub-Specs

### 1. Project Scaffold and Routing
**Scope:** Initialize the Vite + React + TypeScript project, create the folder structure, set up React Router with all screen routes, and create the AppLayout shell with placeholder top bar and bottom nav.
**Files likely touched:** package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx, src/app/App.tsx, src/app/AppProviders.tsx, src/app/AppLayout.tsx, src/routes/index.tsx, placeholder screen files (8 screens)
**Acceptance Criteria:**
- `[MECHANICAL]` `npm install` succeeds with zero errors (REQ-001)
- `[MECHANICAL]` `npx tsc --noEmit` passes with zero errors (REQ-001)
- `[MECHANICAL]` `npm run dev` starts a local server that serves the app (REQ-001)
- `[STRUCTURAL]` Folder structure matches the design document layout with all specified directories present (REQ-002)
- `[BEHAVIORAL]` Navigating to /library, /sheet, /skills, /gear, /magic, /combat, /reference, /settings renders the corresponding placeholder screen (REQ-003)
- `[BEHAVIORAL]` Navigating to an unknown route shows a fallback or redirects (REQ-003)
- `[STRUCTURAL]` AppLayout contains a top bar area and bottom navigation area (REQ-004)
**Dependencies:** none

### 2. Theme System and Design Tokens
**Scope:** Implement the three-theme system (dark, parchment, light) using CSS variables, create a ThemeProvider with localStorage persistence, and build core primitive UI components.
**Files likely touched:** src/theme/themes.ts, src/theme/ThemeProvider.tsx, src/theme/theme.css, src/components/primitives/Button.tsx, src/components/primitives/IconButton.tsx, src/components/primitives/Card.tsx, src/components/primitives/Chip.tsx, src/components/primitives/SectionPanel.tsx, src/components/primitives/CounterControl.tsx, src/components/primitives/Drawer.tsx, src/components/primitives/Modal.tsx
**Acceptance Criteria:**
- `[BEHAVIORAL]` Switching themes applies new colors instantly without page reload (REQ-005)
- `[BEHAVIORAL]` Selected theme persists across browser sessions via localStorage (REQ-005)
- `[STRUCTURAL]` Dark theme is set as default when no preference is stored (REQ-006)
- `[STRUCTURAL]` No component file contains hardcoded color values; all reference CSS variables (REQ-005)
- `[BEHAVIORAL]` Parchment theme has visible fantasy-inspired styling distinct from dark and light (REQ-006)
- `[STRUCTURAL]` All seven primitive component files exist and export a React component (REQ-007)
**Dependencies:** sub-spec 1

### 3. PWA Configuration and Offline Shell
**Scope:** Configure vite-plugin-pwa with manifest, service worker, app-shell precaching, and an update-available notification flow.
**Files likely touched:** vite.config.ts, src/pwa/registerPwa.ts, src/main.tsx, public/icons/ (placeholder icons)
**Acceptance Criteria:**
- `[MECHANICAL]` `npm run build` produces a dist/ with a manifest.webmanifest file (REQ-008)
- `[STRUCTURAL]` manifest.webmanifest contains name, icons, display, start_url, and theme_color fields (REQ-008)
- `[BEHAVIORAL]` After building and serving dist/, the app loads when the network is disconnected (REQ-009)
- `[STRUCTURAL]` registerPwa.ts contains logic for detecting service worker updates and prompting the user (REQ-010)
**Dependencies:** sub-spec 1

### 4. TypeScript Types and Zod Schemas
**Scope:** Define all domain TypeScript interfaces/types and Zod validation schemas for system definitions, character records, and app settings.
**Files likely touched:** src/types/system.ts, src/types/character.ts, src/types/settings.ts, schemas/system.schema.ts, schemas/character.schema.ts, schemas/settings.schema.ts
**Acceptance Criteria:**
- `[MECHANICAL]` `npx tsc --noEmit` passes after types are added (REQ-011)
- `[STRUCTURAL]` SystemDefinition type includes id, version, name, displayName, attributes, conditions, resources, skills, and themesSupported fields (REQ-011)
- `[STRUCTURAL]` CharacterRecord type includes id, schemaVersion, systemId, name, metadata, values, conditions, resources, skills, spells, heroicAbilities, weapons, inventory, derivedOverrides, uiState, and timestamps (REQ-011)
- `[BEHAVIORAL]` Zod character schema accepts a valid sample character JSON and returns typed output (REQ-012)
- `[BEHAVIORAL]` Zod character schema rejects an object missing required fields and produces a human-readable error message (REQ-012)
**Dependencies:** none

### 5. Bundled Dragonbane System and Blank Character
**Scope:** Create the Dragonbane system definition JSON with all game mechanical definitions and a blank character template that validates against the schema.
**Files likely touched:** src/systems/dragonbane/system.json, sample-data/dragonbane.blank.character.json
**Acceptance Criteria:**
- `[STRUCTURAL]` system.json contains definitions for 6 attributes (STR/CON/AGL/INT/WIL/CHA), 6 conditions, HP/WP/deathRolls resources, and a skill list grouped by category (REQ-013)
- `[STRUCTURAL]` system.json contains zero sentences of copyrighted rules text (REQ-013)
- `[BEHAVIORAL]` dragonbane.blank.character.json passes Zod character schema validation (REQ-014)
- `[STRUCTURAL]` Blank character includes schemaVersion and systemId fields (REQ-032)
**Dependencies:** sub-spec 4

### 6. IndexedDB Storage Layer and Repositories
**Scope:** Implement the IndexedDB database initialization and repository classes for characters, systems, settings, reference notes, and metadata.
**Files likely touched:** src/storage/db/client.ts, src/storage/repositories/characterRepository.ts, src/storage/repositories/systemRepository.ts, src/storage/repositories/settingsRepository.ts, src/utils/ids.ts, src/utils/dates.ts
**Acceptance Criteria:**
- `[STRUCTURAL]` IndexedDB client defines object stores for characters, systems, appSettings, referenceNotes, and metadata (REQ-015)
- `[STRUCTURAL]` characterRepository exports getAll, getById, save, and delete methods (REQ-016)
- `[BEHAVIORAL]` Saving a character and then calling getById with its id returns the same character data (REQ-016)
- `[BEHAVIORAL]` Calling getAll on an empty database returns an empty array without errors (REQ-015)
**Dependencies:** sub-spec 4

### 7. App State Context and Startup Hydration
**Scope:** Implement global app state contexts for settings, active character, and system definition. Wire up startup hydration that loads settings, seeds the Dragonbane system if absent, and restores the active character.
**Files likely touched:** src/context/AppStateContext.tsx, src/context/ActiveCharacterContext.tsx, src/features/settings/useAppSettings.ts, src/features/systems/useSystemDefinition.ts, src/app/AppProviders.tsx, src/app/App.tsx
**Acceptance Criteria:**
<!-- HOLDOUT `[BEHAVIORAL]` On first launch with empty database, the app boots without errors and shows the Character Library (REQ-017) -->
- `[BEHAVIORAL]` On first launch, the Dragonbane system definition is seeded into IndexedDB (REQ-017)
- `[BEHAVIORAL]` After setting a character as active and reloading the page, the same character is restored (REQ-017)
- `[BEHAVIORAL]` Theme preference from previous session is restored on startup (REQ-017)
**Dependencies:** sub-specs 2, 5, 6

### 8. Character Library Screen
**Scope:** Build the full Character Library screen with all CRUD operations and active-character management.
**Files likely touched:** src/screens/CharacterLibraryScreen.tsx, src/features/characters/useCharacterActions.ts, src/features/characters/characterMappers.ts
**Acceptance Criteria:**
- `[BEHAVIORAL]` Creating a new character adds it to the library list and it persists after reload (REQ-019)
- `[BEHAVIORAL]` Duplicating a character creates a new entry with a different id but identical data (REQ-019)
- `[BEHAVIORAL]` Deleting a character shows a confirmation dialog before removal (REQ-019, REQ-041)
- `[BEHAVIORAL]` Tapping "set active" on a character persists activeCharacterId and navigates to the Sheet screen (REQ-020)
- `[STRUCTURAL]` The currently active character is visually distinguished in the library list (REQ-019)
**Dependencies:** sub-specs 6, 7

### 9. Sheet Screen with Live Character Data
**Scope:** Build the Sheet screen bound to the active character, displaying identity summary, attributes, conditions, HP/WP counters, and derived value stubs. Implement the autosave hook.
**Files likely touched:** src/screens/SheetScreen.tsx, src/components/fields/AttributeField.tsx, src/components/fields/ConditionToggleGroup.tsx, src/components/fields/ResourceTracker.tsx, src/hooks/useAutosave.ts
**Acceptance Criteria:**
- `[BEHAVIORAL]` The Sheet screen displays the active character's name, kin, and profession (REQ-021)
- `[BEHAVIORAL]` All 6 attributes are displayed with their current values (REQ-021)
- `[BEHAVIORAL]` Toggling a condition checkbox persists the change after page reload (REQ-021, REQ-018)
- `[BEHAVIORAL]` Incrementing/decrementing HP or WP via counter controls persists after reload (REQ-021, REQ-018)
- `[STRUCTURAL]` Autosave hook debounces writes so rapid changes do not trigger individual DB writes per keystroke (REQ-018)
**Dependencies:** sub-specs 2, 7, 8

### 10. Play Mode and Edit Mode System
**Scope:** Implement the global mode toggle, field-level mode guards, and visual mode indicators across the Sheet screen as the initial enforcement point.
**Files likely touched:** src/utils/modeGuards.ts, src/components/layout/TopBar.tsx, src/context/AppStateContext.tsx, src/screens/SheetScreen.tsx
**Acceptance Criteria:**
- `[BEHAVIORAL]` In Play Mode, tapping an attribute field does not open an editor (REQ-022)
- `[BEHAVIORAL]` In Play Mode, HP/WP counters and condition toggles remain interactive (REQ-022)
- `[BEHAVIORAL]` In Edit Mode, attribute fields become editable (REQ-022)
- `[BEHAVIORAL]` The top bar visually distinguishes Play Mode from Edit Mode with distinct color or label (REQ-023)
- `[BEHAVIORAL]` Mode preference persists: switching to Edit Mode and reloading restores Edit Mode (REQ-023)
- `[STRUCTURAL]` Locked fields have a visual indicator (dimmed, no edit affordance) distinguishing them from editable fields (REQ-024)
**Dependencies:** sub-specs 7, 9

### 11. Skills Screen
**Scope:** Build the Skills screen merging system skill definitions with character values, supporting grouped display and relevant-first/show-all toggle.
**Files likely touched:** src/screens/SkillsScreen.tsx, src/components/fields/SkillList.tsx, src/components/fields/SkillRow.tsx
**Acceptance Criteria:**
<!-- HOLDOUT `[BEHAVIORAL]` Skills are displayed grouped by their category from the system definition (REQ-025) -->
- `[BEHAVIORAL]` Editing a skill value in Edit Mode and reloading preserves the new value (REQ-025)
- `[BEHAVIORAL]` The relevant-first toggle hides skills with value 0 and no trained flag; show-all displays every system-defined skill (REQ-025)
- `[STRUCTURAL]` Skill labels and groupings are driven by the system JSON, not hardcoded in the component (REQ-025)
**Dependencies:** sub-specs 5, 7, 10

### 12. Gear Screen and Item Editors
**Scope:** Build the Gear screen with weapons, armor/helmet, inventory, coins, and encumbrance display. Implement drawer/modal editors for complex items.
**Files likely touched:** src/screens/GearScreen.tsx, src/components/fields/WeaponCard.tsx, src/components/fields/InventoryList.tsx, src/components/primitives/Drawer.tsx (may update)
**Acceptance Criteria:**
- `[BEHAVIORAL]` Adding a weapon via the drawer editor persists after reload (REQ-026, REQ-027)
- `[BEHAVIORAL]` Editing coin values updates the display and persists (REQ-026)
- `[STRUCTURAL]` Weapon and inventory item editing opens in a Drawer or Modal, not inline on the main screen (REQ-027)
- `[BEHAVIORAL]` In Play Mode, weapon list is viewable but not editable; in Edit Mode, full CRUD is available (REQ-022)
**Dependencies:** sub-specs 2, 7, 10

### 13. Magic Screen
**Scope:** Build the Magic screen with spell cards, heroic ability cards, freeform entry support, and WP-based can-cast filtering.
**Files likely touched:** src/screens/MagicScreen.tsx, src/components/fields/SpellCard.tsx, src/components/fields/AbilityCard.tsx, src/components/fields/FilterBar.tsx
**Acceptance Criteria:**
- `[BEHAVIORAL]` Adding a spell with name, WP cost, and summary persists after reload (REQ-028)
- `[BEHAVIORAL]` Enabling the can-cast filter hides spells whose WP cost exceeds the character's current WP (REQ-028)
- `[BEHAVIORAL]` Heroic abilities display as cards with name and summary (REQ-028)
- `[BEHAVIORAL]` Spells and abilities can be created, edited, and deleted in Edit Mode (REQ-028)
**Dependencies:** sub-specs 2, 7, 10

### 14. Combat Screen
**Scope:** Build the Combat screen with oversized HP/WP counters, large condition toggles, death roll tracking, and quick equipment summary.
**Files likely touched:** src/screens/CombatScreen.tsx, src/components/fields/CombatResourcePanel.tsx, src/components/fields/QuickConditionPanel.tsx
**Acceptance Criteria:**
- `[BEHAVIORAL]` HP and WP counters on the Combat screen have visibly larger touch targets than on the Sheet screen (REQ-029)
- `[BEHAVIORAL]` Condition toggles on the Combat screen are functional and persist changes (REQ-029)
- `[BEHAVIORAL]` Death roll counter increments/decrements and persists (REQ-029)
- `[STRUCTURAL]` The Combat screen shows a summary of the currently equipped weapon and armor/helmet (REQ-029)
<!-- HOLDOUT `[BEHAVIORAL]` All changes made on the Combat screen are reflected on the Sheet screen without manual refresh (REQ-029) -->
**Dependencies:** sub-specs 9, 10

### 15. Import/Export and Migration Scaffold
**Scope:** Implement character JSON export (download), character JSON import (with validation and error display), and a migration utility scaffold.
**Files likely touched:** src/utils/importExport.ts, src/utils/migrations.ts, src/screens/CharacterLibraryScreen.tsx (add import/export buttons)
**Acceptance Criteria:**
- `[BEHAVIORAL]` Exporting a character downloads a .json file containing valid character data (REQ-030)
- `[BEHAVIORAL]` Importing a valid character JSON file adds it to the library without overwriting existing characters (REQ-031)
- `[BEHAVIORAL]` Importing an invalid JSON file shows a human-readable error and does not modify existing data (REQ-031, REQ-040)
- `[STRUCTURAL]` Exported character JSON includes a schemaVersion field (REQ-032)
- `[STRUCTURAL]` migrations.ts exports a function that accepts a versioned object and returns a migrated object (REQ-033)
**Dependencies:** sub-specs 4, 6, 8

### 16. Derived Values and Override System
**Scope:** Implement automatic derived value computation (movement, damage bonus, encumbrance limit) and the override/reset mechanism in Edit Mode.
**Files likely touched:** src/utils/derivedValues.ts, src/components/fields/DerivedFieldDisplay.tsx, src/screens/SheetScreen.tsx, src/screens/GearScreen.tsx
**Acceptance Criteria:**
- `[BEHAVIORAL]` Changing a character's CON attribute causes the derived HP maximum to update (REQ-034)
<!-- HOLDOUT `[BEHAVIORAL]` Overriding a derived value in Edit Mode stores the override and displays a visual indicator (REQ-035) -->
- `[BEHAVIORAL]` Resetting an override returns the field to its auto-calculated value (REQ-035)
- `[STRUCTURAL]` Derived value logic is centralized in derivedValues.ts, not spread across components (REQ-034)
**Dependencies:** sub-specs 9, 10

### 17. Fullscreen, Wake Lock, and Device Utilities
**Scope:** Implement fullscreen toggle, wake lock toggle, graceful degradation, status indicators, and preference persistence.
**Files likely touched:** src/hooks/useFullscreen.ts, src/hooks/useWakeLock.ts, src/components/layout/TopBar.tsx, src/features/settings/useAppSettings.ts
**Acceptance Criteria:**
- `[BEHAVIORAL]` The fullscreen toggle enters fullscreen mode in a supporting browser (REQ-036)
- `[BEHAVIORAL]` If the Fullscreen API is unsupported, the toggle is disabled or hidden with no error thrown (REQ-036)
- `[BEHAVIORAL]` The wake lock toggle activates screen wake lock and shows an "active" indicator (REQ-037)
- `[BEHAVIORAL]` If wake lock is revoked (e.g., tab switch), the indicator updates to reflect the loss (REQ-037)
**Dependencies:** sub-specs 2, 7

### 18. Reference Notes and Settings Screens
**Scope:** Build the Reference screen with user-authored note cards and the Settings screen with theme selection, mode preference, and import/export helpers.
**Files likely touched:** src/screens/ReferenceScreen.tsx, src/screens/SettingsScreen.tsx, src/storage/repositories/settingsRepository.ts (may update)
**Acceptance Criteria:**
- `[BEHAVIORAL]` Creating a reference note card persists it after reload (REQ-038)
- `[BEHAVIORAL]` Editing and deleting reference notes works correctly (REQ-038)
<!-- HOLDOUT `[STRUCTURAL]` The Reference screen contains no bundled copyrighted rules text (REQ-038) -->
- `[BEHAVIORAL]` The Settings screen allows changing the theme and the change takes effect immediately (REQ-039)
- `[STRUCTURAL]` The Settings screen includes links/buttons for import and export operations (REQ-039)
**Dependencies:** sub-specs 2, 6, 7

### 19. Responsive Layout, Touch Targets, and Cross-Orientation Polish
**Scope:** Final polish pass to ensure portrait/landscape support, minimum touch target sizes, empty states, and visual consistency across all screens.
**Files likely touched:** src/theme/theme.css, src/app/AppLayout.tsx, src/components/layout/TopBar.tsx, src/components/layout/BottomNav.tsx, all screen files (spacing/layout adjustments)
**Acceptance Criteria:**
- `[BEHAVIORAL]` Rotating the device between portrait and landscape does not break any screen layout (REQ-043)
- `[STRUCTURAL]` All interactive elements (buttons, toggles, counters, nav items) have a minimum effective touch area of 44x44px as verified by CSS inspection (REQ-044)
- `[BEHAVIORAL]` No screen requires pinch-zoom to access any control on a 10-inch tablet viewport (REQ-043)
- `[BEHAVIORAL]` Empty states (no characters, no spells, no notes) show helpful placeholder text rather than blank screens (REQ-042)
**Dependencies:** sub-specs 1-18

## Edge Cases
- **Empty database on first launch:** App must boot cleanly, seed Dragonbane system, and redirect to Character Library with a "Create your first character" prompt.
- **Active character deleted:** If the active character is deleted from the library, the app must clear activeCharacterId and return to the Library screen.
- **Import of character with same id:** Must assign a new id to the imported character rather than overwriting the existing one.
- **Import of character for unknown system:** Must still import and store the character but show a warning that the system definition is not loaded.
- **Storage quota exceeded:** Must catch the error and inform the user; must not silently lose data.
- **Wake lock revocation during play:** Must update the indicator without crashing or looping.
- **Malformed character data loaded from IndexedDB:** Must show a fallback error view rather than crashing the entire app.
- **Concurrent rapid taps on counter controls:** Autosave debounce must coalesce rapid increments into a single write.
- **Export with special characters in character name:** Filename must be sanitized for safe download.
- **Browser does not support IndexedDB:** Show a clear "unsupported browser" message on startup.

## Out of Scope
- Dice rolling of any kind
- Online sync, cloud storage, or multi-device sharing
- User accounts, authentication, or login
- Backend API or server-side logic
- PDF import or OCR
- GM campaign/session management
- Multiplayer or party state sync
- Full multi-system RPG engine (only Dragonbane in V1)
- Drag-and-drop form builder
- Arbitrary formula scripting engine
- Printable sheet export
- Portrait/image attachments for characters
- Automated testing infrastructure (manual verification is acceptable for V1)

## Constraints
**Musts:**
- All data must be stored locally in IndexedDB; no network dependency during play
- App must be installable as a PWA from a local server
- App must contain zero copyrighted rules text
- All imported JSON must be validated before persistence
- Play Mode must prevent accidental structural edits
- Character deletes must require confirmation

**Must-Nots:**
- Must not require a backend or internet connection during normal use
- Must not execute scripts from imported JSON
- Must not render raw HTML from imported character data
- Must not silently discard character data on storage failure
- Must not use `any` type in TypeScript (prefer `unknown` with type narrowing)

**Preferences:**
- Prefer Dexie for IndexedDB over raw IDB API for developer ergonomics
- Prefer CSS variables over CSS-in-JS for theming
- Prefer React context + hooks over external state management libraries
- Prefer drawer/modal editors over dense inline forms for complex data
- Prefer large chunky controls over compact elegant ones

**Escalation Triggers:**
- IndexedDB storage limit appears insufficient for the use case
- A Dragonbane mechanic requires copyrighted text to implement properly
- PWA installation flow fails on target Android tablet Chrome
- A sub-spec grows beyond 3 files or 90 minutes of estimated work

## Verification
End-to-end verification sequence:
1. Run `npm install && npm run build` -- must succeed with zero errors
2. Serve the built dist/ folder via a local static server
3. Open on Android tablet Chrome and install as PWA
4. Disconnect from network
5. Launch the installed PWA -- must load fully offline
6. Create a new character in the Library
7. Edit character metadata, attributes, skills, gear, spells, and heroic abilities in Edit Mode
8. Switch to Play Mode and adjust HP, WP, conditions, and death rolls
9. Switch to Combat screen and verify large controls work
10. Use the Magic screen can-cast filter
11. Export the character as JSON, delete the character, import the JSON -- character must be restored
12. Switch themes (dark, parchment, light) and verify all screens render correctly
13. Close the app, reopen it -- active character and all edits must persist
14. Rotate between portrait and landscape -- no layout breakage
