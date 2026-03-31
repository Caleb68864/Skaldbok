# Skaldmark Issues List

Collected during manual testing. To be brainstormed and fixed later.

---

## Issue 1: Manage Party drawer does not add characters without campaign

**Screen:** Manage Party Drawer
**Severity:** UX bug
**Description:** Clicking character names in the "Add Character" list does nothing — characters cannot be assigned to the party. This is likely because no campaign (and therefore no party record) exists yet. There is no feedback explaining why it doesn't work.

**Confirmed:** Adding party members works after creating a campaign. The issue is purely missing feedback — clicks silently do nothing when no campaign exists.

**Expected behavior:**
- If no campaign exists, show a notification/toast explaining that a campaign is required first
- Optionally, offer a quick action to create a campaign from within the drawer (inline modal or redirect)
- If a campaign exists but no party record, auto-create the party on first add attempt

**Screenshot:** `.claude/image-cache/dce66920-3904-4226-82eb-1962752bcb98/1.png`

---

## Issue 2: Quick Skill Check "For Who?" selector — Party not selectable + needs multi-select

**Screen:** Session Quick Actions > Skill Check
**Severity:** Feature gap / UX bug
**Description:** Two problems with the "For Who?" character selector on quick skill checks:

1. **"Party" option doesn't work** — cannot select the whole party as the target for a skill check
2. **Single-select only** — currently only one character can be selected at a time. Should be multi-select.

**Expected behavior:**
- Clicking "Party" selects all party members at once
- If all members are already selected, clicking "Party" deselects all (toggle behavior)
- Individual character names are toggleable — click to select, click again to deselect
- Multiple characters can be selected simultaneously (multi-select, not radio buttons)
- The skill check log should record which characters were involved

**Also affects:** Shopping quick action — Party button doesn't work there either. Likely a shared component issue across all quick actions that have a "For Who?" selector.

---

## Issue 3: Shopping quick action needs coin calculator UI

**Screen:** Session Quick Actions > Shopping
**Severity:** Feature request / UX improvement
**Description:** The shopping quick action currently uses a plain text field for cost. It should have a proper coin calculator setup.

**Expected behavior:**
- Number sliders (or steppers) for Gold, Silver, and Copper instead of a single text field
- A quantity field to set how many of the item are being purchased
- Auto-calculated total cost (unit price x quantity) displayed clearly
- Dragonbane uses Gold/Silver/Copper denominations — the UI should reflect this with labeled inputs for each coin type
- Total should show the full breakdown (e.g., "2 gold, 5 silver, 0 copper")

---

## Issue 4: Merge Notes tab into Session screen — notes grid with filtering

**Screen:** Notes Screen / Session Screen
**Severity:** UX redesign
**Description:** The quick note creation actions on the Session screen make the separate Notes tab feel redundant. The Notes tab should be merged into the Session screen, with a much better browsing/filtering experience.

**Expected behavior:**
- Move note creation and browsing into the Session screen (remove or repurpose the standalone Notes tab)
- Add a notes grid/list view within the session that shows all notes created in the current session
- Notes should be openable for viewing or editing (tap to expand/open editor)
- Checkbox or toggle to "Show notes from other sessions" — when enabled, displays notes from all sessions in the campaign
- Strong filtering capabilities:
  - Filter by note type (NPC, Location, Loot, Quest, etc.)
  - Filter by tags
  - Search (already have MiniSearch wired up)
  - Filter by session
  - Sort by date, name, type
- Grid layout preferred over a simple list — better visual density and scanability

---

## Issue 5: Link Note feature — confusing and likely redundant

**Screen:** Notes Screen > Link Note button
**Severity:** UX / redundancy
**Description:** "Link Note" opens a drawer that associates existing notes with the current active session via entity links. It only shows notes not yet linked to the session. In practice, clicking it often seems to "do nothing" because either there's no active session (silently fails) or all notes are already linked.

**How it currently works:** Creates an entity link record (relationship type `linked_to`) between a note and the active session. This is separate from the `sessionId` field on notes — it's an additional cross-reference.

**Recommendation:** If Issue 4 (merge notes into session screen with filtering) is implemented, Link Note becomes redundant. Notes would naturally be viewable/filterable by session without explicit linking. Consider removing Link Note entirely as part of the Issue 4 redesign.

---

## Issue 6: Remove Combat tab from character sub-nav — redundant with combat tracker

**Screen:** Character > Combat tab (`/character/combat`)
**Severity:** UX cleanup / simplification
**Description:** The Combat tab under the character sub-nav duplicates functionality that already exists on the main Sheet screen and in the session combat tracker. It shows HP/WP resources, conditions, equipment toggles, death rolls, and rest actions — most of which are already on the Sheet or handled by the combat timeline during active combat.

**Expected behavior:**
- Remove the `/character/combat` route and Combat tab from the character sub-nav
- Audit what's unique to the Combat screen (if anything) and move it to the main Sheet screen:
  - HP/WP resources — already on Sheet
  - Conditions — already on Sheet
  - Equipment toggles — could live on Gear screen or Sheet
  - Death rolls — move to Sheet (only visible at HP 0)
  - Rest actions (Round/Stretch/Shift Rest) — move to Sheet
- The session-level combat tracker (Combat Timeline) remains unchanged — that's where active combat is managed during play

---

## Issue 7: Rest actions and condition changes not logged in session notes

**Screen:** Character Sheet / Combat (rest buttons, condition toggles)
**Severity:** Missing feature
**Description:** When a character rests (Round Rest, Stretch Rest, Shift Rest) or gains/loses conditions, these events are not recorded in the session notes/log. During play these are important events that should be tracked.

**Expected behavior:**
- Resting should create a session log entry (e.g., "Leroy took a Stretch Rest — recovered 4 WP, 5 HP")
- Condition changes should be logged (e.g., "Leroy became Exhausted", "Leroy recovered from Dazed")
- Logs should capture the mechanical outcome, not just the action

---

## Issue 8: Coin changes create excessive note spam — needs batching/summary

**Screen:** Character Sheet / Gear (coin counters)
**Severity:** UX problem
**Description:** Each individual coin increment/decrement creates a separate note entry. Clicking the gold up arrow 10 times produces 10 notes saying "gained 1 gold" instead of one note saying "gained 10 gold." This clutters the session log with noise.

**Expected behavior:**
- Batch rapid coin changes into a single log entry — e.g., debounce coin changes over a short window (2-5 seconds) and log the net change as one entry
- Log entry should show the net result: "Leroy gained 10 gold" or "Leroy spent 3 gold, 5 silver"
- Alternatively, don't auto-log individual coin taps at all — instead log coin changes only when triggered through the Shopping quick action or a manual "log transaction" button
- Consider a session-level "economy summary" that shows net coin changes for the session rather than individual ticks

---

## Issue 9: Skills page — dragon/demon mark tracking + session integration + inline roll logging

**Screen:** Character > Skills (`/character/skills`)
**Severity:** Feature request / UX improvement
**Description:** Three related improvements needed for the Skills page:

**9a: Dragon mark toggle should also track Demon (bane) rolls**
- Currently the icon only toggles dragon mark on/off (2 states)
- Should be a triple-click cycle: (1) Dragon mark, (2) Demon mark, (3) Clear
- Visual distinction between dragon (positive) and demon (negative) icons/colors

**9b: Skills page should update when a skill roll is logged from the Session tab**
- If a skill check is logged via Session quick actions, the Skills page should reflect it (e.g., show the dragon/demon mark, update roll history)
- Currently there's no cross-screen sync — rolling from Session doesn't update the Skills page state

**9c: Allow logging a skill roll directly from the Skills page**
- Add an action on each skill row (tap/button) to log a skill check result from within the character Skills screen
- Should create the same session log entry as the Session quick action skill check
- Useful when the GM calls for a roll and the player is already on their character sheet

---

## Issue 10: Global quick-action FAB (dice button) — accessible from any screen

**Screen:** All screens (bottom-left dice icon)
**Severity:** Feature request / UX improvement
**Description:** The little dice icon in the lower left should open a quick menu that allows logging any session event type from any screen — not just from the Session tab. Currently, to log a skill check, spell cast, shopping event, etc., you have to navigate to the Session screen first.

**Expected behavior:**
- Tapping the dice FAB opens a quick-action menu/drawer with all event types: Skill Check, Cast Spell, Ability, Condition, Damage, Rest, Shopping, Encounter, Loot, Quote, Rumor, etc.
- Selecting an event type opens the same log drawer/modal as the Session quick actions
- Works from any screen (Character Sheet, Skills, Gear, Magic, etc.)
- Only active when a session is running — if no active session, show a toast or prompt to start one
- Logged events still appear in the session timeline/notes as normal
- This makes Issue 9c (logging skill rolls from Skills page) a natural subset of this feature

---

## Issue 11: Quick Note body editor — tiny input, Tiptap toolbar missing

**Screen:** Quick Note Drawer
**Severity:** UX bug
**Description:** The body editor in the Quick Note drawer renders as a single-line input that's hard to click/tap. The Tiptap rich text editor toolbar (bold, italic, lists, etc.) is not visible. It looks like a plain empty box with no formatting controls.

**Expected behavior:**
- The body field should be a proper textarea or Tiptap editor with visible minimum height (at least 4-6 lines)
- Tiptap toolbar should be visible above the editor with formatting buttons (bold, italic, bullet list, etc.)
- Editor area should be clearly tappable with adequate hit target size
- If Tiptap is failing to render, fall back to a plain `<textarea>` rather than showing a broken single-line input

**Screenshot:** `.claude/image-cache/dce66920-3904-4226-82eb-1962752bcb98/3.png`

---

## Issue 12: No full note editor — need a dedicated rich-text editing modal/screen

**Screen:** Notes (all note types)
**Severity:** Missing feature
**Description:** There is no way to open a note in a full rich-text editor. Quick Note drawers are meant to be fast/lightweight, which is fine — but there's no "next level" editor for when you want to write longer content with formatting. Once a note is created, there's no way to go back and edit it with a proper editor either.

**Expected behavior:**
- A dedicated full-screen or large modal note editor with full Tiptap toolbar (bold, italic, headings, bullet/numbered lists, blockquotes, links, etc.)
- Accessible by tapping on an existing note to open it for editing
- Also available as a "New Note" action for when you want to write something more substantial than a quick note
- Quick Note drawers can stay basic/lightweight — they're for fast capture during play
- The full editor is for fleshing out notes between sessions or writing detailed recaps, NPC backstories, location descriptions, etc.
- Should support all note metadata: title, type, tags, attachments, body

---

## Issue 13: @-mentions render as raw UUIDs instead of display names

**Screen:** Quick Note / Note editor (Tiptap)
**Severity:** Bug
**Description:** When using @-mentions in a note, the editor inserts the raw entity UUID (e.g., `@1d0a54b4-d43d-4b0f-bc59-20a47debd7a3`) instead of the human-readable name that was selected from the suggestion dropdown. The mention should show the character/NPC/location name, not the internal ID.

**Expected behavior:**
- @-mention should display the selected name (e.g., `@Leroy`) in the editor, styled as a mention chip/tag
- The underlying data can store the UUID for linking, but the rendered text must show the display name
- Mentions should be visually distinct (highlighted, different color, chip-style) so they're clearly interactive/linked
- If the referenced entity is later deleted, fall back to the display name text (not the UUID)

**Screenshot:** `.claude/image-cache/dce66920-3904-4226-82eb-1962752bcb98/4.png`

---

## Issue 14: No way to create custom tags — tag list is hardcoded

**Screen:** Quick Note / Quick NPC / Quick Location (Tag Picker)
**Severity:** Missing feature
**Description:** The tag picker only shows a fixed set of predefined tags (tense, funny, dramatic, combat, exploration, lore, treasure, etc.). There is no way to create a custom tag. Users should be able to add their own tags for campaign-specific categorization.

**Expected behavior:**
- Add a text input or "+" button in the tag picker to create a new custom tag
- Custom tags should be saved and appear in the tag picker for future notes
- Custom tags could be stored per-campaign or globally
- Existing predefined tags remain as defaults/suggestions
- Consider an "autocomplete" style input — type to filter existing tags, and if no match, offer to create a new one

---

## Issue 15: @-mention dropdown — arrow key selection doesn't work

**Screen:** Quick Note / Note editor (Tiptap mention suggestions)
**Severity:** Bug
**Description:** When the @-mention suggestion dropdown appears, arrow keys (up/down) do not navigate the suggestion list. Users cannot keyboard-select a mention — they must use the mouse/tap.

**Expected behavior:**
- Up/Down arrow keys navigate through the suggestion list
- Enter key selects the highlighted suggestion
- Standard accessible combobox/autocomplete keyboard behavior

---

## Issue 16: Reference screen only accessible from Settings — should be in bottom nav

**Screen:** Reference / Settings / Bottom Navigation
**Severity:** UX bug
**Description:** The Reference screen (Dragonbane rules quick-reference) is currently only reachable through the Settings screen. It should be a top-level destination accessible from the bottom navigation bar, since it's something players and GMs need to look up frequently during play.

**Expected behavior:**
- Add a Reference icon/tab to the bottom navigation bar
- Reference screen should be directly accessible from any screen without going through Settings
- Remove or keep the Settings link as a secondary path, but bottom nav should be the primary way to reach it

---

## Issue 17: Session markdown and zip export fails — Permission denied

**Screen:** Session Export
**Severity:** Bug
**Description:** Exporting a session as markdown or as a zip bundle fails with `NotAllowedError: Permission denied`. Both `useExportActions.exportSessionMarkdown` and `useExportActions.exportSessionBundle` throw this error. Likely related to the File System Access API requiring a user gesture or falling back to a download approach when permissions aren't available.

**Console errors:**
```
useExportActions.exportSessionMarkdown failed: NotAllowedError: Permission denied
useExportActions.exportSessionBundle failed: NotAllowedError: Permission denied
```

**Expected behavior:**
- Export should work reliably — either via File System Access API with proper user gesture handling, or fallback to a Blob download approach
- If the browser doesn't support the File System Access API, use `<a download>` or `URL.createObjectURL` as a fallback
