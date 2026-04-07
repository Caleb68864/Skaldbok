/**
 * React node view renderer for inline wikilink chips.
 *
 * @remarks
 * Renders the wikilink as a styled inline span with double-bracket notation.
 * Unresolved links (id === 'unresolved') get a distinct dimmed/red style.
 */

import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

/**
 * Inline chip component for wikilink nodes in the Tiptap editor.
 */
export function WikiLinkComponent({ node }: NodeViewProps) {
  const { id, label } = node.attrs;
  const isUnresolved = id === 'unresolved';

  return (
    <NodeViewWrapper
      as="span"
      className={`wiki-link inline-flex items-center px-1 rounded text-sm font-medium cursor-pointer ${
        isUnresolved
          ? 'wiki-link--unresolved text-red-400 opacity-60'
          : 'text-blue-500 hover:text-blue-600'
      }`}
      data-id={id}
      data-label={label}
    >
      [[{label}]]
    </NodeViewWrapper>
  );
}
