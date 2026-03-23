# Phase 2: Wave 2 — SystemDefinition `themesSupported` Field

**Phase:** 2 of 3
**Spec ID:** SPEC-SKALDBOK-BUGFIX-002
**Run ID:** 2026-03-22T17-55-04-design-doc
**Wave:** 2
**Sub-Specs:** SS-03
**Dependencies:** Phase 1 complete (wave ordering; no hard code dependency)

---

## Dependency Graph

```
Phase 1 (Wave 1) ──→ Phase 2 (Wave 2)
                         └── SS-03: SystemDefinition themesSupported field
```

**Dependency Note:** SS-03 has no code dependency on any Wave 1 item. The sequencing is for orderly verification — all P0 fixes land first, then P1 enhancements.

---

## SS-03: SystemDefinition `themesSupported` Field

### Intent
Add an optional `themesSupported` field to the SystemDefinition TypeScript type and Zod schema. Update the Dragonbane system.json to include the field. This is a type-level fix with a data update — no runtime behavior changes.

### Files

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `src/types/system.ts` | Add `themesSupported?: string[]` to SystemDefinition |
| MODIFY | `schemas/system.schema.ts` | Add `themesSupported` to Zod schema |
| MODIFY | `src/systems/dragonbane/system.json` | Add `"themesSupported"` array |

### Implementation Steps

1. **Modify `src/types/system.ts`:**
   - Locate the `SystemDefinition` interface
   - Add `themesSupported?: string[];` field
   - Place it logically near other system-level config fields (e.g., after `sectionLayouts` or at the end)

2. **Modify `schemas/system.schema.ts`:**
   - Locate the `systemDefinitionSchema` Zod object
   - Add `themesSupported: z.array(z.string()).optional()` to the schema
   - Place it in the same relative position as the type definition

3. **Modify `src/systems/dragonbane/system.json`:**
   - Add `"themesSupported": ["dark", "parchment", "light"]` at the top level of the JSON object
   - Place it logically (e.g., after the system name/id or at the end before closing brace)

### Verification Commands

```bash
# AC-04-1: SystemDefinition includes themesSupported
grep -n "themesSupported" src/types/system.ts

# AC-04-2: Zod schema includes themesSupported
grep -n "themesSupported" schemas/system.schema.ts

# AC-04-3: Dragonbane system.json includes themesSupported
grep -n "themesSupported" src/systems/dragonbane/system.json

# AC-04-4: Field is optional (? in type, .optional() in Zod)
grep -n "themesSupported?" src/types/system.ts
grep -n "optional()" schemas/system.schema.ts
```

### Acceptance Criteria

| ID | Criterion | Pass? |
|----|-----------|-------|
| AC-04-1 | SystemDefinition interface includes `themesSupported?: string[]` | ☐ |
| AC-04-2 | systemDefinitionSchema Zod schema includes `themesSupported` as `z.array(z.string()).optional()` | ☐ |
| AC-04-3 | Dragonbane system.json includes `"themesSupported": ["dark", "parchment", "light"]` | ☐ |
| AC-04-4 | Existing system data without `themesSupported` still passes Zod validation | ☐ |

### Guardrails
- ✅ Field MUST be optional to maintain backward compatibility
- ✅ Use `string[]` to allow arbitrary theme names
- ❌ Do NOT make themesSupported required
- ❌ Do NOT add theme filtering logic (future feature)

---

## Phase 2 Completion Criteria

All 4 acceptance criteria for SS-03 must pass before proceeding to Phase 3.

| Sub-Spec | AC Count | Status |
|----------|----------|--------|
| SS-03 | 4 | ☐ |
| **Total** | **4** | ☐ |
