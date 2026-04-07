# Risky Gaps

## Capability Gaps

### ASM-1: Tiptap Suggestion multi-character trigger (HIGH)

The `@tiptap/suggestion` utility is assumed to accept `char: '[[' ` as a two-character trigger. The existing codebase only uses single-character triggers (`#` for descriptors, `@` for mentions). The technical reference documents this as researched, but no code validates it.

**Fallback:** If `[[` doesn't work as a Suggestion trigger, options include:
- Custom ProseMirror plugin that detects `[[` keystrokes manually
- InputRule-only approach (no autocomplete popup, just post-hoc conversion)
- Single-char trigger with a modifier (e.g., `[` with `allowSpaces` and custom filtering)

### ASM-4: InputRule for atom node creation (MEDIUM)

Tiptap InputRules are commonly used for marks and wrapping nodes. Creating an inline atom node via InputRule is less common. If InputRule can't create atom nodes, the manual typing path (`[[Page Name]]` without autocomplete) would need a different approach.

### ASM-11: Node.create() vs Mention.extend() for wikilinks (MEDIUM)

The plan recommends `Node.create()` + `@tiptap/suggestion` rather than `Mention.extend()` (the existing pattern). This means more manual implementation but more control. The risk is spending extra effort on something `Mention.extend()` could handle out of the box.

## Architecture Gaps

### ASM-7: baseNoteSchema scope field ripple effect (HIGH)

Adding `scope: 'campaign' | 'shared'` to the Note type requires:
1. Updating `baseNoteSchema` in `src/types/note.ts`
2. Adding the field to Dexie v7 notes index
3. Updating every note query that filters by `campaignId` to also include `scope = 'shared'`

The number of query sites is unknown. This could be 3 files or 15.

### ASM-13: Dexie OR query pattern (MEDIUM)

`WHERE campaignId = X OR scope = 'shared'` is not a single Dexie query. Requires:
```typescript
const [byCampaign, byShared] = await Promise.all([
  db.kb_nodes.where('campaignId').equals(campaignId).toArray(),
  db.kb_nodes.where('scope').equals('shared').toArray(),
]);
const merged = dedup([...byCampaign, ...byShared]);
```
This doubles the number of IndexedDB reads for every graph query. Verify it stays under 50ms.

### ASM-9: NotesGrid replacement completeness (MEDIUM)

NotesGrid on the Session screen may have session-specific behaviors (autosave integration, real-time note creation, session-scoped type filtering) that the VaultBrowser spec doesn't explicitly cover. The plan flags this as "pending discussion."

## Version Gaps

### ASM-6: Tiptap package version misalignment (MEDIUM)

package.json has:
- `@tiptap/extension-link: ^2.27.2`
- `@tiptap/extension-mention: ^2.11.7`
- `@tiptap/react: ^2.11.7`
- `@tiptap/starter-kit: ^2.11.7`

The caret ranges resolve correctly in the lockfile, but adding `@tiptap/suggestion` explicitly with a different pin could cause confusion or subtle incompatibilities. Align versions first.

## Operational Gaps

None identified — the plan correctly specifies all-local, offline-only operation with no backend dependencies.
