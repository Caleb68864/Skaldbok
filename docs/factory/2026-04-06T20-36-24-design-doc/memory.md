
<!-- MISSION: DO NOT COMPACT -->
Project: forge-factory
Run: 2026-04-06T20-36-24-design-doc
Phase: forge
Objective: Implement and verify sub-specs per acceptance criteria
Constraints: Correctness over speed. No shell commands. Cross-platform.
<!-- MISSION: DO NOT COMPACT -->

## Stage Outputs

### Stage 3.5: Pre-Flight Analysis
- Artifact: pre-flight-report.md
- Status: CRITICAL_ISSUES
- Critical issues: 8 (CombatTimeline interface mismatch, wrong file path for CombatTimeline, Dexie migration meta table access pattern, wrong repository method names in collectors/merge, characterRecordSchema wrong path, no partyMember.ts file, attachmentMetaSchema name wrong, NPC typeData has no stats fields)
- Advisory issues: 10 (wrong import paths for ids/dates, update() throws vs spec, visibility field Zod ordering, QuickNoteDrawer has no type picker, no listBySession in partyRepo, Blob field cannot round-trip, no useCampaigns hook, toast API mismatch, shareFile expects Blob not string, merge engine function name mismatches)
- File conflicts: 1 HIGH risk (SessionScreen.tsx touched by SS-05, SS-06, SS-07)

### Stage 4: Run — Warnings
- forge/agents/forge-worker.md: not found — using fallback worker instructions
- forge/agents/forge-reviewer.md: not found — review_enabled = false
- forge/config/defaults.json: not found — using default doom-loop thresholds (max_waves=10, max_same_failure=2)

### Wave 1 Changes
- Files created: src/types/creatureTemplate.ts, src/types/encounter.ts, src/types/bundle.ts
- Files modified: src/types/note.ts (added visibility field)
- Key interfaces/exports: creatureTemplateSchema, CreatureTemplate, encounterSchema, Encounter, EncounterParticipant, bundleContentsSchema, bundleEnvelopeSchema, BundleContents, BundleEnvelope, attachmentBundleSchema

### Wave 2 Changes
- Files modified: src/storage/db/client.ts (v6 schema + migration handler), src/storage/repositories/entityLinkRepository.ts (documentation comment)
- Files created: none
- Key interfaces/exports: db.creatureTemplates table, db.encounters table, migration_v6_combat flag, migration_v6_npc flag

### Wave 3 Changes
- Files created: src/storage/repositories/creatureTemplateRepository.ts, src/storage/repositories/encounterRepository.ts
- Files modified: none
- Key interfaces/exports: creatureTemplateRepository.{create,getById,listByCampaign,update,archive}, encounterRepository.{create,getById,listBySession,listByCampaign,update,end,updateParticipant,addParticipant}

### Wave 4 Changes
- Files created: src/features/bestiary/{BestiaryScreen,BestiaryScreenRoute,CreatureTemplateCard,CreatureTemplateForm,useBestiary}.tsx/.ts, src/features/encounters/{EncounterScreen,EncounterListItem,ParticipantDrawer,QuickCreateParticipantFlow,useEncounter,useEncounterList}.tsx/.ts, src/utils/export/{collectors,privacyFilter}.ts, src/utils/import/bundleParser.ts
- Files modified: src/screens/SessionScreen.tsx (encounter UI + bestiary button), src/routes/index.tsx (bestiary route), src/features/notes/NotesGrid.tsx (removed NPC filter), src/screens/NoteEditorScreen.tsx (removed NPC from type picker), src/features/notes/useNoteActions.ts (encounter auto-linking)
- Key interfaces/exports: useBestiary, BestiaryScreen, useEncounterList, useEncounter, EncounterScreen, collectCharacterBundle, collectSessionBundle, collectCampaignBundle, applyPrivacyFilter, parseBundle, verifyContentHash

### Wave 5 Changes
- Files created: src/utils/export/bundleSerializer.ts, src/utils/import/mergeEngine.ts, src/features/encounters/CombatEncounterView.tsx, src/components/import/ImportPreview.tsx
- Files modified: src/features/encounters/EncounterScreen.tsx (combat routing)
- Key interfaces/exports: serializeBundle, deliverBundle, mergeBundle, MergeOptions, MergeReport, CombatEncounterView, ImportPreview

### Wave 6 Changes
- Files created: src/features/import/useImportActions.ts
- Files modified: src/features/export/useExportActions.ts (added exportCharacter, exportSessionSkaldmark, exportCampaign), src/screens/SessionScreen.tsx (import/export buttons)
- Key interfaces/exports: useImportActions, exportCharacter, exportSessionSkaldmark, exportCampaign

### Wave 7 Changes
- Files modified: src/types/note.ts (fixed visibility to optional without default)
- Files created: none
- Key interfaces/exports: none (verification wave)

### Stage 4: Run
- Sub-specs executed: 19
- Results: 19 PASS, 0 PARTIAL, 0 FAIL
- Waves: 7
- Files changed: src/types/creatureTemplate.ts, src/types/encounter.ts, src/types/bundle.ts, src/types/note.ts, src/storage/db/client.ts, src/storage/repositories/entityLinkRepository.ts, src/storage/repositories/creatureTemplateRepository.ts, src/storage/repositories/encounterRepository.ts, src/features/bestiary/BestiaryScreen.tsx, src/features/bestiary/BestiaryScreenRoute.tsx, src/features/bestiary/CreatureTemplateCard.tsx, src/features/bestiary/CreatureTemplateForm.tsx, src/features/bestiary/useBestiary.ts, src/features/encounters/EncounterScreen.tsx, src/features/encounters/EncounterListItem.tsx, src/features/encounters/ParticipantDrawer.tsx, src/features/encounters/QuickCreateParticipantFlow.tsx, src/features/encounters/useEncounter.ts, src/features/encounters/useEncounterList.ts, src/features/encounters/CombatEncounterView.tsx, src/features/notes/NotesGrid.tsx, src/features/notes/useNoteActions.ts, src/features/export/useExportActions.ts, src/features/import/useImportActions.ts, src/utils/export/collectors.ts, src/utils/export/privacyFilter.ts, src/utils/export/bundleSerializer.ts, src/utils/import/bundleParser.ts, src/utils/import/mergeEngine.ts, src/components/import/ImportPreview.tsx, src/screens/SessionScreen.tsx, src/screens/NoteEditorScreen.tsx, src/routes/index.tsx
- Issues: none

### Stage 5: Verify
- Artifact: verify-report.md
- Overall result: PARTIAL
- Spec compliance: PARTIAL -- 93 criteria checked, 85 passed, 3 failed, 5 needs review
- Code quality: PARTIAL -- 8 findings (0 CRITICAL, 4 IMPORTANT, 4 SUGGESTION)
- Integration: PARTIAL -- 5 findings (0 CRITICAL, 3 IMPORTANT, 2 SUGGESTION)
- Key issues: CombatEncounterView does not wrap CombatTimeline as spec requires; dual combat systems coexist without guards; repository create() missing error handling

## Issues Log
- Stage 5 IMPORTANT: CombatEncounterView builds standalone combat UI instead of wrapping CombatTimeline — deviates from spec 1.4 migration approach
- Stage 5 IMPORTANT: Legacy combat note path and new encounter system can both be active simultaneously in SessionScreen.tsx
- Stage 5 IMPORTANT: creatureTemplateRepository.create() and encounterRepository.create() lack try/catch — violates "no function throws" constraint

