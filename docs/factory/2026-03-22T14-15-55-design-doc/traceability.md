# Traceability Matrix

| REQ ID | Requirement | Sub-Spec | Worker Status | Verify Status | Holdout? |
|--------|-------------|----------|---------------|---------------|----------|
| REQ-001 | Vite + React + TypeScript project with strict TS | 1 — Project Scaffold and Routing | PASS | PASS | no |
| REQ-002 | Folder structure matches design layout | 1 — Project Scaffold and Routing | PASS | PASS | no |
| REQ-003 | Client-side routing for all screens with unknown-route handling | 1 — Project Scaffold and Routing | PASS | PASS | no |
| REQ-004 | Top action bar and bottom navigation layout | 1 — Project Scaffold and Routing | PASS | PASS | no |
| REQ-005 | Three themes via CSS variables, switchable without reload, persisted | 2 — Theme System and Design Tokens | PASS | PASS | no |
| REQ-006 | Dark default, parchment fantasy style, readable contrast | 2 — Theme System and Design Tokens | PASS | PASS | no |
| REQ-007 | Primitive UI components created | 2 — Theme System and Design Tokens | PASS | PASS | no |
| REQ-008 | Installable PWA with manifest, service worker, offline caching | 3 — PWA Configuration and Offline Shell | PASS | PASS | no |
| REQ-009 | App functions entirely offline after installation | 3 — PWA Configuration and Offline Shell | PASS | PASS | no |
| REQ-010 | Service worker update flow with user prompt | 3 — PWA Configuration and Offline Shell | PASS | PASS | no |
| REQ-011 | TypeScript domain types for all core entities | 4 — TypeScript Types and Zod Schemas | PASS | PASS | no |
| REQ-012 | Zod validation schemas with human-readable errors | 4 — TypeScript Types and Zod Schemas | PASS | PASS | no |
| REQ-013 | Bundled Dragonbane system definition with no copyrighted text | 5 — Bundled Dragonbane System and Blank Character | PASS | PASS | no |
| REQ-014 | Blank Dragonbane character template validates against schema | 5 — Bundled Dragonbane System and Blank Character | PASS | PASS | no |
| REQ-015 | IndexedDB with stores for characters, systems, settings, notes, metadata | 6 — IndexedDB Storage Layer and Repositories | PASS | PARTIAL | no |
| REQ-016 | Repository interfaces for characters, systems, settings | 6 — IndexedDB Storage Layer and Repositories | PASS | PASS | no |
| REQ-017 | Startup hydration: load settings, seed system, restore active character | 7 — App State Context and Startup Hydration | PASS | PASS | yes |
| REQ-018 | Autosave with debounce, non-blocking | 9 — Sheet Screen with Live Character Data | PASS | PASS | no |
| REQ-019 | Character Library: list, create, duplicate, delete, set active | 8 — Character Library Screen | PASS | PASS | no |
| REQ-020 | Set active persists id and redirects to Sheet | 8 — Character Library Screen | PASS | PASS | no |
| REQ-021 | Sheet screen displays identity, attributes, conditions, resources | 9 — Sheet Screen with Live Character Data | PASS | PASS | no |
| REQ-022 | Play Mode restricts edits; Edit Mode allows full editing | 10 — Play Mode and Edit Mode System | PASS | PASS | no |
| REQ-022 | Play Mode restricts edits; Edit Mode allows full editing | 12 — Gear Screen and Item Editors | pending | PASS | no |
| REQ-022 | Play Mode restricts edits; Edit Mode allows full editing | 13 — Magic Screen | pending | PASS | no |
| REQ-023 | Mode visually obvious, persists, single-tap toggle | 10 — Play Mode and Edit Mode System | PASS | PASS | no |
| REQ-024 | Fields visually indicate editable vs locked state | 10 — Play Mode and Edit Mode System | PASS | PASS | no |
| REQ-025 | Skills screen: system-driven, grouped, relevant-first toggle | 11 — Skills Screen | pending | PASS | yes |
| REQ-026 | Gear screen: weapons, armor, inventory, coins, encumbrance | 12 — Gear Screen and Item Editors | pending | PASS | no |
| REQ-027 | Complex item editing uses drawer/modal | 12 — Gear Screen and Item Editors | pending | PASS | no |
| REQ-028 | Magic screen: spell/ability cards, CRUD, can-cast filter | 13 — Magic Screen | pending | PASS | no |
| REQ-029 | Combat screen: large counters, toggles, death rolls, equipment summary | 14 — Combat Screen | pending | FAIL | yes |
| REQ-030 | Character export to downloadable JSON | 15 — Import/Export and Migration Scaffold | PASS | PASS | no |
| REQ-031 | Character import with validation, error display, no overwrite | 15 — Import/Export and Migration Scaffold | PASS | PASS | no |
| REQ-032 | Every stored entity includes schemaVersion | 15 — Import/Export and Migration Scaffold | PASS | PASS | no |
| REQ-032 | Every stored entity includes schemaVersion | 5 — Bundled Dragonbane System and Blank Character | pending | PASS | no |
| REQ-033 | Migration utility scaffold | 15 — Import/Export and Migration Scaffold | PASS | PASS | no |
| REQ-034 | Derived values compute automatically and update on input change | 16 — Derived Values and Override System | pending | FAIL | no |
| REQ-035 | Override derived values in Edit Mode, visibly marked, resettable | 16 — Derived Values and Override System | pending | FAIL | yes |
| REQ-036 | Fullscreen toggle with graceful degradation | 17 — Fullscreen, Wake Lock, and Device Utilities | PASS | PASS | no |
| REQ-037 | Wake lock toggle with status and graceful degradation | 17 — Fullscreen, Wake Lock, and Device Utilities | PASS | PASS | no |
| REQ-038 | Reference screen: user-authored notes, no copyrighted text | 18 — Reference Notes and Settings Screens | PASS | PASS | yes |
| REQ-039 | Settings screen: theme, mode preference, import/export helpers | 18 — Reference Notes and Settings Screens | PASS | PASS | no |
| REQ-040 | Imported JSON treated as untrusted | 15 — Import/Export and Migration Scaffold | PASS | PASS | no |
| REQ-041 | Delete operations require confirmation | 8 — Character Library Screen | PASS | PASS | no |
| REQ-042 | Storage write failures surfaced to user | 19 — Responsive Layout, Touch Targets, and Polish | pending | PASS | no |
| REQ-043 | Portrait and landscape support without pinch-zoom | 19 — Responsive Layout, Touch Targets, and Polish | pending | NEEDS_REVIEW | no |
| REQ-044 | Touch targets minimum 44x44px | 19 — Responsive Layout, Touch Targets, and Polish | pending | PASS | no |
