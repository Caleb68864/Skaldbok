# Phase Spec — SS-03: Entity Link Type Verification

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 0.3 — Shared Infrastructure: Entity Link Types
**Depends on:** SS-02 (Zod type schemas) — complete first
**Delivery order note:** Step 3 in execution sequence. Verify entity link system before repositories are built.

---

## Objective

Inspect `entityLinkRepository.ts` to confirm that `fromEntityType` and `toEntityType` fields accept free-string values (no whitelist/enum guard). If a whitelist exists, remove it (or extend it) to support `'encounter'` and `'creature'` as valid entity type strings. Document the finding in a code comment regardless.

---

## File to Inspect / Potentially Modify

- `src/storage/repositories/entityLinkRepository.ts`

---

## Implementation Steps

1. **Read the full contents** of `src/storage/repositories/entityLinkRepository.ts`.

2. **Search for any enum or whitelist** that restricts `fromEntityType` or `toEntityType` values. Patterns to look for:
   - Array literals like `['note', 'character', 'session']` used in a guard
   - `z.enum([...])` on the entity type fields
   - `if (validTypes.includes(type))` style guards
   - TypeScript union types like `type EntityType = 'note' | 'character' | ...`

3. **If no whitelist found (expected outcome):**
   - Add a code comment near the `fromEntityType`/`toEntityType` fields:
     ```typescript
     // entityType is a free-string field — no whitelist enforced.
     // Valid values include: 'note', 'character', 'session', 'campaign',
     // 'party', 'partyMember', 'encounter', 'creature'
     // Verified: 2026-04-06 (SS-03)
     ```

4. **If a whitelist IS found:**
   - Extend it to include `'encounter'` and `'creature'` without removing existing values.
   - Add the same comment above.
   - Note this as an issue in the result.

5. **Do not change** any function signatures or logic unless a whitelist is found that blocks the new entity types.

---

## Verification Commands

```bash
# TypeScript compile check — must pass with no errors
npx tsc --noEmit
```

**Manual verification:**
- No runtime test is required for this sub-spec.
- The acceptance criteria focus on code inspection and static confirmation.

---

## Acceptance Criteria

- [ ] `entityLinkRepository.ts` has been read and inspected
- [ ] If no whitelist/enum guard exists on `fromEntityType` or `toEntityType`: a confirming code comment is added
- [ ] If a whitelist/enum guard exists: it has been extended to include `'encounter'` and `'creature'`
- [ ] Creating an entity link with `fromEntityType: 'encounter'` and `toEntityType: 'note'` will succeed at runtime (confirmed by inspection — no guard blocks it)
- [ ] Creating an entity link with `fromEntityType: 'creature'` will succeed at runtime (confirmed by inspection)
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- No new npm dependencies
- Do not change any existing function signature in `entityLinkRepository.ts`
- Only add a comment (or extend an existing whitelist) — do not restructure the file
- If a whitelist requires changing more than the entity type list, escalate (do not silently change logic)
