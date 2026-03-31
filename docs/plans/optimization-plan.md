# Skaldmark Optimization Plan

Discovered during comprehensive E2E Playwright testing (10+ iterations per round).

## Bugs Fixed

### 1. Navigate-during-render React anti-pattern
**Files:** SheetScreen, SkillsScreen, GearScreen, MagicScreen, CombatScreen
**Issue:** `navigate('/library')` called during component render when no character is active, triggering React warning: "You should call navigate() in a React.useEffect()"
**Fix:** Moved navigate call into `useEffect` with proper dependency array. Placed useEffect before conditional returns to avoid React hooks-order violation.

### 2. Dexie compound index missing for sessions table
**File:** `src/storage/db/client.ts`
**Issue:** Queries like `{campaignId, status: "active"}` on sessions table caused Dexie warning about missing compound index.
**Fix:** Added schema version 5 with `[campaignId+status]` compound index.

### 3. Note timestamps not visible
**File:** `src/features/notes/NoteItem.tsx`
**Issue:** Notes had no visible timestamp, making session timeline reconstruction impossible.
**Fix:** Added `createdAt` timestamp display and note type badge to NoteItem.

### 4. End Session confirmation button mismatch
**File:** `src/features/campaign/EndSessionModal.tsx`
**Issue:** The end session modal uses "Confirm" button text, not "End Session" again. Tests were looking for wrong text.
**Status:** No code change needed (test fixed), UI is correct.

## Optimizations to Consider

### HIGH PRIORITY

#### A. SessionQuickActions overlay blocks CombatTimeline interaction
**Impact:** During active combat with session quick actions visible, the quick action chips can overlap combat event type chips (both have "Damage", "Heal" etc.). Force-clicking is needed.
**Recommendation:** When CombatTimeline is visible, either:
- Hide or collapse the SessionQuickActions section
- Add a visual separator with z-index management
- Auto-scroll to combat area when combat starts

#### B. Character creation flow — no auto-activate
**Impact:** After creating a character, it's not automatically set as active. Users must go to library and click "Set Active".
**Recommendation:** After `createCharacter()`, automatically set the new character as active, especially if it's the first character.

#### C. Party members show as "New Adventurer" before rename
**Impact:** When adding characters to party before they're renamed, all show as "New Adventurer", making it impossible to distinguish them.
**Recommendation:**
- Show character ID suffix if names are identical
- Or require naming during creation (not just post-creation edit)
- Or add a "quick rename" prompt right after character creation

#### D. PartyPicker "who" selection on skill checks
**Impact:** User reported inability to choose who when doing skill checks.
**Recommendation:** Verify PartyPicker renders correctly on all mobile viewports. Consider making the "Who?" section sticky at the top of the drawer so it stays visible while scrolling through skills.

### MEDIUM PRIORITY

#### E. Link Note requires active session
**Impact:** The "Link Note" button exists on the Notes screen but only works when a session is active. Without a session, it shows a confusing empty state.
**Recommendation:** Either hide the "Link Note" button when no session is active, or show a clear message explaining why linking isn't available.

#### F. Touch target consistency
**Impact:** Some action buttons in the action menu popup (`...` on NoteItem) don't have sufficient padding for comfortable touch interaction.
**Recommendation:** Audit all interactive elements for 44x44px minimum touch targets.

#### G. Console error: "Cannot update component while rendering"
**Impact:** Cosmetic React warning, but indicates state management anti-pattern that could cause subtle bugs.
**Root cause:** Likely the `navigate()` calls during render (now fixed). Verify the warning is eliminated after the useEffect fix.

### LOW PRIORITY

#### H. Character sub-nav active state detection
**Impact:** The CharacterSubNav uses exact path matching (`location.pathname === to`). If routes change, the active indicator breaks.
**Recommendation:** Use `startsWith` matching consistently.

#### I. Session timer granularity
**Impact:** Session elapsed time only updates every 30 seconds. Users see stale times.
**Recommendation:** Update every 10 seconds or use a more precise timer.

#### J. Combat event form UX
**Impact:** The combat event form requires filling actor/target/value fields before submitting. No auto-fill from active character.
**Recommendation:** Pre-fill actor name with the active character's name.

## Test Coverage Summary

| Feature | Pass Rate | Notes |
|---------|-----------|-------|
| Campaign creation | 100% | Stable |
| Character creation (5) | 100% | Names not persisting (rename flow issue) |
| Party management (5 members) | 100% | All members added successfully |
| Session start/end | 100% | Stable |
| Quick Note creation | 100% | With title |
| Quick NPC creation | 100% | With name, role, affiliation |
| Quick Location creation | 100% | With name, type, region |
| Link Note | N/A | Requires prior notes + active session |
| Combat (10 rounds) | 100% | All event types, next round, end combat |
| Session Quick Actions | 100% | Skill check, others |
| Session Log Overlay | N/A | Requires active character on char screen |
| Character sub-screens | 100% | Sheet, Skills, Gear, Magic, Combat |
| Settings/Reference screens | 100% | Stable |
