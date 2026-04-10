---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 15
title: "Import/Export and Migration Scaffold"
date: 2026-03-22
dependencies: ["4", "6", "8"]
---

# Sub-Spec 15: Import/Export and Migration Scaffold

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Implement character JSON export (serializes to a downloadable .json file), character JSON import (parses a file, validates with Zod, shows readable errors on failure, persists on success without overwriting existing characters), and a migration utility scaffold that reads schemaVersion and routes through a migration pipeline.

Edge cases:
- Import of character with same id: assign a new id
- Import of character for unknown system: still import but show warning
- Malformed JSON: show clear error, do not modify existing data
- Special characters in character name: sanitize filename for download
- All imported JSON treated as untrusted: no script execution, no raw HTML rendering

## Interface Contracts

### Provides
- `src/utils/importExport.ts`: Exports `exportCharacter(character: CharacterRecord): void` (triggers download), `importCharacter(file: File): Promise<{ success: boolean, character?: CharacterRecord, error?: string }>`
- `src/utils/migrations.ts`: Exports `migrateCharacter(data: unknown): CharacterRecord` that reads schemaVersion and applies migrations
- `src/screens/CharacterLibraryScreen.tsx` (modified): Import/export buttons added to UI

### Requires
- From sub-spec 4: `characterRecordSchema` Zod schema for validation
- From sub-spec 6: `characterRepository.save()`, `characterRepository.getById()`
- From sub-spec 8: Character Library screen to add import/export buttons

### Shared State
- IndexedDB `characters` store: import writes new characters here

## Implementation Steps

### Step 1: Create migration utility scaffold
- **File:** `src/utils/migrations.ts`
- **Action:** create
- **Changes:**
  - Export `CURRENT_SCHEMA_VERSION = 1`
  - Export `migrateCharacter(data: unknown): CharacterRecord`:
    1. Cast to `{ schemaVersion?: number }`
    2. If schemaVersion is missing, assume version 1
    3. Route through a migration map: `{ [version: number]: (data: unknown) => unknown }`
    4. For V1, no migration needed -- just validate
    5. After migrations, validate with Zod schema
    6. Return typed CharacterRecord
  - Export `migrateSystem(data: unknown): SystemDefinition` (same pattern)

### Step 2: Create importExport utility
- **File:** `src/utils/importExport.ts`
- **Action:** create
- **Changes:**
  - `exportCharacter(character: CharacterRecord): void`:
    1. Serialize character to JSON string with 2-space indent
    2. Sanitize character name for filename: replace non-alphanumeric chars with `-`, trim, lowercase
    3. Create a Blob and trigger download via `<a>` element with `download` attribute
    4. Filename: `{sanitized-name}.skaldbok.json`
  - `importCharacter(file: File): Promise<ImportResult>`:
    1. Read file as text via `FileReader` or `file.text()`
    2. Parse JSON -- catch SyntaxError, return `{ success: false, error: "Invalid JSON file" }`
    3. Run through `migrateCharacter()` -- catches validation errors, returns human-readable Zod error messages
    4. Check if id already exists via `characterRepository.getById()` -- if so, assign new id via `generateId()`
    5. Set fresh `createdAt` and `updatedAt` timestamps
    6. Check if `systemId` matches a known system -- if not, attach a `warning: "Unknown system"` to result
    7. Save to DB via `characterRepository.save()`
    8. Return `{ success: true, character, warning? }`
  - Sanitization: strip `<script>`, HTML tags from all string fields before persistence

### Step 3: Add import/export to CharacterLibraryScreen
- **File:** `src/screens/CharacterLibraryScreen.tsx`
- **Action:** modify
- **Changes:**
  - Add "Export" button on each character card (calls `exportCharacter`)
  - Add "Import Character" button in the header/toolbar area
  - Import button opens a file picker (`<input type="file" accept=".json">`)
  - On file select, call `importCharacter(file)`
  - On success: refresh character list, show success message
  - On failure: show error in a Modal with the human-readable error message
  - On warning (unknown system): show success with a warning note

### Step 4: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 5: Commit
- **Stage:** `git add src/utils/importExport.ts src/utils/migrations.ts src/screens/CharacterLibraryScreen.tsx`
- **Message:** `feat: import/export and migration scaffold`

## Acceptance Criteria

- `[BEHAVIORAL]` Exporting a character downloads a .json file containing valid character data (REQ-030)
- `[BEHAVIORAL]` Importing a valid character JSON file adds it to the library without overwriting existing characters (REQ-031)
- `[BEHAVIORAL]` Importing an invalid JSON file shows a human-readable error and does not modify existing data (REQ-031, REQ-040)
- `[STRUCTURAL]` Exported character JSON includes a schemaVersion field (REQ-032)
- `[STRUCTURAL]` migrations.ts exports a function that accepts a versioned object and returns a migrated object (REQ-033)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Export: Click export on a character, verify .json file downloads, open it, verify valid JSON with schemaVersion
  - Import valid: Export a character, delete it, import the file -- character reappears with new id
  - Import invalid: Create a .json file with `{"bad": "data"}`, import -- verify error shown, no data modified
  - Import duplicate id: Export character A, import without deleting -- verify imported copy gets a new id

## Patterns to Follow

- File download pattern: Create Blob, create object URL, create hidden `<a>`, set `href` and `download`, click, revoke URL.
- File upload pattern: Hidden `<input type="file">` triggered by a visible `<Button>` component.
- Validation errors: Use Zod's `error.flatten()` or `error.issues` to produce readable messages.
- Never trust imported data: sanitize string fields, assign fresh ids and timestamps.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/utils/migrations.ts | Create | Schema version migration pipeline |
| src/utils/importExport.ts | Create | Character export (download) and import (validate + persist) |
| src/screens/CharacterLibraryScreen.tsx | Modify | Add import/export buttons to library UI |
