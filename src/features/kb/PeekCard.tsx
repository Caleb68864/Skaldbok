/**
 * PeekCard — inline preview card shown when tapping a link.
 *
 * Displays: note title, type badge, first ~100 chars of text content,
 * and an "Open" button. Rendered as a bottom-anchored overlay.
 */

import { useState, useEffect } from 'react';
import { db } from '../../storage/db/client';
import { getNoteById } from '../../storage/repositories/noteRepository';
import type { KBNode } from '../../storage/db/client';

interface PeekCardProps {
  nodeId: string;
  onClose: () => void;
  onOpen: () => void;
}

/**
 * Extracts the first ~100 characters of plain text from a Tiptap JSON body.
 */
function extractTextSnippet(body: unknown, maxLen: number = 100): string {
  if (!body || typeof body !== 'object') return '';

  function walk(node: Record<string, unknown>): string {
    if (node.text && typeof node.text === 'string') return node.text;
    if (Array.isArray(node.content)) {
      return node.content.map((child) => walk(child as Record<string, unknown>)).join(' ');
    }
    return '';
  }

  const text = walk(body as Record<string, unknown>).trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

export function PeekCard({ nodeId, onClose, onOpen }: PeekCardProps) {
  const [node, setNode] = useState<KBNode | null>(null);
  const [snippet, setSnippet] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const kbNode = await db.kb_nodes.get(nodeId);
        if (!mounted) return;
        if (!kbNode) {
          onClose();
          return;
        }
        setNode(kbNode);

        // If it's a note type, load the actual note for a snippet
        if (kbNode.sourceId) {
          const note = await getNoteById(kbNode.sourceId);
          if (mounted && note?.body) {
            const body =
              typeof note.body === 'string'
                ? JSON.parse(note.body)
                : note.body;
            setSnippet(extractTextSnippet(body));
          }
        }
      } catch {
        if (mounted) onClose();
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [nodeId, onClose]);

  if (!node) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />

      {/* Card */}
      <div
        className="relative w-full max-w-[400px] mx-4 mb-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              {node.label}
            </h3>
            <span className="inline-block px-1.5 py-0.5 mt-1 rounded text-xs font-medium bg-blue-500/10 text-blue-500">
              {node.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] bg-transparent border-none cursor-pointer text-lg"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {snippet && (
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            {snippet}
          </p>
        )}

        <button
          onClick={onOpen}
          className="w-full min-h-[44px] px-4 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer"
        >
          Open
        </button>
      </div>
    </div>
  );
}
