import Mention from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';

/**
 * TipTap extension for inline #descriptor chips.
 * Extends Mention with a separate name and '#' trigger character,
 * so both @mention and #descriptor work simultaneously in the same editor.
 *
 * The node stores: { type: 'descriptorMention', attrs: { id: label, label: label } }
 * (We use id === label since descriptors are free-form words, not entity references.)
 */
export const DescriptorMentionPluginKey = new PluginKey('descriptorMention');

/** The `#descriptor` inline-chip extension: a `#`-triggered Mention variant that coexists with `@mention` in the same editor. */
export const DescriptorMention = Mention.extend({
  name: 'descriptorMention',
}).configure({
  HTMLAttributes: { class: 'descriptor-mention' },
  suggestion: {
    char: '#',
    pluginKey: DescriptorMentionPluginKey,
    // items and render are injected at registration time in TiptapNoteEditor
    // via the getSuggestions ref pattern (see TiptapNoteEditor.tsx)
    items: () => [],
    render: () => ({
      onStart: () => undefined,
      onUpdate: () => undefined,
      onKeyDown: () => false,
      onExit: () => undefined,
    }),
  },
});
