# Phase Spec — SS-04: Note Repositories & useNoteActions

```yaml
sub-spec: SS-04
title: Note Repositories & useNoteActions
stage: 1
priority: P0
score: 92
depends-on: SS-02, SS-03
run: 2026-03-31T01-23-45-design-doc
```

> **Dependency Order:** Requires **SS-02** (Dexie v3 Schema + Zod types) and **SS-03** (CampaignContext) to be complete first. Repository functions need the Dexie tables; `useNoteActions` reads `campaignId` and `sessionId` from `CampaignContext`. SS-09 (Notes Hub) depends on this sub-spec.

---

## Intent

Provide the full CRUD and auto-linking layer for notes. Repository functions are pure async; the hook is the stateful service layer that reads context and orchestrates operations.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-S4-01 | The following repository files exist as pure async functions (no classes, no React imports): `src/storage/repositories/noteRepository.ts`, `src/storage/repositories/entityLinkRepository.ts`, `src/storage/repositories/campaignRepository.ts`, `src/storage/repositories/sessionRepository.ts`, `src/storage/repositories/partyRepository.ts`. |
| AC-S4-02 | `noteRepository` exposes at minimum: `getNoteById(id)`, `getNotesByCampaign(campaignId)`, `getNotesBySession(sessionId)`, `createNote(data)`, `updateNote(id, data)`, `deleteNote(id)`. |
| AC-S4-03 | `entityLinkRepository` exposes at minimum: `getLinksFrom(fromEntityId, relationshipType)`, `getLinksTo(toEntityId, relationshipType)`, `createLink(data)`, `deleteLinksForNote(noteId)`. |
| AC-S4-04 | All repository reads validate the returned record(s) against the corresponding Zod schema. A record failing validation logs a warning and returns `undefined` rather than throwing. |
| AC-S4-05 | `useNoteActions()` hook returns `{ createNote, updateNote, deleteNote, linkNote, pinNote, unpinNote }`. Each action reads `campaignId` and `sessionId` from `CampaignContext` automatically — callers do not pass context IDs. |
| AC-S4-06 | `createNote()` auto-creates EntityLinks on save: `session → note` (`relationshipType: "contains"`) and `note → session` (`relationshipType: "introduced_in"`) for `npc` type. Links are NOT duplicated if already present (deduplicate check). |
| AC-S4-07 | `deleteNote()` cascades: calls `entityLinkRepository.deleteLinksForNote()` before deleting the note record. |
| AC-S4-08 | `pinNote(noteId)` / `unpinNote(noteId)` toggle `note.pinned` in Dexie. |
| AC-S4-09 | All repository functions wrap Dexie calls in try-catch and rethrow with a descriptive message (e.g., `"noteRepository.createNote failed:"`). |
| AC-S4-10 | `useNoteActions()` catches repository errors and calls `showToast()` with a user-facing message. It does NOT rethrow to the component. |
| AC-S4-11 | Basic CRUD round-trip passes for each repository: create → read back → update → read back → delete → confirm gone. (Verified in browser dev tools during Stage 1 sign-off.) |

---

## Implementation Steps

### 1. Create `src/storage/repositories/noteRepository.ts`

Pure async functions only. No classes. No React imports.

```ts
import { db } from '../db/client';
import { noteSchema, Note } from '../../types/note';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

export async function getNoteById(id: string): Promise<Note | undefined> { ... }
export async function getNotesByCampaign(campaignId: string): Promise<Note[]> { ... }
export async function getNotesBySession(sessionId: string): Promise<Note[]> { ... }
export async function createNote(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> { ... }
export async function updateNote(id: string, data: Partial<Note>): Promise<Note> { ... }
export async function deleteNote(id: string): Promise<void> { ... }
```

- Each read validates with `noteSchema.safeParse()` — on failure, `console.warn(...)` and return `undefined` / filter from arrays
- Each function wraps Dexie in try-catch: `catch (e) { throw new Error(\`noteRepository.X failed: \${e}\`); }`

### 2. Create `src/storage/repositories/entityLinkRepository.ts`

```ts
export async function getLinksFrom(fromEntityId: string, relationshipType: string): Promise<EntityLink[]> { ... }
export async function getLinksTo(toEntityId: string, relationshipType: string): Promise<EntityLink[]> { ... }
export async function createLink(data: Omit<EntityLink, 'id' | 'createdAt' | 'updatedAt'>): Promise<EntityLink> { ... }
export async function deleteLinksForNote(noteId: string): Promise<void> { ... }
```

- `getLinksFrom` uses compound index: `db.entityLinks.where('[fromEntityId+relationshipType]').equals([fromEntityId, relationshipType])`
- `getLinksTo` uses compound index: `db.entityLinks.where('[toEntityId+relationshipType]').equals([toEntityId, relationshipType])`
- `deleteLinksForNote(noteId)`: deletes all links where `fromEntityId === noteId` OR `toEntityId === noteId`
  - Fetch both sets, collect ids, call `db.entityLinks.bulkDelete([...ids])`

### 3. Create `src/storage/repositories/campaignRepository.ts`

```ts
export async function getCampaignById(id: string): Promise<Campaign | undefined> { ... }
export async function getAllCampaigns(): Promise<Campaign[]> { ... }
export async function createCampaign(data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign> { ... }
export async function updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign> { ... }
```

### 4. Create `src/storage/repositories/sessionRepository.ts`

```ts
export async function getSessionById(id: string): Promise<Session | undefined> { ... }
export async function getSessionsByCampaign(campaignId: string): Promise<Session[]> { ... }
export async function getActiveSession(campaignId: string): Promise<Session | undefined> { ... }
export async function createSession(data: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> { ... }
export async function updateSession(id: string, data: Partial<Session>): Promise<Session> { ... }
```

### 5. Create `src/storage/repositories/partyRepository.ts`

```ts
export async function getPartyByCampaign(campaignId: string): Promise<Party | undefined> { ... }
export async function createParty(data: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>): Promise<Party> { ... }
export async function getPartyMembers(partyId: string): Promise<PartyMember[]> { ... }
export async function addPartyMember(data: Omit<PartyMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<PartyMember> { ... }
export async function removePartyMember(memberId: string): Promise<void> { ... }
```

### 6. Create `src/features/notes/useNoteActions.ts`

```ts
export function useNoteActions() {
  const { activeCampaign, activeSession } = useCampaignContext();
  const { showToast } = useToast();

  const createNote = async (data: ...) => { ... };
  const updateNote = async (id: string, data: ...) => { ... };
  const deleteNote = async (id: string) => { ... };
  const linkNote = async (noteId: string, sessionId: string) => { ... };
  const pinNote = async (noteId: string) => { ... };
  const unpinNote = async (noteId: string) => { ... };

  return { createNote, updateNote, deleteNote, linkNote, pinNote, unpinNote };
}
```

#### `createNote` implementation detail:
- Injects `campaignId: activeCampaign?.id` and `sessionId: activeSession?.id` automatically
- After creating note, if `activeSession` exists:
  - Check for existing `"contains"` link: `getLinksFrom(activeSession.id, 'contains')` → filter by `toEntityId === newNote.id`
  - If not present: `createLink({ fromEntityId: activeSession.id, fromEntityType: 'session', toEntityId: newNote.id, toEntityType: 'note', relationshipType: 'contains' })`
  - If note type is `'npc'`: also check/create `introduced_in` link from note → session
- Wrap in try-catch → `showToast('Failed to create note')` on error

#### `deleteNote` implementation detail:
- Call `entityLinkRepository.deleteLinksForNote(noteId)` first
- Then call `noteRepository.deleteNote(noteId)`

#### `pinNote` / `unpinNote`:
- Call `noteRepository.updateNote(id, { pinned: true/false })`

---

## Verification Commands

```
# TypeScript check
npx tsc --noEmit

# Manual browser CRUD round-trip (AC-S4-11):
# Open DevTools console and run repository functions directly (or via app UI):
# 1. noteRepository.createNote({...}) → check IndexedDB for record
# 2. noteRepository.getNoteById(id) → confirm returned
# 3. noteRepository.updateNote(id, { title: 'Updated' }) → check IndexedDB
# 4. noteRepository.deleteNote(id) → confirm gone from IndexedDB
# 5. entityLinkRepository.createLink({...}) → check entityLinks table
# 6. entityLinkRepository.deleteLinksForNote(noteId) → confirm cascade deletion
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Create** | `src/storage/repositories/noteRepository.ts` |
| **Create** | `src/storage/repositories/entityLinkRepository.ts` |
| **Create** | `src/storage/repositories/campaignRepository.ts` |
| **Create** | `src/storage/repositories/sessionRepository.ts` |
| **Create** | `src/storage/repositories/partyRepository.ts` |
| **Create** | `src/features/notes/useNoteActions.ts` |

---

## Cross-Cutting Constraints (apply to this sub-spec)

- `XC-01` Zero TypeScript errors
- `XC-02` All new IDs use `generateId()` from `src/utils/ids.ts`; timestamps use `nowISO()` from `src/utils/dates.ts`
- `XC-04` Named exports only
- `XC-05` Hook returns `{ fn1, fn2, ... }` object — no array returns
- `XC-06` `showToast()` from `useToast()` for user-facing errors in the hook
