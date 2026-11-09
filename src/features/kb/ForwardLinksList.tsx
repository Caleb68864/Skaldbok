import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNodeById } from '../../storage/repositories/kbNodeRepository';
import type { KBEdge, KBNode } from '../../storage/db/client';

/**
 * Renders a list of forward links from the current note.
 *
 * @remarks
 * Moved out of `NoteReader` so it can be tested. Each edge's target was read
 * with an un-caught `await` inside the effect, so one rejected read was an
 * unhandled rejection that also abandoned every later edge, leaving the list
 * empty under a "Links from this note (N)" heading with no message. A rejected
 * read is now counted and reported; a target that simply no longer exists is
 * still skipped, as before.
 */
export function ForwardLinksList({
  edges,
  onPeek,
}: {
  edges: KBEdge[];
  onPeek?: (nodeId: string) => void;
}) {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<KBNode[]>([]);
  const [unreadable, setUnreadable] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadNodes() {
      const results: KBNode[] = [];
      let failed = 0;
      for (const edge of edges) {
        try {
          const node = await getNodeById(edge.toId);
          if (node) results.push(node);
        } catch (err) {
          console.error(err);
          failed += 1;
        }
      }
      if (mounted) {
        setNodes(results);
        setUnreadable(failed);
      }
    }
    void loadNodes();
    return () => {
      mounted = false;
    };
  }, [edges]);

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
          className="text-left px-2 py-1 text-sm text-[var(--color-accent)] bg-transparent border-none cursor-pointer hover:underline"
        >
          {node.label}
          <span className="ml-1 text-xs text-[var(--color-text-muted)]">
            [{node.type}]
          </span>
        </button>
      ))}
      {unreadable > 0 && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {unreadable} link{unreadable === 1 ? '' : 's'} couldn't be read.
        </p>
      )}
    </div>
  );
}
