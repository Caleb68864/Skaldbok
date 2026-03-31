# Pre-Flight Report -- 2026-03-31T01-23-45-design-doc

**Date:** 2026-03-30 23:50
**Phase Specs Analyzed:** 11
**Status:** CRITICAL_ISSUES

## Summary

Analysis of all 11 phase specs against the existing Skaldmark codebase reveals 5 critical issues and 7 advisory issues. The most impactful critical issue is that SS-01 (Navigation Shell) and SS-03 (CampaignContext) reference incorrect file paths for key modifications -- the provider tree lives in `src/app/AppProviders.tsx`, not `src/main.tsx`, and the existing layout/nav components live at `src/components/layout/` and `src/app/AppLayout.tsx`, not at paths the specs expect. Additionally, a Tiptap package referenced in SS-06 does not exist in the Tiptap ecosystem.

## Critical Issues

### CRIT-1: SS-03 targets wrong file for provider insertion

- **Sub-Spec:** SS-03 -- CampaignContext Provider
- **Type:** missing file / incorrect target
- **Detail:** SS-03 Implementation Step 10 says to modify `src/main.tsx` to wrap `AppStateProvider` with `CampaignProvider`. However, the provider tree is assembled in `src/app/AppProviders.tsx` (lines 12-26), not in `src/main.tsx`. `src/main.tsx` merely renders `<AppProviders><App /></AppProviders>`. The `CampaignProvider` must be inserted into `AppProviders.tsx` inside the existing provider chain, between `ActiveCharacterProvider` and `ToastProvider` (or wrapping both). The Files table in SS-03 lists "Modify src/main.tsx" which is incorrect.
- **Impact:** Implementor will look for the provider tree in the wrong file, potentially inserting the provider in an ineffective location or creating a duplicate provider tree.
- **Suggested Fix:** Change SS-03 "Modify" target from `src/main.tsx` to `src/app/AppProviders.tsx`. Update Step 10 code example to show `CampaignProvider` placed inside the existing provider chain in `AppProviders.tsx`.

### CRIT-2: SS-01 conflicts with existing BottomNav and AppLayout

- **Sub-Spec:** SS-01 -- Navigation Shell Rebuild
- **Type:** conflicting changes / incorrect assumptions
- **Detail:** SS-01 creates new shell components at `src/components/shell/BottomNav.tsx`, `ShellLayout.tsx`, etc. However, `src/components/layout/BottomNav.tsx` already exists with a fully functional bottom nav implementation, and `src/app/AppLayout.tsx` already serves as the shell layout (TopBar + Outlet + BottomNav). SS-01 does not mention these existing files in its Files table as files to modify or delete. The route config at `src/routes/index.tsx` wraps all routes in `<AppLayout />`. After SS-01, both `AppLayout` and `ShellLayout` would exist, and the old `BottomNav` would still be imported by `AppLayout`.
- **Impact:** Without explicitly deprecating/removing `src/app/AppLayout.tsx` and `src/components/layout/BottomNav.tsx`, the app would have two competing layout shells and two bottom navs. Route restructuring would fail silently or render duplicated UI.
- **Suggested Fix:** Add `src/app/AppLayout.tsx` and `src/components/layout/BottomNav.tsx` to SS-01's Files table as "Modify" (replace contents/redirect) or "Delete". Update Step 6 to explicitly replace the `AppLayout` import in `src/routes/index.tsx` with `ShellLayout`. Also note that `src/components/layout/TopBar.tsx` will need to be accounted for.

### CRIT-3: SS-06 references non-existent Tiptap vim keymap package

- **Sub-Spec:** SS-06 -- Tiptap Editor Integration
- **Type:** missing dependency
- **Detail:** SS-06 specifies `@tiptap/extension-vim-keymap` as a required package (Steps 1 and 2). This package does not exist in the official Tiptap extension registry. There is no `@tiptap/extension-vim-keymap` on npm. The Tiptap ecosystem does not include a first-party vim mode extension. Community alternatives exist (e.g., `tiptap-extension-vim` or using CodeMirror's vim mode), but none match the import path specified.
- **Impact:** `npm install @tiptap/extension-vim-keymap` will fail. The dynamic import in Step 2 (`import('@tiptap/extension-vim-keymap')`) will always fail, meaning AC-S6-04 (vim mode toggle) cannot be satisfied as specified.
- **Suggested Fix:** Either (a) remove vim mode from SS-06 scope entirely (defer to a future sub-spec after researching viable vim extensions), or (b) replace with a real community package and update import paths accordingly. This should trigger Escalation Trigger #1 (new npm dependency beyond Tiptap core).

### CRIT-4: All existing screens use default exports but spec mandates named-only

- **Sub-Spec:** SS-01 -- Navigation Shell Rebuild
- **Type:** interface mismatch
- **Detail:** All 12 existing screen files (`SettingsScreen.tsx`, `SheetScreen.tsx`, `SkillsScreen.tsx`, `GearScreen.tsx`, `MagicScreen.tsx`, `CombatScreen.tsx`, `ReferenceScreen.tsx`, `ProfileScreen.tsx`, `CharacterLibraryScreen.tsx`, `PrintableSheetScreen.tsx`, `DraggableCardContainer.tsx`, `PrintableSheet.tsx`) use `export default function`. The route config at `src/routes/index.tsx` imports them as default imports. SS-01 Step 6 restructures the router to wrap routes in `ShellLayout` and remap character sub-routes, which means touching every import. Cross-cutting constraint XC-04 mandates "Named exports only -- no default exports in any new file." If the implementor only applies XC-04 to new files but leaves existing screens as default exports, the router imports will be inconsistent. If the implementor converts them to named exports, every screen file must be modified -- but SS-01's Files table does not list them.
- **Impact:** Router restructuring will either break imports (if screens are converted without updating all consumers) or create an inconsistency the TypeScript compiler may not catch (default imports work for named exports in some configs). Either way, the scope of SS-01 is underestimated.
- **Suggested Fix:** Add a note to SS-01 clarifying that existing screen default exports should be left as-is (grandfather clause per XC-03 precedent) and imported via their existing default import syntax. Only new files created by this spec use named exports. Alternatively, add all screen files to the Files table as "Modify" to convert to named exports, and acknowledge the expanded scope.

### CRIT-5: SS-11 combat typeData shape conflicts with SS-02 schema definition

- **Sub-Spec:** SS-11 -- Combat Event Timeline
- **Type:** interface contract mismatch
- **Detail:** SS-02 Step 5 defines the `combat` variant's `typeData` as `z.object({ rounds: z.array(z.unknown()), participants: z.array(z.unknown()) })` -- using `z.unknown()` for array elements. SS-11 Step 1 requires a much more detailed schema: `rounds` as an array of `{ roundNumber, events: CombatEvent[] }` and `participants` as an array of `{ id, name, type, linkedCharacterId? }`. Since SS-02 uses `z.unknown()`, records written by SS-11 will pass validation, but the Zod schema will not enforce the detailed structure, making AC-S4-04 (Zod validation on read) meaningless for combat notes. More critically, SS-11 says to "ensure" the combat variant schema is fully defined in `src/types/note.ts` (Files table: Modify `src/types/note.ts`), meaning SS-11 must retroactively modify SS-02's output.
- **Impact:** If SS-02 is implemented first with `z.unknown()` arrays, then SS-11 modifies the schema later, any combat notes written between SS-02 and SS-11 (unlikely in practice, but architecturally unclean) could fail validation. More practically, the SS-02 implementor does not have the information to write the full schema, and the SS-11 implementor must modify a file "owned" by SS-02.
- **Suggested Fix:** Move the detailed `CombatEvent` and `CombatTypeData` schemas into SS-02's scope (Step 5), or explicitly note in SS-02 that the combat `typeData` is intentionally loose and will be tightened by SS-11. Add an interface contract between SS-02 and SS-11 documenting this handoff.

## Advisory Issues

### ADV-1: Existing BottomNav uses className-based styling (grandfathered but notable)

- **Sub-Spec:** SS-01 -- Navigation Shell Rebuild
- **Type:** convention
- **Detail:** The existing `src/components/layout/BottomNav.tsx` uses `className="bottom-nav"` and CSS class-based styling throughout. XC-03 requires inline `style={{}}` with CSS variables for new files. The new `src/components/shell/BottomNav.tsx` must use inline styles, which is fine for new code, but the coexistence of both patterns during migration could cause confusion.
- **Recommendation:** SS-01 implementation notes should explicitly state that the new shell components follow inline style conventions and the old layout components are being replaced, not extended.

### ADV-2: SS-03 CampaignContext does not expose refreshParty but SS-08 needs it

- **Sub-Spec:** SS-08 -- Party Model & Member Management
- **Type:** coverage gap
- **Detail:** SS-03 defines `CampaignContextValue` with `startSession`, `endSession`, and `setActiveCampaign`. SS-08 Step 5 requires adding a `refreshParty()` action to `CampaignContext`. This means SS-08 modifies SS-03's output file (`src/features/campaign/CampaignContext.tsx`), extending the context interface. This is documented in SS-08 but not in SS-03's interface contracts.
- **Recommendation:** Add a note in SS-03 that the `CampaignContextValue` interface is extensible and will be augmented by SS-08 (adding `refreshParty`). This sets the correct expectation for the SS-03 implementor to keep the interface open.

### ADV-3: SS-06 Tiptap mention suggestion renderer needs DOM manipulation not covered by inline styles

- **Sub-Spec:** SS-06 -- Tiptap Editor Integration
- **Type:** convention tension
- **Detail:** The Tiptap `Mention` extension's `suggestion.render()` callback requires creating and appending DOM elements for the suggestion popup. This typically involves creating a floating div with absolute positioning and appending it to the DOM. The XC-03 inline style constraint applies, but Tiptap's suggestion plugin operates outside React's render cycle, making pure `style={{}}` patterns inapplicable. The implementor will need to use `element.style.xxx = ...` in vanilla JS within the render callback.
- **Recommendation:** Acknowledge in SS-06 that the mention suggestion renderer may use imperative `element.style` assignments (vanilla DOM) while still using CSS variable values. This is not a violation of XC-03 -- it is a necessary adaptation for Tiptap's plugin system.

### ADV-4: SS-05 bundleToZip requires JSZip installation not tracked in any phase spec

- **Sub-Spec:** SS-05 -- Export Utilities (Pure Functions)
- **Type:** missing step
- **Detail:** SS-05 Step 6 imports `JSZip from 'jszip'`, but no phase spec includes a step to `npm install jszip`. SS-06 has a step to install Tiptap packages and modify `package.json`, but SS-05 does not. JSZip is pre-approved (XC-07), so this is not an escalation trigger, but the installation step is missing.
- **Recommendation:** Add an explicit "Install jszip" step to SS-05, or note that the implementor should add `jszip` to `package.json` as part of Step 6.

### ADV-5: SS-09 Quick Note/NPC spec says "without typing" but both require a text input

- **Sub-Spec:** SS-09 -- Notes Hub & Quick Capture
- **Type:** clarity
- **Detail:** The spec intent says "Quick Note and Quick NPC flows must complete without typing (tap-only for required fields)." However, AC-S9-02 requires "title (text input)" as a required field, and AC-S9-03 requires "name (text input)". A text input inherently requires typing. The acceptance criteria and the intent are contradictory.
- **Recommendation:** Clarify the intent: the likely meaning is "no typing required for choosing the note type" (tap a Quick Note or Quick NPC button), not "zero typing for the entire flow." Update the intent sentence to match, e.g., "Quick Note and Quick NPC flows must require minimal typing -- only the title/name field."

### ADV-6: SS-08 adds activeCharacterMemberId to Campaign type but SS-02 does not include it

- **Sub-Spec:** SS-08 -- Party Model & Member Management
- **Type:** schema evolution
- **Detail:** SS-08 Step 2 proposes storing "my character" as `campaign.activeCharacterMemberId` on the Campaign record. SS-02 defines the Campaign interface without this field. SS-08's Files table correctly lists "Modify src/types/campaign.ts" to add this field. Since Dexie is schemaless for non-indexed fields, this is safe at the storage level. However, the Zod `campaignSchema` (created in SS-02) will reject records containing this field unless the schema uses `.passthrough()` or is updated.
- **Recommendation:** Either (a) add `activeCharacterMemberId?: string` to SS-02's Campaign schema as an optional field upfront, or (b) ensure SS-08 also updates the Zod schema in `src/types/campaign.ts`, not just the TypeScript interface.

### ADV-7: SS-11 scope may exceed 90-minute estimate

- **Sub-Spec:** SS-11 -- Combat Event Timeline
- **Type:** scope
- **Detail:** SS-11 requires: a new CombatTimeline component with round management and event logging, an AbilityPicker that reads character heroic abilities, a SpellPicker that reads spells from all party members with WP display and dimming logic, quick-add spell functionality, combat note persistence with typeData round-trip, and integration into SessionScreen. This is the most complex sub-spec in the set and includes two data-reading pickers that query across character and party data.
- **Recommendation:** Monitor implementation time closely. If SS-11 starts to exceed scope, consider splitting the SpellPicker (AC-S11-06) into a follow-up sub-spec, since it depends on party data and is the most complex component.

## File Conflict Map

| File | Sub-Specs Touching | Conflict Risk |
|------|-------------------|---------------|
| `src/storage/db/client.ts` | SS-02 | none |
| `src/app/AppProviders.tsx` | SS-03 (should be here, not main.tsx) | none |
| `src/main.tsx` | SS-03 (incorrectly targeted) | none |
| `src/routes/index.tsx` | SS-01, SS-07, SS-09 | **HIGH** |
| `src/types/campaign.ts` | SS-02, SS-08 | low |
| `src/types/note.ts` | SS-02, SS-11 | **HIGH** |
| `src/screens/SettingsScreen.tsx` | SS-06 | none |
| `src/screens/SessionScreen.tsx` | SS-07, SS-10, SS-11 | **HIGH** |
| `src/features/campaign/CampaignContext.tsx` | SS-03, SS-08 | low |
| `src/features/campaign/CampaignCreateModal.tsx` | SS-07, SS-08 | low |
| `src/features/notes/useNoteActions.ts` | SS-04, SS-09 | low |
| `src/components/shell/CampaignHeader.tsx` | SS-01, SS-07 | low |
| `package.json` | SS-05 (jszip), SS-06 (tiptap) | low |
| `src/app/AppLayout.tsx` | SS-01 (needs deprecation) | **HIGH** |
| `src/components/layout/BottomNav.tsx` | SS-01 (needs deprecation) | **HIGH** |

## Interface Contract Verification

| Provider (Sub-Spec) | Consumer (Sub-Spec) | Contract | Status |
|---------------------|---------------------|----------|--------|
| SS-02 (Dexie schema + Zod types) | SS-03 (CampaignContext) | Campaign, Session, Party types available in `src/types/` | MATCH |
| SS-02 (Dexie schema + Zod types) | SS-04 (Repositories) | All 6 tables queryable; Zod schemas importable | MATCH |
| SS-02 (Dexie schema + Zod types) | SS-05 (Export utils) | Note, Session, Campaign, EntityLink types importable | MATCH |
| SS-02 (combat typeData schema) | SS-11 (Combat Timeline) | `typeData` shape for combat notes | **MISMATCH** -- SS-02 uses `z.unknown()`, SS-11 needs structured schema |
| SS-03 (CampaignContext) | SS-04 (useNoteActions) | `useCampaignContext()` returns `{ activeCampaign, activeSession }` | MATCH |
| SS-03 (CampaignContext) | SS-07 (Campaign CRUD) | `startSession()`, `endSession()`, `setActiveCampaign()` available | MATCH |
| SS-03 (CampaignContext) | SS-08 (Party Model) | `activeParty` available; `refreshParty()` NOT provided by SS-03 | **MISMATCH** -- SS-08 must extend SS-03 |
| SS-04 (Repositories) | SS-06 (Tiptap mention) | `getNotesByCampaign()` available for typeahead query | MATCH |
| SS-04 (useNoteActions) | SS-09 (Notes Hub) | `{ createNote, linkNote, pinNote, unpinNote }` returned | MATCH |
| SS-05 (Export utils) | SS-10 (Export Delivery) | `renderNoteToMarkdown`, `renderSessionBundle`, `bundleToZip`, `shareFile`, `copyToClipboard` all importable | MATCH |
| SS-01 (ShellLayout + routes) | SS-07 (SessionScreen) | `/session` route exists inside ShellLayout | MATCH |
| SS-01 (ShellLayout + routes) | SS-09 (NotesScreen) | `/notes` route exists inside ShellLayout | MATCH |
| SS-07 (SessionScreen) | SS-10 (Export Delivery) | Export buttons rendered in SessionScreen | MATCH |
| SS-07 (SessionScreen) | SS-11 (Combat Timeline) | "Start Combat" button rendered in SessionScreen when session active | MATCH |
| SS-08 (Party Model) | SS-11 (Spell Picker) | `activeParty.members` with `linkedCharacterId` available | MATCH |

## Verdict

CRITICAL_ISSUES: 5 critical issues must be resolved before proceeding. See details above. The most impactful are CRIT-1 (wrong file target for CampaignProvider), CRIT-2 (existing layout not accounted for in shell rebuild), and CRIT-3 (non-existent Tiptap vim package). CRIT-4 and CRIT-5 are scope/contract issues that can be resolved with spec amendments.
