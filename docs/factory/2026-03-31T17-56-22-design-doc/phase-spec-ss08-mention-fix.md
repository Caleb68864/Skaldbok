# Phase Spec — SS-08: @-Mention Display & Keyboard Fix
**Sub-Spec:** SPEC-B2-4
**Issue:** #12
**Batch:** 2 — Notes Overhaul
**Dependency:** SS-07 (Tiptap Quick Note Fix) must be verified as a Tiptap/React 19 canary before proceeding with Tiptap-related changes.

---

## Intent
Mentions must display the entity's name (e.g., `@Leroy`), never a raw UUID. Arrow-key navigation must work in the suggestion dropdown. If the referenced entity is deleted, show the stored name as plain text.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Read & fix | `src/components/notes/TiptapNoteEditor.tsx` |
| Read & fix | `src/extensions/descriptorMentionExtension.ts` (or equivalent — search for "mention" if path differs) |

---

## Implementation Steps

1. **Read** `src/extensions/descriptorMentionExtension.ts` (or equivalent mention extension file) to understand the current node schema and rendering.
2. **Read** `src/components/notes/TiptapNoteEditor.tsx` to find where mentions are inserted and rendered.
3. **Fix mention storage**: at insert time, store both `id` (UUID) and `label` (entity display name) in the mention node attributes:
   ```ts
   // Node attrs: { id: string; label: string }
   ```
4. **Fix mention rendering**: render mention nodes as styled chips showing `label` (e.g., `@Leroy`). The UUID must never appear in the rendered output.
5. **Fix deleted-entity handling**: if the entity referenced by `id` no longer exists in Dexie, render `label` as plain inline text (not a chip; UUID must not appear).
6. **Fix arrow-key navigation** in the suggestion dropdown:
   - `↑` moves focus to the previous suggestion item.
   - `↓` moves focus to the next suggestion item.
   - `Enter` selects the currently focused suggestion.
   - Verify that existing `onClick` selection is not broken.

---

## Acceptance Criteria

- [ ] **B2-4-AC1:** @-mentions display the entity's name (e.g., `@Leroy`), not a UUID.
- [ ] **B2-4-AC2:** @-mention dropdown supports ↑/↓ arrow key navigation and Enter to select.
- [ ] **B2-4-AC3:** Mentions to deleted entities show the stored display name as plain text (no UUID visible).

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit
```

---

## Cross-Cutting Constraints

- No new npm dependencies.
- No Dexie schema version bump.
- All CSS via CSS variables — no hardcoded colors.

---

## Escalation Triggers

Pause and request human input if:
- Existing mention nodes in Dexie do not store a `label` attribute and a migration is needed to back-fill display names.
- The mention extension is shared with another feature that would be affected by the attr schema change.
