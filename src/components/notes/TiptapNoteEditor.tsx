import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Link from '@tiptap/extension-link';
import { DescriptorMention } from '../../features/notes/descriptorMentionExtension';
import { useDescriptorSuggestions } from '../../features/notes/useDescriptorSuggestions';
import { getNotesByCampaign } from '../../storage/repositories/noteRepository';
import { getAll as getAllCharacters } from '../../storage/repositories/characterRepository';
import type { Note } from '../../types/note';

/**
 * Props for the {@link TiptapNoteEditor} component.
 */
export interface TiptapNoteEditorProps {
  /**
   * The initial document to load into the editor as a ProseMirror JSON object.
   * Pass `null` or `undefined` to start with an empty document.
   *
   * @remarks
   * Typed as `unknown` because the ProseMirror JSON schema is not exposed from
   * Tiptap's public types and callers typically store it as opaque JSON.
   */
  initialContent: unknown; // ProseMirror JSON object (or null/undefined for empty)
  /**
   * Called on every document change with the updated ProseMirror JSON.
   * Callers should debounce or persist this in a controlled fashion.
   *
   * @param content - The full ProseMirror document as a plain JSON object.
   */
  onChange: (content: unknown) => void;
  /**
   * ID of the active campaign, used to load notes and characters for the
   * `@mention` and `#descriptor` autocomplete suggestions.
   * Pass `null` when there is no active campaign.
   */
  campaignId: string | null;
  /** Placeholder text shown while the editor is loading or empty. */
  placeholder?: string;
  /** Show a formatting toolbar above the editor (default: `false` for backward compat). */
  showToolbar?: boolean;
  /** Minimum height for the editor content area (e.g. `"200px"`). */
  minHeight?: string;
}

/**
 * Creates a Tiptap suggestion renderer object for `@mention` completions.
 *
 * @remarks
 * The renderer builds and manages a plain DOM popup (fixed-position `<div>`)
 * that appears below the caret when the user types `@`. Items are
 * `{ id, label }` objects sourced from campaign notes and characters.
 *
 * Keyboard navigation (ArrowUp / ArrowDown / Enter / Escape) and mouse
 * interaction are both supported. The popup is appended directly to
 * `document.body` and removed on `onExit`.
 *
 * @returns A Tiptap suggestion renderer with `onStart`, `onUpdate`,
 *   `onKeyDown`, and `onExit` lifecycle hooks.
 */
function createSuggestionRenderer() {
  let container: HTMLDivElement | null = null;
  let items: Array<{ id: string; label: string }> = [];
  let command: ((item: { id: string; label: string }) => void) | null = null;
  let selectedIndex = 0;

  /** Applies highlight styles to the currently focused item button. */
  const highlightSelected = () => {
    if (!container) return;
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn, i) => {
      (btn as HTMLButtonElement).style.background = i === selectedIndex
        ? 'var(--color-surface-raised, #f0f0f0)'
        : 'none';
    });
  };

  /**
   * (Re-)populates the popup with a fresh list of suggestion items.
   *
   * Clears the container's innerHTML, creates one `<button>` per item, and
   * resets the selected index to 0.
   *
   * @param newItems - The latest filtered suggestion list.
   * @param newCommand - The Tiptap callback to invoke when an item is chosen.
   */
  const buildItems = (
    newItems: Array<{ id: string; label: string }>,
    newCommand: (item: { id: string; label: string }) => void
  ) => {
    items = newItems;
    command = newCommand;
    selectedIndex = 0;
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      btn.setAttribute('data-index', String(i));
      btn.style.cssText = [
        'display: block',
        'width: 100%',
        'text-align: left',
        'padding: 8px 12px',
        'min-height: 44px',
        'background: none',
        'border: none',
        'cursor: pointer',
        'color: var(--color-text, #333)',
      ].join(';');
      btn.addEventListener('click', () => {
        command?.(item);
      });
      btn.addEventListener('mouseover', () => {
        selectedIndex = i;
        highlightSelected();
      });
      container!.appendChild(btn);
    });
    highlightSelected();
  };

  return {
    /** Called by Tiptap when the `@` trigger is first detected. Creates the popup DOM node. */
    onStart: (props: { items: Array<{ id: string; label: string }>; command: (item: { id: string; label: string }) => void; clientRect?: (() => DOMRect | null) | null }) => {
      container = document.createElement('div');
      container.style.cssText = [
        'position: fixed',
        'z-index: 9999',
        'background: var(--color-surface, #fff)',
        'border: 1px solid var(--color-border, #ccc)',
        'border-radius: 4px',
        'box-shadow: 0 2px 12px rgba(0,0,0,0.2)',
        'max-height: 200px',
        'overflow-y: auto',
        'min-width: 180px',
      ].join(';');

      const rect = props.clientRect?.();
      if (rect) {
        container.style.top = `${rect.bottom + 4}px`;
        container.style.left = `${rect.left}px`;
      }

      buildItems(props.items, props.command);
      document.body.appendChild(container);
    },
    /** Called by Tiptap when the query text or items list changes. Repositions and repopulates the popup. */
    onUpdate: (props: { items: Array<{ id: string; label: string }>; command: (item: { id: string; label: string }) => void; clientRect?: (() => DOMRect | null) | null }) => {
      if (!container) return;
      const rect = props.clientRect?.();
      if (rect) {
        container.style.top = `${rect.bottom + 4}px`;
        container.style.left = `${rect.left}px`;
      }
      buildItems(props.items, props.command);
    },
    /**
     * Called by Tiptap for each keydown event while the popup is open.
     *
     * Handles ArrowUp, ArrowDown, Enter (select), and Escape (dismiss).
     *
     * @returns `true` when the key event was consumed, `false` to let Tiptap handle it.
     */
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'Escape') return true;
      if (event.key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % Math.max(items.length, 1);
        highlightSelected();
        return true;
      }
      if (event.key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1);
        highlightSelected();
        return true;
      }
      if (event.key === 'Enter') {
        if (items[selectedIndex]) {
          command?.(items[selectedIndex]);
          return true;
        }
      }
      return false;
    },
    /** Called by Tiptap when the mention is committed or cancelled. Removes the popup from the DOM. */
    onExit: () => {
      if (container) {
        container.remove();
        container = null;
      }
      items = [];
      command = null;
      selectedIndex = 0;
    },
  };
}

/**
 * Creates a Tiptap suggestion renderer object for `#descriptor` completions.
 *
 * @remarks
 * Functionally identical in structure to {@link createSuggestionRenderer} but
 * tailored for the `DescriptorMention` extension which triggers on `#`. Items
 * are plain strings (descriptor labels) rather than `{ id, label }` objects;
 * they are converted to the required shape when the command is invoked.
 *
 * The popup is not shown at all when `props.items` is empty on `onStart`.
 *
 * @returns A Tiptap suggestion renderer with `onStart`, `onUpdate`,
 *   `onKeyDown`, and `onExit` lifecycle hooks.
 */
function createDescriptorRenderer() {
  let container: HTMLDivElement | null = null;
  let items: string[] = [];
  let command: ((item: { id: string; label: string }) => void) | null = null;
  let selectedIndex = 0;

  /** Applies highlight styles to the currently focused item button. */
  const highlightSelected = () => {
    if (!container) return;
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn, i) => {
      (btn as HTMLButtonElement).style.background = i === selectedIndex
        ? 'var(--color-surface-raised, #f0f0f0)'
        : 'none';
    });
  };

  /**
   * (Re-)populates the popup with a fresh list of descriptor suggestions.
   *
   * Each button is prefixed with `#` to visually reinforce the descriptor
   * trigger character.
   *
   * @param newItems - The latest filtered list of descriptor label strings.
   * @param newCommand - The Tiptap callback to invoke when an item is chosen.
   */
  const buildItems = (
    newItems: string[],
    newCommand: (item: { id: string; label: string }) => void
  ) => {
    items = newItems;
    command = newCommand;
    selectedIndex = 0;
    if (!container) return;
    container.innerHTML = '';
    items.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.textContent = `#${label}`;
      btn.setAttribute('data-index', String(i));
      btn.style.cssText = [
        'display: block',
        'width: 100%',
        'text-align: left',
        'padding: 8px 12px',
        'min-height: 44px',
        'background: none',
        'border: none',
        'cursor: pointer',
        'color: var(--color-text, #333)',
        'font-size: 14px',
      ].join(';');
      btn.addEventListener('click', () => {
        command?.({ id: label, label });
      });
      btn.addEventListener('mouseover', () => {
        selectedIndex = i;
        highlightSelected();
      });
      container!.appendChild(btn);
    });
    highlightSelected();
  };

  return {
    /** Called by Tiptap when `#` is typed. Skips creating the popup when no items are available. */
    onStart: (props: { items: string[]; command: (item: { id: string; label: string }) => void; clientRect?: (() => DOMRect | null) | null }) => {
      if (!props.items.length) return;
      container = document.createElement('div');
      container.style.cssText = [
        'position: fixed',
        'z-index: 9999',
        'background: var(--color-surface, #fff)',
        'border: 1px solid var(--color-border, #ccc)',
        'border-radius: 4px',
        'box-shadow: 0 2px 12px rgba(0,0,0,0.2)',
        'max-height: 200px',
        'overflow-y: auto',
        'min-width: 180px',
      ].join(';');
      const rect = props.clientRect?.();
      if (rect) {
        container.style.top = `${rect.bottom + 4}px`;
        container.style.left = `${rect.left}px`;
      }
      buildItems(props.items, props.command);
      document.body.appendChild(container);
    },
    /** Called by Tiptap when the query changes. Repositions and repopulates the popup. */
    onUpdate: (props: { items: string[]; command: (item: { id: string; label: string }) => void; clientRect?: (() => DOMRect | null) | null }) => {
      if (!container) return;
      const rect = props.clientRect?.();
      if (rect) {
        container.style.top = `${rect.bottom + 4}px`;
        container.style.left = `${rect.left}px`;
      }
      buildItems(props.items, props.command);
    },
    /**
     * Called by Tiptap for each keydown event while the descriptor popup is open.
     *
     * Handles ArrowUp, ArrowDown, Enter (select), and Escape (dismiss).
     *
     * @returns `true` when the key event was consumed, `false` otherwise.
     */
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'Escape') return true;
      if (event.key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % Math.max(items.length, 1);
        highlightSelected();
        return true;
      }
      if (event.key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1);
        highlightSelected();
        return true;
      }
      if (event.key === 'Enter') {
        if (items[selectedIndex]) {
          command?.({ id: items[selectedIndex], label: items[selectedIndex] });
          return true;
        }
      }
      return false;
    },
    /** Called by Tiptap when the descriptor mention is committed or cancelled. Cleans up the popup. */
    onExit: () => {
      if (container) {
        container.remove();
        container = null;
      }
      items = [];
      command = null;
      selectedIndex = 0;
    },
  };
}

/**
 * Plain `<textarea>` shown as a last-resort fallback when the Tiptap editor
 * fails to initialise within the 2-second timeout.
 *
 * @param onChange - Called with the raw string value on every input event.
 * @param placeholder - Placeholder text for the textarea.
 */
function TextareaFallback({ onChange, placeholder }: { onChange: (val: string) => void; placeholder?: string }) {
  return (
    <textarea
      placeholder={placeholder ?? 'Write your note...'}
      onChange={e => onChange(e.target.value)}
      className="w-full min-h-[120px] p-2 bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded font-[family-name:var(--font-body)] text-sm resize-y box-border"
    />
  );
}

/**
 * Rich-text note editor built on [Tiptap](https://tiptap.dev/) with
 * campaign-aware `@mention` and `#descriptor` autocomplete.
 *
 * @remarks
 * ### Features
 * - **StarterKit** — bold, italic, headings (H2/H3), bullet and ordered lists,
 *   blockquote, and code blocks out of the box.
 * - **Link extension** — inline hyperlinks; URL is prompted via `window.prompt`
 *   from the optional toolbar.
 * - **`@mention`** — typing `@` opens a fixed-position dropdown populated with
 *   notes from the active campaign (NPCs, locations, loot, etc.) and all
 *   characters in the database, filtered by the typed query. Up to 12 results
 *   are returned; character entries are deduplicated against notes.
 * - **`#descriptor`** — typing `#` opens a dropdown of frequency-ranked
 *   descriptors derived from existing campaign notes via
 *   `useDescriptorSuggestions`.
 *
 * ### Resilience
 * If Tiptap fails to initialise within 2 seconds (e.g., in environments where
 * the ProseMirror DOM view cannot attach), the component falls back to a plain
 * `<textarea>` via {@link TextareaFallback}. While loading, a styled
 * placeholder box is shown instead.
 *
 * ### Suggestion popup lifecycle
 * Each suggestion type uses its own renderer instance (stored in a `useRef`)
 * so that multiple editor instances on the same page do not share popup state.
 * The `getSuggestions` function from the descriptor hook is stored in a ref
 * to give the Tiptap suggestion closure access to its latest value without
 * re-creating the editor.
 *
 * @param initialContent - ProseMirror JSON document to pre-populate the editor.
 * @param onChange - Called with the full ProseMirror JSON on every edit.
 * @param campaignId - Active campaign ID for suggestion data loading.
 * @param placeholder - Hint text shown in empty / loading states.
 * @param showToolbar - Whether to render the formatting toolbar. Defaults to `false`.
 * @param minHeight - CSS min-height for the editable area. Defaults to `"120px"`.
 *
 * @example
 * <TiptapNoteEditor
 *   initialContent={note.content}
 *   onChange={content => setNote(prev => ({ ...prev, content }))}
 *   campaignId={activeCampaignId}
 *   placeholder="Write your session note..."
 *   showToolbar
 *   minHeight="200px"
 * />
 */
export function TiptapNoteEditor({ initialContent, onChange, campaignId, placeholder, showToolbar = false, minHeight }: TiptapNoteEditorProps) {
  const [failed, setFailed] = React.useState(false);
  const [campaignNotes, setCampaignNotes] = useState<Note[]>([]);
  /** Stable renderer instance for the `@mention` suggestion popup. */
  const rendererRef = useRef(createSuggestionRenderer());
  /** Stable renderer instance for the `#descriptor` suggestion popup. */
  const descriptorRendererRef = useRef(createDescriptorRenderer());
  /** Timeout handle for the 2-second Tiptap initialisation guard. */
  const initTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load campaign notes for descriptor frequency map
  useEffect(() => {
    if (!campaignId) return;
    let mounted = true;
    getNotesByCampaign(campaignId).then(notes => {
      if (mounted) setCampaignNotes(notes);
    }).catch(() => {/* ignore */});
    return () => { mounted = false; };
  }, [campaignId]);

  // Descriptor suggestions hook (frequency-ranked)
  const { getSuggestions } = useDescriptorSuggestions(campaignNotes);

  // Store getSuggestions in a ref so TipTap's suggestion closure can access current value
  const getSuggestionsRef = useRef(getSuggestions);
  useEffect(() => {
    getSuggestionsRef.current = getSuggestions;
  }, [getSuggestions]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { class: 'tiptap-link' },
        }),
        Mention.configure({
          HTMLAttributes: { class: 'mention' },
          suggestion: {
            items: async ({ query }: { query: string }) => {
              try {
                const results: Array<{ id: string; label: string }> = [];
                const q = query.toLowerCase();

                // Notes from campaign (NPCs, locations, loot, etc.)
                if (campaignId) {
                  const notes = await getNotesByCampaign(campaignId);
                  for (const n of notes) {
                    if (n && n.title.toLowerCase().includes(q)) {
                      const typeLabel = n.type !== 'generic' ? ` [${n.type}]` : '';
                      results.push({ id: n.id, label: `${n.title}${typeLabel}` });
                    }
                  }
                }

                // Characters (party members and all characters)
                const chars = await getAllCharacters();
                for (const c of chars) {
                  if (c.name.toLowerCase().includes(q)) {
                    // Avoid duplicates if character is already in notes as NPC
                    if (!results.some(r => r.label.startsWith(c.name))) {
                      results.push({ id: c.id, label: `${c.name} [character]` });
                    }
                  }
                }

                return results.slice(0, 12);
              } catch {
                return [];
              }
            },
            render: () => rendererRef.current,
          },
        }),
        DescriptorMention.configure({
          HTMLAttributes: { class: 'descriptor-mention' },
          suggestion: {
            char: '#',
            items: ({ query }: { query: string }) => {
              // Use ref to access current getSuggestions from hook
              return getSuggestionsRef.current(query);
            },
            render: () => descriptorRendererRef.current,
          },
        }),
      ],
      content: (initialContent as object) ?? '',
      onUpdate: ({ editor: e }) => {
        onChange(e.getJSON());
      },
    }
  );

  // If editor hasn't initialized after 2 seconds, fall back to textarea
  useEffect(() => {
    if (editor) {
      if (initTimer.current) clearTimeout(initTimer.current);
      return;
    }
    initTimer.current = setTimeout(() => {
      if (!editor) setFailed(true);
    }, 2000);
    return () => {
      if (initTimer.current) clearTimeout(initTimer.current);
    };
  }, [editor]);

  if (failed) {
    return (
      <TextareaFallback
        onChange={val => onChange(val)}
        placeholder={placeholder}
      />
    );
  }

  if (!editor) {
    // Show placeholder box while Tiptap initializes (not the fallback textarea)
    return (
      <div className="font-[family-name:var(--font-body)] text-[var(--color-text-muted)] bg-[var(--color-surface)] p-2 min-h-[120px] rounded border border-[var(--color-border)] cursor-text text-sm">
        {placeholder ?? 'Loading editor...'}
      </div>
    );
  }

  /**
   * Returns inline styles for a toolbar button, reflecting the active state
   * of the corresponding Tiptap mark or node.
   *
   * @param active - Whether the editor cursor is currently inside the relevant mark/node.
   * @returns A `React.CSSProperties` object with accent or surface styling.
   */
  const toolbarBtnClass = (active: boolean) => cn(
    "min-h-11 min-w-11 px-2 border border-[var(--color-border)] rounded cursor-pointer text-sm font-semibold",
    active
      ? "bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]"
      : "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
  );

  return (
    <div>
      {showToolbar && (
        <div className="flex flex-wrap gap-2 p-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] border-b-0 rounded-t">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={toolbarBtnClass(editor.isActive('bold'))}>B</button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={toolbarBtnClass(editor.isActive('italic'))}><em>I</em></button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={toolbarBtnClass(editor.isActive('heading', { level: 2 }))}>H2</button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={toolbarBtnClass(editor.isActive('heading', { level: 3 }))}>H3</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={toolbarBtnClass(editor.isActive('bulletList'))}>• List</button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={toolbarBtnClass(editor.isActive('orderedList'))}>1. List</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={toolbarBtnClass(editor.isActive('blockquote'))}>❝</button>
          <button type="button" onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
            } else {
              const url = window.prompt('URL');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }
          }} className={toolbarBtnClass(editor.isActive('link'))}>Link</button>
        </div>
      )}
      <EditorContent
        editor={editor}
        className={cn(
          "font-[family-name:var(--font-body)] text-[var(--color-text)] bg-[var(--color-surface)] p-2 border border-[var(--color-border)] cursor-text min-h-[120px]",
          showToolbar ? "rounded-b" : "rounded"
        )}
        style={minHeight ? { minHeight } : undefined}
      />
    </div>
  );
}
