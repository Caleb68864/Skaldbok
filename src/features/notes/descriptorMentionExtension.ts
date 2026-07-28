import Mention from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';

/**
 * Plugin key for the inline `#descriptor` chip extension.
 *
 * @remarks
 * The extension below extends Tiptap's Mention with its own name and a `#`
 * trigger character, so `@mention` and `#descriptor` coexist in one editor.
 * A distinct plugin key is what keeps their suggestion popups independent.
 *
 * The node stores `{ type: 'descriptorMention', attrs: { id: label, label } }`
 * — `id` equals `label` because descriptors are free-form words rather than
 * references to an entity with its own id.
 *
 * Note the backticks: written bare, a leading `@mention` at the start of a
 * line is parsed by TypeDoc as an unknown block tag.
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
