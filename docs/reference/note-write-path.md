# Canonical Note Write Path

This note documents the small architecture-hardening pass that establishes one canonical path for creating notes and their standard links.

## Goal

Keep note creation policy in one place so new note flows do not re-implement:

- body vs `typeData` normalization
- default note fields
- session `contains` links
- encounter `contains` links
- NPC `introduced_in` links
- auto-attach-to-active-encounter behavior

## Canonical service

Shared note write policy now lives in [src/features/notes/noteCreationService.ts](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/features/notes/noteCreationService.ts).

Use these helpers together:

1. `buildNoteRecord(...)`
2. `resolveEncounterAttachmentTarget(...)`
3. `persistCanonicalNoteLinks(...)`

## Current callers

- [src/features/notes/useNoteActions.ts](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/features/notes/useNoteActions.ts)
- [src/features/session/useSessionLog.ts](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/features/session/useSessionLog.ts)

## Rules

- React hooks may supply context, toasts, and orchestration.
- Repositories may persist records.
- The service owns the canonical note defaults and standard link policy.
- New quick-log flows should call the shared service instead of creating links manually.
- If a flow needs special behavior beyond the canonical session/encounter/NPC rules, keep the special case outside the service and document why.

## Timeline boundary

The generic timeline barrel at [src/components/timeline/index.ts](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/components/timeline/index.ts) is now treated as a protected boundary.

- Generic timeline UI and state stay in the barrel.
- App adapters and mock/example files stay off the barrel.
- Session/note-specific timeline assembly belongs outside the timeline core.
