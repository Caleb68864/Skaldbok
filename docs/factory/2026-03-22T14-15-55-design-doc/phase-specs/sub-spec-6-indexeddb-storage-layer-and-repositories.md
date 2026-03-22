---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 6
title: "IndexedDB Storage Layer and Repositories"
date: 2026-03-22
dependencies: ["4"]
---

# Sub-Spec 6: IndexedDB Storage Layer and Repositories

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Implement the IndexedDB persistence layer using Dexie.js. Define the database schema with stores for characters, systems, appSettings, referenceNotes, and metadata. Create repository classes/modules for characters (getAll, getById, save, delete), systems (getAll, getById, save), and settings (get, save). Create utility modules for ID generation and date formatting.

## Interface Contracts

### Provides
- `src/storage/db/client.ts`: Exports `db` -- a Dexie database instance with typed tables
- `src/storage/repositories/characterRepository.ts`: Exports `{ getAll, getById, save, remove }` for CharacterRecord
- `src/storage/repositories/systemRepository.ts`: Exports `{ getAll, getById, save }` for SystemDefinition
- `src/storage/repositories/settingsRepository.ts`: Exports `{ get, save }` for AppSettings
- `src/storage/repositories/referenceNoteRepository.ts`: Exports `{ getAll, save, remove }` for reference notes
- `src/utils/ids.ts`: Exports `generateId(): string` (UUID v4 or similar)
- `src/utils/dates.ts`: Exports `nowISO(): string` returning current ISO 8601 timestamp

### Requires
- From sub-spec 4: `CharacterRecord`, `SystemDefinition`, `AppSettings` types from `src/types/`

### Shared State
- IndexedDB database named `skaldbok-db` with object stores: `characters`, `systems`, `appSettings`, `referenceNotes`, `metadata`

## Implementation Steps

### Step 1: Create utility modules
- **File:** `src/utils/ids.ts`, `src/utils/dates.ts`
- **Action:** create
- **Changes:**
  - `ids.ts`: Export `generateId()` using `crypto.randomUUID()` (supported in all modern browsers)
  - `dates.ts`: Export `nowISO()` returning `new Date().toISOString()`

### Step 2: Create Dexie database client
- **File:** `src/storage/db/client.ts`
- **Action:** create
- **Changes:** Define a Dexie subclass or instance with typed tables:
  ```ts
  import Dexie, { type Table } from 'dexie';
  import type { CharacterRecord } from '../../types/character';
  import type { SystemDefinition } from '../../types/system';
  import type { AppSettings } from '../../types/settings';

  export interface ReferenceNote {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }

  class SkaldbokDatabase extends Dexie {
    characters!: Table<CharacterRecord, string>;
    systems!: Table<SystemDefinition, string>;
    appSettings!: Table<AppSettings, string>;
    referenceNotes!: Table<ReferenceNote, string>;

    constructor() {
      super('skaldbok-db');
      this.version(1).stores({
        characters: 'id, systemId, updatedAt',
        systems: 'id',
        appSettings: 'id',
        referenceNotes: 'id, updatedAt',
      });
    }
  }

  export const db = new SkaldbokDatabase();
  ```
  Note: The `appSettings` store uses a single record with id `'default'`.

### Step 3: Create character repository
- **File:** `src/storage/repositories/characterRepository.ts`
- **Action:** create
- **Changes:** Export functions that wrap Dexie operations:
  - `getAll(): Promise<CharacterRecord[]>` -- `db.characters.toArray()`
  - `getById(id: string): Promise<CharacterRecord | undefined>` -- `db.characters.get(id)`
  - `save(character: CharacterRecord): Promise<void>` -- `db.characters.put(character)` with try/catch for quota errors
  - `remove(id: string): Promise<void>` -- `db.characters.delete(id)`
  - All write operations must catch errors and throw a descriptive error (never silently fail)

### Step 4: Create system repository
- **File:** `src/storage/repositories/systemRepository.ts`
- **Action:** create
- **Changes:** Export functions:
  - `getAll(): Promise<SystemDefinition[]>`
  - `getById(id: string): Promise<SystemDefinition | undefined>`
  - `save(system: SystemDefinition): Promise<void>`

### Step 5: Create settings repository
- **File:** `src/storage/repositories/settingsRepository.ts`
- **Action:** create
- **Changes:** Export functions:
  - `get(): Promise<AppSettings | undefined>` -- reads the single `'default'` record
  - `save(settings: AppSettings): Promise<void>` -- puts with id `'default'`

### Step 6: Create reference note repository
- **File:** `src/storage/repositories/referenceNoteRepository.ts`
- **Action:** create
- **Changes:** Export functions:
  - `getAll(): Promise<ReferenceNote[]>`
  - `save(note: ReferenceNote): Promise<void>`
  - `remove(id: string): Promise<void>`

### Step 7: Create storage barrel export
- **File:** `src/storage/index.ts`
- **Action:** create
- **Changes:** Re-export db client and all repositories.

### Step 8: Verify type-check
- **Run:** `npx tsc --noEmit`
- **Expected:** Zero errors.

### Step 9: Commit
- **Stage:** `git add src/storage/ src/utils/ids.ts src/utils/dates.ts`
- **Message:** `feat: indexeddb storage layer and repositories`

## Acceptance Criteria

- `[STRUCTURAL]` IndexedDB client defines object stores for characters, systems, appSettings, referenceNotes, and metadata (REQ-015)
- `[STRUCTURAL]` characterRepository exports getAll, getById, save, and delete methods (REQ-016)
- `[BEHAVIORAL]` Saving a character and then calling getById with its id returns the same character data (REQ-016)
- `[BEHAVIORAL]` Calling getAll on an empty database returns an empty array without errors (REQ-015)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- behavioral criteria verified at integration time in the browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Verify store names: Read `src/storage/db/client.ts`, confirm stores for characters, systems, appSettings, referenceNotes
  - Verify repository methods: Read `src/storage/repositories/characterRepository.ts`, confirm getAll, getById, save, remove exports
  - Behavioral tests run in-browser during sub-spec 7-8 integration

## Patterns to Follow

- Use Dexie's `Table.put()` for upsert semantics (create or update).
- All repository functions are plain async functions (not class methods) for simplicity and tree-shaking.
- Error handling: catch `QuotaExceededError` and DOMException from IndexedDB writes, re-throw with a user-friendly message string.
- The settings store uses a singleton pattern: always read/write with id `'default'`.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/utils/ids.ts | Create | UUID generation utility |
| src/utils/dates.ts | Create | ISO timestamp utility |
| src/storage/db/client.ts | Create | Dexie database definition with typed tables |
| src/storage/repositories/characterRepository.ts | Create | Character CRUD operations |
| src/storage/repositories/systemRepository.ts | Create | System definition storage |
| src/storage/repositories/settingsRepository.ts | Create | App settings persistence |
| src/storage/repositories/referenceNoteRepository.ts | Create | Reference notes persistence |
| src/storage/index.ts | Create | Barrel export for storage layer |
