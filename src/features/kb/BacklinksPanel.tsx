/**
 * BacklinksPanel — lists all nodes that link to the current node.
 *
 * @remarks
 * Uses `useBacklinks` from KnowledgeBaseContext to fetch edges pointing
 * to the current node, then resolves each edge's source to display
 * the linking note's title and type.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBacklinks } from './KnowledgeBaseContext';
import { db } from '../../storage/db/client';
import type { KBNode } from '../../storage/db/client';

interface BacklinksPanelProps {
  nodeId: string;
  onPeek?: (nodeId: string) => void;
}

export function BacklinksPanel({ nodeId, onPeek }: BacklinksPanelProps) {
  const navigate = useNavigate();
  const backlinks = useBacklinks(nodeId);
  const [sourceNodes, setSourceNodes] = useState<KBNode[]>([]);

  // Resolve each backlink edge's fromId to a KBNode
  useEffect(() => {
    let mounted = true;

    async function resolve() {
      const nodes: KBNode[] = [];
      for (const edge of backlinks) {
        try {
          const node = await db.kb_nodes.get(edge.fromId);
          if (node) nodes.push(node);
        } catch {
          // skip unresolvable
        }
      }
      if (mounted) setSourceNodes(nodes);
    }

    if (backlinks.length > 0) {
      resolve();
    } else {
      setSourceNodes([]);
    }

    return () => {
      mounted = false;
    };
  }, [backlinks]);

  return (
    <div className="border-t border-[var(--color-border)] pt-3">
      <h3 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
        Backlinks ({sourceNodes.length})
      </h3>
      {sourceNodes.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          No notes link here yet.
        </p>
      ) : (
        <BacklinkList nodes={sourceNodes} onPeek={onPeek} />
      )}
    </div>
  );
}

function BacklinkList({ nodes, onPeek }: { nodes: KBNode[]; onPeek?: (nodeId: string) => void }) {
  const navigate = useNavigate();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <div className="flex flex-col gap-1">
      {nodes.map((node) => (
        <button
          key={node.id}
          onClick={() => navigate(`/kb/${node.id}`)}
          onPointerDown={() => {
            if (onPeek) {
              longPressTimer.current = setTimeout(() => onPeek(node.id), 500);
            }
          }}
          onPointerUp={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }}
          onPointerLeave={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }}
          className="flex items-center gap-2 text-left px-2 py-1.5 min-h-[44px] bg-transparent border-none cursor-pointer rounded hover:bg-[var(--color-surface-raised)]"
        >
          <span className="text-sm text-[var(--color-text)]">
            {node.label}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]">
            {node.type}
          </span>
        </button>
      ))}
    </div>
  );
}
