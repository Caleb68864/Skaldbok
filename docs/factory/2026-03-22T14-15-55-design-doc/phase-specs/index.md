---
type: phase-spec-index
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
date: 2026-03-22
sub_specs: 19
---

# Phase Specs -- Skaldbok: The Adventurer's Ledger

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| 1 | Project Scaffold and Routing | none | [sub-spec-1-project-scaffold-and-routing.md](sub-spec-1-project-scaffold-and-routing.md) |
| 2 | Theme System and Design Tokens | 1 | [sub-spec-2-theme-system-and-design-tokens.md](sub-spec-2-theme-system-and-design-tokens.md) |
| 3 | PWA Configuration and Offline Shell | 1 | [sub-spec-3-pwa-configuration-and-offline-shell.md](sub-spec-3-pwa-configuration-and-offline-shell.md) |
| 4 | TypeScript Types and Zod Schemas | none | [sub-spec-4-typescript-types-and-zod-schemas.md](sub-spec-4-typescript-types-and-zod-schemas.md) |
| 5 | Bundled Dragonbane System and Blank Character | 4 | [sub-spec-5-bundled-dragonbane-system-and-blank-character.md](sub-spec-5-bundled-dragonbane-system-and-blank-character.md) |
| 6 | IndexedDB Storage Layer and Repositories | 4 | [sub-spec-6-indexeddb-storage-layer-and-repositories.md](sub-spec-6-indexeddb-storage-layer-and-repositories.md) |
| 7 | App State Context and Startup Hydration | 2, 5, 6 | [sub-spec-7-app-state-context-and-startup-hydration.md](sub-spec-7-app-state-context-and-startup-hydration.md) |
| 8 | Character Library Screen | 6, 7 | [sub-spec-8-character-library-screen.md](sub-spec-8-character-library-screen.md) |
| 9 | Sheet Screen with Live Character Data | 2, 7, 8 | [sub-spec-9-sheet-screen-with-live-character-data.md](sub-spec-9-sheet-screen-with-live-character-data.md) |
| 10 | Play Mode and Edit Mode System | 7, 9 | [sub-spec-10-play-mode-and-edit-mode-system.md](sub-spec-10-play-mode-and-edit-mode-system.md) |
| 11 | Skills Screen | 5, 7, 10 | [sub-spec-11-skills-screen.md](sub-spec-11-skills-screen.md) |
| 12 | Gear Screen and Item Editors | 2, 7, 10 | [sub-spec-12-gear-screen-and-item-editors.md](sub-spec-12-gear-screen-and-item-editors.md) |
| 13 | Magic Screen | 2, 7, 10 | [sub-spec-13-magic-screen.md](sub-spec-13-magic-screen.md) |
| 14 | Combat Screen | 9, 10 | [sub-spec-14-combat-screen.md](sub-spec-14-combat-screen.md) |
| 15 | Import/Export and Migration Scaffold | 4, 6, 8 | [sub-spec-15-import-export-and-migration-scaffold.md](sub-spec-15-import-export-and-migration-scaffold.md) |
| 16 | Derived Values and Override System | 9, 10 | [sub-spec-16-derived-values-and-override-system.md](sub-spec-16-derived-values-and-override-system.md) |
| 17 | Fullscreen, Wake Lock, and Device Utilities | 2, 7 | [sub-spec-17-fullscreen-wake-lock-and-device-utilities.md](sub-spec-17-fullscreen-wake-lock-and-device-utilities.md) |
| 18 | Reference Notes and Settings Screens | 2, 6, 7 | [sub-spec-18-reference-notes-and-settings-screens.md](sub-spec-18-reference-notes-and-settings-screens.md) |
| 19 | Responsive Layout, Touch Targets, and Polish | 1-18 | [sub-spec-19-responsive-layout-touch-targets-and-polish.md](sub-spec-19-responsive-layout-touch-targets-and-polish.md) |

## Execution Order

Independent roots (can be parallelized):
- Sub-spec 1 (Scaffold) and Sub-spec 4 (Types) have no dependencies

Layer 1 (after roots):
- Sub-spec 2 (Themes) -- needs 1
- Sub-spec 3 (PWA) -- needs 1
- Sub-spec 5 (Dragonbane data) -- needs 4
- Sub-spec 6 (Storage) -- needs 4

Layer 2 (after Layer 1):
- Sub-spec 7 (App State) -- needs 2, 5, 6

Layer 3 (after Layer 2):
- Sub-spec 8 (Library) -- needs 6, 7
- Sub-spec 17 (Device utils) -- needs 2, 7
- Sub-spec 18 (Reference/Settings) -- needs 2, 6, 7

Layer 4 (after Layer 3):
- Sub-spec 9 (Sheet) -- needs 2, 7, 8
- Sub-spec 15 (Import/Export) -- needs 4, 6, 8

Layer 5 (after Layer 4):
- Sub-spec 10 (Mode System) -- needs 7, 9

Layer 6 (after Layer 5):
- Sub-spec 11 (Skills) -- needs 5, 7, 10
- Sub-spec 12 (Gear) -- needs 2, 7, 10
- Sub-spec 13 (Magic) -- needs 2, 7, 10
- Sub-spec 14 (Combat) -- needs 9, 10
- Sub-spec 16 (Derived Values) -- needs 9, 10

Layer 7 (after all):
- Sub-spec 19 (Polish) -- needs 1-18
