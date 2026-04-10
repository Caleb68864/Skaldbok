# Phase Spec — SS-13: Skills Page Improvements
**Sub-Spec:** SPEC-B3-3
**Issue:** #9
**Batch:** 3 — Character Sheet Cleanup
**Dependency:** SS-12 (`useSessionLogger` hook) MUST be complete and merged before implementing this spec.

---

## Intent
Add dragon/demon mark cycling to skill entries (triple-tap state machine). Ensure skill-check logs are routed through `useSessionLogger` regardless of source (FAB, Session screen, or Skills page). Skill data updates reactively via Dexie live queries.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Read & modify | `src/features/character/SkillsPage.tsx` (or equivalent — search for "SkillsPage" or "Skills" in character feature) |
| Reference | `src/features/session/useSessionLogger.ts` (from SS-12) |
| Reference | Character repository — existing update function for skills |

---

## Implementation Steps

1. **Read** `src/features/character/SkillsPage.tsx` to understand current skill entry rendering and state management.
2. **Read** the character repository to find the existing skill persistence function.

### Dragon/Demon Mark Cycle

3. Add a **triple-tap state machine** on each skill entry:
   - State sequence: `none → dragon → demon → none → ...`
   - Implement via a stored field on the skill (e.g., `markType: "none" | "dragon" | "demon"`) persisted in character data via the existing character repository.
   - Visually distinct rendering for each state (agent chooses icons/colors using existing CSS vars and icon set):
     - `dragon`: dragon icon or warm accent color chip
     - `demon`: demon icon or contrasting accent color chip
     - `none`: no mark shown
4. **Use Dexie live queries** on the Skills page so that skill updates (from any source) reactively update the UI without manual refresh.

### Skill Check Log Routing

5. When a user logs a skill check from the Skills page directly (if an inline roll/log button exists), route it through `useSessionLogger.logEvent("skillCheck", { ... })`.
6. Verify that skill check logs written via the FAB (SS-03) and Session screen quick actions appear in the same session timeline — this is a cross-screen consistency check, not a new data path.

---

## Acceptance Criteria

- [ ] **B3-3-AC1:** Dragon/demon mark cycles through 3 states: dragon → demon → clear (triple-tap on skill entry).
- [ ] **B3-3-AC2:** Dragon and demon marks use visually distinct icons/colors (using existing CSS vars).
- [ ] **B3-3-AC3:** Skill check logs from FAB, Session screen, and Skills page appear consistently in the session timeline.

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit
```

---

## Cross-Cutting Constraints

- No new npm dependencies.
- No Dexie schema version bump (store mark state within existing character/skill data structure if possible — escalate if not).
- All CSS via CSS variables — no hardcoded colors.
- All touch targets ≥ 44 px.

---

## Escalation Triggers

Pause and request human input if:
- Storing `markType` on skills requires a new Dexie index or schema version bump.
- The Skills page component is >500 lines and changes risk breaking existing behavior.
