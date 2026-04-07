/**
 * Pure Canvas 2D render function for the KB graph.
 *
 * @remarks
 * No React, no hooks — takes canvas context, node array, edge array,
 * and d3-zoom transform, and renders to Canvas 2D. Deliberately pure
 * for testability and separation of concerns.
 */

import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { ZoomTransform } from 'd3-zoom';

/** Node color map by type. */
const NODE_COLORS: Record<string, string> = {
  note: '#3b82f6',       // blue
  character: '#22c55e',  // green
  location: '#92400e',   // brown
  item: '#f59e0b',       // gold
  tag: '#6b7280',        // gray
  unresolved: '#ef4444', // red
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

/**
 * Renders the force graph onto a Canvas 2D context.
 *
 * @param ctx - The Canvas 2D rendering context.
 * @param nodes - Array of graph nodes with x/y positions from d3-force.
 * @param edges - Array of graph edges with source/target references.
 * @param transform - The current d3-zoom transform.
 * @param width - Canvas width in pixels.
 * @param height - Canvas height in pixels.
 */
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

    // Circle
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
