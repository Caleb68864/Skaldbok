# Phase Spec — SS-05 · Wikilink Tiptap Extension

**Run:** `2026-04-07T00-01-30-design-doc`
**Sub-spec:** SS-05
**Phase:** 2 — Wikilinks + Reading
**Priority:** 8/10

---

## Dependency Order

> ⚠️ **Depends on SS-01, SS-02, and SS-03 being completed first.**
> The link sync engine (SS-03) must handle the `wikiLink` node type emitted by this Tiptap extension.

---

## Pre-condition (Required Before Implementation)

Before implementing this sub-spec:

1. Read `package.json` and identify all `@tiptap/*` packages currently listed.
2. Align ALL `@tiptap/*` packages to `^2.27.2` in `package.json`.
3. Add `@tiptap/suggestion` as an **explicit** dependency (currently transitive only) at `^2.27.2`.
4. Verify the change compiles (`npm run build`) before implementing the extension.

If aligning Tiptap versions causes peer-dep conflicts that cannot be resolved without removing existing extensions, **STOP and escalate to human review.**

---

## Intent

Create a Tiptap `Node.create()` extension for `[[double bracket]]` wikilinks, following the pattern in `src/features/notes/descriptorMentionExtension.ts`. The extension uses `@tiptap/suggestion` with `char: '[['`, renders as an inline atom chip via `ReactNodeViewRenderer`, and includes an `InputRule` for typed `[[Page Name]]` without autocomplete.

---

## Files to Create

| File | Exports |
|---|---|
| `src/features/notes/wikilinkExtension.ts` | `WikiLinkPluginKey`, `WikiLink` (the Tiptap Node extension) |
| `src/features/notes/WikiLinkComponent.tsx` | `WikiLinkComponent` — React node view renderer for the inline chip |
| `src/features/notes/WikiLinkList.tsx` | `WikiLinkList` — autocomplete dropdown for suggestion results |

## Files to Modify

| File | Change |
|---|---|
| `package.json` | Align all `@tiptap/*` to `^2.27.2`; add `@tiptap/suggestion` as explicit dependency |
| `src/utils/export/resolveWikiLinks.ts` | Handle `wikiLink` node type in the `serializeNode` switch — output `[[label]]` |

---

## Implementation Steps

### Step 1 — Update `package.json`

- Align all `@tiptap/*` package versions to `^2.27.2`.
- Add `"@tiptap/suggestion": "^2.27.2"` to `dependencies` if not present.
- Verify no peer-dep conflicts before proceeding.

### Step 2 — Create `src/features/notes/wikilinkExtension.ts`

Model this file closely after `src/features/notes/descriptorMentionExtension.ts`. Key spec:

```typescript
import { Node, mergeAttributes, InputRule, PasteRule } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { WikiLinkComponent } from './WikiLinkComponent';

// Distinct PluginKey — must NOT reuse the descriptor or mention PluginKey names
export const WikiLinkPluginKey = new PluginKey('wikiLink');

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  priority: 101,

  addAttributes() {
    return {
      id: { default: 'unresolved' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="wiki-link"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'wiki-link',
        'data-id': node.attrs.id,
        'data-label': node.attrs.label,
        class: `wiki-link${node.attrs.id === 'unresolved' ? ' wiki-link--unresolved' : ''}`,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkComponent);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const label = match[1];
          const node = state.schema.nodes.wikiLink.create({ id: 'unresolved', label });
          return state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: /\[\[([^\]]+)\]\]/g,
        handler: ({ state, range, match }) => {
          const label = match[1];
          const node = state.schema.nodes.wikiLink.create({ id: 'unresolved', label });
          return state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: WikiLinkPluginKey,
        char: '[[',
        allowSpaces: true,
        // items, render, command — wired to WikiLinkList below
        items: async ({ query }) => {
          // Query kb_nodes by label prefix via getNodesByCampaign + filter
          // Return top 10 matches
          // ...
        },
        render: () => ({
          onStart: (props) => { /* render WikiLinkList */ },
          onUpdate: (props) => { /* update WikiLinkList */ },
          onKeyDown: (props) => { /* handle keyboard in list */ },
          onExit: () => { /* destroy WikiLinkList */ },
        }),
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'wikiLink',
              attrs: { id: props.id, label: props.label },
            })
            .run();
        },
      }),
    ];
  },
});
```

> **Note on InputRule for atom nodes (ASM-4):** Atom nodes may need special handling in the InputRule handler. Validate that the InputRule approach works for atom nodes before committing. If issues arise, a workaround is to use a keyboard shortcut or slash command instead. Log the approach chosen in a code comment.

### Step 3 — Create `src/features/notes/WikiLinkComponent.tsx`

React node view renderer for the inline wikilink chip:

```typescript
import { NodeViewWrapper } from '@tiptap/react';
import { NodeViewProps } from '@tiptap/core';

export function WikiLinkComponent({ node }: NodeViewProps) {
  const { id, label } = node.attrs;
  const isUnresolved = id === 'unresolved';

  return (
    <NodeViewWrapper
      as="span"
      className={`wiki-link${isUnresolved ? ' wiki-link--unresolved' : ''}`}
      data-id={id}
      data-label={label}
    >
      [[{label}]]
    </NodeViewWrapper>
  );
}
```

Style `wiki-link` and `wiki-link--unresolved` in the project's CSS/Tailwind. Unresolved links should appear dimmed or with a red/warning color. Use existing Tailwind utility classes rather than custom CSS where possible.

### Step 4 — Create `src/features/notes/WikiLinkList.tsx`

Autocomplete dropdown, modeled after any existing suggestion list in the project:

```typescript
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

interface WikiLinkListProps {
  items: Array<{ id: string; label: string }>;
  command: (item: { id: string; label: string }) => void;
}

export const WikiLinkList = forwardRef<unknown, WikiLinkListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') { setSelectedIndex(i => (i - 1 + items.length) % items.length); return true; }
      if (event.key === 'ArrowDown') { setSelectedIndex(i => (i + 1) % items.length); return true; }
      if (event.key === 'Enter') { if (items[selectedIndex]) command(items[selectedIndex]); return true; }
      return false;
    },
  }));

  return (
    <div className="wiki-link-list /* Tailwind classes for dropdown */">
      {items.length === 0 ? (
        <div className="/* no results style */">No notes found</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.id}
            className={i === selectedIndex ? '/* selected */' : '/* normal */'}
            onClick={() => command(item)}
          >
            {item.label}
          </button>
        ))
      )}
    </div>
  );
});
WikiLinkList.displayName = 'WikiLinkList';
```

### Step 5 — Update `src/utils/export/resolveWikiLinks.ts`

Add a case for `wikiLink` node type in the `serializeNode` switch statement:

```typescript
// In serializeNode switch, add before the default case:
case 'wikiLink': {
  const label = node.attrs?.label as string | undefined;
  return label ? `[[${label}]]` : '';
}
```

This ensures Obsidian export backward-compatibility.

---

## Acceptance Criteria

1. `npm run build` succeeds with zero TypeScript errors (all `@tiptap/*` aligned to `^2.27.2`).
2. Typing `[[` in `TiptapNoteEditor` triggers the wikilink autocomplete dropdown with existing note titles as suggestions.
3. Selecting a suggestion inserts an inline wikilink chip showing the note title.
4. Typing `[[Page Name]]` (complete with closing brackets, no autocomplete) converts to a wikilink node via InputRule.
5. Pasting `[[Page Name]]` converts to a wikilink node via PasteRule.
6. A wikilink to a non-existent note renders with a distinct "unresolved" visual style (dimmed or red).
7. `renderNoteToMarkdown` converts a note containing wikiLink nodes to `[[label]]` Obsidian-compatible markdown without errors.
8. The `@tiptap/suggestion` package appears as an explicit (not transitive) entry in `package.json`.
9. `WikiLinkPluginKey` uses a distinct `PluginKey` name (`'wikiLink'`) separate from `DescriptorMentionPluginKey` and the `@mention` plugin key.
10. Existing `@mention` and `#descriptor` functionality is unaffected.

---

## Verification Commands

```bash
# TypeScript build check
npm run build

# (Manual) Test in browser:
# 1. Open a note in the editor
# 2. Type [[ — confirm dropdown appears with note suggestions
# 3. Select a suggestion — confirm chip appears inline
# 4. Type [[My Page]] and confirm InputRule converts it to a chip
# 5. Paste [[My Page]] and confirm PasteRule converts it
# 6. Create a link to a non-existent note — confirm unresolved styling
# 7. Export the note — confirm [[label]] appears in markdown output
# 8. Create/edit an @mention or #descriptor — confirm still works
```

---

## Escalation Triggers

Stop and escalate to human if:
- `@tiptap/*` version alignment causes peer-dep conflicts that cannot be resolved without removing existing extensions.
- The InputRule approach for atom nodes (ASM-4) does not work and no alternative is found.

---

## Constraints / Notes

- ASM-6: Tiptap version mismatch (some packages at 2.11.7, most at 2.27.2). Alignment to `^2.27.2` is required before any wikilink work.
- ASM-4: InputRule for atom nodes needs validation in a proof-of-concept before full implementation.
- The `WikiLinkPluginKey` name must be `'wikiLink'` — different from `'descriptorMention'` and `'mention'`.
- Correctness over speed. No shell commands. Cross-platform.
