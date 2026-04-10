# Post-Unification Cleanup Notes

Follow-ups flagged during the main encounter-notes-folder rework and how
each was resolved.

## Unit 1 — Resolved 2026-04-10

### ✅ #1 — ESLint config drift
**Problem:** `package.json` declared `"lint": "eslint ."` but ESLint was not
installed and no `eslint.config.*` file existed. Running `npm run lint`
crashed with "couldn't find an eslint.config".

**Resolution:** Removed the orphan `lint` script from `package.json`. The
repo uses `tsc -b` (inside `npm run build`) for static verification, which
is sufficient for the current workflow. If proper linting is wanted later,
it should be introduced as a focused effort that audits and fixes the
existing violations in a single pass rather than piecewise via worker
failures.

**Files changed:** `package.json` (1 line removed).

---

### ✅ #3 — `SessionLogOverlay` AttachToControl
**Problem:** Sub-Spec 8 deferred adding `AttachToControl` to
`SessionLogOverlay.tsx` (the floating skill/spell/ability picker on
character screens) because its UX is a single-tap result picker, not a
form body. Adding a visible attach-to dropdown there would meaningfully
change its feel.

**Resolution:** Keep current behavior — **implicit auto-attach to active
encounter**. The infrastructure already does the right thing 99% of the
time (via `logToSession`'s default re-query of `getActiveEncounterForSession`
inside its transaction). For the 1% case where a user needs to re-route
a character-screen log, they can:
- Re-log from the encounter screen's Quick Log (which has the full control)
- Reassign after the fact via `reassignNote` from the Attached log row's
  "Move to…" action on `EncounterScreen`.

**No code change required.** This follow-up is closed as "already behaves
correctly; UX change not needed at this time." If it bites during a real
session, revisit with either a chip-style indicator or a long-press
override.

**Files changed:** none.

---

### ✅ #4 — `schemas/character.schema.ts` reconciliation
**Problem:** `schemas/character.schema.ts` (a top-level Zod schema parallel
to `src/types/character.ts`) was out of Sub-Spec 1's scope and did not
receive `deletedAt` / `softDeletedBy` fields. The concern was that if
anything round-tripped character records through the external schema,
Zod's `.object()` would strip the new fields on `safeParse`.

**Spike result:** `schemas/character.schema.ts` IS actively used.
`src/utils/migrations.ts:1` imports `characterRecordSchema` and
`migrateCharacter` calls `.safeParse(current)` (line 27) on every character
migration. This would have silently dropped `deletedAt` and `softDeletedBy`
the next time any character ran through the migration path — a latent bug
that wouldn't surface until someone soft-deleted a character AND a schema
version bump happened.

**Resolution:** Added optional `deletedAt` and `softDeletedBy` fields to
`characterRecordSchema` in `schemas/character.schema.ts`, matching the
shape of `CharacterRecord` in `src/types/character.ts`. Both places now
carry the soft-delete fields; `migrateCharacter` is now lossless with
respect to them.

**Longer-term:** there are two character schemas in the repo (one Zod
schema for migrations, one TS interface for runtime types). This is a
code-organization smell but not a correctness issue as long as both stay
in sync. Reconciling them into a single source of truth would be a
larger cleanup pass — out of scope for this unit.

**Files changed:** `schemas/character.schema.ts` (2 fields added).

---

## Unit 2 — Still Open

### 🕰 #2 — `CombatEncounterView` legacy trio migration
**Status:** Deferred. Not broken — the trio (`CombatTimeline.tsx`,
`QuickCreateParticipantFlow.tsx`, `ParticipantDrawer.tsx`) is reachable
through `CombatEncounterView` for combat-type encounters and works
correctly. Migration onto the unified surface is legitimate design work
that deserves a focused `/forge-brainstorm` session.

**Rough scope:** 4-6 files modified, 0-3 deleted.

**When to tackle:** Next time the combat UX friction shows up during
actual play, or when you want to consolidate encounter surface code in
a dedicated pass.
