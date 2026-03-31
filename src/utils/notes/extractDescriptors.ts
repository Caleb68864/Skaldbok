/**
 * Extract descriptor labels from a ProseMirror JSON document.
 * Walks the node tree and collects all nodes where type === 'descriptorMention'.
 * Returns an array of label strings.
 *
 * Modeled on extractText() from utils/prosemirror.
 * Never throws — returns [] for null, undefined, or malformed input.
 */
export function extractDescriptors(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];

  const node = body as Record<string, unknown>;

  // Collect from this node if it's a descriptorMention
  const results: string[] = [];

  if (node.type === 'descriptorMention') {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (attrs && typeof attrs.label === 'string' && attrs.label.length > 0) {
      results.push(attrs.label);
    }
  }

  // Recurse into content children
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const childDescriptors = extractDescriptors(child);
      results.push(...childDescriptors);
    }
  }

  return results;
}
