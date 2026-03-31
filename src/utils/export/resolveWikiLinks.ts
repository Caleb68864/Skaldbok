type ProseMirrorNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

export function resolveWikiLinks(
  prosemirrorJson: unknown,
  allNotes: Array<{ id: string; title: string }>
): string {
  if (!prosemirrorJson || typeof prosemirrorJson !== 'object') {
    return '';
  }
  return serializeNode(prosemirrorJson as ProseMirrorNode, allNotes);
}

function serializeNode(node: ProseMirrorNode, allNotes: Array<{ id: string; title: string }>): string {
  switch (node.type) {
    case 'doc': {
      return (node.content ?? []).map(child => serializeNode(child, allNotes)).join('');
    }
    case 'paragraph': {
      const inner = (node.content ?? []).map(child => serializeNode(child, allNotes)).join('');
      return inner ? inner + '\n\n' : '\n\n';
    }
    case 'text': {
      return node.text ?? '';
    }
    case 'mention': {
      const id = node.attrs?.id as string | undefined;
      const title = node.attrs?.title as string | undefined;
      if (id) {
        const found = allNotes.find(n => n.id === id);
        if (found) {
          return `[[${found.title}]]`;
        }
      }
      // Deleted note — return plain text
      return title ?? '';
    }
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = '#'.repeat(Math.min(level, 6));
      const inner = (node.content ?? []).map(child => serializeNode(child, allNotes)).join('');
      return `${prefix} ${inner}\n\n`;
    }
    case 'bulletList': {
      return (node.content ?? []).map(child => serializeNode(child, allNotes)).join('');
    }
    case 'orderedList': {
      return (node.content ?? []).map(child => serializeNode(child, allNotes)).join('');
    }
    case 'listItem': {
      const inner = (node.content ?? [])
        .map(child => serializeNode(child, allNotes))
        .join('')
        .replace(/\n\n$/, '');
      return `- ${inner}\n`;
    }
    case 'hardBreak': {
      return '\n';
    }
    case 'horizontalRule': {
      return '\n---\n\n';
    }
    case 'blockquote': {
      const inner = (node.content ?? []).map(child => serializeNode(child, allNotes)).join('');
      return inner.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
    }
    case 'codeBlock': {
      const inner = (node.content ?? []).map(child => serializeNode(child, allNotes)).join('');
      return `\`\`\`\n${inner}\n\`\`\`\n\n`;
    }
    default: {
      // Graceful fallback: serialize content recursively
      if (node.content) {
        return node.content.map(child => serializeNode(child, allNotes)).join('');
      }
      return node.text ?? '';
    }
  }
}
