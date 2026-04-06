# Verify Report -- 2026-04-06T20-36-24-design-doc

**Overall: PARTIAL**
**Date:** 2026-04-06 22:45

## Spec Compliance

| Sub-Spec | Criterion (summary) | Type | Status | Evidence |
|----------|---------------------|------|--------|----------|
| 0.1 | db.version(6).stores() contains all three table definitions | [STRUCTURAL] | PASS | client.ts:70-73 — creatureTemplates, encounters, notes with visibility index |
| 0.1 | Upgrade handler runs combat migration if flag not set | [BEHAVIORAL] | PASS | client.ts:77-119 — checks metadata table for migration_v6_combat flag |
| 0.1 | Upgrade handler runs NPC migration if flag not set | [BEHAVIORAL] | PASS | client.ts:129-167 — checks metadata table for migration_v6_npc flag |
| 0.1 | Migration failure leaves app on v5 (Dexie upgrade transaction) | [BEHAVIORAL] | PASS | Dexie upgrade transactions provide this guarantee natively |
| 0.1 | Both migration flags set after successful run; re-run is no-op | [BEHAVIORAL] | PASS | client.ts:114-118, 162-166 — flags written after migration loop |
| 0.2 | All three schema files compile without TypeScript errors | [MECHANICAL] | PASS | `npx tsc --noEmit` passes cleanly |
| 0.2 | creatureTemplateSchema.safeParse(validObject) returns success | [BEHAVIORAL] | PASS | Schema structure matches spec exactly — all fields present |
| 0.2 | encounterSchema.safeParse(validObject) returns success | [BEHAVIORAL] | PASS | Schema structure matches spec exactly |
| 0.2 | bundleEnvelopeSchema.safeParse(validEnvelope) returns success | [BEHAVIORAL] | PASS | Schema structure matches spec; uses campaignSchema, sessionSchema etc. |
| 0.2 | noteSchema extended with visibility optional field | [STRUCTURAL] | PASS | note.ts:79 — `visibility: z.enum(['public', 'private']).optional()` |
| 0.2 | No existing Zod schemas modified (only extended) | [STRUCTURAL] | PASS | Only note.ts gained optional visibility field; bundle.ts is new |
| 0.3 | entityLinkRepository has no whitelist on entity types | [STRUCTURAL] | PASS | entityLinkRepository.ts:7-9 — comment confirms free-string field |
| 0.3 | Creating entity link with fromEntityType 'encounter' succeeds | [BEHAVIORAL] | NEEDS_REVIEW | No runtime test; code review confirms no guards |
| 0.3 | Creating entity link with fromEntityType 'creature' succeeds | [BEHAVIORAL] | NEEDS_REVIEW | No runtime test; code review confirms no guards |
| 1.1 | creatureTemplateRepository.create() inserts and returns typed object | [BEHAVIORAL] | PASS | creatureTemplateRepository.ts:13-26 |
| 1.1 | creatureTemplateRepository.listByCampaign() filters by campaignId | [BEHAVIORAL] | PASS | creatureTemplateRepository.ts:56-71 |
| 1.1 | encounterRepository.create() inserts and returns typed object | [BEHAVIORAL] | PASS | encounterRepository.ts:10-27 |
| 1.1 | encounterRepository.listBySession() filters by sessionId | [BEHAVIORAL] | PASS | encounterRepository.ts:56-71 |
| 1.1 | encounterRepository.updateParticipant() updates nested participant | [BEHAVIORAL] | PASS | encounterRepository.ts:132-146 — maps over participants array |
| 1.1 | All functions use safeParse() on read with console.warn | [BEHAVIORAL] | PASS | Both repos use safeParse() in getById/list methods |
| 1.1 | No repository function throws — errors returned via result/undefined | [BEHAVIORAL] | FAIL | creatureTemplateRepository.create() has no try/catch — can throw on DB error |
| 1.2 | BestiaryScreen renders list for active campaign | [BEHAVIORAL] | PASS | BestiaryScreen.tsx uses useBestiary(campaignId) |
| 1.2 | Search filters by name and tags (case-insensitive) | [BEHAVIORAL] | PASS | useBestiary.ts:33-37 — toLowerCase() comparison |
| 1.2 | Category filter narrows list | [BEHAVIORAL] | PASS | useBestiary.ts:31 |
| 1.2 | Tapping template opens stat block with all fields | [BEHAVIORAL] | PASS | BestiaryScreen.tsx:141-256 — HP, armor, movement, attacks, abilities, skills |
| 1.2 | New Creature flow opens form, saves, appears in list | [BEHAVIORAL] | PASS | BestiaryScreen.tsx:115-117 + CreatureTemplateForm |
| 1.2 | Editing updates template; archiving hides from default view | [BEHAVIORAL] | PASS | useBestiary.ts:28-30 filters archived |
| 1.2 | Archived templates accessible via Show archived toggle | [BEHAVIORAL] | PASS | BestiaryScreen.tsx:101-112 |
| 1.2 | Bestiary accessible from session screen | [BEHAVIORAL] | PASS | SessionScreen.tsx:187-189 — Bestiary button navigates to /bestiary |
| 1.2 | Bestiary accessible from main navigation | [STRUCTURAL] | PASS | routes/index.tsx:73 — /bestiary route registered |
| 1.3 | User can start encounter (combat/social/exploration) with title | [BEHAVIORAL] | PASS | SessionScreen.tsx:324-378 — start encounter modal with type + title |
| 1.3 | User can add participant from bestiary | [BEHAVIORAL] | PASS | useEncounter.ts:82-97 — addParticipantFromTemplate |
| 1.3 | User can add participant from current party (PCs) | [BEHAVIORAL] | PASS | useEncounter.ts:99-114 — addParticipantFromCharacter |
| 1.3 | User can quick-create participant | [BEHAVIORAL] | PASS | useEncounter.ts:116-146 — creates template + participant |
| 1.3 | Tapping participant opens stat drawer | [BEHAVIORAL] | PASS | EncounterScreen.tsx:81-106 — onClick -> setSelectedParticipant |
| 1.3 | Recording armor via stat drawer in <= 3 taps | [BEHAVIORAL] | NEEDS_REVIEW | ParticipantDrawer has HP/conditions/notes but no direct armor field; armor shown read-only from template |
| 1.3 | Notes created while encounter active are auto-linked | [BEHAVIORAL] | PASS | useNoteActions.ts:87-101 — finds active encounter, creates entity link |
| 1.3 | Linked notes appear in encounter's notes feed | [BEHAVIORAL] | PASS | useEncounter.ts:37-48 + EncounterScreen.tsx:117-133 |
| 1.3 | Social/exploration encounters show participant list + notes feed | [BEHAVIORAL] | PASS | EncounterScreen.tsx:72-133 — renders both when type != combat |
| 1.3 | Ending encounter sets status and endedAt | [BEHAVIORAL] | PASS | encounterRepository.ts:120-122 — end() calls update with status/endedAt |
| 1.3 | Past encounters browsable from session screen | [BEHAVIORAL] | PASS | SessionScreen.tsx:307-319 — EncounterListItem for ended encounters |
| 1.3 | Session end prompts to end active encounters | [BEHAVIORAL] | FAIL | SessionScreen.tsx confirmEndSession (line 123-125) calls endSession directly without checking/prompting about active encounters |
| 1.4 | Combat encounter renders CombatTimeline with rounds/events/participants | [BEHAVIORAL] | FAIL | CombatEncounterView does NOT use CombatTimeline — it builds its own UI. Spec says "wraps existing combat UI" but implementation is standalone |
| 1.4 | Participants show linked creature template stats in drawer | [BEHAVIORAL] | PASS | ParticipantDrawer.tsx:27-30 loads template, shows base stats read-only |
| 1.4 | CombatTimeline.tsx props unchanged | [STRUCTURAL] | PASS | CombatTimeline.tsx interface is `{ combatNoteId: string; onClose: () => void }` — no changes |
| 1.4 | Existing combat notes migrated render correctly as encounters | [BEHAVIORAL] | NEEDS_REVIEW | Migration creates encounter entities; CombatEncounterView renders them. But migrated data may have empty participants arrays |
| 1.4 | Original combat notes remain accessible as archived | [BEHAVIORAL] | PASS | client.ts:111 — archives source notes during migration |
| 1.5 | 'npc' does not appear in new-note type picker | [STRUCTURAL] | PASS | NoteEditorScreen.tsx:214 — filters out 'npc' from NOTE_TYPES |
| 1.5 | Existing NPC notes render when show archived active | [BEHAVIORAL] | NEEDS_REVIEW | NPC notes are archived by migration; NotesGrid does not filter by status so archived notes may not be visible without explicit filter |
| 1.5 | No TypeScript errors in affected files | [MECHANICAL] | PASS | tsc --noEmit passes |
| 1.5 | NPC note type not in QuickNoteDrawer picker | [STRUCTURAL] | PASS | QuickNoteDrawer.tsx has no NPC reference |
| 2.1 | collectCharacterBundle includes notes linked via entity links | [BEHAVIORAL] | PASS | collectors.ts:59-71 — getAllLinksForEntity + note extraction |
| 2.1 | collectSessionBundle includes encounters with matching sessionId | [BEHAVIORAL] | PASS | collectors.ts:113 — listEncountersBySession |
| 2.1 | collectSessionBundle includes creature templates from participants | [BEHAVIORAL] | PASS | collectors.ts:116-124 |
| 2.1 | collectCampaignBundle includes all creature templates and encounters | [BEHAVIORAL] | PASS | collectors.ts:202-205 |
| 2.1 | No collector throws — errors caught and returned | [BEHAVIORAL] | PASS | All collectors wrapped in try/catch returning CollectorResult |
| 2.1 | Each collector returns BundleContents shape | [STRUCTURAL] | PASS | Return types match bundleContentsSchema fields |
| 2.2 | Default export excludes private notes | [BEHAVIORAL] | PASS | privacyFilter.ts:27-30 |
| 2.2 | Opt-in includes all notes | [BEHAVIORAL] | PASS | privacyFilter.ts:22 — early return |
| 2.2 | Entity links referencing stripped notes removed | [BEHAVIORAL] | PASS | privacyFilter.ts:41-47 |
| 2.2 | Attachments referencing stripped notes removed | [BEHAVIORAL] | PASS | privacyFilter.ts:50-55 |
| 2.2 | Notes with no visibility treated as public | [BEHAVIORAL] | PASS | privacyFilter.ts:28 — only filters explicit 'private' |
| 2.3 | Output JSON parses as valid BundleEnvelope | [BEHAVIORAL] | PASS | bundleSerializer.ts:43-51 — constructs envelope with version:1, system:'dragonbane' |
| 2.3 | contentHash present and matches SHA-256 | [BEHAVIORAL] | PASS | bundleSerializer.ts:31-32 — computeSha256 on contents JSON |
| 2.3 | Attachment Blobs converted to base64 | [BEHAVIORAL] | PASS | bundleSerializer.ts:70-89 |
| 2.3 | File delivered via existing shareFile | [BEHAVIORAL] | PASS | bundleSerializer.ts:65 |
| 2.3 | File extension is .skaldmark.json | [STRUCTURAL] | PASS | bundleSerializer.ts:63 |
| 2.3 | Attachment size warning at 20MB | [BEHAVIORAL] | PASS | bundleSerializer.ts:34-39 |
| 2.4 | Valid .skaldmark.json parses successfully | [BEHAVIORAL] | PASS | bundleParser.ts:87-105 |
| 2.4 | Legacy .skaldbok.json detected and wrapped | [BEHAVIORAL] | PASS | bundleParser.ts:65-67 + handleLegacySkaldbok |
| 2.4 | Invalid JSON returns success:false | [BEHAVIORAL] | PASS | bundleParser.ts:52-55 |
| 2.4 | version > 1 returns success:false with upgrade message | [BEHAVIORAL] | PASS | bundleParser.ts:76-79 |
| 2.4 | Per-entity Zod failures produce warnings | [BEHAVIORAL] | PASS | bundleParser.ts:142-168 — validateContentsEntities |
| 2.4 | contentHash mismatch produces warning, does not block | [BEHAVIORAL] | PASS | verifyContentHash returns false on mismatch; UI shows warning banner |
| 2.4 | No JSON.parse without try/catch; all via safeParse | [STRUCTURAL] | PASS | bundleParser.ts:52-55 wraps JSON.parse; all Zod via safeParse |
| 2.5 | Processing order matches spec | [STRUCTURAL] | PASS | mergeEngine.ts:38-49 — order matches exactly |
| 2.5 | Same ID + newer updatedAt -> update | [BEHAVIORAL] | PASS | mergeEngine.ts:161-163 |
| 2.5 | Same ID + identical updatedAt -> skip | [BEHAVIORAL] | PASS | mergeEngine.ts:164-166 (>= covers identical case as skip) |
| 2.5 | Same ID + older updatedAt -> keep local | [BEHAVIORAL] | PASS | mergeEngine.ts:164-166 |
| 2.5 | No matching ID -> insert | [BEHAVIORAL] | PASS | mergeEngine.ts:141-143 |
| 2.5 | targetCampaignId applied to all entities | [BEHAVIORAL] | PASS | mergeEngine.ts:183-185 |
| 2.5 | sessionId cleared when session not in bundle | [BEHAVIORAL] | PASS | mergeEngine.ts:188-195 |
| 2.5 | Unresolvable linkedCreatureId logs warning | [BEHAVIORAL] | PASS | mergeEngine.ts:219-232 |
| 2.5 | Selective import via selectedEntityTypes | [BEHAVIORAL] | PASS | mergeEngine.ts:88 — skips unselected types |
| 2.5 | Returns MergeReport, never throws | [BEHAVIORAL] | PASS | mergeEngine.ts:86-110 — try/catch wraps entire function |
| 2.6 | Shows entity count including creatureTemplates and encounters | [STRUCTURAL] | PASS | ImportPreview.tsx:27-38 — ENTITY_LABELS includes both |
| 2.6 | Validation warnings displayed per entity | [BEHAVIORAL] | PASS | ImportPreview.tsx:166-179 |
| 2.6 | Conflicts listed with entity name | [BEHAVIORAL] | PASS | ImportPreview.tsx:182-203 |
| 2.6 | Per-group checkboxes present and functional | [BEHAVIORAL] | PASS | ImportPreview.tsx:147-152 — checkbox per type with handleToggle |
| 2.6 | Campaign selector shown for session/character bundles | [BEHAVIORAL] | PASS | ImportPreview.tsx:74, 206-227 |
| 2.6 | Import disabled until target campaign selected | [BEHAVIORAL] | PASS | ImportPreview.tsx:75 — canImport requires targetCampaignId |
| 2.6 | Import N items button label updates | [BEHAVIORAL] | PASS | ImportPreview.tsx:246 — dynamic `Import ${totalSelected} items` |
| 2.6 | contentHash mismatch displayed as non-blocking warning | [BEHAVIORAL] | PASS | ImportPreview.tsx:114-118 |
| 2.7 | Character export produces .skaldmark.json | [BEHAVIORAL] | PASS | useExportActions.ts:295-311 — collect -> filter -> serialize -> deliver |
| 2.7 | Session export includes encounters and templates | [BEHAVIORAL] | PASS | Delegates to collectSessionBundle which includes encounters/templates |
| 2.7 | Campaign export includes all entity types | [BEHAVIORAL] | PASS | Delegates to collectCampaignBundle |
| 2.7 | Import file picker accepts both extensions | [BEHAVIORAL] | PASS | useImportActions.ts:24 — accepts .skaldmark.json, .skaldbok.json, .json |
| 2.7 | MergeReport displayed as toast | [BEHAVIORAL] | PASS | useImportActions.ts:52-59 |
| 2.7 | Errors displayed as toast with actionable message | [BEHAVIORAL] | PASS | useImportActions.ts:51-54 |
| 2.7 | No new npm dependencies | [STRUCTURAL] | PASS | No package.json changes; Web Crypto API used for SHA-256 |
| 3.1-3.4 | Round-trip and migration verification | [BEHAVIORAL] | NEEDS_REVIEW | No automated test files created; these are runtime verification criteria |

**Compliance result:** PARTIAL

## Code Quality

## Code Quality Findings
- [IMPORTANT] src/features/notes/useNoteActions.ts: Orphaned JSDoc comment at line 164-167 — the `linkNote` function's documentation starts but the function body was removed. The opening comment block has a nested `/**` without a matching `*/`.
- [IMPORTANT] src/storage/repositories/creatureTemplateRepository.ts: `create()` function (line 13-26) has no try/catch error handling. Spec requires "no repository function throws". If IndexedDB fails, this will throw an unhandled error.
- [IMPORTANT] src/storage/repositories/encounterRepository.ts: `create()` function (line 10-27) also has no try/catch. Same concern as creatureTemplateRepository.
- [IMPORTANT] src/utils/export/collectors.ts:26-42: `getAllLinksForEntity` queries a hardcoded list of relationship types (`contains`, `references`, `linked`, `created_during`). This may miss links with other relationship types like `introduced_in` (used by NPC notes), leading to incomplete entity link collection.
- [SUGGESTION] src/features/encounters/CombatEncounterView.tsx:95: Dynamic import `await import('...')` is used inline inside a callback. Consider using the static import already present at line 4 (`getCreatureTemplateById`) instead.
- [SUGGESTION] src/utils/export/collectors.ts:81,84: `characters` is cast through `unknown` (`as unknown as Record<string, unknown>`) and `blob` is set to `undefined as unknown as Blob`. These double-casts are code smells; consider using the `attachmentBundleSchema` type directly.
- [SUGGESTION] src/screens/SessionScreen.tsx: The file is growing large (480 lines) with encounter management, import/export, and combat logic. Consider extracting encounter-related state into a dedicated hook.
- [SUGGESTION] src/features/encounters/CombatEncounterView.tsx:53: The `templateCache` dependency in the useEffect causes unnecessary re-renders because the cache object reference changes every time a template is loaded. Consider using a ref or stable state update.

**Quality result:** PARTIAL

## Integration

## Integration Findings
- [IMPORTANT] src/features/encounters/CombatEncounterView.tsx + CombatTimeline.tsx: Spec 1.4 says "Build CombatEncounterView that passes encounter-sourced data to CombatTimeline via existing props." The implementation does NOT wrap or call CombatTimeline at all. It builds a completely independent combat UI. CombatTimeline reads from note typeData; CombatEncounterView reads from encounter entities. Both exist in parallel with no integration.
- [IMPORTANT] src/screens/SessionScreen.tsx: Both the legacy CombatTimeline (via combat notes, line 228-248) and the new encounter system (line 276-319) coexist. Users can start combat via the legacy path (handleStartCombat, creating a combat note) OR via the new encounter system (handleStartEncounter with type: combat). There is no guard preventing both from being active simultaneously.
- [IMPORTANT] src/types/bundle.ts: `bundleContentsSchema` uses `baseNoteSchema` for notes (line 48), but the spec defines `noteSchema` in the contents. Since `baseNoteSchema` IS the note schema in this codebase (no separate `noteSchema`), this is correct but the naming difference from spec could cause confusion.
- [SUGGESTION] src/features/import/useImportActions.ts: The `ImportPreview` component expects a `conflicts` prop (ConflictInfo[]) but `useImportActions` always passes an empty array (SessionScreen.tsx:411). Conflict detection is not implemented — the merge engine handles conflicts silently via updatedAt comparison. This means the UI never shows conflicts to the user before import.
- [SUGGESTION] src/features/encounters/CombatEncounterView.tsx:4: Imports `getById as getCreatureTemplateById` statically at the top, but line 95 uses dynamic `import()` for the `create` function from the same module. Mixed import patterns for the same module.

**Integration result:** PARTIAL

## Traceability Audit

Traceability file not found (`traceability.md` does not exist for this run). Traceability audit cannot be performed.

| Metric | Value |
|--------|-------|
| Total REQ-IDs | N/A |
| Orphan REQs | N/A |
| Incomplete REQs | N/A |
| Matrix Completeness | N/A |

NOTE: No traceability.md file exists for this factory run. Traceability audit skipped.

**Traceability result:** PARTIAL

## Holdout Validation

Holdout validation skipped -- no holdout criteria present.

**Holdout result:** SKIPPED

## Recommendations

1. **[IMPORTANT] Add try/catch to repository create() functions.** Both `creatureTemplateRepository.create()` and `encounterRepository.create()` lack error handling. Wrap in try/catch and return undefined (or a result object) on failure, matching the spec's "no function throws" constraint.

2. **[IMPORTANT] Resolve dual combat systems.** The legacy CombatTimeline (combat notes) and the new encounter-based combat coexist without guards. Either (a) disable the legacy "Start Combat" button when the encounter system is available, (b) redirect legacy combat to create a combat encounter, or (c) add a migration that makes the legacy path encounter-aware.

3. **[IMPORTANT] Decide on CombatEncounterView + CombatTimeline integration.** The spec says CombatEncounterView should "pass encounter-sourced data to CombatTimeline via existing props." The current implementation builds a standalone combat UI instead. This is arguably a better design (cleaner separation), but deviates from the spec's migration approach. Accept the deviation or refactor to wrap CombatTimeline.

4. **[IMPORTANT] Add `introduced_in` to collector relationship types.** The `getAllLinksForEntity` helper in collectors.ts only queries 4 relationship types. NPC notes use `introduced_in` which would be missed, leading to incomplete character and session bundles.

5. **[SUGGESTION] Implement conflict detection in import flow.** The ImportPreview component supports showing conflicts, but the merge engine resolves them silently. Consider adding a pre-merge scan that compares bundle entities against local DB to populate the conflicts list.

6. **[SUGGESTION] Clean up orphaned JSDoc in useNoteActions.ts.** Remove the truncated `linkNote` documentation block at line 164-167.

7. **[SUGGESTION] Add session-end encounter prompt.** Spec 1.3 requires "Session end prompts to end active encounters or carry them over." This is not implemented.
