---
date: 2026-03-22
topic: "Sheet Enhancements, Session Tools, Advancement Tracking, and UX Fixes"
author: Caleb Bennett
status: draft
tags:
  - design
  - sheet-enhancements
  - session-tools
  - advancement
---

# Sheet Enhancements, Session Tools, and Advancement Tracking -- Design

## Summary

A comprehensive update to Skaldmark adding missing character sheet fields (age, weakness, damage bonuses), a dedicated Profile screen for appearance, session-aware boon/bane skill adjustments with condition integration, rest tracking on Sheet and Combat screens, a full Dragonbane advancement system (dragon marks + end-of-session modal), two-tier reference navigation, configurable bottom nav, and a TopBar layout fix. Session state (boon/bane) is ephemeral in-memory; advancement marks and session checks persist to IndexedDB.

## Approach Selected

**Session State + New Screens (Approach B)** -- A lightweight `sessionState` layer in AppStateContext tracks boon/bane defaults across screen navigation without persisting to storage. Character-level data (dragon marks, advancement checks) persists to IndexedDB. Profile gets its own screen. Rest actions appear on both Sheet and Combat. This balances persistence needs with simplicity.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  AppStateContext                                        │
│  ├── settings (mode, theme, activeCharacterId)          │
│  └── sessionState (NEW, in-memory only)                 │
│       ├── globalBoonBane: 'boon' | 'none' | 'bane'     │
│       └── skillOverrides: Record<skillId, boon|bane>    │
│                                                         │
│  ActiveCharacterContext                                  │
│  └── character: CharacterRecord                         │
│       ├── metadata: { kin, profession, age, weakness,   │
│       │               appearance, notes }               │
│       ├── attributes, conditions, resources             │
│       ├── skills: Record<skillId, CharacterSkill>       │
│       │    └── { value, trained, dragonMarked (NEW) }   │
│       ├── advancementChecks (NEW):                      │
│       │    { combat, exploration, roleplay, ... }       │
│       ├── derivedOverrides                              │
│       └── portraitUri                                   │
└─────────────────────────────────────────────────────────┘

Screens:
  Sheet ──── age, weakness in identity section
         ──── portrait thumbnail (uploadable, tap for full-size modal)
         ──── STR & AGL damage bonuses in derived values
         ──── Rest & Recovery section (round rest / stretch rest)

  Profile (NEW) ──── hero-sized portrait (uploadable)
                ──── appearance text area
                ──── notes text area

  Skills ──── global boon/bane selector at top
          ──── per-skill boon/bane override
          ──── condition-adjusted percentages
          ──── attribute tag per skill (STR, AGL, etc.)
          ──── dragon mark toggle per skill
          ──── marked skills count badge

  Combat ──── rest buttons (same as Sheet, duplicated for convenience)

  Reference ──── two-tier pill navigation

  TopBar ──── fix mode toggle positioning/overlap

  End-of-Session Modal (NEW) ──── session checklist + advancement rolls

  Settings (UPDATED) ──── configurable bottom nav tab visibility
```

## Components

### 1. SheetScreen -- Identity Section (Updated)

**Owns:** Rendering kin, profession, age, weakness as metadata fields; portrait thumbnail with upload; STR & AGL damage bonuses; rest actions.
**Does NOT own:** Appearance (Profile screen), full portrait editing experience (Profile).

- Age and weakness fields stack below kin and profession in identity section (2x2 grid on wide, single column on narrow).
- Portrait thumbnail (~64px) next to character name. Tapping opens a full-size lightbox modal. Upload button available on both Sheet and Profile.
- STR damage bonus (existing) and AGL damage bonus (new) displayed in derived values section alongside movement, HP max, WP max.
- "Rest & Recovery" section panel with Round Rest and Stretch Rest buttons (play mode only).

### 2. ProfileScreen (NEW)

**Owns:** Hero-sized portrait display/upload, appearance text, notes text.
**Does NOT own:** Kin, profession, age, weakness (Sheet screen).

- Large portrait taking top ~40% of screen, with upload/change button overlay.
- Appearance as multi-line text area below portrait.
- Notes as multi-line text area below appearance.
- Accessible from hamburger menu and optionally from bottom nav (configurable).
- Read-only in play mode, editable in edit mode.

### 3. SkillsScreen (Updated)

**Owns:** Skill list with adjusted percentages, boon/bane controls, dragon marks, attribute tags.
**Does NOT own:** Advancement rolling (end-of-session modal).

- **Global boon/bane selector** at top: three-segment control (Boon / Normal / Bane).
- **Per-skill override:** tapping boon/bane area on a skill row cycles through boon / bane / inherit-global.
- **Adjusted percentage display:** each skill shows value and, when boon/bane active, the adjusted probability. Example: "Swords 14 AGL -- 14% (26% with boon)".
- **Condition auto-bane:** if a skill's linked attribute has its condition active (e.g., Dazed → AGL skills), auto-apply bane indicator. Boon + auto-bane cancel to normal. Bane + auto-bane = single bane (no stacking).
- **Attribute tag:** small label showing governing attribute (STR, AGL, INT, etc.) next to skill name.
- **Dragon mark:** toggle icon per skill row. Tap to mark/unmark in play mode. Marked skills get gold highlight. Count badge near top: "4 marked".

### 4. CombatScreen -- Rest Section

**Owns:** Round rest and stretch rest action buttons (duplicated from Sheet for combat convenience).
**Does NOT own:** Resource values (ResourceTracker), rest logic (shared utility).

- Same buttons as Sheet's rest section.
- Available in play mode only.

### 5. Rest Action Flow (Shared Logic)

**Round Rest:**
- Prompt: "Roll a d6 for WP recovery"
- User enters result (number input)
- WP.current += entered value (capped at max)
- Toast: "Recovered X WP"

**Stretch Rest:**
- Prompt: "Roll a d6 for WP and a d6 for HP recovery"
- User enters both results
- WP.current = WP.max (full restore)
- HP.current += entered HP value (capped at max)
- Optionally: present condition list to clear one
- Toast: "Full WP, recovered X HP"

No in-app dice rolling -- physical dice only.

### 6. ReferenceScreen -- Two-Tier Pills (Updated)

**Owns:** Top-level category pills + expandable sub-section pills.
**Does NOT own:** Section content rendering (ReferenceSectionRenderer).

- Top pill row: same 4 categories (Combat & Time, Core Rules, NPCs & Animals, NPC Generator & Travel).
- Tapping a top pill expands a second row beneath it with sub-section pills for that category.
- Tapping a sub-section pill scrolls to that specific section.
- Only one category expanded at a time.
- Active sub-pill tracked via IntersectionObserver.

### 7. TopBar -- Mode Toggle Fix

**Owns:** Mode toggle button positioning.
**Does NOT own:** Mode state logic.

- Mode toggle gets its own dedicated slot in the top bar, not inside the actions button group.
- On narrow screens (<360px), collapse to icon-only (no label text).
- Must not overlap fullscreen/wake-lock/hamburger buttons at any viewport width.

### 8. Bottom Nav -- Configurable Tabs

**Owns:** Rendering visible tabs based on user settings.
**Does NOT own:** Screen content.

- All screens available via hamburger menu regardless of bottom nav configuration.
- Settings screen gets a "Bottom Navigation" section where users toggle which tabs appear.
- Default: Sheet, Skills, Gear, Magic, Combat, Reference (6 tabs).
- Profile available as optional 7th tab.
- Icon-only mode on small screens to fit more tabs.

### 9. End-of-Session Modal (NEW)

**Owns:** Session advancement checklist, advancement roll walkthrough, skill value updates.
**Does NOT own:** Dragon marks during play (SkillsScreen).

Triggered from hamburger menu option or a button on Sheet/Combat.

**Step 1 -- Session Checklist:**
- Checkboxes for Dragonbane session events (participated in combat, explored new location, role-played weakness, used heroic ability, etc.).
- Each checked box = 1 bonus advancement roll.

**Step 2 -- Assign Bonus Rolls:**
- Player picks which skills get bonus advancement rolls.
- Default filter: trained skills first. Toggle to show all skills.

**Step 3 -- Roll Through:**
- Presents each dragon-marked + bonus skill one at a time.
- Shows: skill name, current value, target ("roll above 14 on d20").
- Two buttons: **Pass** (value +1, clear mark) and **Fail** (clear mark only).

**Step 4 -- Summary:**
- Shows which skills advanced and by how much.
- "Done" button closes modal and clears all marks + advancement checks.

## Data Flow

```
CHARACTER RECORD (IndexedDB via Dexie)
  │
  ├── metadata.age ──────────────► SheetScreen (identity section)
  ├── metadata.weakness ─────────► SheetScreen (identity section)
  ├── metadata.appearance ───────► ProfileScreen (text area)
  ├── metadata.notes ────────────► ProfileScreen (text area)
  ├── portraitUri ───────────────► SheetScreen (thumbnail + lightbox modal)
  │                               ProfileScreen (hero image)
  │
  ├── attributes.STR ────────────► computeDamageBonus() ──► SheetScreen
  ├── attributes.AGL ────────────► computeAgilityDamageBonus() ──► SheetScreen
  │
  ├── conditions ────────────────► SkillsScreen (auto-bane detection)
  │   e.g. Dazed=true → AGL skills get auto-bane
  │   Boon + auto-bane = cancel to normal
  │   Bane + auto-bane = single bane (no stacking)
  │
  ├── skills[id].dragonMarked ───► SkillsScreen (mark toggle)
  │                               End-of-Session Modal (roll list)
  │
  └── advancementChecks ─────────► End-of-Session Modal (checklist)


SESSION STATE (AppStateContext, in-memory, ephemeral)
  │
  ├── globalBoonBane ────────────► SkillsScreen (top selector)
  └── skillOverrides[id] ───────► SkillsScreen (per-skill override)
                                    │
                              adjustedChance(value, effectiveBoonBane)
                                    │
                              Display: "Swords 14 AGL — 14% (26% boon)"


BOON/BANE PROBABILITY CALC (pure function)
  Base: skill.value% (roll ≤ value on d20)
  Boon: P = 1 - (1 - value/20)²    (roll 2d20, take lower)
  Bane: P = (value/20)²             (roll 2d20, take higher)


REST ACTIONS (play mode only, no in-app dice)
  Round Rest:
    1. Show prompt: "Roll a d6 for WP recovery"
    2. User enters d6 result
    3. WP.current += result (capped at max)
    4. Toast: "Recovered X WP"

  Stretch Rest:
    1. Show prompt: "Roll a d6 for WP and d6 for HP"
    2. User enters both results
    3. WP.current = WP.max
    4. HP.current += HP result (capped at max)
    5. Optional: pick one condition to clear
    6. Toast summary


ADVANCEMENT FLOW
  During play: tap dragon icon → skill.dragonMarked = true (persisted)
  End of session:
    1. Check session event boxes → count bonus rolls
    2. Assign bonus rolls to skills (trained filter, show-all toggle)
    3. Per marked skill: Pass → value +1, clear mark. Fail → clear mark.
    4. Summary → reset advancementChecks
```

## Error Handling

**Portrait upload:**
- Invalid file type → reject with toast "Please select an image file"
- Large images → compress/resize client-side before storing as data URI (cap ~500KB)
- No portrait → placeholder silhouette on both Sheet and Profile

**Boon/bane edge cases:**
- Skill value 1 (Dragon) → always succeeds; display shows adjusted % but note auto-success
- Skill value 20 → bane shows very low %; display honestly
- Condition auto-bane + manual bane → single bane (no double-bane in Dragonbane)
- Condition auto-bane + manual boon → cancel to normal roll

**Rest:**
- Rest when already full → button works, toast shows "Already at full WP/HP"
- Entered value exceeding remaining capacity → capped at max
- Rest buttons disabled in edit mode

**Advancement:**
- Skill at 18 (max) marked → appears in modal, Pass auto-skips with "Already at maximum"
- No marks + no session checks → modal shows "Nothing to advance this session"
- App closed mid-advancement → marks persist in IndexedDB; user re-triggers modal later
- Bonus roll assigned to already-marked skill → fine, one roll covers it

**Bottom nav:**
- All tabs hidden → hamburger menu always available as fallback
- Icon-only mode on screens <360px wide

**TopBar:**
- Narrow screens → mode toggle collapses to icon-only, no text label

## Open Questions

1. **AGL damage bonus formula:** Dragonbane has a STR-based damage bonus. Is there an official AGL-based damage bonus, or is this homebrew? Need to confirm formula and thresholds (same as STR: ≥17→+D6, ≥13→+D4, ≤12→+0?).

2. **Stretch rest condition clearing:** Dragonbane rules allow clearing one condition on stretch rest. Should the UI enforce "pick exactly one" or allow clearing multiple/none?

3. **Session event list:** The exact Dragonbane session checklist items need confirmation from the rulebook (combat participation, exploration, roleplay, heroic ability usage -- are there others?).

## Approaches Considered

### Approach A: Lightweight Enhancements
Add everything to existing screens with local `useState`. Boon/bane resets when navigating away. Rest is just manual buttons. Minimal architecture changes.
**Not selected:** Boon/bane resetting on navigation is a poor UX during play sessions.

### Approach B: Session State + New Screens (Selected)
Shared session state for boon/bane in AppStateContext. Profile as new screen. Rest on Sheet + Combat. Advancement persists to IndexedDB.
**Selected because:** Matches the session-oriented nature of play. Boon/bane persists across screen flips. Advancement marks survive app restarts. Clean separation of ephemeral session state vs. persistent character data.

### Approach C: Play Dashboard Hub
New dedicated "Play" screen consolidating boon/bane, rest, conditions, combat round counter. Other screens read from shared play state.
**Not selected:** Over-engineers what amounts to a toggle and two buttons. Adds navigation overhead without proportional value.

## Next Steps
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-22-sheet-enhancements-and-session-tools-design.md`)
- [ ] Confirm AGL damage bonus formula from Dragonbane rulebook
- [ ] Confirm exact session advancement checklist items from rulebook
- [ ] Implement features in priority order: TopBar fix → Sheet fields → Skills enhancements → Rest → Profile → Advancement → Reference pills → Configurable nav
