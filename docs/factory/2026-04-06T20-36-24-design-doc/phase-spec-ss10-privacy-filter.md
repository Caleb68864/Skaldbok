# Phase Spec — SS-10: Privacy Filter

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 2.2 — Feature B: Privacy Filter
**Depends on:** SS-02 (Zod schemas — bundle.ts, note.ts with visibility field), SS-09 (Scope collectors for context on BundleContents shape).
**Delivery order note:** Step 10 in execution sequence. Required by SS-11 (bundle serializer).

---

## Objective

Implement a pure function that strips private notes and all their orphaned references (entity links, attachments) from a `BundleContents` object before serialization. The filter is applied after collection and before serialization.

---

## File to Create

- `src/utils/export/privacyFilter.ts` — **create new**

---

## Implementation Steps

### Step 1: Define the function signature

```typescript
import { BundleContents } from '../../types/bundle';

/**
 * Removes private notes and all references to them from bundle contents.
 * @param contents - The collected bundle contents (mutated immutably — returns new object)
 * @param includePrivate - If true, all notes are retained regardless of visibility
 * @returns Filtered BundleContents with private notes and orphaned refs removed
 */
export function applyPrivacyFilter(
  contents: BundleContents,
  includePrivate: boolean
): BundleContents {
  if (includePrivate) return contents;

  // Step 1: Identify private note IDs
  const privateNoteIds = new Set(
    (contents.notes ?? [])
      .filter((note) => note.visibility === 'private')
      .map((note) => note.id)
  );

  if (privateNoteIds.size === 0) return contents;

  // Step 2: Filter out private notes
  const filteredNotes = (contents.notes ?? []).filter(
    (note) => !privateNoteIds.has(note.id)
  );

  // Step 3: Filter entity links that reference removed notes
  const filteredEntityLinks = (contents.entityLinks ?? []).filter((link) => {
    const fromIsPrivate =
      (link.fromEntityType === 'note' && privateNoteIds.has(link.fromEntityId));
    const toIsPrivate =
      (link.toEntityType === 'note' && privateNoteIds.has(link.toEntityId));
    return !fromIsPrivate && !toIsPrivate;
  });

  // Step 4: Filter attachments that reference removed notes
  // Inspect the attachment schema to find the correct field linking to a note
  // Likely: attachment.noteId or attachment.entityId where entityType === 'note'
  const filteredAttachments = (contents.attachments ?? []).filter((attachment) => {
    // Adjust field name to match actual AttachmentMeta schema
    const linkedNoteId = (attachment as any).noteId ?? (attachment as any).entityId;
    return !privateNoteIds.has(linkedNoteId);
  });

  return {
    ...contents,
    notes: filteredNotes,
    entityLinks: filteredEntityLinks,
    attachments: filteredAttachments,
  };
}
```

### Step 2: Inspect attachment schema

Before finalizing the attachment filter logic, read `src/types/attachment.ts` (or wherever `attachmentMetaSchema` is defined) to identify the exact field that links an attachment to a note. Adjust the filter predicate to use the correct field name (e.g., `attachment.noteId`, `attachment.entityId`, `attachment.linkedEntityId`).

### Step 3: Handle legacy notes without visibility field

Notes exported from older app versions may not have a `visibility` field. These must be treated as `'public'`:

```typescript
// In the filter predicate:
.filter((note) => note.visibility === 'private')
// Since visibility has .default('public') in Zod schema,
// undefined visibility will default to 'public' after safeParse.
// If filtering raw objects (pre-parse), add explicit check:
.filter((note) => note.visibility !== undefined && note.visibility === 'private')
```

The safest approach: a note is only excluded if `note.visibility === 'private'` is explicitly true. Any other value (including `undefined` or `'public'`) keeps the note.

### Step 4: Write pure function (no side effects)

The function must:
- Return a new `BundleContents` object (do not mutate the input)
- Have no async calls
- Have no database access
- Have no logging (caller handles logging if needed)

---

## Verification Commands

```bash
npx tsc --noEmit
```

**Unit test verification (manual in DevTools or test runner):**

```typescript
// Test: default filter excludes private notes
const contents: BundleContents = {
  notes: [
    { id: 'n1', visibility: 'public', ... },
    { id: 'n2', visibility: 'private', ... },
  ],
  entityLinks: [
    { id: 'l1', fromEntityType: 'note', fromEntityId: 'n2', toEntityType: 'character', toEntityId: 'c1', ... },
    { id: 'l2', fromEntityType: 'encounter', fromEntityId: 'e1', toEntityType: 'note', toEntityId: 'n1', ... },
  ],
  attachments: [
    { id: 'a1', noteId: 'n2', ... },
    { id: 'a2', noteId: 'n1', ... },
  ],
};

const filtered = applyPrivacyFilter(contents, false);
assert(filtered.notes.length === 1);            // n2 removed
assert(filtered.notes[0].id === 'n1');
assert(filtered.entityLinks.length === 1);      // l1 removed (references n2)
assert(filtered.entityLinks[0].id === 'l2');
assert(filtered.attachments.length === 1);      // a1 removed (references n2)
assert(filtered.attachments[0].id === 'a2');

// Test: includePrivate=true retains all
const full = applyPrivacyFilter(contents, true);
assert(full.notes.length === 2);
assert(full.entityLinks.length === 2);
assert(full.attachments.length === 2);

// Test: legacy note (no visibility) treated as public
const legacy = applyPrivacyFilter({
  notes: [{ id: 'n3' /* no visibility field */ }],
  ...
}, false);
assert(legacy.notes.length === 1); // n3 kept (treated as public)
```

---

## Acceptance Criteria

- [ ] Default export (includePrivate=false) excludes notes where `visibility === 'private'`
- [ ] Opt-in (includePrivate=true) includes all notes regardless of visibility
- [ ] Entity links referencing stripped private notes are removed (both `fromEntityId` and `toEntityId` checked)
- [ ] Attachments referencing stripped private notes are removed
- [ ] Notes with no visibility field (legacy) treated as `'public'` and retained
- [ ] Function is pure — returns new object, does not mutate input
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- No new npm dependencies
- Pure function — no async, no database, no side effects
- Adjust attachment field name to match actual `attachmentMetaSchema` (inspect before writing)
- Do not log inside this function — keep it pure
- Return value must satisfy `BundleContents` type (all fields optional, so partial returns are valid)
