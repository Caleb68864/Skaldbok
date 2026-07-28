/**
 * Plain-text <-> ProseMirror doc conversion for session-log note capture.
 *
 * @remarks
 * `textToDoc` splits input on blank lines into paragraphs and parses
 * `[[label]]` spans into `wikiLink` inline atom nodes. `docToText` is the
 * inverse, rendering `wikiLink` nodes back to `[[label]]` text.
 */

type ProseMirrorNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
};

const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g;

function parseParagraphText(text: string): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];
  let lastIndex = 0;
  WIKILINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WIKILINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }
    nodes.push({ type: 'wikiLink', attrs: { id: null, label: match[1] } });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return nodes;
}

/**
 * Converts plain text into a ProseMirror doc: blank lines split paragraphs,
 * `[[label]]` spans become `wikiLink` inline atom nodes.
 */
export function textToDoc(text: string): unknown {
  const paragraphs = text.split(/\n\s*\n/);

  return {
    type: 'doc',
    content: paragraphs.map(paragraph => ({
      type: 'paragraph',
      content: parseParagraphText(paragraph),
    })),
  };
}

function serializeNode(node: ProseMirrorNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(serializeNode).join('\n\n');
    case 'paragraph':
      return (node.content ?? []).map(serializeNode).join('');
    case 'text':
      return node.text ?? '';
    case 'wikiLink': {
      const label = node.attrs?.label as string | undefined;
      return label ? `[[${label}]]` : '';
    }
    default:
      return (node.content ?? []).map(serializeNode).join('');
  }
}

/** Inverse of {@link textToDoc}: renders a doc back to plain text. */
export function docToText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') {
    return '';
  }
  return serializeNode(doc as ProseMirrorNode);
}
