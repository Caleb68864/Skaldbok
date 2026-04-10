---
type: phase-spec-index
master_spec: "docs/factory/2026-03-31T18-21-40-design-doc/spec.md"
date: 2026-03-31
sub_specs: 5
---

# Phase Specs — Skaldmark Issues Batch Resolution

Refined from spec.md — Factory Run 2026-03-31T18-21-40-design-doc.

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| 1 | Session UX Core — PartyPicker, Coin Calculator, Bottom Nav | none | [sub-spec-1-session-ux-core.md](sub-spec-1-session-ux-core.md) |
| 2 | Global FAB and Action Drawer Extraction | 1 | [sub-spec-2-global-fab-action-drawers.md](sub-spec-2-global-fab-action-drawers.md) |
| 3 | Notes Overhaul — Grid, Full Editor, Tiptap Fix, @-Mentions, Tags, Link Note Removal | 1 | [sub-spec-3-notes-overhaul.md](sub-spec-3-notes-overhaul.md) |
| 4 | Character Sheet Cleanup and Session Logger Enhancements | 1, 2 | [sub-spec-4-sheet-cleanup-session-logger.md](sub-spec-4-sheet-cleanup-session-logger.md) |
| 5 | Export Permission Fix | none | [sub-spec-5-export-permission-fix.md](sub-spec-5-export-permission-fix.md) |

## Execution Order

Sub-specs 1 and 5 can run in parallel (no dependencies on each other).
Sub-specs 2 and 3 can run in parallel after sub-spec 1 completes.
Sub-spec 4 runs after sub-specs 1 and 2 complete.

```
        [1] ──────┬──── [2] ────── [4]
                  │
                  └──── [3]
[5] (independent)
```
