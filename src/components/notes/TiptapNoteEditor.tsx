import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
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
}

// Minimal suggestion popup renderer for @mention (items are {id, title} objects)
function createSuggestionRenderer() {
  let container: HTMLDivElement | null = null;

  return {
    onStart: (props: { items: Array<{ id: string; title: string }>; command: (item: { id: string; title: string }) => void; clientRect?: (() => DOMRect | null) | null }) => {
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

      props.items.forEach(item => {
        const btn = document.createElement('button');
        btn.textContent = item.title;
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
          props.command(item);
        });
        btn.addEventListener('mouseover', () => {
          btn.style.background = 'var(--color-surface-raised, #f0f0f0)';
        });
        btn.addEventListener('mouseout', () => {
          btn.style.background = 'none';
        });
        container!.appendChild(btn);
      });

      document.body.appendChild(container);
    },
    onUpdate: (props: { items: Array<{ id: string; title: string }>; command: (item: { id: string; title: string }) => void; clientRect?: (() => DOMRect | null) | null }) => {
      if (!container) return;
      container.innerHTML = '';
      const rect = props.clientRect?.();
      if (rect) {
        container.style.top = `${rect.bottom + 4}px`;
        container.style.left = `${rect.left}px`;
      }
      props.items.forEach(item => {
        const btn = document.createElement('button');
        btn.textContent = item.title;
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
          props.command(item);
        });
        container!.appendChild(btn);
      });
    },
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      return event.key === 'Escape';
    },
    onExit: () => {
      if (container) {
        container.remove();
        container = null;
      }
    },
  };
}

// Minimal suggestion popup renderer for #descriptor (items are strings)
function createDescriptorRenderer() {
  let container: HTMLDivElement | null = null;

  const buildItems = (
    items: string[],
    command: (item: { id: string; label: string }) => void
  ) => {
    items.forEach(label => {
      const btn = document.createElement('button');
      btn.textContent = `#${label}`;
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
        command({ id: label, label });
      });
      btn.addEventListener('mouseover', () => {
        btn.style.background = 'var(--color-surface-raised, #f0f0f0)';
      });
      btn.addEventListener('mouseout', () => {
        btn.style.background = 'none';
      });
      container!.appendChild(btn);
    });
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
      container.innerHTML = '';
      const rect = props.clientRect?.();
      if (rect) {
        container.style.top = `${rect.bottom + 4}px`;
        container.style.left = `${rect.left}px`;
      }
      buildItems(props.items, props.command);
    },
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      return event.key === 'Escape';
    },
    onExit: () => {
      if (container) {
        container.remove();
        container = null;
      }
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

export function TiptapNoteEditor({ initialContent, onChange, campaignId, placeholder }: TiptapNoteEditorProps) {
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
        Mention.configure({
          HTMLAttributes: { class: 'mention' },
          suggestion: {
            items: async ({ query }: { query: string }) => {
              try {
                const results: Array<{ id: string; title: string }> = [];
                const q = query.toLowerCase();

                // Notes from campaign (NPCs, locations, loot, etc.)
                if (campaignId) {
                  const notes = await getNotesByCampaign(campaignId);
                  for (const n of notes) {
                    if (n && n.title.toLowerCase().includes(q)) {
                      const typeLabel = n.type !== 'generic' ? ` [${n.type}]` : '';
                      results.push({ id: n.id, title: `${n.title}${typeLabel}` });
                    }
                  }
                }

                // Characters (party members and all characters)
                const chars = await getAllCharacters();
                for (const c of chars) {
                  if (c.name.toLowerCase().includes(q)) {
                    // Avoid duplicates if character is already in notes as NPC
                    if (!results.some(r => r.title.startsWith(c.name))) {
                      results.push({ id: c.id, title: `${c.name} [character]` });
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

  return (
    <EditorContent
      editor={editor}
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text)',
        background: 'var(--color-surface)',
        padding: '8px',
        minHeight: '120px',
        borderRadius: '4px',
        border: '1px solid var(--color-border)',
        cursor: 'text',
      }}
    />
  );
}
