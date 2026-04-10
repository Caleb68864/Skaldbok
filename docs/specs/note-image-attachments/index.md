---
type: phase-spec-index
master_spec: "docs/specs/2026-03-31-note-image-attachments.md"
date: 2026-03-30
sub_specs: 5
---

# Phase Specs -- Note Image Attachments with Obsidian Export

Refined from docs/specs/2026-03-31-note-image-attachments.md.

## Dependency Graph

```
Sub-Spec 1: Attachment Type + DB Migration
    |
    v
Sub-Spec 2: Attachment Repository
    |         \
    v          v
Sub-Spec 3    Sub-Spec 5: Export Pipeline
    |
    v
Sub-Spec 4: Wire into Note Flows
```

Sub-specs 3 and 5 can run in parallel after sub-spec 2 completes.

## Sub-Specs

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| 1 | Attachment Type + DB Migration | none | [sub-spec-1-attachment-type-db.md](sub-spec-1-attachment-type-db.md) |
| 2 | Attachment Repository | 1 | [sub-spec-2-attachment-repository.md](sub-spec-2-attachment-repository.md) |
| 3 | useNoteAttachments Hook + UI Components | 2 | [sub-spec-3-hook-ui-components.md](sub-spec-3-hook-ui-components.md) |
| 4 | Wire Attachments into Note Flows | 3 | [sub-spec-4-wire-into-note-flows.md](sub-spec-4-wire-into-note-flows.md) |
| 5 | Export Pipeline -- Sidecar + Binary Support | 2 | [sub-spec-5-export-pipeline.md](sub-spec-5-export-pipeline.md) |

## Files Summary

| File | Action | Sub-Spec |
|------|--------|----------|
| `src/types/attachment.ts` | Create | 1 |
| `src/storage/db/client.ts` | Modify | 1 |
| `src/utils/imageResize.ts` | Create | 2 |
| `src/storage/repositories/attachmentRepository.ts` | Create | 2 |
| `src/features/notes/useNoteAttachments.ts` | Create | 3 |
| `src/components/notes/AttachButton.tsx` | Create | 3 |
| `src/components/notes/AttachmentThumbs.tsx` | Create | 3 |
| `src/features/notes/useNoteActions.ts` | Modify | 4 |
| `src/features/notes/QuickNoteDrawer.tsx` | Modify | 4 |
| `src/features/notes/QuickNPCDrawer.tsx` | Modify | 4 |
| `src/features/notes/QuickLocationDrawer.tsx` | Modify | 4 |
| `src/utils/export/bundleToZip.ts` | Modify | 5 |
| `src/utils/export/renderAttachmentSidecar.ts` | Create | 5 |
| `src/utils/export/renderNote.ts` | Modify | 5 |
| `src/features/export/useExportActions.ts` | Modify | 5 |

## Verification

All sub-specs share the same primary verification command:

```
npx tsc --noEmit
```

Full end-to-end verification requires completing all 5 sub-specs and testing in the browser per the master spec's Verification section.
