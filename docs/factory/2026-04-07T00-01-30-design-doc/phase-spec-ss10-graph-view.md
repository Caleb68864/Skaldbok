# Phase Spec — SS-10 · Graph View

**Run:** `2026-04-07T00-01-30-design-doc`
**Sub-spec:** SS-10
**Phase:** 4 — Visualization
**Priority:** 5/10
**Note:** This sub-spec can be deferred to the next release if Phase 3 is not yet complete.

---

## Dependency Order

> ⚠️ **Depends on SS-01, SS-02, SS-04, and SS-08 being completed first.**
> The KB repositories (SS-02) provide node/edge data. The KB context (SS-04) provides data hooks. The KB screen (SS-08) provides the routing and `?view=graph` param.

---

## Pre-condition (Human Approval Required)

Before implementing, add the following to `package.json` and get human approval:

**Runtime dependencies:**
```json
"d3-force": "^3.0.0",
"d3-zoom": "^3.0.0",
"d3-selection": "^3.0.0"
```

**Dev dependencies:**
```json
"@types/d3-force": "^3.0.0",
"@types/d3-zoom": "^3.0.0",
"@types/d3-selection": "^3.0.0"
```

> **Escalation:** Do NOT add any d3 packages beyond the three listed above. If other d3 sub-packages are needed, escalate to human review.

---

## Intent

Create `src/features/kb/GraphView.tsx` using d3-force (layout), d3-zoom (touch/camera), and Canvas 2D (rendering). No react-force-graph, no sigma.js, no cytoscape.js. The view is accessible from the KB screen via `?view=graph` query param or a "Graph" button.

---

## Files to Create

| File | Exports |
|---|---|
| `src/features/kb/GraphView.tsx` | `GraphView` component |
| `src/features/kb/graphRenderer.ts` | `renderGraph(canvas, nodes, edges, transform)` — pure Canvas 2D render function |

## Files to Modify

| File | Change |
|---|---|
| `src/screens/KnowledgeBaseScreen.tsx` | Check `?view=graph` query param; if set, render `<GraphView>` instead of `<VaultBrowser>` |

---

## Implementation Steps

### Step 1 — Add d3 packages to `package.json`

Add the six packages listed in the pre-condition section (3 runtime, 3 dev). Only these three d3 sub-packages.

### Step 2 — Create `src/features/kb/graphRenderer.ts`

A pure function — no React, no hooks. Takes canvas context, node array, edge array, and d3-zoom transform, and renders to Canvas 2D:

```typescript
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { ZoomTransform } from 'd3-zoom';
import type { KBNode, KBEdge } from '../../storage/db/client';

// Node color map by type
const NODE_COLORS: Record<string, string> = {
  note: '#3b82f6',        // blue
  character: '#22c55e',   // green
  location: '#92400e',    // brown
  item: '#f59e0b',        // gold
  tag: '#6b7280',         // gray
  unresolved: '#ef4444',  // red
};
const DEFAULT_NODE_COLOR = '#6b7280';

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
}

export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  id: string;
}

export function renderGraph(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  edges: GraphEdge[],
  transform: ZoomTransform,
  width: number,
  height: number
): void {
  // Clear
  ctx.clearRect(0, 0, width, height);

  // Apply zoom/pan transform
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  // Draw edges
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  for (const edge of edges) {
    const source = edge.source as GraphNode;
    const target = edge.target as GraphNode;
    if (source.x == null || source.y == null || target.x == null || target.y == null) continue;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  }

  // Draw nodes
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    ctx.beginPath();
    ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = NODE_COLORS[node.type] ?? DEFAULT_NODE_COLOR;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#1e293b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + 18);
  }

  ctx.restore();
}
```

### Step 3 — Create `src/features/kb/GraphView.tsx`

```typescript
import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3Force from 'd3-force';
import * as d3Zoom from 'd3-zoom';
import * as d3Selection from 'd3-selection';
import { renderGraph, GraphNode, GraphEdge } from './graphRenderer';
import { getNodesByCampaign, getSharedNodes } from '../../storage/repositories/kbNodeRepository';
import { getEdgesByCampaign } from '../../storage/repositories/kbEdgeRepository';
import type { KBNode, KBEdge } from '../../storage/db/client';

interface GraphViewProps {
  campaignId: string;
  centeredNodeId?: string; // if set, centers and highlights this node on mount
}

export function GraphView({ campaignId, centeredNodeId }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const simulationRef = useRef<d3Force.Simulation<GraphNode, GraphEdge> | null>(null);
  const transformRef = useRef<d3Zoom.ZoomTransform>(d3Zoom.zoomIdentity);

  const [showTags, setShowTags] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(['note', 'character', 'location', 'item', 'unresolved'])
    // 'tag' excluded by default
  );

  // Load data
  useEffect(() => {
    async function load() {
      const [campaignNodes, sharedNodes] = await Promise.all([
        getNodesByCampaign(campaignId),
        getSharedNodes(),
      ]);
      const allNodes: KBNode[] = [...campaignNodes, ...sharedNodes];
      const allEdges = await getEdgesByCampaign(campaignId);

      // Filter: hide tags unless showTags; hide leaf nodes unless showAll
      const edgeCountMap = new Map<string, number>();
      for (const e of allEdges) {
        edgeCountMap.set(e.fromId, (edgeCountMap.get(e.fromId) ?? 0) + 1);
        edgeCountMap.set(e.toId, (edgeCountMap.get(e.toId) ?? 0) + 1);
      }

      const filteredNodes = allNodes.filter(n => {
        // Check showTags for tag nodes BEFORE visibleTypes filter
        if (n.type === 'tag') {
          if (!showTags) return false;
        } else if (!visibleTypes.has(n.type)) {
          return false;
        }
        if (!showAll && allNodes.length > 200 && (edgeCountMap.get(n.id) ?? 0) < 2) return false;
        return true;
      });

      const nodeIdSet = new Set(filteredNodes.map(n => n.id));
      const filteredEdges = allEdges.filter(e => nodeIdSet.has(e.fromId) && nodeIdSet.has(e.toId));

      // Convert to GraphNode / GraphEdge
      const graphNodes: GraphNode[] = filteredNodes.map(n => ({ ...n }));
      const nodeById = new Map(graphNodes.map(n => [n.id, n]));
      const graphEdges: GraphEdge[] = filteredEdges
        .map(e => ({
          id: e.id,
          source: nodeById.get(e.fromId) ?? e.fromId,
          target: nodeById.get(e.toId) ?? e.toId,
        }))
        .filter(e => typeof e.source === 'object' && typeof e.target === 'object');

      setupSimulation(graphNodes, graphEdges as GraphEdge[]);
    }
    load();
  }, [campaignId, showTags, showAll, visibleTypes]);

  function setupSimulation(nodes: GraphNode[], edges: GraphEdge[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    // Stop previous simulation
    simulationRef.current?.stop();

    const simulation = d3Force.forceSimulation<GraphNode>(nodes)
      .force('link', d3Force.forceLink<GraphNode, GraphEdge>(edges).id(d => d.id).distance(60))
      .force('charge', d3Force.forceManyBody().strength(-120))
      .force('center', d3Force.forceCenter(width / 2, height / 2));

    simulation.on('tick', () => {
      const ctx = canvas.getContext('2d');
      if (ctx) renderGraph(ctx, nodes, edges, transformRef.current, width, height);
    });

    simulationRef.current = simulation;

    // If centeredNodeId, translate to that node once positions stabilize
    if (centeredNodeId) {
      simulation.on('end', () => {
        const centered = nodes.find(n => n.id === centeredNodeId);
        if (centered && centered.x != null && centered.y != null) {
          const t = d3Zoom.zoomIdentity.translate(width / 2 - centered.x, height / 2 - centered.y);
          transformRef.current = t;
        }
      });
    }
  }

  // Setup d3-zoom on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoom = d3Zoom.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        // Re-render
        const ctx = canvas.getContext('2d');
        const nodes = (simulationRef.current?.nodes() as GraphNode[]) ?? [];
        const links = ((simulationRef.current?.force('link') as d3Force.ForceLink<GraphNode, GraphEdge>)?.links() ?? []) as GraphEdge[];
        if (ctx) renderGraph(ctx, nodes, links, transformRef.current, canvas.offsetWidth, canvas.offsetHeight);
      });

    d3Selection.select(canvas).call(zoom);
    return () => { d3Selection.select(canvas).on('.zoom', null); };
  }, []);

  // Tap/click to navigate
  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
    const py = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

    const nodes = (simulationRef.current?.nodes() as GraphNode[]) ?? [];
    const hit = nodes.find(n => {
      if (n.x == null || n.y == null) return false;
      return Math.hypot(n.x - px, n.y - py) < 10; // 10px hit radius
    });
    if (hit) navigate(`/kb/${hit.id}`);
  }, [navigate]);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    resizeObserver.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Filter controls */}
      <div className="/* absolute top toolbar */">
        <label>
          <input type="checkbox" checked={showTags} onChange={e => setShowTags(e.target.checked)} />
          Show tags
        </label>
        <label>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Show all nodes
        </label>
        {/* Type toggle buttons for each type */}
        {['note', 'character', 'location', 'item', 'unresolved'].map(type => (
          <button
            key={type}
            onClick={() => setVisibleTypes(prev => {
              const next = new Set(prev);
              next.has(type) ? next.delete(type) : next.add(type);
              return next;
            })}
            style={{ opacity: visibleTypes.has(type) ? 1 : 0.4 }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}
```

### Step 4 — Modify `src/screens/KnowledgeBaseScreen.tsx`

Add `?view=graph` handling:

```typescript
const [searchParams] = useSearchParams();
const isGraphView = searchParams.get('view') === 'graph';

// In render:
{isGraphView
  ? <GraphView campaignId={campaign.id} centeredNodeId={nodeId} />
  : nodeId
    ? <NoteReader noteId={nodeId} />
    : <VaultBrowser campaignId={campaign.id} />
}
```

---

## Acceptance Criteria

1. `npm run build` succeeds with zero TypeScript errors after adding d3 packages.
2. `GraphView` renders a Canvas element that fills its container.
3. Nodes are rendered as colored circles, color-coded by `kb_node.type` (note=blue, character=green, location=brown, item=gold, tag=gray, unresolved=red).
4. Edges are rendered as lines between nodes.
5. Tag nodes are hidden by default; a "Show tags" toggle reveals them.
6. d3-zoom handles: pinch-to-zoom, one-finger pan, mouse wheel zoom.
7. Tapping a node (via `pointerup` + inverse transform to graph coords) navigates to `/kb/{nodeId}`.
8. When `centeredNodeId` is provided, the graph opens centered on that node with depth-1 neighbors visible.
9. For > 200 nodes, default filter to nodes with ≥ 2 connections; a "Show all nodes" toggle reveals leaf nodes.
10. Filter panel allows toggling node types on/off (re-filter data arrays, restart d3 simulation).
11. Force simulation uses: `forceLink` (edges), `forceManyBody` (repulsion), `forceCenter` (canvas midpoint).
12. Opening graph from a specific note (e.g., from NoteReader's "Graph" button) shows that note centered with its neighbors visible.

---

## Verification Commands

```bash
# TypeScript build check (after adding d3 packages)
npm run build

# (Manual) Test in browser:
# 1. Navigate to /kb?view=graph — confirm Canvas renders
# 2. Confirm: nodes appear as colored circles matching type colors
# 3. Confirm: edges appear as lines between nodes
# 4. Pinch-to-zoom — confirm canvas scales
# 5. Pan — confirm canvas translates
# 6. Tap a node — confirm navigation to /kb/{nodeId}
# 7. Toggle "Show tags" — confirm tag nodes appear/disappear
# 8. Open graph from a note with 3+ links — confirm note is centered
```

---

## Escalation Triggers

Stop and escalate to human if:
- Any d3 package beyond `d3-force`, `d3-zoom`, `d3-selection` is needed for the implementation.
- Canvas 2D touch interactions do not work on iOS (may need `touch-action: none` CSS or pointer event polyfill).

---

## Constraints / Notes

- No react-force-graph, no sigma.js, no cytoscape.js — d3-force + Canvas 2D only.
- Only the three d3 packages listed are approved. No other new npm dependencies.
- The `graphRenderer.ts` function is deliberately pure (no React) for testability.
- SCALE risk: 500+ nodes on tablet. Default depth-1 filter + 2+ connection filter mitigates this.
- Correctness over speed. No shell commands. Cross-platform.
