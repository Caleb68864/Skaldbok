# Phase Spec — SS-09: Custom Tags
**Sub-Spec:** SPEC-B2-5
**Issue:** #13
**Batch:** 2 — Notes Overhaul
**Dependency:** None within Batch 2 (can run after SS-07 canary is verified). SS-06 (NoteEditorPage) will consume this tag picker.

---

## Intent
Allow GMs to create custom tags inline in the tag picker. Custom tags are normalized, deduplicated, and persisted per campaign without a Dexie schema version bump.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Identify & modify | Tag picker component (search codebase for "TagPicker" or "tag" in `src/components` and `src/features/notes`) |
| Reference | Dexie campaign settings / `appSettings` per-campaign storage (within existing structure) |

---

## Implementation Steps

1. **Search** the codebase for the existing tag picker component (try `TagPicker`, `TagSelector`, or usages of predefined tag lists in note forms).
2. **Read** the tag picker file and any related campaign settings storage to understand the current structure.
3. **Add** a text input (or "+" button) to the tag picker component:
   - Typing filters both predefined tags and existing custom tags (case-insensitive substring match).
   - If the typed text does not match any existing tag (predefined or custom), show a "Create '{input}'" option at the bottom of the dropdown.
4. **On create**:
   - Normalize: lowercase, trim whitespace.
   - Deduplicate: if the normalized value matches a predefined tag, select that predefined tag instead of creating a duplicate.
   - Persist the new custom tag in Dexie within the existing campaign/settings data structure (e.g., a `customTags: string[]` field inside the existing settings blob). **Do NOT create a new Dexie table or bump schema version.**
5. **Ensure** predefined tags remain as defaults and are always displayed alongside custom tags.

---

## Acceptance Criteria

- [ ] **B2-5-AC1:** Tag picker has a text input to filter and create custom tags.
- [ ] **B2-5-AC2:** Custom tags persist per-campaign across app restarts.
- [ ] **B2-5-AC3:** Typing a name matching a predefined tag selects the existing tag (no duplicate created).

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit
```

---

## Cross-Cutting Constraints

- No new npm dependencies.
- **No Dexie schema version bump** — store custom tags in existing settings blob only.
- All CSS via CSS variables — no hardcoded colors.
- All touch targets ≥ 44 px.

---

## Escalation Triggers

Pause and request human input if:
- Storing custom tags requires a new Dexie table or a schema version bump — human must approve before proceeding.
