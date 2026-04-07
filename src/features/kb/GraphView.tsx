/**
 * Canvas-based force-directed graph view of the KB.
 *
 * @remarks
 * Uses d3-force for layout, d3-zoom for touch/camera, and Canvas 2D for
 * rendering. No react-force-graph, no sigma.js, no cytoscape.js.
 *
 * Accessible from KB screen via `?view=graph` query param.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
} from 'd3-force';
import type { Simulation } from 'd3-force';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { ZoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import { renderGraph } from './graphRenderer';
import type { GraphNode, GraphEdge } from './graphRenderer';
import {
  getNodesByCampaign,
  getSharedNodes,
} from '../../storage/repositories/kbNodeRepository';
import { getEdgesByCampaign } from '../../storage/repositories/kbEdgeRepository';
import type { KBNode } from '../../storage/db/client';

interface GraphViewProps {
  campaignId: string;
  centeredNodeId?: string;
}

export function GraphView({ campaignId, centeredNodeId }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const simulationRef = useRef<Simulation<GraphNode, GraphEdge> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);

  const [showTags, setShowTags] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(['note', 'character', 'location', 'item', 'unresolved'])
  );

  // Load data and build simulation
  useEffect(() => {
    let mounted = true;

    async function load() {
      const [campaignNodes, sharedNodes] = await Promise.all([
        getNodesByCampaign(campaignId),
        getSharedNodes(),
      ]);
      const allNodes: KBNode[] = [...campaignNodes, ...sharedNodes];
      const allEdges = await getEdgesByCampaign(campaignId);

      if (!mounted) return;

      // Edge count map for filtering
      const edgeCountMap = new Map<string, number>();
      for (const e of allEdges) {
        edgeCountMap.set(e.fromId, (edgeCountMap.get(e.fromId) ?? 0) + 1);
        edgeCountMap.set(e.toId, (edgeCountMap.get(e.toId) ?? 0) + 1);
      }

      // Filter nodes
      const filteredNodes = allNodes.filter((n) => {
        // Check showTags for tag nodes BEFORE visibleTypes filter
        if (n.type === 'tag') {
          if (!showTags) return false;
        } else if (!visibleTypes.has(n.type)) {
          return false;
        }
        // For large graphs, hide leaf nodes unless showAll
        if (
          !showAll &&
          allNodes.length > 200 &&
          (edgeCountMap.get(n.id) ?? 0) < 2
        )
          return false;
        return true;
      });

      const nodeIdSet = new Set(filteredNodes.map((n) => n.id));
      const filteredEdges = allEdges.filter(
        (e) => nodeIdSet.has(e.fromId) && nodeIdSet.has(e.toId)
      );

      // Convert to GraphNode / GraphEdge
      const graphNodes: GraphNode[] = filteredNodes.map((n) => ({
        id: n.id,
        label: n.label,
        type: n.type,
      }));
      const nodeById = new Map(graphNodes.map((n) => [n.id, n]));
      const graphEdges: GraphEdge[] = [];
      for (const e of filteredEdges) {
        const source = nodeById.get(e.fromId);
        const target = nodeById.get(e.toId);
        if (source && target) {
          graphEdges.push({ id: e.id, source, target });
        }
      }

      nodesRef.current = graphNodes;
      edgesRef.current = graphEdges;

      setupSimulation(graphNodes, graphEdges);
    }

    load().catch((err) => {
      if (import.meta.env.DEV)
        console.warn('[GraphView] Failed to load data', err);
    });

    return () => {
      mounted = false;
    };
  }, [campaignId, showTags, showAll, visibleTypes]);

  function setupSimulation(nodes: GraphNode[], edges: GraphEdge[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.offsetWidth || 800;
    const height = canvas.offsetHeight || 600;

    // Stop previous simulation
    simulationRef.current?.stop();

    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance(60)
      )
      .force('charge', forceManyBody().strength(-120))
      .force('center', forceCenter(width / 2, height / 2));

    simulation.on('tick', () => {
      const ctx = canvas.getContext('2d');
      if (ctx)
        renderGraph(
          ctx,
          nodes,
          edges,
          transformRef.current,
          canvas.width,
          canvas.height
        );
    });

    simulationRef.current = simulation;

    // Center on specific node once simulation stabilizes
    if (centeredNodeId) {
      simulation.on('end', () => {
        const centered = nodes.find((n) => n.id === centeredNodeId);
        if (centered && centered.x != null && centered.y != null) {
          const t = zoomIdentity.translate(
            width / 2 - centered.x,
            height / 2 - centered.y
          );
          transformRef.current = t;
          const ctx = canvas.getContext('2d');
          if (ctx)
            renderGraph(ctx, nodes, edges, t, canvas.width, canvas.height);
        }
      });
    }
  }

  // Setup d3-zoom on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        const ctx = canvas.getContext('2d');
        if (ctx)
          renderGraph(
            ctx,
            nodesRef.current,
            edgesRef.current,
            transformRef.current,
            canvas.width,
            canvas.height
          );
      });

    select(canvas).call(zoomBehavior);
    return () => {
      select(canvas).on('.zoom', null);
    };
  }, []);

  // Tap/click to navigate
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px =
        (e.clientX - rect.left - transformRef.current.x) /
        transformRef.current.k;
      const py =
        (e.clientY - rect.top - transformRef.current.y) /
        transformRef.current.k;

      const nodes = nodesRef.current;
      const hit = nodes.find((n) => {
        if (n.x == null || n.y == null) return false;
        return Math.hypot(n.x - px, n.y - py) < 10;
      });
      if (hit) navigate(`/kb/${hit.id}`);
    },
    [navigate]
  );

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

  const toggleType = useCallback((type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  return (
    <div className="w-full h-full relative" style={{ minHeight: '400px' }}>
      {/* Back button */}
      <button
        onClick={() => navigate('/kb')}
        className="absolute top-2 right-2 z-10 min-h-11 px-3 py-1.5 flex items-center gap-1.5 bg-[var(--color-surface)]/80 backdrop-blur-sm rounded-lg border border-[var(--color-border)] cursor-pointer text-[var(--color-text)] text-xs font-medium"
        aria-label="Back to list"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        List
      </button>

      {/* Filter controls */}
      <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-2 p-2 bg-[var(--color-surface)]/80 rounded-lg border border-[var(--color-border)] backdrop-blur-sm">
        <label className="flex items-center gap-1 text-xs text-[var(--color-text)] cursor-pointer">
          <input
            type="checkbox"
            checked={showTags}
            onChange={(e) => setShowTags(e.target.checked)}
          />
          Show tags
        </label>
        <label className="flex items-center gap-1 text-xs text-[var(--color-text)] cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          Show all
        </label>
        {['note', 'character', 'location', 'item', 'unresolved'].map(
          (type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-2 py-0.5 text-xs rounded border-none cursor-pointer ${
                visibleTypes.has(type)
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                  : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] opacity-50'
              }`}
            >
              {type}
            </button>
          )
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ touchAction: 'none' }}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}
