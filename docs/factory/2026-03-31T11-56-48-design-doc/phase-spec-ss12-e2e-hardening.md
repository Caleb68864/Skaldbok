# Phase Spec — SS-12: E2E Test Hardening

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 3 (Polish)
**Item:** 12 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** All other sub-specs (SS-01 through SS-11) should be complete before this item, because the new tests verify behaviors introduced in SS-02 (PartyPicker) and SS-05 (descriptor chips). The character rename flow fix is independent and can be done first.

---

## Intent

Improve E2E test suite robustness: fix the flaky character rename flow test, add tests for `#descriptor` chip creation/rendering (SS-05), and add tests for PartyPicker "Who?" selection and sticky header (SS-02). All new and existing tests must pass 10/10 iterations.

---

## Files to Modify

| File | Action |
|------|--------|
| `tests/e2e_full_test.py` | Modify — fix rename flow + add descriptor and PartyPicker tests |

> No other files should be modified. If any other file requires changes, escalate to human before proceeding.

---

## Implementation Steps

1. **Read** `tests/e2e_full_test.py` in full before writing any code.
   - Understand the existing test structure, selectors, helper patterns, and iteration loop.
   - Identify the flaky character rename flow test.

2. **Fix flaky character rename flow test:**
   - Identify why it is flaky (likely: timing issues, unstable selectors, or missing `await` for DOM state).
   - Replace fragile selectors with stable ones (e.g., `data-testid` attributes if present, or robust CSS selectors).
   - Add explicit waits for DOM state (e.g., wait for the rename input to be visible/enabled before interacting).
   - Verify the fixed test passes 10 iterations in isolation before proceeding.

3. **Add `#descriptor` chip tests:**

   **Test A — Descriptor chip creation in TipTap editor:**
   - Navigate to the Notes screen.
   - Open or create a note.
   - Focus the TipTap editor.
   - Type `#` followed by a query string (e.g., `#test`).
   - Assert the autocomplete dropdown appears.
   - Select a suggestion (or type to completion).
   - Assert a chip node is present in the editor content.

   **Test B — Descriptor chips render on NoteItem:**
   - Save the note from Test A.
   - Navigate away and back (or close and reopen the note list).
   - Assert the `NoteItem` for the saved note displays at least one descriptor chip in its chip row.

4. **Add PartyPicker "Who?" tests:**

   **Test C — Sticky "Who?" section:**
   - Open a session.
   - Open the PartyPicker drawer.
   - Scroll the drawer downward.
   - Assert the "Who?" section is still visible (sticky — it should remain at the top of the visible drawer area).

   **Test D — Active character pre-selection:**
   - Open a session with a known active character.
   - Open the PartyPicker drawer.
   - Assert the active character is pre-selected (checked/highlighted) without any user interaction.

5. **Run full suite 10× after all changes:**
   ```bash
   python tests/e2e_full_test.py
   ```
   - Required: 10/10 pass rate.
   - Fix any failures before marking this item complete.

6. Commit with a descriptive message referencing Item 12.

---

## Acceptance Criteria

- [ ] **AC12.1** — Character rename flow test passes reliably (10/10 iterations, no flakiness).
- [ ] **AC12.2** — At least one test verifies `#descriptor` chip creation in the TipTap editor.
- [ ] **AC12.3** — At least one test verifies descriptor chips render on `NoteItem`.
- [ ] **AC12.4** — At least one test verifies PartyPicker "Who?" sticky section and pre-selection.
- [ ] **AC12.5** — Full E2E suite passes 10/10 iterations after all additions.

---

## Verification Commands

```bash
# Run full E2E suite (10 iterations required)
python tests/e2e_full_test.py

# Type-check (Python file — no tsc needed, but confirm no syntax errors)
python -m py_compile tests/e2e_full_test.py
```

**Iteration checklist:**
- [ ] Run 1: all tests pass.
- [ ] Run 2: all tests pass.
- [ ] Run 3: all tests pass.
- [ ] Run 4: all tests pass.
- [ ] Run 5: all tests pass.
- [ ] Run 6: all tests pass.
- [ ] Run 7: all tests pass.
- [ ] Run 8: all tests pass.
- [ ] Run 9: all tests pass.
- [ ] Run 10: all tests pass.

---

## Constraints (Never Violate)

- No new npm dependencies.
- No changes to application source code from this item (test file only).
- If a test requires a `data-testid` attribute that doesn't exist in the source: add the attribute to the relevant source component, but flag it as a scope addition and verify with human if it feels out of scope.

---

## Shortcuts

- Follow existing test helper patterns in `tests/e2e_full_test.py` for selectors and wait utilities.
- Use stable selectors: `data-testid`, `aria-label`, or structural CSS paths — avoid brittle text-content selectors where possible.
- Commit after this item for bisectability. This is the final item — after commit, run the full Tier 3 gate (E2E 10×, `vite build`, zero console errors).
