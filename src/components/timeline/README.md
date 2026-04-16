# Timeline System

This folder holds a reusable multi-track timeline engine intended to stay decoupled from the app's note system.

## Protected boundary

Treat `src/components/timeline/index.ts` as the public surface for the generic timeline UI.

- Keep only render primitives, generic types, and generic hooks in the barrel.
- Import app adapters, examples, and mock data through their concrete paths instead of re-exporting them here.
- Do not teach `TimelineRoot` about notes, sessions, encounters, or repository lookups.

## Adding a new track kind

1. Add the user-facing default label and ordering in `config/defaultTimelineTrackCatalog.ts`.
2. Update your adapter resolver so source data maps to that kind instead of teaching `TimelineRoot` about app-specific records.
3. Pass track-specific colors, icons, or custom renderers through props if the new kind needs special presentation.

## Integration rule

`TimelineRoot` should only receive `tracks`, `items`, `markers`, and callbacks. Keep repository lookups, entity-link traversal, and note-shape knowledge inside adapter functions.
