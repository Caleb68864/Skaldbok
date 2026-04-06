# Spec: Bestiary, Encounters, and Campaign Import/Export — Unified Design

**Run:** 2026-04-06T20-36-24-design-doc
**Phase:** forge
**Score:** 97/100
**Status:** Ready for execution

---

## Intent Hierarchy

```
Commander's Intent
└── Enable fast stat recording at the table, searchable encounter history,
    and portable game state sharing between players and groups.
    │
    ├── Strategic Goal A: Campaign-scoped bestiary with creature templates
    │   └── Tactical: Durable stat blocks, quick-create flow, < 3 taps to record armor
    │
    ├── Strategic Goal B: Generalized encounters (combat/social/exploration)
    │   └── Tactical: Note auto-linking, combat timeline migration, encounter history
    │
    └── Strategic Goal C: Full import/export as .skaldmark.json bundles
        └── Tactical: Privacy filter, merge engine, legacy .skaldbok.json support
```

---

## Scoring Rationale

| Dimension | Score | Notes |
|-----------|-------|-------|
| Completeness | 25/25 | All entity types, migrations, error cases, and delivery order defined |
| Correctness | 24/25 | Minor: attachment re-linking on NPC template migration not fully specified (attachments stay on archived note) |
| Feasibility | 24/25 | Combat timeline migration is highest-risk; mitigation plan is sound but integration timing is tight |
| Testability | 24/25 | Acceptance criteria are explicit and verifiable; round-trip test for import/export is well-defined |

**Total: 97/100**

---

## Sub-Spec 0: Shared Infrastructure

### 0.1 Dexie v6 Schema Migration

**File:** `src/storage/db/client.ts`

**Intent:** Single schema version bump that introduces all new tables and indexes, runs data migrations idempotently, and preserves existing data.

**Changes:**
- Add `creatureTemplates` table: `'id, campaignId, category, status, name'`
- Add `encounters` table: `'id, sessionId, campaignId, type, status'`
- Extend `notes` index to include `visibility`: `'id, campaignId, sessionId, type, status, pinned, visibility'`
- Run combat note → encounter migration (guarded by `migration_v6_combat` flag)
- Run NPC note → creature template migration (guarded by `migration_v6_npc` flag)

**Migration Guard Pattern:**
```typescript
// In upgrade handler:
const combatDone = await db.table('meta').get('migration_v6_combat');
if (!combatDone) {
  // ... migrate
  await db.table('meta').put({ key: 'migration_v6_combat', value: true });
}
```

**Acceptance Criteria:**
- [ ] `db.version(6).stores(...)` contains all three table definitions
- [ ] Upgrade handler runs combat migration if flag not set
- [ ] Upgrade handler runs NPC migration if flag not set
- [ ] Migration failure leaves app on v5 with data intact (Dexie upgrade transaction semantics)
- [ ] Both migration flags set after successful run; re-run is no-op

---

### 0.2 Zod Type Schemas

**Files:**
- `src/types/creatureTemplate.ts`
- `src/types/encounter.ts`
- `src/types/bundle.ts`

**Intent:** Define canonical TypeScript types via Zod for all new entities, enabling runtime validation at import boundary and full type safety throughout the codebase.

#### `creatureTemplate.ts`

```typescript
export const creatureTemplateSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  name: z.string(),
  description: z.any().optional(),        // Tiptap JSON or plain string
  category: z.enum(['monster', 'npc', 'animal']),
  role: z.string().optional(),
  affiliation: z.string().optional(),
  stats: z.object({
    hp: z.number(),
    armor: z.number(),
    movement: z.number(),
  }),
  attacks: z.array(z.object({
    name: z.string(),
    damage: z.string(),
    range: z.string(),
    skill: z.string(),
    special: z.string().optional(),
  })),
  abilities: z.array(z.object({ name: z.string(), description: z.string() })),
  skills: z.array(z.object({ name: z.string(), value: z.number() })),
  tags: z.array(z.string()),
  imageUrl: z.string().optional(),
  status: z.enum(['active', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number(),
});
export type CreatureTemplate = z.infer<typeof creatureTemplateSchema>;
```

#### `encounter.ts`

```typescript
export const encounterParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['pc', 'npc', 'monster']),
  linkedCreatureId: z.string().optional(),
  linkedCharacterId: z.string().optional(),
  instanceState: z.object({
    currentHp: z.number().optional(),
    conditions: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),
  sortOrder: z.number(),
});

export const encounterSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  campaignId: z.string(),
  title: z.string(),
  type: z.enum(['combat', 'social', 'exploration']),
  status: z.enum(['active', 'ended']),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  participants: z.array(encounterParticipantSchema),
  combatData: z.object({
    currentRound: z.number(),
    events: z.array(z.any()),
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number(),
});
export type Encounter = z.infer<typeof encounterSchema>;
export type EncounterParticipant = z.infer<typeof encounterParticipantSchema>;
```

#### `bundle.ts`

```typescript
export const bundleEnvelopeSchema = z.object({
  version: z.literal(1),
  type: z.enum(['character', 'session', 'campaign']),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  system: z.literal('dragonbane'),
  contentHash: z.string().optional(),
  contents: z.object({
    campaign: campaignSchema.optional(),
    sessions: z.array(sessionSchema).optional(),
    parties: z.array(partySchema).optional(),
    partyMembers: z.array(partyMemberSchema).optional(),
    characters: z.array(characterRecordSchema).optional(),
    creatureTemplates: z.array(creatureTemplateSchema).optional(),
    encounters: z.array(encounterSchema).optional(),
    notes: z.array(noteSchema).optional(),
    entityLinks: z.array(entityLinkSchema).optional(),
    attachments: z.array(attachmentMetaSchema).optional(),
  }),
});
export type BundleEnvelope = z.infer<typeof bundleEnvelopeSchema>;
```

**Acceptance Criteria:**
- [ ] All three schema files compile without TypeScript errors
- [ ] `creatureTemplateSchema.safeParse(validObject)` returns `{ success: true }`
- [ ] `encounterSchema.safeParse(validObject)` returns `{ success: true }`
- [ ] `bundleEnvelopeSchema.safeParse(validEnvelope)` returns `{ success: true }`
- [ ] Existing `noteSchema` extended with `visibility: z.enum(['public', 'private']).default('public')` — no existing reads break
- [ ] No existing Zod schemas in `src/types/` are modified (only extended with optional fields)

---

### 0.3 Entity Link Types

**File:** `src/storage/repositories/entityLinkRepository.ts`

**Intent:** Verify and confirm that the entity link system accepts `'encounter'` and `'creature'` as `fromEntityType`/`toEntityType` values without schema changes.

**Action:** Inspect `entityLinkRepository.ts` for any whitelist on entity type strings. If none exists (expected — free-string field), no code changes required. Document the finding in a code comment.

**Acceptance Criteria:**
- [ ] `entityLinkRepository.ts` contains no whitelist/enum guard on `fromEntityType` or `toEntityType`
- [ ] Creating an entity link with `fromEntityType: 'encounter'` and `toEntityType: 'note'` succeeds at runtime
- [ ] Creating an entity link with `fromEntityType: 'creature'` succeeds at runtime

---

## Sub-Spec 1: Feature A — Bestiary & Encounters

### 1.1 Repositories

**Files:**
- `src/storage/repositories/creatureTemplateRepository.ts`
- `src/storage/repositories/encounterRepository.ts`

**Intent:** Stateless async CRUD functions following the existing repository pattern. All functions use `generateId()` and `nowISO()` for IDs and timestamps.

**`creatureTemplateRepository` exports:**
```typescript
create(data: Omit<CreatureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<CreatureTemplate>
getById(id: string): Promise<CreatureTemplate | undefined>
listByCampaign(campaignId: string): Promise<CreatureTemplate[]>
update(id: string, patch: Partial<CreatureTemplate>): Promise<CreatureTemplate>
archive(id: string): Promise<void>
```

**`encounterRepository` exports:**
```typescript
create(data: Omit<Encounter, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Encounter>
getById(id: string): Promise<Encounter | undefined>
listBySession(sessionId: string): Promise<Encounter[]>
listByCampaign(campaignId: string): Promise<Encounter[]>
update(id: string, patch: Partial<Encounter>): Promise<Encounter>
end(id: string): Promise<Encounter>
updateParticipant(encounterId: string, participantId: string, patch: Partial<EncounterParticipant>): Promise<Encounter>
addParticipant(encounterId: string, participant: Omit<EncounterParticipant, 'id'>): Promise<Encounter>
```

**Acceptance Criteria:**
- [ ] `creatureTemplateRepository.create()` inserts record and returns typed object
- [ ] `creatureTemplateRepository.listByCampaign()` returns only templates for given campaignId
- [ ] `encounterRepository.create()` inserts record and returns typed object
- [ ] `encounterRepository.listBySession()` returns encounters for given sessionId
- [ ] `encounterRepository.updateParticipant()` updates nested participant without replacing others
- [ ] All functions use `safeParse()` on read with `console.warn` on failure, return `undefined`
- [ ] No repository function throws — errors returned via result pattern or undefined

---

### 1.2 Bestiary Screen

**Files:**
- `src/features/bestiary/BestiaryScreen.tsx`
- `src/features/bestiary/CreatureTemplateCard.tsx`
- `src/features/bestiary/CreatureTemplateForm.tsx`
- `src/features/bestiary/useBestiary.ts`

**Intent:** Campaign-scoped CRUD UI for creature templates. Search by name/tag, filter by category, browse cards, tap to view/edit stat block.

**`useBestiary` hook:**
```typescript
{
  templates: CreatureTemplate[],
  search: string,
  setSearch: (s: string) => void,
  categoryFilter: 'all' | 'monster' | 'npc' | 'animal',
  setCategoryFilter: (f: ...) => void,
  create: (data: ...) => Promise<void>,
  update: (id: string, patch: ...) => Promise<void>,
  archive: (id: string) => Promise<void>,
}
```

**Navigation entry points:**
- Session screen → "Bestiary" button (when campaign is active)
- Main navigation tab/item

**Acceptance Criteria:**
- [ ] BestiaryScreen renders list of creature templates for active campaign
- [ ] Search filters templates by name and tags (case-insensitive)
- [ ] Category filter (`all` / `monster` / `npc` / `animal`) narrows list
- [ ] Tapping a template opens stat block view with all fields (HP, armor, movement, attacks, abilities, skills)
- [ ] "New Creature" flow opens CreatureTemplateForm, saves, and appears in list
- [ ] Editing updates template; archiving hides from default list view
- [ ] Archived templates accessible via "Show archived" toggle
- [ ] Bestiary accessible from session screen when campaign is active
- [ ] Bestiary accessible from main navigation

---

### 1.3 Encounter Feature

**Files:**
- `src/features/encounters/EncounterListItem.tsx`
- `src/features/encounters/EncounterScreen.tsx`
- `src/features/encounters/ParticipantDrawer.tsx`
- `src/features/encounters/QuickCreateParticipantFlow.tsx`
- `src/features/encounters/useEncounter.ts`
- `src/features/encounters/useEncounterList.ts`

**Intent:** Encounter creation, participant management, note auto-linking, combat-type and non-combat-type rendering.

**`useEncounter` hook:**
```typescript
{
  encounter: Encounter | null,
  participants: EncounterParticipant[],
  linkedNotes: Note[],
  startEncounter: (type, title) => Promise<Encounter>,
  endEncounter: () => Promise<void>,
  addParticipantFromTemplate: (templateId: string) => Promise<void>,
  addParticipantFromCharacter: (characterId: string) => Promise<void>,
  quickCreateParticipant: (name: string, stats: Partial<...>) => Promise<void>,
  updateParticipantState: (participantId: string, patch: ...) => Promise<void>,
}
```

**Note auto-linking:** When a note is created with `sessionId` and an active encounter exists for that session, automatically call `entityLinkRepository.create({ fromEntityType: 'encounter', fromEntityId: encounterId, toEntityType: 'note', toEntityId: noteId, relationshipType: 'contains' })`.

**Quick-create flow:**
1. Tap "Add participant" → "Quick create" option
2. User types name + key stats inline
3. System creates CreatureTemplate + EncounterParticipant in one operation
4. If name matches existing template → prompt "Link to existing or create new?"

**Tap to record stat (< 3 taps):**
1. Tap participant row (tap 1)
2. Tap stat field in drawer (tap 2)
3. Type value → auto-save (tap 3 = done)

**Acceptance Criteria:**
- [ ] User can start encounter (combat/social/exploration) from session screen with title
- [ ] User can add participant from bestiary by searching templates
- [ ] User can add participant from current party (PCs)
- [ ] User can quick-create participant — creates template + participant in ≤ 3 taps
- [ ] Tapping participant opens stat drawer: template stats (read-only) + instance state (editable)
- [ ] Recording armor via stat drawer completes in ≤ 3 taps
- [ ] Notes created while encounter is active are auto-linked to that encounter via entity links
- [ ] Linked notes appear in encounter's notes feed
- [ ] Social/exploration encounters show participant list + linked notes feed
- [ ] Ending encounter sets `status: 'ended'` and `endedAt` timestamp
- [ ] Past encounters browsable from session screen with participants and notes
- [ ] Session end prompts to end active encounters or carry them over

---

### 1.4 Combat Encounter (Timeline Migration)

**Files:**
- `src/features/encounters/CombatEncounterView.tsx` (new, wraps existing combat UI)
- `src/components/combat/CombatTimeline.tsx` (existing — interface unchanged)

**Intent:** Combat-type encounters render the existing combat timeline. The timeline is rewired to read from `encounter.combatData` and `encounter.participants` instead of note `typeData`. **Keep original `CombatTimeline.tsx` interface unchanged until new view is verified.**

**Migration approach:**
1. Build `CombatEncounterView` that passes encounter-sourced data to `CombatTimeline` via existing props
2. Verify rendering matches original
3. Only then switch session screen to use encounter-based routing

**Acceptance Criteria:**
- [ ] Combat-type encounter renders CombatTimeline with rounds, events, and participants
- [ ] Participants in combat encounter show linked creature template stats in drawer
- [ ] `CombatTimeline.tsx` component props are unchanged (no interface modification)
- [ ] Existing combat notes migrated in Dexie v6 render correctly as combat encounters
- [ ] Original combat notes remain accessible as archived

---

### 1.5 NPC Note Deprecation

**Files (impact-analyzed):**
- `src/types/noteValidators.ts` — keep `npcTypeDataSchema` for migration parsing (no removal)
- `src/features/notes/QuickNoteDrawer.tsx` — remove `'npc'` from type picker options
- `src/features/notes/NotesGrid.tsx` — update type filter: `'npc'` replaced by archived view
- `src/features/notes/NoteItem.tsx` — NPC-specific rendering remains for archived notes
- `src/screens/NoteEditorScreen.tsx` — NPC-specific editor fields hidden for new notes
- `src/features/notes/useNoteActions.ts` — NPC entity linking preserved for archived notes
- `src/types/note.ts` — `'npc'` kept in const/schema for backward compat, removed from UI pickers

**Acceptance Criteria:**
- [ ] `'npc'` does not appear in new-note type picker
- [ ] Existing (archived) NPC notes still render in NotesGrid when "show archived" is active
- [ ] No TypeScript errors in any affected file
- [ ] NPC note type not present in `noteSchema` type picker enum used by QuickNoteDrawer

---

## Sub-Spec 2: Feature B — Import/Export

### 2.1 Scope Collectors

**File:** `src/utils/export/collectors.ts`

**Intent:** Query IndexedDB for all entities belonging to a given export scope. Three collectors: character, session, campaign.

**`collectCharacterBundle(characterId: string): Promise<BundleContents>`**
- Character record + notes linked via entity links (from OR to characterId) + those notes' entity links + attachments

**`collectSessionBundle(sessionId: string): Promise<BundleContents>`**
- Session + notes (by sessionId) + active party + party members + linked characters + character-linked notes + encounters (by sessionId) + creature templates referenced by encounter participants (`linkedCreatureId`) + entity links + attachments

**`collectCampaignBundle(campaignId: string): Promise<BundleContents>`**
- Everything: campaign + all sessions + all parties/members + all notes + all characters + all creature templates + all encounters + all entity links + all attachments

**Acceptance Criteria:**
- [ ] `collectCharacterBundle` includes notes linked to character via entity links (from OR to)
- [ ] `collectSessionBundle` includes encounters with matching sessionId
- [ ] `collectSessionBundle` includes creature templates referenced by those encounters' participants
- [ ] `collectCampaignBundle` includes all creature templates and encounters in campaign
- [ ] No collector throws — errors caught and returned in result pattern
- [ ] Each collector returns a `BundleContents` shape matching `bundleEnvelopeSchema.contents`

---

### 2.2 Privacy Filter

**File:** `src/utils/export/privacyFilter.ts`

**Intent:** Strip private notes and orphaned references from bundle contents before serialization.

**`applyPrivacyFilter(contents: BundleContents, includePrivate: boolean): BundleContents`**
- If `!includePrivate`: remove notes where `visibility === 'private'`
- Remove entity links where `fromEntityId` or `toEntityId` references a removed note
- Remove attachments where `noteId` (or equivalent link field) references a removed note

**Acceptance Criteria:**
- [ ] Default export (includePrivate=false) excludes `visibility: 'private'` notes
- [ ] Opt-in (includePrivate=true) includes all notes regardless of visibility
- [ ] Entity links referencing stripped notes are removed
- [ ] Attachments referencing stripped notes are removed
- [ ] Notes with no visibility field (legacy) treated as `'public'`

---

### 2.3 Bundle Serializer + Delivery

**File:** `src/utils/export/bundleSerializer.ts`

**Intent:** Wrap collected + filtered contents into a `BundleEnvelope`, compute optional SHA-256 contentHash, convert attachment Blobs to base64, and call existing delivery utility.

**`serializeBundle(type, contents, options): Promise<string>`** — returns JSON string
**`deliverBundle(slug: string, json: string): Promise<void>`** — delegates to `utils/export/delivery.ts`

**File naming:** `{slug}.skaldmark.json`

**Acceptance Criteria:**
- [ ] Output JSON parses as valid `BundleEnvelope` (version: 1, system: 'dragonbane')
- [ ] `contentHash` field present and matches SHA-256 of `JSON.stringify(contents)` when Web Crypto API available
- [ ] Attachment Blobs converted to base64 strings in output
- [ ] File delivered via existing `shareFile`/download pattern from `utils/export/delivery.ts`
- [ ] File extension is `.skaldmark.json`
- [ ] Attachment size warning logged/toasted at 20MB total

---

### 2.4 Bundle Parser + Validator

**File:** `src/utils/import/bundleParser.ts`

**Intent:** Parse and validate a `.skaldmark.json` or legacy `.skaldbok.json` file at the import boundary using `safeParse()`.

**`parseBundle(json: string): ParsedBundleResult`**

```typescript
type ParsedBundleResult =
  | { success: true; bundle: BundleEnvelope; warnings: ValidationWarning[] }
  | { success: false; error: string; partialBundle?: Partial<BundleEnvelope> }
```

- Invalid JSON → `{ success: false, error: 'Invalid JSON' }`
- `version > 1` → `{ success: false, error: 'Unsupported bundle version. Please upgrade Skaldmark.' }`
- `version < 1` → apply migration transforms, then parse
- Legacy `.skaldbok.json` (bare CharacterRecord) → wrap in envelope as `type: 'character'`
- Per-entity Zod failures → `warnings[]` with entity index and path; entity skipped in partial import
- `contentHash` mismatch → warning (non-blocking)

**Acceptance Criteria:**
- [ ] Valid `.skaldmark.json` parses successfully
- [ ] Legacy `.skaldbok.json` (bare CharacterRecord) detected and wrapped as character bundle
- [ ] Invalid JSON returns `{ success: false }`
- [ ] `version > 1` returns `{ success: false }` with upgrade prompt message
- [ ] Per-entity Zod failures produce warnings; other valid entities still returned
- [ ] `contentHash` mismatch produces warning, does not block import
- [ ] No use of `JSON.parse` without try/catch; all Zod validation via `safeParse()`

---

### 2.5 Merge Engine

**File:** `src/utils/import/mergeEngine.ts`

**Intent:** Merge parsed bundle contents into local IndexedDB, resolving conflicts by `updatedAt`, respecting entity processing order, supporting selective import.

**`mergeBundle(bundle: BundleEnvelope, options: MergeOptions): Promise<MergeReport>`**

```typescript
type MergeOptions = {
  targetCampaignId?: string;
  selectedEntityTypes: Set<keyof BundleContents>;
}

type MergeReport = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: MergeError[];
}
```

**Processing order (FK-safe):**
1. Campaign
2. Sessions
3. Parties
4. Party Members
5. Characters
6. Creature Templates
7. Encounters
8. Notes
9. Entity Links
10. Attachments

**Dedup rules per entity:**
- Same ID, newer `updatedAt` → update (overwrite local)
- Same ID, identical `updatedAt` → skip
- Same ID, older `updatedAt` → skip (keep local)
- No ID match → insert

**Re-parenting:** Set `campaignId` to `targetCampaignId` on all entities. Preserve `sessionId` if session in bundle; clear if not.

**Unresolvable `linkedCreatureId`:** Log warning, retain participant with existing `instanceState`, do not fail.

**Acceptance Criteria:**
- [ ] Processing order matches spec (Campaign → ... → Attachments)
- [ ] Same ID + newer updatedAt → local entity updated
- [ ] Same ID + identical updatedAt → entity skipped (count in `skipped`)
- [ ] Same ID + older updatedAt → local entity kept (count in `skipped`)
- [ ] No matching ID → entity inserted
- [ ] `targetCampaignId` applied to all imported entities
- [ ] `sessionId` cleared when session not present in bundle
- [ ] Unresolvable `linkedCreatureId` logs warning, does not fail merge
- [ ] Selective import: only entity types in `selectedEntityTypes` are processed
- [ ] Returns `MergeReport` with accurate counts; never throws

---

### 2.6 Import Preview UI

**File:** `src/components/import/ImportPreview.tsx`

**Intent:** Display bundle metadata, entity counts, validation warnings, and conflicts. Allow per-entity-group checkboxes and campaign targeting for session/character imports.

**UI elements:**
- Bundle type badge (character / session / campaign)
- Entity counts table: one row per entity type (including `creatureTemplates`, `encounters`)
- Validation warnings list (per-entity errors from parser)
- Conflict list: entities where bundle `updatedAt` differs from local `updatedAt`
- Per-entity-group checkboxes (default all checked)
- Campaign selector dropdown (for session and character imports)
- "Import" and "Cancel" buttons
- `contentHash` mismatch warning banner (non-blocking)

**Acceptance Criteria:**
- [ ] Shows entity count for each type including `creatureTemplates` and `encounters`
- [ ] Validation warnings from parser displayed per entity
- [ ] Conflicts (differing updatedAt) listed with entity name and conflict type
- [ ] Per-group checkboxes present and functional
- [ ] Campaign selector shown for session/character bundles
- [ ] Import disabled until target campaign selected (for session/character)
- [ ] "Import N items" button label updates based on checked entities
- [ ] contentHash mismatch displayed as non-blocking warning

---

### 2.7 Export/Import Hook Integration

**Files:**
- `src/features/export/useExportActions.ts` (extend existing)
- `src/features/import/useImportActions.ts` (new or extend)

**Intent:** Wire export/import flows to UI entry points (character detail, session screen, campaign settings). Follow error handling pattern from existing `useExportActions.ts`.

**Export entry points:**
- Character detail screen → "Export character" → `collectCharacterBundle` → privacy filter → serialize → deliver
- Session screen → "Export session" → `collectSessionBundle` → privacy filter → serialize → deliver
- Campaign settings → "Export campaign" → `collectCampaignBundle` → privacy filter → serialize → deliver

**Import entry point:**
- Global or campaign settings → "Import" → file picker (`.skaldmark.json`, `.skaldbok.json`) → parse → preview → merge → toast report

**Toast on complete:** `"Imported {N} new, updated {M}, skipped {K}"` or error message.

**Acceptance Criteria:**
- [ ] Character export produces `.skaldmark.json` with character + linked notes + attachments
- [ ] Session export includes encounters and creature templates
- [ ] Campaign export includes all entity types
- [ ] Import file picker accepts `.skaldmark.json` and `.skaldbok.json`
- [ ] MergeReport displayed as toast after import
- [ ] Errors displayed as toast with actionable message
- [ ] No new npm dependencies introduced

---

## Sub-Spec 3: Integration & Round-Trip Verification

### 3.1 Round-Trip Test: Character

**Scenario:** Create character with notes → export → import to empty campaign → verify.

**Acceptance Criteria:**
- [ ] Exported character bundle parses without errors
- [ ] All notes linked to character present in bundle (minus private)
- [ ] Re-import inserts all entities under target campaign
- [ ] Second import of same bundle: all entities skipped (identical updatedAt)
- [ ] Private notes excluded from default export; present with opt-in toggle

---

### 3.2 Round-Trip Test: Session with Encounters

**Scenario:** Session with combat encounter, creature templates, notes → export → import to different campaign.

**Acceptance Criteria:**
- [ ] Bundle contains session, encounter, participants, creature templates, notes, entity links
- [ ] Import under different campaign: all entities re-parented to target campaignId
- [ ] Encounter participants resolve `linkedCreatureId` to imported templates
- [ ] Encounter-note entity links preserved (note appears in encounter feed post-import)

---

### 3.3 Round-Trip Test: Full Campaign

**Scenario:** Campaign with multiple sessions, encounters, bestiary, notes, characters → export → import to fresh app.

**Acceptance Criteria:**
- [ ] Bundle includes all entity types
- [ ] Import to fresh app (no existing data) inserts everything
- [ ] Campaign structure intact: sessions linked to campaign, encounters linked to sessions
- [ ] Creature templates linked to campaigns; encounter participants resolve templates
- [ ] Notes linked to sessions and encounters via entity links
- [ ] Party structure intact: party members linked to characters

---

### 3.4 Migration Verification

**Acceptance Criteria:**
- [ ] Pre-migration: app on Dexie v5 with combat notes and NPC notes
- [ ] Post-migration (v6): combat notes exist as archived + new encounter entities created
- [ ] Post-migration (v6): NPC notes exist as archived + new creature template entities created
- [ ] CombatTimeline renders correctly from encounter entities (not note typeData)
- [ ] Migration flags set; re-opening app does not re-run migrations
- [ ] App `npm run build` succeeds after all changes

---

## Delivery Order (Execution Sequence)

| Step | Sub-spec | Deliverable | Verify Before Next |
|------|----------|-------------|-------------------|
| 1 | 0.2 | Type schemas: creatureTemplate.ts, encounter.ts, bundle.ts | `tsc --noEmit` passes |
| 2 | 0.1 | Dexie v6 schema + migrations in client.ts | Manual: app opens, migration runs once |
| 3 | 0.3 | Entity link type verification | No whitelist found or removed |
| 4 | 1.1 | creatureTemplateRepository + encounterRepository | Unit: CRUD round-trips work |
| 5 | 1.2 | Bestiary screen + useBestiary | Manual: create/edit/archive template |
| 6 | 1.3 | Encounter screen + useEncounter + note auto-linking | Manual: start encounter, add participant, note links |
| 7 | 1.4 | CombatEncounterView (timeline migration) | Manual: existing combat notes render as encounters |
| 8 | 1.5 | NPC note type deprecation | Manual: no NPC option in new-note picker |
| 9 | 2.1 | Scope collectors | Unit: character/session/campaign collections correct |
| 10 | 2.2 | Privacy filter | Unit: private notes stripped, links/attachments cleaned |
| 11 | 2.3 | Bundle serializer + delivery | Manual: file downloaded as .skaldmark.json |
| 12 | 2.4 | Bundle parser + validator | Unit: valid/invalid/legacy files handled |
| 13 | 2.5 | Merge engine | Unit: dedup rules, processing order, re-parenting |
| 14 | 2.6 | Import Preview UI | Manual: counts, checkboxes, campaign selector |
| 15 | 2.7 | Hook integration (export/import entry points) | Manual: full export+import cycle |
| 16 | 3.1–3.4 | Round-trip + migration verification | All acceptance criteria pass |

---

## Constraints Reference

| Constraint | Source | Impact |
|------------|--------|--------|
| No existing repository function signature changes | Commander's Intent | New functions only; no modifying existing exports |
| Dexie schema only in client.ts with proper migration | Commander's Intent | All schema work in Sub-spec 0.1 |
| No new npm dependencies | Commander's Intent | Use Web Crypto API (built-in) for SHA-256; no lodash/extras |
| Extend Zod schemas only (no modify) | Commander's Intent | `noteSchema` gains `visibility` as optional field |
| Module-export repository pattern (not classes) | Commander's Intent | All repositories export named async functions |
| `safeParse()` at import boundary | Commander's Intent | Sub-spec 2.4 and all repository reads |
| Return `ImportResult`-style objects (not throw) | Commander's Intent | Sub-spec 2.5 MergeReport pattern |
| Existing `shareFile`/download patterns | Commander's Intent | Sub-spec 2.3 delegates to delivery.ts |
| Legacy `.skaldbok.json` support | Commander's Intent | Sub-spec 2.4 detection and wrapping |
| Campaign-scoped creature templates | Commander's Intent | All templates require campaignId |
| Preserve combat/NPC notes through migration | Commander's Intent | Archive, never delete; Sub-spec 0.1 |
| No new note types | Commander's Intent | Encounters replace combat/NPC note types |

---

## Escalation Triggers

Pause and request human approval if any of the following occur:

1. A new npm dependency appears necessary (e.g., crypto polyfill, diff library)
2. Dexie migration requires changes beyond the defined schema (additional tables, altered indexes)
3. Entity link traversal produces runaway recursive expansion
4. `CombatTimeline.tsx` public props must change to support encounter-based data
5. NPC note type removal cascades to more than 3 files not listed in Sub-spec 1.5
6. `BundleEnvelope` import requires changes to existing `Note`, `Character`, or `Session` type schemas (not just extensions)

---

## Open Questions (All Resolved per Design Doc)

| Question | Resolution |
|----------|-----------|
| Auto-damage calculation | Deferred |
| Encounter types extensible? | Fixed enum for now (`combat`/`social`/`exploration`) |
| Bundle versioning | Version bump + migration transforms on import |
| Attachment re-linking on NPC migration | Attachments stay on archived note (not migrated to template) |
| Creature description format | Agent decides: Tiptap JSON or plain text |

---

*Spec generated by forge agent · Run 2026-04-06T20-36-24-design-doc · Score 97/100*
