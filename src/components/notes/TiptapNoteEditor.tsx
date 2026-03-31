import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Link from '@tiptap/extension-link';
import { DescriptorMention } from '../../features/notes/descriptorMentionExtension';
import { useDescriptorSuggestions } from '../../features/notes/useDescriptorSuggestions';
import { getNotesByCampaign } from '../../storage/repositories/noteRepository';
import { getAll as getAllCharacters } from '../../storage/repositories/characterRepository';
import type { Note } from '../../types/note';

export interface TiptapNoteEditorProps {
  initialContent: unknown; // ProseMirror JSON object (or null/undefined for empty)
  onChange: (content: unknown) => void;
  campaignId: string | null;
  placeholder?: string;
  /** Show a formatting toolbar above the editor (default: false for backward compat) */
  showToolbar?: boolean;
  /** Minimum height for the editor content area (e.g. "200px") */
  minHeight?: string;
}

// Minimal suggestion popup renderer for @mention (items are {id, label} objects)
function createSuggestionRenderer() {
  let container: HTMLDivElement | null = null;
  let items: Array<{ id: string; label: string }> = [];
  let command: ((item: { id: string; label: string }) => void) | null = null;
  let selectedIndex = 0;

  const highlightSelected = () => {
    if (!container) return;
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn, i) => {
      (btn as HTMLButtonElement).style.background = i === selectedIndex
        ? 'var(--color-surface-raised, #f0f0f0)'
        : 'none';
    });
  };

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
    onUpdate: (props: { items: Array<{ id: string; label: string }>; command: (item: { id: string; label: string }) => void; clientRect?: (() => DOMRect | null) | null }) => {
      if (!container) return;
      const rect = props.clientRect?.();
      if (rect) {
        container.style.top = `${rect.bottom + 4}px`;
        container.style.left = `${rect.left}px`;
      }
      buildItems(props.items, props.command);
    },
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

// Minimal suggestion popup renderer for #descriptor (items are strings)
function createDescriptorRenderer() {
  let container: HTMLDivElement | null = null;
  let items: string[] = [];
  let command: ((item: { id: string; label: string }) => void) | null = null;
  let selectedIndex = 0;

  const highlightSelected = () => {
    if (!container) return;
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn, i) => {
      (btn as HTMLButtonElement).style.background = i === selectedIndex
        ? 'var(--color-surface-raised, #f0f0f0)'
        : 'none';
    });
  };

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
    onUpdate: (props: { items: string[]; command: (item: { id: string; label: string }) => void; clientRect?: (() => DOMRect | null) | null }) => {
      if (!container) return;
      const rect = props.clientRect?.();
      if (rect) {
        container.style.top = `${rect.bottom + 4}px`;
        container.style.left = `${rect.left}px`;
      }
      buildItems(props.items, props.command);
    },
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

function TextareaFallback({ onChange, placeholder }: { onChange: (val: string) => void; placeholder?: string }) {
  return (
    <textarea
      placeholder={placeholder ?? 'Write your note...'}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        minHeight: '120px',
        padding: '8px',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px',
        fontFamily: 'var(--font-body)',
        fontSize: '14px',
        resize: 'vertical',
        boxSizing: 'border-box',
      }}
    />
  );
}

export function TiptapNoteEditor({ initialContent, onChange, campaignId, placeholder, showToolbar = false, minHeight }: TiptapNoteEditorProps) {
  const [failed, setFailed] = React.useState(false);
  const [campaignNotes, setCampaignNotes] = useState<Note[]>([]);
  const rendererRef = useRef(createSuggestionRenderer());
  const descriptorRendererRef = useRef(createDescriptorRenderer());
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
      <div
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-muted)',
          background: 'var(--color-surface)',
          padding: '8px',
          minHeight: '120px',
          borderRadius: '4px',
          border: '1px solid var(--color-border)',
          cursor: 'text',
          fontSize: '14px',
        }}
      >
        {placeholder ?? 'Loading editor...'}
      </div>
    );
  }

  const toolbarBtnStyle = (active: boolean): React.CSSProperties => ({
    minHeight: '44px',
    minWidth: '44px',
    padding: '0 8px',
    background: active ? 'var(--color-accent)' : 'var(--color-surface-raised)',
    color: active ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  });

  return (
    <div>
      {showToolbar && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '6px',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderBottom: 'none',
            borderRadius: '4px 4px 0 0',
          }}
        >
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={toolbarBtnStyle(editor.isActive('bold'))}>B</button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={toolbarBtnStyle(editor.isActive('italic'))}><em>I</em></button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} style={toolbarBtnStyle(editor.isActive('heading', { level: 2 }))}>H2</button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} style={toolbarBtnStyle(editor.isActive('heading', { level: 3 }))}>H3</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={toolbarBtnStyle(editor.isActive('bulletList'))}>• List</button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={toolbarBtnStyle(editor.isActive('orderedList'))}>1. List</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} style={toolbarBtnStyle(editor.isActive('blockquote'))}>❝</button>
          <button type="button" onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
            } else {
              const url = window.prompt('URL');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }
          }} style={toolbarBtnStyle(editor.isActive('link'))}>Link</button>
        </div>
      )}
      <EditorContent
        editor={editor}
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text)',
          background: 'var(--color-surface)',
          padding: '8px',
          minHeight: minHeight ?? '120px',
          borderRadius: showToolbar ? '0 0 4px 4px' : '4px',
          border: '1px solid var(--color-border)',
          cursor: 'text',
        }}
      />
    </div>
  );
}
