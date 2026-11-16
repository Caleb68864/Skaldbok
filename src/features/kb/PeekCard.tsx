/**
 * PeekCard — inline preview card shown when tapping a link.
 *
 * Displays: note title, type badge, first ~100 chars of text content,
 * and an "Open" button. Rendered as a bottom-anchored overlay.
 */

import { useState, useEffect } from 'react';
import { getNodeById } from '../../storage/repositories/kbNodeRepository';
import { getNoteById } from '../../storage/repositories/noteRepository';
import type { KBNode } from '../../storage/db/client';
import { PrivateBadge } from '../notes/NotePrivacy';

/** Props for {@link PeekCard}. */
export interface PeekCardProps {
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

/**
 * Small preview popover for a KB node: its title, type and a short body
 * snippet, with the option to open it fully.
 *
 * @remarks
 * Exists so following a wikilink does not have to mean losing your place —
 * the peek resolves the node and the first ~100 characters of its body without
 * navigating away.
 */
export function PeekCard({ nodeId, onClose, onOpen }: PeekCardProps) {
  const [node, setNode] = useState<KBNode | null>(null);
  const [snippet, setSnippet] = useState('');
  // The peek already reads the note for its snippet, so saying whether that
  // note is private costs nothing and closes the last surface where a private
  // note looked like every other one.
  const [isPrivate, setIsPrivate] = useState(false);
  // Why the card could not show everything. A failed node read used to close
  // the card (`catch { onClose() }`), so a long press that hit a storage
  // failure looked like nothing happened; a body that failed `JSON.parse` took
  // the same exit and hid a node that had loaded.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setNode(null);
    setSnippet('');
    setIsPrivate(false);
    setLoadError(null);
    setBodyError(null);

    async function load() {
      let kbNode: KBNode | undefined;
      try {
        kbNode = await getNodeById(nodeId);
      } catch (err) {
        console.error('PeekCard: node read failed', err);
        if (mounted) setLoadError(err instanceof Error ? err.message : String(err));
        return;
      }
      if (!mounted) return;
      // A link whose node is simply gone has nothing to preview: closing
      // quietly is still right for that one.
      if (!kbNode) {
        onClose();
        return;
      }
      setNode(kbNode);

      // If it's a note type, load the actual note for a snippet
      if (!kbNode.sourceId) return;
      let note;
      try {
        note = await getNoteById(kbNode.sourceId);
      } catch (err) {
        console.error('PeekCard: note read failed', err);
        if (mounted) {
          setBodyError(`Couldn't load this note's text — ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }
      if (!mounted || !note) return;
      setIsPrivate(note.visibility === 'private');
      if (!note.body) return;
      try {
        const body = typeof note.body === 'string' ? JSON.parse(note.body) : note.body;
        setSnippet(extractTextSnippet(body));
      } catch (err) {
        console.error('PeekCard: note body did not parse', err);
        setBodyError("This note's text couldn't be read — it may be damaged.");
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [nodeId, onClose]);

  if (loadError) {
    return (
      <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
        <div
          className="relative w-full max-w-[400px] mx-4 mb-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              Couldn't load this preview — {loadError}
            </p>
            <button
              onClick={onClose}
              className="text-[var(--color-text-muted)] bg-transparent border-none cursor-pointer text-lg"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-500">
                {node.type}
              </span>
              {isPrivate && <PrivateBadge />}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] bg-transparent border-none cursor-pointer text-lg"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {bodyError && (
          <p role="alert" className="text-sm text-[var(--color-danger)] mb-3">
            {bodyError}
          </p>
        )}

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
