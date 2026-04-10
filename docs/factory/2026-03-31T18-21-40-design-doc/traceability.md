# Traceability Matrix

| REQ ID | Requirement | Sub-Spec | Worker Status | Verify Status | Holdout? |
|--------|-------------|----------|---------------|---------------|----------|
| REQ-001 | Tapping "Party" in PartyPicker selects all party members; tapping again deselects all | 1 — Session UX Core | PASS | PASS | no |
| REQ-002 | Individual character chips in PartyPicker are toggleable independently (multi-select) | 1 — Session UX Core | PASS | PASS | no |
| REQ-003 | PartyPicker is extracted to src/components/fields/PartyPicker.tsx as a shared component | 1 — Session UX Core | PASS | PASS | no |
| REQ-004 | Shopping quick action shows Gold/Silver/Copper steppers with quantity and calculated total | 1 — Session UX Core | PASS | PASS | no |
| REQ-005 | A global dice FAB is visible on all screens when inside the ShellLayout | 2 — Global FAB and Action Drawer Extraction | PASS | PASS | no |
| REQ-006 | The FAB opens quick-action menu when session active; shows toast when no session active | 2 — Global FAB and Action Drawer Extraction | PASS | PASS | no |
| REQ-007 | Each action drawer is extracted from SessionQuickActions into own component under actions/ | 2 — Global FAB and Action Drawer Extraction | PASS | PASS | no |
| REQ-008 | Bottom nav shows Characters, Session, Reference. Notes tab removed. Settings via hamburger only | 1 — Session UX Core | PASS | PASS | no |
| REQ-009 | Session screen has Notes Grid section showing notes filterable by type, tags, session, search | 3 — Notes Overhaul | PASS | PASS | no |
| REQ-010 | "Show notes from other sessions" toggle works and persists preference per campaign | 3 — Notes Overhaul | PASS | PASS | no |
| REQ-011 | /notes URL redirects to /session?view=notes | 1 — Session UX Core | PASS | PASS | no |
| REQ-012 | Tapping a note in Notes Grid navigates to /note/:id/edit (dedicated full-page editor route) | 3 — Notes Overhaul | PASS | PASS | no |
| REQ-013 | Full Note Editor has visible Tiptap toolbar with bold, italic, headings, lists, blockquotes, links | 3 — Notes Overhaul | PASS | PASS | no |
| REQ-014 | Quick Note drawer body field renders with min-height ~200px and visible Tiptap toolbar | 3 — Notes Overhaul | PASS | FAIL | no |
| REQ-015 | @-mentions display entity names (not UUIDs) and store both UUID and display name | 3 — Notes Overhaul | PASS | FAIL | yes |
| REQ-016 | @-mention dropdown supports arrow key navigation and Enter to select | 3 — Notes Overhaul | PASS | PASS | no |
| REQ-017 | Tag picker has text input to create custom tags; custom tags persist per-campaign | 3 — Notes Overhaul | PASS | PASS | no |
| REQ-018 | Link Note feature (LinkNoteDrawer and its UI triggers) is removed | 3 — Notes Overhaul | PASS | PASS | no |
| REQ-019 | /character/combat route removed; Combat tab not in CharacterSubNav | 1 — Session UX Core | PASS | PASS | no |
| REQ-020 | Death rolls visible on SheetScreen when character HP is 0 | 4 — Character Sheet Cleanup and Session Logger | PASS | PASS | no |
| REQ-021 | Resting creates session log entry with mechanical outcome via useSessionLog | 4 — Character Sheet Cleanup and Session Logger | PASS | PASS | yes |
| REQ-022 | useSessionLog exports logCoinChange with debounce buffer (~3-5 seconds) | 4 — Character Sheet Cleanup and Session Logger | PASS | PASS | no |
| REQ-023 | Dragon/demon mark cycles through 3 states: dragon, demon, clear | 4 — Character Sheet Cleanup and Session Logger | PASS | PASS | no |
| REQ-024 | Manage Party with no campaign shows toast "Create a campaign first" | 4 — Character Sheet Cleanup and Session Logger | PASS | PASS | no |
| REQ-025 | Rapid coin changes produce single session log entry with net change | 4 — Character Sheet Cleanup and Session Logger | PASS | PASS | yes |
| REQ-026 | exportSessionMarkdown and exportSessionBundle produce downloads without NotAllowedError | 5 — Export Permission Fix | PASS | PASS | no |
| REQ-027 | Export works in Chrome and Edge PWA contexts without permission prompts | 5 — Export Permission Fix | PASS | NEEDS_REVIEW | no |
| REQ-028 | tsc --noEmit passes after all changes | 1 — Session UX Core | PASS | PASS | no |
| REQ-028 | tsc --noEmit passes after all changes | 2 — Global FAB and Action Drawer Extraction | PASS | PASS | no |
| REQ-028 | tsc --noEmit passes after all changes | 3 — Notes Overhaul | PASS | PASS | no |
| REQ-028 | tsc --noEmit passes after all changes | 4 — Character Sheet Cleanup and Session Logger | PASS | PASS | no |
| REQ-028 | tsc --noEmit passes after all changes | 5 — Export Permission Fix | PASS | PASS | no |
