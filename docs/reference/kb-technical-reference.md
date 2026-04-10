# Knowledge Base — Technical Reference

Research findings for the In-App Knowledge Base design. Each section de-risks a key technical assumption with concrete API patterns, gotchas, and code examples.

## 1. Tiptap Wikilink Extension

### Architecture
Build on the same pattern as the Mention extension: an **inline atom Node** paired with the **Suggestion utility** for autocomplete.

**Key properties:**
```typescript
import { mergeAttributes, Node } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'

export const WikiLinkPluginKey = new PluginKey('wikiLink')

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,           // single uneditable unit, like Mention
  priority: 101,        // above default to ensure input rules fire first

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: el => el.getAttribute('data-id'),
        renderHTML: attrs => ({ 'data-id': attrs.id }),
      },
      label: {
        default: null,
        parseHTML: el => el.getAttribute('data-label'),
        renderHTML: attrs => ({ 'data-label': attrs.label }),
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
```

### The `[[` Trigger

Multi-character `char` values work in Suggestion — the regex escaping handles `[` properly. Configuration:

```typescript
suggestion: {
  char: '[[',
  allowedPrefixes: [' ', '\n'],  // or null to allow anywhere
  allowSpaces: true,              // page names can have spaces
}
```

**Custom findSuggestionMatch** (fallback if built-in matching misbehaves):
```typescript
findSuggestionMatch: ({ $position }) => {
  const text = $position.nodeBefore?.isText && $position.nodeBefore.text
  if (!text) return null
  const match = text.match(/\[\[([^\]]*)$/)
  if (!match) return null
  return {
    range: { from: $position.pos - match[0].length, to: $position.pos },
    query: match[1],
    text: match[0],
  }
},
```

### InputRule for typed `[[Page Name]]` without autocomplete
```typescript
import { nodeInputRule } from '@tiptap/core'

addInputRules() {
  return [
    nodeInputRule({
      find: /\[\[([^\]]+)\]\]$/,
      type: this.type,
      getAttributes: match => ({ label: match[1], id: match[1] }),
    }),
  ]
}
```

### React Node View (rendered chip in editor)
```tsx
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'

const WikiLinkComponent = ({ node }) => (
  <NodeViewWrapper as="span" className="wikilink">
    [[{node.attrs.label}]]
  </NodeViewWrapper>
)

// In Node.create():
addNodeView() {
  return ReactNodeViewRenderer(WikiLinkComponent)
}
```

### Suggestion command (insert node on selection)
```typescript
command: ({ editor, range, props }) => {
  const nodeAfter = editor.view.state.selection.$to.nodeAfter
  if (nodeAfter?.text?.startsWith(' ')) range.to += 1
  editor.chain().focus().insertContentAt(range, [
    { type: 'wikiLink', attrs: props },
    { type: 'text', text: ' ' },
  ]).run()
  editor.view.dom.ownerDocument.defaultView?.getSelection()?.collapseToEnd()
}
```

### Gotchas
- **Explicit dependency needed:** `npm install @tiptap/suggestion` — it's a transitive dep of Mention but should be explicit
- **`allowSpaces: true` and `allowToIncludeChar` are mutually exclusive** in the Suggestion source. Use `allowSpaces: true`, do NOT set `allowToIncludeChar`
- **Closing `]]` is never typed** when using autocomplete — the command replaces the range. The InputRule handles the typed-without-autocomplete case
- **Add a PasteRule** so pasted `[[Page Name]]` text converts to nodes

### Reference implementation
- Community extension: [aarkue/tiptap-wikilink-extension](https://github.com/aarkue/tiptap-wikilink-extension) — useful as reference (regex patterns, backspace handling) but do NOT use as a dependency. It bypasses Suggestion utility and uses raw ProseMirror plugins.

### Recommended file structure
```
src/features/notes/
  wikilinkExtension.ts       — Node.create() with suggestion plugin + input/paste rules
  WikiLinkList.tsx            — React autocomplete dropdown component
  WikiLinkComponent.tsx       — React node view (rendered chip in editor)
```

---

## 2. ProseMirror JSON Parsing (Link Sync Engine)

### JSON Structure
ProseMirror JSON is a recursive tree: `{ type, attrs?, content?, marks?, text? }`

- **Block nodes** (paragraph, heading) have `content` arrays
- **Inline content** is a flat sequence inside block nodes (not nested like HTML)
- **Atom nodes** (mentions, wikilinks) appear alongside text nodes — they have `type` and `attrs` but no `text` or `content`
- **Marks** (bold, italic, link) are metadata arrays on text nodes, not wrapping containers
- **Links are marks**, not nodes — check `node.marks` for `type: 'link'`

### Mention node attrs in JSON
```json
{
  "type": "mention",
  "attrs": {
    "id": "npc_aldric_001",
    "label": "Aldric",
    "mentionSuggestionChar": "@"
  }
}
```

### No built-in traversal utility
Tiptap has NO API for traversing raw JSON without an editor instance. `Node.descendants()` requires hydrated ProseMirror Node objects. **Simple recursive tree walking is the correct approach.**

### Link extraction implementation
```typescript
import type { JSONContent } from '@tiptap/core'

interface ExtractedLink {
  type: 'mention' | 'descriptorMention' | 'wikilink' | 'link'
  targetId: string
  label: string | null
}

function extractLinks(doc: JSONContent): ExtractedLink[] {
  const links: ExtractedLink[] = []

  function walk(node: JSONContent): void {
    if (node.type === 'mention' && node.attrs?.id) {
      links.push({ type: 'mention', targetId: node.attrs.id, label: node.attrs.label ?? null })
    } else if (node.type === 'descriptorMention' && node.attrs?.id) {
      links.push({ type: 'descriptorMention', targetId: node.attrs.id, label: node.attrs.label ?? null })
    } else if (node.type === 'wikiLink' && node.attrs?.id) {
      links.push({ type: 'wikilink', targetId: node.attrs.id, label: node.attrs.label ?? null })
    }

    // Links are marks on text nodes, not separate nodes
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'link' && mark.attrs?.href) {
          links.push({ type: 'link', targetId: mark.attrs.href, label: node.text ?? null })
        }
      }
    }

    if (node.content) {
      for (const child of node.content) walk(child)
    }
  }

  walk(doc)
  return links
}
```

### Performance
Walking a typical note's JSON tree (100-500 nodes) takes **microseconds**. No schema instantiation, no DOM parsing, no library import. Safe to run on every autosave.

---

## 3. Dexie Graph Store

### Schema declaration (version 7)
```typescript
// In SkaldbokDatabase constructor:
kb_nodes!: Table<KBNode, string>;
kb_edges!: Table<KBEdge, string>;

this.version(7).stores({
  kb_nodes: 'id, [campaignId+type], campaignId, scope, label',
  kb_edges: 'id, fromId, toId, [campaignId+type], [fromId+toId]',
});
// No .upgrade() needed — new tables start empty
```

### Query patterns
```typescript
// Backlinks (all edges pointing TO a node)
const incoming = await db.kb_edges.where('toId').equals(nodeId).toArray()

// Forward links (all edges FROM a node)
const outgoing = await db.kb_edges.where('fromId').equals(nodeId).toArray()

// Dedup check before insert
const existing = await db.kb_edges.where('[fromId+toId]').equals([fromId, toId]).first()

// Nodes by campaign (with shared scope)
const nodes = await db.kb_nodes
  .where('campaignId').equals(campaignId)
  .and(n => n.scope === 'campaign' || n.scope === 'shared')
  .toArray()

// Wikilink resolution (case-insensitive)
const node = await db.kb_nodes.where('label').equalsIgnoreCase(label).first()

// BFS depth 1-2
async function getNeighbors(nodeId: string, depth: number = 2) {
  const visited = new Set<string>([nodeId])
  let frontier = [nodeId]
  for (let d = 0; d < depth; d++) {
    const [out, inc] = await Promise.all([
      db.kb_edges.where('fromId').anyOf(frontier).toArray(),
      db.kb_edges.where('toId').anyOf(frontier).toArray(),
    ])
    const next: string[] = []
    for (const e of [...out, ...inc]) {
      const neighbor = frontier.includes(e.fromId) ? e.toId : e.fromId
      if (!visited.has(neighbor)) { visited.add(neighbor); next.push(neighbor) }
    }
    frontier = next
  }
  return visited
}
```

### Performance at scale
- Index lookups: ~1ms for 1000-5000 records
- BFS depth 2: **~5-20ms** (4 indexed queries)
- Bulk writes: ~80ms for 1000 records via `bulkAdd()`
- `equalsIgnoreCase()`: sub-millisecond at 500-2000 nodes (cursor walk, not native IndexedDB)

### Gotchas
- **`equalsIgnoreCase()` only handles English a-z** — accented/Nordic characters may not match. If needed later, add a `labelLower` computed field with a Dexie `creating`/`updating` hook
- **Compound index order matters**: `[campaignId+type]` supports querying `campaignId` alone (prefix) but NOT `type` alone
- **`.or()` loses sort order** — sort in JS after if needed
- **Never modify published upgrade functions** — users who already ran them won't re-run
- **Keep index count under 8-10 per table** — each index adds write overhead

### OR queries
Dexie supports `.or()` but the better pattern for campaign+scope is: index on `campaignId`, then JS `.and()` filter on scope. At 500 nodes per campaign, filtering 2 scope values in JS is negligible.

---

## 4. Graph Visualization: d3-force + d3-zoom + Canvas 2D

### Why this stack
| Option | Bundle (gzip) | Touch | Verdict |
|--------|--------------|-------|---------|
| d3-force + d3-zoom + Canvas | ~12-15 KB | Native (d3-zoom) | **Recommended** |
| react-force-graph-2d | ~80-100 KB | Built-in but buggy mobile | Too heavy for PWA |
| Sigma.js | ~60-80 KB | **Broken** (v3 known issue) | Eliminated |
| Cytoscape.js | ~90-100 KB | Excellent | Good backup, heavy |

### Dependencies to add
```bash
npm install d3-force d3-zoom d3-selection
npm install -D @types/d3-force @types/d3-zoom @types/d3-selection
```

### Architecture pattern
```
React Component (owns state: nodes, links, filters, selectedNode)
  └─ <canvas ref={canvasRef}>
       ├─ d3.forceSimulation (layout engine, runs on tick)
       ├─ d3.zoom (touch/mouse camera, calls render on zoom)
       └─ Canvas2D render function (draws everything)
```

### Key code pattern
```typescript
const canvasRef = useRef<HTMLCanvasElement>(null)

useEffect(() => {
  const canvas = canvasRef.current!
  const ctx = canvas.getContext('2d')!
  let transform = d3.zoomIdentity

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .on('tick', () => render(ctx, nodes, links, transform))

  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on('zoom', (event) => {
      transform = event.transform
      render(ctx, nodes, links, transform)
    })
  d3.select(canvas).call(zoom)

  return () => sim.stop()
}, [nodes, links])
```

### Touch support
d3-zoom natively handles: pinch-to-zoom, one-finger pan, mouse wheel. For tap-to-navigate: add `pointerup` listener, invert zoom transform to get graph coordinates, find nearest node within radius.

### Center on node
```typescript
zoom.transform(d3.select(canvas), d3.zoomIdentity.translate(cx, cy).scale(s))
```

### Performance
Canvas 2D with d3-force handles 200-500 nodes at 60fps on tablet hardware. Physics calculation is trivial at this scale.

---

## 5. MiniSearch Unified Index

### Single index for all entity types
MiniSearch handles heterogeneous documents natively. Declare the superset of fields; missing fields return `undefined` and are skipped.

```typescript
import MiniSearch from 'minisearch'

interface KBSearchDoc {
  id: string
  _type: string        // 'note' | 'character' | 'tag' | 'unresolved'
  title?: string
  bodyText?: string
  tags?: string
  descriptors?: string
  name?: string
  description?: string
  label?: string
}

const searchIndex = new MiniSearch<KBSearchDoc>({
  fields: ['title', 'bodyText', 'tags', 'descriptors', 'name', 'description', 'label'],
  storeFields: ['_type', 'title', 'name', 'label'],
  searchOptions: {
    boost: { title: 3, name: 3, label: 2, tags: 1.5, descriptors: 1.5, description: 1, bodyText: 1 },
    fuzzy: 0.2,
    prefix: true,
    boostDocument: (_id, _term, storedFields) => {
      switch (storedFields?._type) {
        case 'note': return 1.5
        case 'character': return 1.3
        case 'tag': return 0.8
        case 'unresolved': return 0.5
        default: return 1
      }
    },
  },
})
```

### Type-specific conversion
```typescript
function nodeToSearchDoc(node: KBNode): KBSearchDoc {
  switch (node.type) {
    case 'note':
      return {
        id: node.id, _type: 'note',
        title: node.label,
        bodyText: node.metadata?.bodyText ?? '',
        tags: node.metadata?.tags ?? '',
        descriptors: node.metadata?.descriptors ?? '',
      }
    case 'character':
      return {
        id: node.id, _type: 'character',
        name: node.label,
        description: node.metadata?.description ?? '',
      }
    case 'tag':
      return { id: node.id, _type: 'tag', label: node.label }
    default:
      return { id: node.id, _type: node.type, label: node.label }
  }
}
```

### Bulk rebuild (non-blocking)
```typescript
const rebuildIndex = async (nodes: KBNode[]) => {
  searchIndex.removeAll()
  await searchIndex.addAllAsync(nodes.map(nodeToSearchDoc), { chunkSize: 200 })
}
```

### Safe update pattern
```typescript
// Use discard() not remove() — remove() needs original field values
if (searchIndex.has(node.id)) searchIndex.discard(node.id)
searchIndex.add(nodeToSearchDoc(node))
```

### Filter by type in search
```typescript
searchIndex.search('bjorn', {
  filter: (result) => result._type === 'character'
})
```

### Performance
- `addAllAsync` for 2000 docs: ~50-100ms (chunked, non-blocking)
- Search with fuzzy + prefix at 2000 docs: < 10ms
- Memory: efficient radix tree. Do NOT store `bodyText` in `storeFields` — doubles memory

### Gotchas
- **`discard(id)` not `remove(doc)`** for updates — `remove` needs the original indexed field values which may have changed
- **Include `_type` in `storeFields`** — required for `boostDocument` callback
- **Module-level singleton persists across renders** but not page reloads — rebuild on KB context mount
- **`addAllAsync`** uses `setTimeout(0)` between chunks — keeps UI responsive during bulk indexing

---

## Sources

### Tiptap
- [Custom Node Extensions](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node)
- [Suggestion Utility](https://tiptap.dev/docs/editor/api/utilities/suggestion)
- [Mention Extension](https://tiptap.dev/docs/editor/extensions/nodes/mention)
- [React Node Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react)
- [Community wikilink reference](https://github.com/aarkue/tiptap-wikilink-extension)

### Dexie
- [Compound Index](https://dexie.org/docs/Compound-Index)
- [Dexie.version()](https://dexie.org/docs/Dexie/Dexie.version())
- [Collection.or()](https://dexie.org/docs/Collection/Collection.or())
- [WhereClause.equalsIgnoreCase()](https://dexie.org/docs/WhereClause/WhereClause.equalsIgnoreCase())

### Graph Visualization
- [d3-force docs](https://d3js.org/d3-force)
- [d3-zoom docs (touch support)](https://d3js.org/d3-zoom)

### MiniSearch
- [MiniSearch GitHub](https://github.com/lucaong/minisearch)
- [MiniSearch API — SearchOptions.boostDocument](https://lucaong.github.io/minisearch/classes/MiniSearch.MiniSearch.html)
