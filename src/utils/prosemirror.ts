/**
 * Recursively extract plain text from a ProseMirror JSON document.
 * Walks the node tree and collects text content from text nodes.
 */
export function extractText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';

  const node = doc as Record<string, unknown>;

  // Text nodes have a `text` property
  if (typeof node.text === 'string') return node.text;

  // Nodes with content recurse into children
  if (Array.isArray(node.content)) {
    return node.content.map(child => extractText(child)).join(' ');
  }

  return '';
}
