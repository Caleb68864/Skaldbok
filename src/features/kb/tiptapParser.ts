/**
 * Extracts wikilink, mention, and descriptor references from a Tiptap JSON tree.
 *
 * @remarks
 * Recursively walks the ProseMirror/Tiptap `content` arrays at any depth.
 * Unknown node types are skipped with a dev-mode warning.
 */

export interface ExtractedLinks {
  /** Label values from wikiLink atom nodes. */
  wikilinks: string[];
  /** Label values from mention atom nodes. */
  mentions: string[];
  /** Label values from descriptorMention atom nodes. */
  descriptors: string[];
}

/** Set of known Tiptap node types that are structural (not link-bearing). */
const KNOWN_STRUCTURAL_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'hardBreak',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'image',
  'tableRow',
  'tableCell',
  'tableHeader',
  'table',
]);

/**
 * Recursively walks a Tiptap JSON tree and extracts link references.
 *
 * @param json - The root Tiptap JSON document (or any sub-node).
 * @returns An {@link ExtractedLinks} object containing all found references.
 */
export function extractLinksFromTiptapJSON(json: unknown): ExtractedLinks {
  const result: ExtractedLinks = { wikilinks: [], mentions: [], descriptors: [] };
  walkNode(json, result);
  return result;
}

function walkNode(node: unknown, result: ExtractedLinks): void {
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;

  if (typeof n.type === 'string') {
    const attrs = n.attrs as Record<string, unknown> | undefined;

    if (n.type === 'wikiLink' && attrs && typeof attrs.label === 'string') {
      result.wikilinks.push(attrs.label);
    } else if (n.type === 'mention' && attrs && typeof attrs.label === 'string') {
      result.mentions.push(attrs.label);
    } else if (n.type === 'descriptorMention' && attrs && typeof attrs.label === 'string') {
      result.descriptors.push(attrs.label);
    } else if (
      !KNOWN_STRUCTURAL_TYPES.has(n.type) &&
      n.type !== 'wikiLink' &&
      n.type !== 'mention' &&
      n.type !== 'descriptorMention'
    ) {
      if (import.meta.env.DEV) {
        console.warn(`[tiptapParser] Unknown node type encountered: ${n.type} — skipping`);
      }
    }
  }

  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      walkNode(child, result);
    }
  }
}
