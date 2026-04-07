/**
 * Tiptap extension for [[wikilink]] inline nodes.
 *
 * @remarks
 * Follows the pattern established in `descriptorMentionExtension.ts`.
 * Creates an inline atom node with `id` and `label` attributes.
 * Renders via `ReactNodeViewRenderer` for interactive chip display.
 *
 * Includes:
 * - Suggestion plugin triggered by `[[` for autocomplete
 * - InputRule for typed `[[Page Name]]` (without autocomplete)
 * - PasteRule for pasted `[[Page Name]]` content
 */

import { Node, mergeAttributes, PasteRule } from '@tiptap/core';
import { InputRule } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import { WikiLinkComponent } from './WikiLinkComponent';

/**
 * Distinct ProseMirror PluginKey for the wikilink suggestion plugin.
 * Must not collide with the descriptor or mention plugin keys.
 */
export const WikiLinkPluginKey = new PluginKey('wikiLink');

/**
 * Tiptap Node extension for `[[wikilink]]` inline chips.
 *
 * @example
 * ```ts
 * // Register in your editor config:
 * const editor = useEditor({
 *   extensions: [StarterKit, WikiLink],
 * });
 * ```
 */
export interface WikiLinkOptions {
  suggestion: Partial<SuggestionOptions>;
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  priority: 101,

  addOptions() {
    return {
      suggestion: {
        char: '[[',
        pluginKey: WikiLinkPluginKey,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContentAt(range.from, {
              type: 'wikiLink',
              attrs: { id: props.id, label: props.label },
            })
            .run();
        },
      },
    };
  },

  addAttributes() {
    return {
      id: { default: 'unresolved' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="wiki-link"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'wiki-link',
        'data-id': node.attrs.id,
        'data-label': node.attrs.label,
        class: `wiki-link${node.attrs.id === 'unresolved' ? ' wiki-link--unresolved' : ''}`,
      }),
      `[[${node.attrs.label}]]`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkComponent);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ range, match, chain }) => {
          const label = match[1];
          // ASM-4: InputRule for atom nodes — create and replace inline
          chain()
            .deleteRange(range)
            .insertContentAt(range.from, {
              type: 'wikiLink',
              attrs: { id: 'unresolved', label },
            })
            .run();
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: /\[\[([^\]]+)\]\]/g,
        handler: ({ range, match, chain }) => {
          const label = match[1];
          chain()
            .deleteRange(range)
            .insertContentAt(range.from, {
              type: 'wikiLink',
              attrs: { id: 'unresolved', label },
            })
            .run();
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
