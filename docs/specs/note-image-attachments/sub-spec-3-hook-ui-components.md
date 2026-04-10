---
type: phase-spec
master_spec: "docs/specs/2026-03-31-note-image-attachments.md"
sub_spec_number: 3
title: "useNoteAttachments Hook + UI Components"
date: 2026-03-30
dependencies: [2]
---

# Sub-Spec 3: useNoteAttachments Hook + UI Components

Refined from spec.md -- Note Image Attachments.

## Intent

Create the React hook that manages attachment state for a single note (load, add, remove, caption edit) and two UI components (AttachButton for file input, AttachmentThumbs for the thumbnail strip). The hook owns object URL lifecycle to prevent memory leaks. The components follow the project's inline-styles-with-CSS-variables pattern.

## Scope

1. Create `src/features/notes/useNoteAttachments.ts` -- a hooks-as-services layer that wraps the repository, manages object URLs, enforces the 10-attachment limit, and surfaces loading state.
2. Create `src/components/notes/AttachButton.tsx` -- a file input button that accepts images (camera + gallery).
3. Create `src/components/notes/AttachmentThumbs.tsx` -- a horizontal scrollable thumbnail strip with tap-to-caption and delete actions.

## Interface Contracts

### Provides
- `useNoteAttachments(noteId: string | undefined)` returns:
  ```typescript
  {
    attachments: Array<Attachment & { objectUrl: string }>;
    addAttachment: (file: File) => Promise<void>;
    removeAttachment: (id: string) => Promise<void>;
    updateCaption: (id: string, caption: string) => Promise<void>;
    isLoading: boolean;
  }
  ```
- `AttachButton` component: `{ onFileSelected: (file: File) => void; disabled?: boolean }`
- `AttachmentThumbs` component:
  ```typescript
  {
    attachments: Array<{ id: string; objectUrl: string; caption?: string }>;
    onDelete: (id: string) => void;
    onCaptionChange: (id: string, caption: string) => void;
  }
  ```

### Requires
- From sub-spec 2: `createAttachment`, `getAttachmentsByNote`, `deleteAttachment`, `deleteAttachmentsByNote`, `updateAttachmentCaption` from attachmentRepository
- From sub-spec 1: `Attachment` type

### Shared State
- Sub-spec 4 (wire-in) imports `useNoteAttachments`, `AttachButton`, and `AttachmentThumbs` into the Quick*Drawer components.

## Acceptance Criteria

| ID | Type | Criterion |
|----|------|-----------|
| AC-3.1 | STRUCTURAL | `useNoteAttachments(noteId)` returns `{ attachments, addAttachment, removeAttachment, updateCaption, isLoading }` |
| AC-3.2 | BEHAVIORAL | Hook creates object URLs via `URL.createObjectURL` and revokes them on unmount/noteId change |
| AC-3.3 | BEHAVIORAL | `addAttachment` enforces 10-attachment limit -- shows toast if exceeded |
| AC-3.4 | STRUCTURAL | `AttachButton` renders `<input type="file" accept="image/*">` with camera capture option |
| AC-3.5 | STRUCTURAL | `AttachmentThumbs` renders horizontal scrollable strip of `<img>` thumbnails from object URLs |
| AC-3.6 | BEHAVIORAL | Tapping thumbnail shows inline caption input |
| AC-3.7 | BEHAVIORAL | Delete action on thumbnail calls `removeAttachment` |

## Implementation Steps

### Step 1: Create useNoteAttachments hook

- **File:** `src/features/notes/useNoteAttachments.ts` (create)
- **Action:** Create new file
- **Pattern:** Follow `src/features/notes/useNoteActions.ts` -- useCallback with explicit deps, useToast() for errors, useCampaignContext() for IDs
- **Changes:**
  ```typescript
  import { useState, useEffect, useCallback, useRef } from 'react';
  import { useToast } from '../../context/ToastContext';
  import { useCampaignContext } from '../campaign/CampaignContext';
  import * as attachmentRepository from '../../storage/repositories/attachmentRepository';
  import type { Attachment } from '../../types/attachment';
  ```

  Key implementation details:

  1. **State:** `attachments` array (Attachment + objectUrl), `isLoading` boolean
  2. **Load effect:** On `noteId` change, fetch `attachmentRepository.getAttachmentsByNote(noteId)`, create object URLs for each blob, set state. Return cleanup that revokes all object URLs.
  3. **`addAttachment(file)`:**
     - Check `attachments.length >= 10` -- if so, `showToast('Maximum 10 attachments per note')` and return
     - Call `attachmentRepository.createAttachment(noteId, campaignId, file)`
     - On `QuotaExceededError` (check error message or name), `showToast('Storage full')`
     - On corrupt image error from `createImageBitmap`, `showToast('Could not read image')`
     - On success, create object URL, append to state
  4. **`removeAttachment(id)`:**
     - Call `attachmentRepository.deleteAttachment(id)`
     - Revoke the object URL for that attachment
     - Remove from state
  5. **`updateCaption(id, caption)`:**
     - Call `attachmentRepository.updateAttachmentCaption(id, caption)`
     - Update caption in local state
  6. **Cleanup on unmount:** useRef to track current object URLs, revoke all in cleanup

### Step 2: Create AttachButton component

- **File:** `src/components/notes/AttachButton.tsx` (create)
- **Action:** Create new file
- **Pattern:** Follow `src/components/notes/TagPicker.tsx` -- named export, inline styles with CSS variables, Props interface
- **Changes:**
  ```typescript
  interface AttachButtonProps {
    onFileSelected: (file: File) => void;
    disabled?: boolean;
  }

  export function AttachButton({ onFileSelected, disabled }: AttachButtonProps) {
    // Hidden <input type="file" accept="image/*" capture="environment">
    // Visible button that triggers input.click()
    // On change, extract file from event.target.files[0], call onFileSelected
    // Reset input value after selection so same file can be re-selected
  }
  ```

  Style notes:
  - Button styled like other action buttons in the drawers (var(--color-surface-raised), var(--color-text-muted))
  - Camera icon or paperclip text label
  - `minHeight: '44px'` for touch targets

### Step 3: Create AttachmentThumbs component

- **File:** `src/components/notes/AttachmentThumbs.tsx` (create)
- **Action:** Create new file
- **Pattern:** Follow `src/components/notes/TagPicker.tsx` -- named export, inline styles with CSS variables
- **Changes:**
  ```typescript
  interface AttachmentThumbsProps {
    attachments: Array<{ id: string; objectUrl: string; caption?: string }>;
    onDelete: (id: string) => void;
    onCaptionChange: (id: string, caption: string) => void;
  }

  export function AttachmentThumbs({ attachments, onDelete, onCaptionChange }: AttachmentThumbsProps) {
    // Container: horizontal scroll strip (display: flex, overflowX: auto, gap: 8px)
    // Each thumb: 80x80 img with objectFit: cover, borderRadius: 8px
    // Tap on thumb: toggle inline caption <input> below the image
    // Delete: small X button in top-right corner of each thumb
    // Caption input: compact text input below thumb, fontSize: 11px
  }
  ```

  Style notes:
  - Thumb container: `display: flex`, `overflowX: 'auto'`, `gap: '8px'`, `padding: '8px 0'`
  - Each thumb wrapper: `position: relative`, `flexShrink: 0`
  - Delete button: absolute positioned top-right, small circle with X
  - Use CSS variable colors: `var(--color-surface-raised)`, `var(--color-border)`, `var(--color-text-muted)`

### Step 4: Verify TypeScript compilation

- **Run:** `npx tsc --noEmit`
- **Expected:** No errors

### Step 5: Commit

- **Stage:** `git add src/features/notes/useNoteAttachments.ts src/components/notes/AttachButton.tsx src/components/notes/AttachmentThumbs.tsx`
- **Message:** `feat: useNoteAttachments hook and attachment UI components`

## Verification Commands

- **Build:** `npx tsc --noEmit`
- **Tests:** No test framework detected -- skip TDD steps, implement directly.
- **Acceptance:**
  - AC-3.1: Inspect hook return type -- confirm all 5 members
  - AC-3.2: Read useEffect cleanup -- confirm `URL.revokeObjectURL` calls
  - AC-3.3: Read `addAttachment` -- confirm `attachments.length >= 10` check with toast
  - AC-3.4: Inspect AttachButton -- confirm `<input type="file" accept="image/*">`
  - AC-3.5: Inspect AttachmentThumbs -- confirm horizontal flex container with `<img>` tags
  - AC-3.6: Inspect thumb tap handler -- confirm caption input toggle
  - AC-3.7: Inspect delete button -- confirm it calls `onDelete(id)`

## Patterns to Follow

- `src/features/notes/useNoteActions.ts`: Hook pattern -- useCallback with explicit deps, useCampaignContext(), useToast(), try/catch with toast on error
- `src/components/notes/TagPicker.tsx`: Component pattern -- named export, inline styles with CSS variables, Props interface, callback props

## Cross-Cutting Constraints

- Object URL lifecycle is critical -- every `createObjectURL` must have a corresponding `revokeObjectURL`
- The hook must handle the case where `noteId` is undefined (during note creation before the note is saved) -- return empty attachments array
- No new npm dependencies
- Touch targets must be at least 44px for mobile usability

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/features/notes/useNoteAttachments.ts` | Create | Hook managing attachment state, object URLs, and 10-limit enforcement |
| `src/components/notes/AttachButton.tsx` | Create | File input button for camera/gallery image selection |
| `src/components/notes/AttachmentThumbs.tsx` | Create | Horizontal scrollable thumbnail strip with caption editing and delete |
