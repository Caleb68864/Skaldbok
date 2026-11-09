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
import { getNodeById } from '../../storage/repositories/kbNodeRepository';
import type { KBNode } from '../../storage/db/client';

/** Props for {@link BacklinksPanel}. */
export interface BacklinksPanelProps {
  nodeId: string;
  onPeek?: (nodeId: string) => void;
}

/**
 * Lists the KB nodes that link *to* `nodeId` — the "what mentions this?" panel.
 *
 * @remarks
 * Backlink edges are read from the graph context, then each edge's `fromId` is
 * resolved to a node for display. Nodes that no longer exist are skipped rather
 * than rendered as dead rows, so a stale edge degrades to a missing entry
 * instead of a crash.
 */
export function BacklinksPanel({ nodeId, onPeek }: BacklinksPanelProps) {
  const { edges: backlinks, error: edgeError } = useBacklinks(nodeId);
  const [sourceNodes, setSourceNodes] = useState<KBNode[]>([]);
  /** Edges whose source node could not be *read* — distinct from one that no longer exists. */
  const [unreadable, setUnreadable] = useState(0);

  // Resolve each backlink edge's fromId to a KBNode
  useEffect(() => {
    let mounted = true;

    async function resolve() {
      const nodes: KBNode[] = [];
      let failed = 0;
      for (const edge of backlinks) {
        try {
          const node = await getNodeById(edge.fromId);
          // A missing node is a stale edge and is skipped on purpose.
          if (node) nodes.push(node);
        } catch (err) {
          // A rejected read is a storage failure, not a stale edge: count it so
          // the panel can say some backlinks are hidden rather than undercount.
          console.error(err);
          failed += 1;
        }
      }
      if (mounted) {
        setSourceNodes(nodes);
        setUnreadable(failed);
      }
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
      {edgeError ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          Couldn't load backlinks — {edgeError}
        </p>
      ) : sourceNodes.length === 0 && unreadable === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          No notes link here yet.
        </p>
      ) : (
        <BacklinkList nodes={sourceNodes} onPeek={onPeek} />
      )}
      {!edgeError && unreadable > 0 && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {unreadable} backlink{unreadable === 1 ? '' : 's'} couldn't be read.
        </p>
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
