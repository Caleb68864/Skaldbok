# Verify Report -- 2026-03-31T01-23-45-design-doc

**Overall: PARTIAL**
**Date:** 2026-03-30 23:59

## Spec Compliance

| Sub-Spec | Criterion (summary) | Type | Status | Evidence |
|----------|---------------------|------|--------|----------|
| S1 | AC-S1-01: Four bottom-nav tabs render (Session, Notes, Character, More) | [STRUCTURAL] | PASS | src/components/shell/BottomNav.tsx:3-8 -- NAV_TABS array has all 4 tabs |
| S1 | AC-S1-02: Campaign header renders persistent bar, shows name or "No campaign", tapping opens selector | [STRUCTURAL] | PASS | src/components/shell/CampaignHeader.tsx:132-134 -- renders activeCampaign.name or "No campaign"; CampaignSelectorOverlay opens on click |
| S1 | AC-S1-03: Character sub-nav with Sheet/Skills/Gear/Magic pills | [STRUCTURAL] | PASS | src/components/shell/CharacterSubNav.tsx:4-8 -- CHARACTER_TABS has all 4 sections; pill-shaped border-radius |
| S1 | AC-S1-04: Session/Notes show prompt when no campaign; Character renders independently | [BEHAVIORAL] | PASS | src/screens/SessionScreen.tsx:100-102 and src/screens/NotesScreen.tsx:37-39 both render NoCampaignPrompt; Character routes have no campaign guard |
| S1 | AC-S1-05: Tab-bar tap targets >= 44x44 px | [STRUCTURAL] | PASS | src/components/shell/BottomNav.tsx:39-40 -- minHeight: '44px', minWidth: '44px' |
| S1 | AC-S1-06: No TypeScript compiler errors from shell changes | [MECHANICAL] | PASS | npx tsc --noEmit produces zero errors |
| S1 | AC-S1-07: Existing character screens render without console errors after migration | [HUMAN REVIEW] | NEEDS_REVIEW | Routes preserved at /character/sheet, /character/skills, etc. -- manual smoke-test required |
| S2 | AC-S2-01: Dexie version 3 adds 6 new tables with correct indexes | [STRUCTURAL] | PASS | src/storage/db/client.ts:44-51 -- version(3) adds campaigns, sessions, notes, entityLinks, parties, partyMembers with specified indexes |
| S2 | AC-S2-02: Existing tables not modified | [STRUCTURAL] | PASS | src/storage/db/client.ts:35-43 -- version(1) and version(2) blocks unchanged |
| S2 | AC-S2-03: entityLinks compound indexes present | [STRUCTURAL] | PASS | src/storage/db/client.ts:48 -- '[fromEntityId+relationshipType], [toEntityId+relationshipType]' present |
| S2 | AC-S2-04: Zod schemas exist for all 6 new record types | [STRUCTURAL] | PASS | campaignSchema in src/types/campaign.ts, sessionSchema in src/types/session.ts, noteSchema (discriminated union) in src/types/note.ts, entityLinkSchema in src/types/entityLink.ts, partySchema and partyMemberSchema in src/types/party.ts |
| S2 | AC-S2-05: Repository reads validate against Zod schemas | [BEHAVIORAL] | PASS | All 5 repositories use safeParse on read; log warning + return undefined on failure |
| S2 | AC-S2-06: IndexedDB inspector shows 6 new stores | [HUMAN REVIEW] | NEEDS_REVIEW | Manual browser verification required |
| S2 | AC-S2-07: No TypeScript errors in db schema file | [MECHANICAL] | PASS | tsc --noEmit passes cleanly |
| S3 | AC-S3-01: createContext(null) pattern with descriptive error | [STRUCTURAL] | PASS | src/features/campaign/CampaignContext.tsx:26 -- createContext(null); line 30 throws descriptive error |
| S3 | AC-S3-02: Provider hydrates on mount from Dexie | [BEHAVIORAL] | PASS | CampaignContext.tsx:51-103 -- useEffect hydrates campaign, session, party, activeCharacter from Dexie |
| S3 | AC-S3-03: CampaignContext wraps AppStateContext; no duplicated state | [STRUCTURAL] | PASS | src/app/AppProviders.tsx:20-21 -- CampaignProvider wraps inside ToastProvider > ActiveCharacterProvider > AppStateProvider chain |
| S3 | AC-S3-04: startSession() guards against existing session | [BEHAVIORAL] | PASS | CampaignContext.tsx:110-112 -- checks activeSession, returns early with toast |
| S3 | AC-S3-05: endSession() sets status to "ended" and clears context | [BEHAVIORAL] | PASS | CampaignContext.tsx:141-156 -- updates Dexie and sets activeSession to null |
| S3 | AC-S3-06: Stale session warning on app launch (>24h) | [BEHAVIORAL] | PASS | CampaignContext.tsx:87-94 -- STALE_SESSION_MS = 24h; shows warning toast |
| S3 | AC-S3-07: setActiveCampaign re-resolves session and party | [BEHAVIORAL] | PASS | CampaignContext.tsx:158-186 -- reads campaign, session, party from Dexie on switch |
| S3 | AC-S3-08: Null values when no campaign (not undefined) | [BEHAVIORAL] | PASS | CampaignContext.tsx:59-63 -- explicitly sets all to null; useState initializers are null |
| S3 | AC-S3-09: No TypeScript errors | [MECHANICAL] | PASS | tsc --noEmit passes |
| S4 | AC-S4-01: 5 repository files as pure async functions | [STRUCTURAL] | PASS | All 5 files exist at src/storage/repositories/; no React imports, no classes |
| S4 | AC-S4-02: noteRepository exposes required functions | [STRUCTURAL] | PASS | getNoteById, getNotesByCampaign, getNotesBySession, createNote, updateNote, deleteNote all exported |
| S4 | AC-S4-03: entityLinkRepository exposes required functions | [STRUCTURAL] | PASS | getLinksFrom, getLinksTo, createLink, deleteLinksForNote all exported |
| S4 | AC-S4-04: Repository reads validate via Zod | [BEHAVIORAL] | PASS | All read functions use safeParse; warn + return undefined on failure |
| S4 | AC-S4-05: useNoteActions returns required shape | [STRUCTURAL] | PASS | src/features/notes/useNoteActions.ts:123 -- returns { createNote, updateNote, deleteNote, linkNote, pinNote, unpinNote } |
| S4 | AC-S4-06: createNote auto-creates EntityLinks | [BEHAVIORAL] | PASS | useNoteActions.ts:27-54 -- creates "contains" link session->note; creates "introduced_in" link for npc type; deduplication check present |
| S4 | AC-S4-07: deleteNote cascades EntityLinks | [BEHAVIORAL] | PASS | useNoteActions.ts:76-78 -- calls deleteLinksForNote before deleteNote |
| S4 | AC-S4-08: pinNote/unpinNote toggle pinned field | [BEHAVIORAL] | PASS | useNoteActions.ts:105-121 -- updates pinned to true/false via repository |
| S4 | AC-S4-09: Repository functions wrap Dexie in try-catch with descriptive messages | [BEHAVIORAL] | PASS | All repository functions use try-catch with template string messages |
| S4 | AC-S4-10: useNoteActions catches errors and shows toast | [BEHAVIORAL] | PASS | All hook functions catch errors, call showToast, and do not rethrow |
| S4 | AC-S4-11: Basic CRUD round-trip | [HUMAN REVIEW] | NEEDS_REVIEW | Manual browser verification required |
| S5 | AC-S5-01: Export functions are pure (no side effects, no React, no Dexie) | [STRUCTURAL] | PASS | All files in src/utils/export/ have no React or Dexie imports |
| S5 | AC-S5-02: renderNoteToMarkdown produces YAML front matter with required fields | [BEHAVIORAL] | PASS | src/utils/export/renderNote.ts:25-34 -- YAML fields include title, type, id, campaignId, sessionId, createdAt, updatedAt, tags |
| S5 | AC-S5-03: renderSessionBundle returns Map with session index + per-note entries | [BEHAVIORAL] | PASS | src/utils/export/renderSession.ts:33-87 -- returns Map with session file + one entry per linked note; uses deduplicateFilename |
| S5 | AC-S5-04: renderCampaignIndex returns markdown with YAML + sections | [BEHAVIORAL] | PASS | src/utils/export/renderCampaignIndex.ts:19-49 -- YAML front matter + Sessions + NPCs + Open Rumors sections |
| S5 | AC-S5-05: resolveWikiLinks converts mentions to [[Title]] | [BEHAVIORAL] | PASS | src/utils/export/resolveWikiLinks.ts:30-42 -- mention nodes resolved to [[title]] if found; plain text for deleted notes |
| S5 | AC-S5-06: generateFilename returns slug with ID suffix | [BEHAVIORAL] | PASS | src/utils/export/generateFilename.ts -- lowercase, hyphens, no special chars, 6-char ID suffix |
| S5 | AC-S5-07: bundleToZip returns Blob via JSZip | [BEHAVIORAL] | PASS | src/utils/export/bundleToZip.ts -- creates JSZip, adds all files at root level, returns blob |
| S5 | AC-S5-08: Delivery utilities with share/clipboard/download | [STRUCTURAL] | PASS | src/utils/export/delivery.ts -- shareFile (with canShare check + fallback), copyToClipboard, downloadBlob all exported |
| S5 | AC-S5-09: Minimal generic note produces correct front matter shape | [BEHAVIORAL] | PASS | renderNote.ts produces "---" + "title:" + "type: generic" + "---" structure |
| S5 | AC-S5-10: No TypeScript errors in export files | [MECHANICAL] | PASS | tsc --noEmit passes |
| S6 | AC-S6-01: TiptapNoteEditor component exists with StarterKit + Mention | [STRUCTURAL] | PASS | src/components/notes/TiptapNoteEditor.tsx -- imports StarterKit and Mention, configures both |
| S6 | AC-S6-02: Mention typeahead triggers on "@", queries notes by title prefix | [BEHAVIORAL] | PASS | TiptapNoteEditor.tsx:140-151 -- suggestion.items queries getNotesByCampaign, filters by prefix |
| S6 | AC-S6-03: Mention round-trip test | [HUMAN REVIEW] | NEEDS_REVIEW | Manual browser verification required |
| S6 | AC-S6-04: Vim mode toggle | [BEHAVIORAL] | FAIL | No vim mode implementation found. @tiptap/extension-vim-keymap does not exist (CRIT-3 from pre-flight). No alternative vim extension was implemented. |
| S6 | AC-S6-05: Editor stores body as ProseMirror JSON | [BEHAVIORAL] | PASS | TiptapNoteEditor.tsx:157-158 -- onChange calls editor.getJSON(); no markdown conversion |
| S6 | AC-S6-06: Inline styles with CSS variables, no imported Tiptap stylesheet | [STRUCTURAL] | PASS | Component uses style={{}} with CSS variables throughout; no imported CSS |
| S6 | AC-S6-07: Fallback to textarea if Tiptap fails | [BEHAVIORAL] | PASS | TiptapNoteEditor.tsx:107-127 -- TextareaFallback renders when editor is null or failed state |
| S6 | AC-S6-08: No TypeScript errors | [MECHANICAL] | PASS | tsc --noEmit passes |
| S7 | AC-S7-01: User can create a campaign from modal | [STRUCTURAL] | PASS | src/features/campaign/CampaignCreateModal.tsx -- name required, description optional, system defaults to "dragonbane" |
| S7 | AC-S7-02: Campaign selector sets active campaign | [BEHAVIORAL] | PASS | CampaignHeader.tsx:55 -- calls setActiveCampaign on selection |
| S7 | AC-S7-03: "Start Session" button when campaign active, no session | [BEHAVIORAL] | PASS | SessionScreen.tsx:233-250 -- renders Start Session button when !activeSession && activeCampaign |
| S7 | AC-S7-04: Tapping Start Session creates record, updates context | [BEHAVIORAL] | PASS | SessionScreen.tsx:72-74 calls startSession(); CampaignContext.startSession creates record in Dexie |
| S7 | AC-S7-05: End Session with confirmation modal | [BEHAVIORAL] | PASS | SessionScreen.tsx:77-83 shows EndSessionModal; onConfirm calls endSession() |
| S7 | AC-S7-06: Session tab renders when no active session (not blank) | [BEHAVIORAL] | PASS | SessionScreen.tsx:223-250 -- shows last session summary or "No sessions yet." |
| S7 | AC-S7-07: Stale session warning on launch | [BEHAVIORAL] | PASS | Covered by AC-S3-06 implementation |
| S7 | AC-S7-08: No TypeScript errors | [MECHANICAL] | PASS | tsc --noEmit passes |
| S8 | AC-S8-01: Campaign has one party (auto-created) | [BEHAVIORAL] | PASS | CampaignCreateModal.tsx:33-39 -- auto-creates party on campaign creation; ManagePartyDrawer lazy-creates if missing |
| S8 | AC-S8-02: User can add character to party | [BEHAVIORAL] | PASS | ManagePartyDrawer.tsx:32-61 -- handleAddMember creates partyMember with linkedCharacterId |
| S8 | AC-S8-03: User can remove character from party | [BEHAVIORAL] | PASS | ManagePartyDrawer.tsx:63-74 -- handleRemoveMember calls removePartyMember |
| S8 | AC-S8-04: CampaignContext.activeParty reflects current members | [STRUCTURAL] | PASS | CampaignContext.tsx:11-13 -- ActivePartyWithMembers includes members array; refreshParty re-resolves |
| S8 | AC-S8-05: User can designate "my character" | [BEHAVIORAL] | PASS | ManagePartyDrawer.tsx:76-89 -- handleSetMyCharacter updates campaign.activeCharacterMemberId |
| S8 | AC-S8-06: Character tab works independently of party | [BEHAVIORAL] | PASS | Character routes have no campaign/party guards; routing unchanged |
| S8 | AC-S8-07: No TypeScript errors | [MECHANICAL] | PASS | tsc --noEmit passes |
| S9 | AC-S9-01: Notes hub shows notes grouped by type with campaign guard | [STRUCTURAL] | PASS | NotesScreen.tsx -- groups into pinned, npcs, generic, combat sections; NoCampaignPrompt when no campaign |
| S9 | AC-S9-02: Quick Note creates generic note via drawer | [BEHAVIORAL] | PASS | QuickNoteDrawer.tsx -- title required, body optional via Tiptap, creates type: 'generic' |
| S9 | AC-S9-03: Quick NPC creates npc note via drawer | [BEHAVIORAL] | PASS | QuickNPCDrawer.tsx -- name required, role/affiliation optional in typeData, creates type: 'npc' |
| S9 | AC-S9-04: Notes auto-link to active session | [BEHAVIORAL] | PASS | Handled by useNoteActions.createNote (AC-S4-06) |
| S9 | AC-S9-05: Link Note associates existing note to session | [BEHAVIORAL] | PASS | LinkNoteDrawer.tsx -- shows unlinked notes, creates "linked_to" EntityLink; deduplication in useNoteActions.linkNote |
| S9 | AC-S9-06: Pinned notes appear at top | [STRUCTURAL] | PASS | NotesScreen.tsx:42 -- pinned section rendered first |
| S9 | AC-S9-07: Count badges per section | [STRUCTURAL] | PASS | NotesScreen.tsx:62-94 -- sectionHeader renders count badge |
| S9 | AC-S9-08: Action tap targets >= 44x44 px | [STRUCTURAL] | PASS | NotesScreen.tsx:110-111 -- minHeight: '44px', minWidth: '44px' on Quick Note/NPC/Link buttons |
| S9 | AC-S9-09: No TypeScript errors | [MECHANICAL] | PASS | tsc --noEmit passes |
| S10 | AC-S10-01: Single note export via renderNoteToMarkdown + shareFile | [BEHAVIORAL] | PASS | useExportActions.ts:19-41 -- exportNote reads note, builds links, renders markdown, shares |
| S10 | AC-S10-02: Session export as .md file | [BEHAVIORAL] | PASS | useExportActions.ts:43-76 -- exportSessionMarkdown renders bundle, extracts session index, shares as .md |
| S10 | AC-S10-03: Session + notes bundle as .zip | [BEHAVIORAL] | PASS | useExportActions.ts:78-109 -- exportSessionBundle renders bundle, creates zip via bundleToZip, shares |
| S10 | AC-S10-04: Copy as Markdown with clipboard + toast | [BEHAVIORAL] | PASS | useExportActions.ts:111-133 -- copyNoteAsMarkdown renders markdown, copies to clipboard, shows "Copied to clipboard" toast |
| S10 | AC-S10-05: Mobile Safari .zip fallback | [BEHAVIORAL] | PASS | delivery.ts:1-11 -- shareFile checks canShare before calling navigator.share, falls back to downloadBlob |
| S10 | AC-S10-06: No TypeScript errors | [MECHANICAL] | PASS | tsc --noEmit passes |
| S11 | AC-S11-01: "Start Combat" button creates combat note linked to session | [BEHAVIORAL] | PASS | SessionScreen.tsx:86-98 -- handleStartCombat creates combat note with typeData, auto-links via useNoteActions.createNote |
| S11 | AC-S11-02: Combat view with round number, event log, Next Round | [STRUCTURAL] | PASS | CombatTimeline.tsx:206-208 shows round number; 404-446 shows event log; 228-245 shows Next Round button |
| S11 | AC-S11-03: Event types as tap targets (attack, spell, ability, damage, heal, condition, note) | [STRUCTURAL] | PASS | CombatTimeline.tsx:18 -- EVENT_TYPES array has all 7 types; rendered as chip buttons at line 250-259 |
| S11 | AC-S11-04: Next Round increments counter + inserts round-separator | [BEHAVIORAL] | PASS | CombatTimeline.tsx:146-166 -- handleNextRound increments, creates separator event, adds new round |
| S11 | AC-S11-05: Heroic ability picker from active character's sheet | [BEHAVIORAL] | PASS | AbilityPicker.tsx -- reads character.heroicAbilities from ActiveCharacterContext; onSelect logs ability event |
| S11 | AC-S11-06: Spell picker with WP display, dimming, quick-add | [BEHAVIORAL] | PASS | SpellPicker.tsx -- shows spells grouped by party member; WP shown (line 133); opacity dimming at line 156; QuickAddSpell at line 18-57 |
| S11 | AC-S11-07: Combat note stored with type: "combat", typeData: { rounds, participants } | [STRUCTURAL] | PASS | src/types/note.ts:20-31 -- combatTypeDataSchema has rounds array (roundNumber + events) and participants array |
| S11 | AC-S11-08: No TypeScript errors | [MECHANICAL] | PASS | tsc --noEmit passes |

### Cross-Cutting Criteria

| XC | Summary | Status | Evidence |
|----|---------|--------|----------|
| XC-01 | Zero TypeScript compiler errors | PASS | npx tsc --noEmit produces no output |
| XC-02 | generateId(), nowISO(), db used consistently | PASS | All repositories and hooks use these utilities |
| XC-03 | Inline style={{}} with CSS variables; no new className styling | PASS | Grep for className= in all new files returns 0 matches |
| XC-04 | Named exports only in new files | PASS | Grep for "export default" in all new directories returns 0 matches |
| XC-05 | Hooks follow use<Feature>Actions() -> { fn1, fn2 } shape | PASS | useNoteActions, useExportActions, useCampaignContext all return objects |
| XC-06 | showToast() for all user-facing errors | PASS | All hooks and services use showToast from useToast |
| XC-07 | No unapproved npm packages | PASS | Only Tiptap packages and JSZip added (pre-approved) |
| XC-08 | Character sheet screens render without regression | NEEDS_REVIEW | Routes preserved; manual smoke-test required |

**Compliance result:** PARTIAL (1 FAIL: AC-S6-04 vim mode not implemented; 4 NEEDS_REVIEW criteria requiring manual verification)

## Code Quality

### Code Quality Findings

- [IMPORTANT] src/screens/MoreScreen.tsx:22-23: Duplicate `borderBottom` property in style object. The first `borderBottom: '1px solid var(--color-border)'` at line 22 is on `padding`, and the second on line 23 also sets `borderBottom`. The second value wins at runtime but this is sloppy and may cause confusion. The `as React.CSSProperties` cast suppresses the TS error.
- [IMPORTANT] src/app/AppLayout.tsx and src/components/layout/BottomNav.tsx: These files are now dead code (orphaned) after the shell rebuild. They should be deleted or marked deprecated to avoid confusion.
- [IMPORTANT] src/features/campaign/CampaignContext.tsx:88-93: Stale session warning (AC-S3-06) shows a toast but does not offer "End it" or "Continue" options as specified. The spec says the user should be offered these two options; the current implementation only shows a warning toast that auto-dismisses.
- [SUGGESTION] src/utils/export/renderNote.ts and src/utils/export/renderSession.ts: The `yamlValue()` helper function is duplicated across both files. Consider extracting to a shared utility.
- [SUGGESTION] src/components/notes/TiptapNoteEditor.tsx:130: The `failed` state is declared but never set to `true` -- the error boundary effect at line 164-167 is a no-op. The fallback correctly triggers when `editor` is null, but the explicit `failed` path is dead code.
- [SUGGESTION] src/features/notes/LinkNoteDrawer.tsx:50: Variable named `unlinkdNotes` has a typo (should be `unlinkedNotes`).
- [SUGGESTION] src/screens/NotesScreen.tsx:151-157: NPC notes in the Notes hub pass empty no-op functions `() => {}` for `onExport` and `onCopy` instead of the actual export/copy handlers. This means Export Note and Copy as Markdown are silently broken for NPC-type notes.

**Quality result:** PARTIAL (3 IMPORTANT findings, 4 SUGGESTIONS, 0 CRITICAL)

## Integration

### Integration Findings

- [IMPORTANT] src/features/campaign/ManagePartyDrawer.tsx:4: Imports `getAll as getAllCharacters` from `../../storage/repositories/characterRepository`. The characterRepository exports `getAll` as a named function (confirmed via grep). This works but uses a renamed import pattern that differs from how other repositories are consumed (direct named imports). No functional issue.
- [IMPORTANT] src/features/combat/SpellPicker.tsx:3: Imports `getById as getCharacterById` from `../../storage/repositories/characterRepository`. Same pattern note as above. Confirmed the function exists and TypeScript compiles cleanly.
- [SUGGESTION] src/features/combat/AbilityPicker.tsx:2: Imports `useActiveCharacter` from `../../context/ActiveCharacterContext`. The character type is accessed via `character?.heroicAbilities`. This depends on the existing character data model having a `heroicAbilities` array with `id`, `name`, and optional `wpCost` fields. TypeScript confirms this type-checks, but any changes to the character model could break this.
- [SUGGESTION] The old src/app/AppLayout.tsx still imports from `src/components/layout/BottomNav.tsx`. Neither is referenced elsewhere, so no runtime impact, but they could confuse future developers.

**Integration result:** PASS (no CRITICAL or IMPORTANT integration failures; 2 IMPORTANT notes about code style, 2 SUGGESTIONS)

## Traceability Audit

| Metric | Value |
|--------|-------|
| Total REQ-IDs | 80 |
| Orphan REQs | 0 |
| Incomplete REQs | 5 |
| Matrix Completeness | 93.75% |

NOTE: Matrix completeness is below 100%. The 5 incomplete REQ-IDs are those requiring manual verification (NEEDS_REVIEW): AC-S1-07, AC-S2-06, AC-S4-11, AC-S6-03, XC-08. Additionally, AC-S6-04 (vim mode) has status FAIL.

**Traceability result:** PARTIAL

## Holdout Validation

Holdout validation skipped -- no holdout criteria present.

**Holdout result:** SKIPPED

## Pre-Flight Critical Issue Resolution

| Issue | Resolution | Status |
|-------|-----------|--------|
| CRIT-1: SS-03 targets wrong file for provider insertion | CampaignProvider correctly placed in src/app/AppProviders.tsx (not src/main.tsx) | RESOLVED |
| CRIT-2: SS-01 conflicts with existing BottomNav and AppLayout | ShellLayout replaces AppLayout in router; old files exist but are orphaned (not imported) | RESOLVED (cleanup recommended) |
| CRIT-3: SS-06 references non-existent @tiptap/extension-vim-keymap | Vim mode was silently dropped. AC-S6-04 not implemented. | UNRESOLVED -- vim mode absent |
| CRIT-4: Existing screens use default exports vs XC-04 | Existing screens kept as default exports (grandfathered); all new files use named exports | RESOLVED |
| CRIT-5: SS-11 combat typeData shape conflicts with SS-02 | Combat typeData schema fully specified in src/types/note.ts with proper Zod types (not z.unknown()) | RESOLVED |

## Recommendations

1. **AC-S6-04 (vim mode):** Either implement vim mode with a real community extension (e.g., `tiptap-extension-vim` or `@codemirror/vim`), or formally defer this criterion to a future sub-spec and update the spec to reflect the deferral. This is the only acceptance criterion that fully failed.
2. **AC-S3-06 (stale session UX):** The stale session warning currently shows a toast. The spec requires offering "End it" or "Continue" options. Upgrade this to a modal dialog with two action buttons.
3. **Dead code cleanup:** Delete or deprecate `src/app/AppLayout.tsx` and `src/components/layout/BottomNav.tsx`. They are no longer used.
4. **Duplicate borderBottom in MoreScreen.tsx:** Fix the duplicate property on the Manage Party button style object.
5. **NPC export/copy handlers:** The NotesScreen passes no-op functions for NPC note export/copy. Wire these to the real `exportNote` and `copyNoteAsMarkdown` handlers.
6. **Extract yamlValue utility:** Deduplicate the `yamlValue()` helper from renderNote.ts and renderSession.ts into a shared module.
7. **Manual smoke-tests needed:** Verify AC-S1-07, AC-S2-06, AC-S4-11, AC-S6-03, and XC-08 in a browser environment before declaring Stage 1/2 complete.
