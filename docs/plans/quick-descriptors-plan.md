# Quick Descriptors for In-Session Note-Taking

## Problem

During a session, you need to jot down impressions fast — "haggard", "old", "friendly", "ruined", "foggy". Currently the only chip-like system is **tags**, but tags serve a structural/organizational role (mood, scene type, meta flags). Using "haggard" as a tag pollutes the tag namespace and muddies search/filter.

## Tags vs Descriptors — Why They're Different

| Concern | Tags | Descriptors |
|---------|------|-------------|
| **Purpose** | Organize & filter notes | Capture flavor at a glance |
| **Set** | Curated, finite (~30 predefined) | Open-ended, user-typed |
| **Lifespan** | Persist as first-class filter keys | Color for reading back later |
| **Where shown** | FilterBar, search boost, export YAML | Inline in editor body + NoteItem card |
| **Interaction** | Pick from list | Type `#` in editor, autocomplete appears |

Tags answer "what kind of note is this?" Descriptors answer "what was this thing *like*?"

## Key Discovery: TipTap Already Has What We Need

Skaldmark already uses `@tiptap/extension-mention` with `@tiptap/suggestion` for `@mentions`. The Mention extension supports **multiple trigger characters** via `suggestions` (plural config). This means we can add `#` as a second trigger — type `#haggard` in the editor body and it becomes a styled inline chip with autocomplete, using the same infrastructure as `@mentions`.

**No new input component needed.** Descriptors live in the note body itself, right where you're already typing. This is faster than any separate input field.

## Four Options

### Option A — Separate `descriptors[]` Field + Separate Input Component

Add `descriptors: string[]` alongside `tags` on the Note schema. New DescriptorInput component outside the editor.

- **Pros**: Clean separation. Tags stay organizational. Descriptors stay flavor.
- **Cons**: Schema migration. Separate input field = extra UI step. Doesn't leverage the TipTap editor the user is already typing in.

### Option B — Tag Categories with a "descriptor" Category

Add a fifth tag category (`DESCRIPTOR_TAGS`) to TagPicker. Keep everything in `tags[]`.

- **Pros**: Zero schema change.
- **Cons**: Tags array becomes a grab bag. TagPicker is pick-from-list, not freeform.

### Option C — Freeform Descriptors via `typeData`

Store descriptors in `typeData.descriptors: string[]` for NPC/location notes only.

- **Pros**: No schema migration.
- **Cons**: Inconsistent — generic notes left out. Separate from the editor flow.

### Option D — Inline `#descriptor` Chips via TipTap Mention Extension (Recommended)

Add a second suggestion trigger (`#`) to the existing Mention extension. Descriptors become **inline atom nodes** in the ProseMirror document — styled chips that live in the note body text. Autocomplete popup appears as you type, identical to `@mention` behavior.

- **Pros**: Zero new UI components for input. Fastest possible flow — type `#h` mid-sentence and autocomplete does the rest. Uses existing, battle-tested TipTap infrastructure. Descriptors are part of the note content, not metadata bolted on the side.
- **Cons**: Descriptors live in the ProseMirror JSON body, not a flat array — need extraction for search indexing and NoteItem display. Slightly more complex to extract than a top-level field.

## Recommendation: Option D (Inline `#descriptor` Chips)

This is the fastest in-session flow. You're already typing in the editor — just hit `#` and keep going. The autocomplete popup appears with campaign-prioritized suggestions. No context switch to a separate input, no extra drawer section. The existing `@mention` infrastructure handles all the hard parts.

## Proposed Design

### How It Works — User Flow

You're writing a note about an NPC you just met:

```
Met the blacksmith in the Outskirts. #haggard #old — seems like
he's been through something. Mentioned @Grumli_the_Smith owes him
a favor. The shop was #cluttered and #dim.
```

1. You type `#` — autocomplete popup appears immediately
2. You type `h` — popup filters to `haggard (3x)`, `haunted (1x)`, `hostile`
3. Press **Enter** or **Tab** → `#haggard` becomes a styled inline chip
4. Keep typing your note. Descriptors and prose live together.

The `#` chips render as styled inline atoms — visually distinct from text, non-editable as a unit, deletable with Backspace. The `@` mentions continue working exactly as before.

### TipTap Integration — Multi-Trigger Mention

The existing Mention extension gets a second suggestion entry:

```typescript
Mention.configure({
  suggestions: [
    {
      char: '@',
      // existing NPC/note mention config — unchanged
      items: async ({ query }) => searchCampaignEntities(query),
      render: () => mentionRenderer,
    },
    {
      char: '#',
      items: async ({ query }) => getDescriptorSuggestions(query, campaignId),
      render: () => descriptorRenderer,
      command: ({ editor, range, props }) => {
        editor.chain().focus()
          .insertContentAt(range, [{
            type: 'mention',
            attrs: { id: props.id, label: props.label, kind: 'descriptor' },
          }, { type: 'text', text: ' ' }])
          .run();
      },
    },
  ],
})
```

**Key detail**: We add a `kind` attribute to the Mention node (`'mention'` vs `'descriptor'`) so rendering and extraction can distinguish them. This requires extending the Mention extension's `addAttributes()`:

```typescript
const DescriptorMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: { default: 'mention' },  // 'mention' | 'descriptor'
    };
  },
});
```

### Suggestion Popup — Descriptor Renderer

A separate renderer from the `@mention` popup, styled differently:

- Compact list, max 6 items
- Each item shows: descriptor word + usage count badge (e.g., `haggard  3x`)
- Campaign-local items get a subtle highlight or are grouped above cross-campaign ones
- Keyboard nav: ArrowUp/Down to select, Enter/Tab to accept, Esc to dismiss
- Freeform: if the typed word doesn't match any suggestion, pressing Space/Enter inserts it as a new descriptor chip anyway (no match required)

Reuses the same raw-DOM popup pattern as the existing mention renderer, adapted with descriptor styling.

### IntelliSense Suggestion Ranking

Suggestions appear after 1+ characters typed. Ranked by a weighted score:

| Priority | Source | Weight | Why |
|----------|--------|--------|-----|
| 1 | **Same campaign, high frequency** | 3x | "old" used 8 times this campaign → top suggestion |
| 2 | **Same campaign, low frequency** | 2x | "scarred" used once this campaign → still relevant |
| 3 | **Other campaigns, high frequency** | 1x | Cross-campaign descriptors fill gaps for new campaigns |
| 4 | **Starter seed (never-used fallback)** | 0.5x | Only shown when no campaign history matches |

```typescript
interface DescriptorSuggestion {
  word: string;
  score: number;        // weighted frequency
  campaignLocal: boolean; // true = from current campaign
}
```

The dropdown shows **max 6 suggestions**, prefix-matched against current input. If the user types `#ha` they see: `haggard (3x)`, `haunted (1x)`, `harsh`, etc.

### Starter Seed Set

Only shown as filler when a campaign has few/no descriptors yet. Not shown once the campaign has 10+ unique descriptors:

- **People**: old, young, scarred, tall, short, friendly, hostile, nervous, calm, wealthy, poor, loud, quiet
- **Places**: ruined, dark, bright, foggy, cramped, vast, wealthy, filthy, ornate, ancient, overgrown

These never override campaign-local suggestions — they just prevent a cold-start empty dropdown.

### Inline Chip Styling

Descriptor chips render visually distinct from both plain text and `@mentions`:

```css
/* @mentions — existing style */
.mention[data-kind="mention"] {
  background: var(--color-primary-muted);
  color: var(--color-primary);
  font-weight: 600;
}

/* #descriptors — new style */
.mention[data-kind="descriptor"] {
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  font-style: italic;
  font-size: 0.85em;
  border-radius: var(--radius-sm);
  padding: 1px 6px;
}
```

In the editor, a note looks like:

```
Met the blacksmith in the Outskirts. [haggard] [old] — seems like
he's been through something. Mentioned |Grumli the Smith| owes him
a favor. The shop was [cluttered] and [dim].
```

Where `[haggard]` = muted italic chip, `|Grumli|` = bold primary chip.

### Descriptor Extraction — `extractDescriptors()`

Since descriptors live in the ProseMirror JSON body (not a flat field), we need a utility to walk the document and pull them out:

```typescript
function extractDescriptors(doc: ProseMirrorJSON): string[] {
  const descriptors: string[] = [];
  // Walk all nodes recursively
  // Find nodes where type === 'mention' && attrs.kind === 'descriptor'
  // Collect attrs.label
  return [...new Set(descriptors)]; // deduplicate
}
```

This is used in two places:
1. **NoteItem display** — extract descriptors to show as chips on the card
2. **Search indexing** — feed extracted descriptors into MiniSearch

### Data Model — No Schema Change Needed

Descriptors live inside the ProseMirror JSON body as mention nodes with `kind: 'descriptor'`. The `note.body` field already stores arbitrary ProseMirror JSON. **No schema migration required.**

However, for fast search indexing we add a **derived field** at index time:

```typescript
// In useNoteSearch.ts — when building IndexedDoc:
{
  id: note.id,
  title: note.title,
  bodyText: extractPlainText(note.body),
  tags: (note.tags ?? []).join(' '),
  type: note.type,
  descriptors: extractDescriptors(note.body).join(' '),  // new
}
```

### Mobile Considerations

- Popup positioned above input when keyboard is visible (same logic as `@mention` popup)
- `#` is easy to reach on mobile keyboards (one tap on symbol row)
- Freeform entry still works — no match required, just type and Space/Enter to commit

### UI — NoteItem Display

On the NoteItem card, descriptors render as a row of small italic chips below the title, before the body preview. Visually lighter than tags — think annotation, not category.

```
┌────────────────────────────────┐
│ ⏱ 19:42  Grumli the Smith     │
│ haggard · old · suspicious     │  ← descriptors (italic, muted)
│ npc · important                │  ← tags (bold, primary color)
│ Blacksmith in the Outskirts... │
└────────────────────────────────┘
```

### Search Integration

Add `descriptors` as a derived field in the MiniSearch index:

```typescript
fields: ['title', 'bodyText', 'tags', 'type', 'descriptors'],
boost: { title: 2, descriptors: 1.5, tags: 1.5, bodyText: 1 },
```

Searching "haggard" finds every NPC/place you described that way — even though it's stored inline in the body, it gets indexed as a separate boosted field.

### Export

Descriptors extracted from body and included in YAML frontmatter:
```yaml
descriptors: [haggard, old, suspicious]
```

And in the Markdown body, `#descriptor` nodes render as `**#haggard**` (bold hashtag) to preserve meaning in plain text.

### Autocomplete Source — `useDescriptorSuggestions`

```typescript
// useDescriptorSuggestions(campaignId: string)
//
// 1. On mount: query all notes in current campaign → extract descriptors → build frequency map
// 2. Optionally: query all notes across other campaigns → separate frequency map
// 3. Merge with weighted scoring:
//      - same campaign count * 3
//      - other campaign count * 1
//      - starter seed * 0.5 (only if campaign has < 10 unique descriptors)
// 4. Returns: (prefix: string) => DescriptorSuggestion[] (max 6, sorted by score)

interface DescriptorSuggestion {
  word: string;
  score: number;
  campaignLocal: boolean;
}
```

**Caching**: Build the frequency map once on drawer open. Append new descriptors to the in-memory map on save (no re-query needed until next drawer open). This keeps it snappy even with hundreds of notes.

### NoteItem Display — Extracted Chips

Even though descriptors live in the body, NoteItem extracts and surfaces them as a chip row on the card for scannability:

```
┌────────────────────────────────┐
│ ⏱ 19:42  Grumli the Smith     │
│ haggard · old · suspicious     │  ← extracted from body, italic muted
│ npc · important                │  ← tags (bold, primary color)
│ Blacksmith in the Outskirts... │
└────────────────────────────────┘
```

`extractDescriptors(note.body)` runs at render time — cheap walk of the JSON tree.

## Scope & Files to Touch

| File | Change |
|------|--------|
| `src/components/notes/TiptapNoteEditor.tsx` | Extend Mention config with `#` trigger, add `kind` attribute, add descriptor renderer |
| `src/features/notes/useDescriptorSuggestions.ts` | **New** — campaign-weighted autocomplete hook |
| `src/features/notes/NoteItem.tsx` | Extract + render descriptor chips from note body |
| `src/features/notes/useNoteSearch.ts` | Extract descriptors from body for search indexing |
| `src/utils/notes/extractDescriptors.ts` | **New** — walk ProseMirror JSON to collect descriptor labels |
| `src/utils/export/renderNote.ts` | Extract descriptors into YAML frontmatter + render as `#word` in Markdown |

**Not needed anymore** (thanks to TipTap approach):
- ~~`src/types/note.ts`~~ — no schema change
- ~~`src/storage/db/client.ts`~~ — no migration
- ~~`src/components/notes/DescriptorInput.tsx`~~ — no separate input component
- ~~`QuickNoteDrawer / QuickNPCDrawer / QuickLocationDrawer`~~ — no drawer changes (editor handles it)

**Total: 6 files (2 new, 4 modified). Zero schema migrations. Zero new UI components for input.**

## Decisions Made

1. **Inline `#` trigger in TipTap** — descriptors are typed right in the editor body, not a separate field. Uses existing Mention extension infrastructure with a second suggestion entry.
2. **Campaign-priority autocomplete**: Suggestions strongly prefer the current campaign (3x weight) but fall back to cross-campaign descriptors (1x) and starter seeds (0.5x) so new campaigns aren't empty.
3. **Freeform allowed**: If the typed word doesn't match any suggestion, Enter/Space still commits it as a new descriptor chip. No gatekeeping.
4. **Starter seeds exist but fade out**: Pre-seeded words only appear when the campaign has <10 unique descriptors. They never outrank real usage.
5. **No schema migration**: Descriptors live in the ProseMirror body JSON. Extracted at render/index time.

## Open Questions

1. **Max descriptors per note?** Probably not worth enforcing — the editor body is freeform. If someone puts 20, that's fine.
2. **Descriptor chips in read-only view?** When a note body is displayed outside the editor (e.g., export preview), render `#haggard` as bold italic text.
3. **Backfill?** Existing notes won't have descriptors. That's fine — they grow organically as notes are written/edited.
