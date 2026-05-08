<p align="center">
  <img src="public/icons/icon-512.png" alt="Skaldbok logo" width="160" height="160">
</p>

# Skaldbok

Skaldbok is a local-first tabletop character sheet and play dashboard PWA. It is built for fast table use on tablets and desktops, with offline storage, installable app icons, character import/export, campaign tools, and user-owned reference material.

## Current Features

- **Installable PWA** with custom app icon, Apple touch icon, service worker precache, and offline-friendly bundled fonts.
- **Character sheet workspace** for identity, attributes, resources, skills, gear, abilities, magic, and printable sheets.
- **Play dashboard** with modular table-facing panels for HP/WP, conditions, rests, fast skills, equipped gear, heroic abilities, and prepared magic.
- **Autosave and data hardening** that normalize character values before persistence and guard the app with a top-level error boundary.
- **User-owned reference library** with importable JSON, editable reference sections, reusable reference cards/groups, and drag-and-drop card/section reordering.
- **Campaign and session tools** for campaigns, active sessions, notes, parties, quick logging, import/export, and knowledge-base linking.
- **Local data model** backed by IndexedDB/Dexie, with soft-delete conventions for domain entities and reversible cleanup flows.

## Game System

Skaldbok ships with a generic **Classic Fantasy** system definition (`src/systems/classic-fantasy/system.json`) — a skill-based, attribute-driven fantasy RPG shape with conditions, rests, weapons, armour, and magic schools. It is intended as a starting point. Additional systems can be added as sibling folders under `src/systems/` and selected per character via `systemId`.

## Reference Data Policy

Skaldbok does not bundle any third-party publisher's rules text, art, trade dress, or proprietary content. The bundled Classic Fantasy system describes generic game-mechanical concepts (attributes, skills, conditions, resources) that are not, in our view, copyrightable expression. Specific in-app reference material — spell descriptions, ability text, monster stat blocks, house rules — is loaded from user-owned local JSON imports or authored directly in the app. Local reference archives belong under `local-references/`, which is intentionally gitignored.

If you are using Skaldbok with a published commercial RPG, please source any rules content you import yourself from material you own. Skaldbok is a tool; the books are still the books.

## Development

Install dependencies:

```bash
npm ci
```

Start the dev server:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

The dev server uses Vite and the project PWA config is in `vite.config.ts`.

## Project Notes

- Public PWA assets live under `public/`.
- The full-size generated source icon is kept under `docs/assets/` locally; `docs/` is gitignored.
- User-facing presets and reference groupings should live in configuration or user storage, not hardcoded component arrays.
- Domain deletes should use soft-delete repository flows rather than hard deletion from UI code.
