/**
 * Read-only note viewer with tappable wikilinks, backlinks panel,
 * forward links summary, and peek cards.
 *
 * @remarks
 * Renders Tiptap content in read-only mode. Wikilink nodes are tappable
 * and navigate to `/kb/{nodeId}`. Unresolved wikilinks prompt "Create note?".
 * Embedded within KnowledgeBaseScreen (not a standalone screen).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { WikiLink } from '../notes/wikilinkExtension';
import { DescriptorMention } from '../notes/descriptorMentionExtension';
import Mention from '@tiptap/extension-mention';
import { getNoteById, createNote } from '../../storage/repositories/noteRepository';
import { getAttachmentsByNote } from '../../storage/repositories/attachmentRepository';
import { useForwardLinks } from './KnowledgeBaseContext';
import { BacklinksPanel } from './BacklinksPanel';
import { PeekCard } from './PeekCard';
import { db } from '../../storage/db/client';
import type { Note } from '../../types/note';
import type { Attachment } from '../../types/attachment';
import type { KBNode } from '../../storage/db/client';

interface NoteReaderProps {
  noteId: string;
}

export function NoteReader({ noteId }: NoteReaderProps) {
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [kbNode, setKbNode] = useState<KBNode | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [peekNodeId, setPeekNodeId] = useState<string | null>(null);

  // Load note data — nodeId might be a kb_nodes ID or a note ID
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // First try to find the KB node
        const node = await db.kb_nodes.get(noteId);
        if (node) {
          if (mounted) setKbNode(node);
          // Load the actual note from sourceId
          if (node.sourceId) {
            const n = await getNoteById(node.sourceId);
            if (mounted) {
              if (n) {
                setNote(n);
                const atts = await getAttachmentsByNote(n.id);
                setAttachments(atts);
              } else {
                setNotFound(true);
              }
            }
          } else {
            if (mounted) setNotFound(true);
          }
        } else {
          // Try as a direct note ID
          const n = await getNoteById(noteId);
          if (mounted) {
            if (n) {
              setNote(n);
              const atts = await getAttachmentsByNote(n.id);
              setAttachments(atts);
              // Look up the KB node
              const kbn = await db.kb_nodes.get(`note-${n.id}`);
              if (kbn) setKbNode(kbn);
            } else {
              setNotFound(true);
            }
          }
        }
      } catch {
        if (mounted) setNotFound(true);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [noteId]);

  // Backlinks and forward links
  const kbNodeId = kbNode?.id ?? `note-${noteId}`;
  const forwardLinks = useForwardLinks(kbNodeId);

  // Read-only Tiptap editor
  const editor = useEditor(
    {
      editable: false,
      extensions: [
        StarterKit,
        Link.configure({ openOnClick: false }),
        WikiLink,
        Mention.configure({ HTMLAttributes: { class: 'mention' } }),
        DescriptorMention.configure({
          HTMLAttributes: { class: 'descriptor-mention' },
          suggestion: {
            char: '#',
            items: () => [],
            render: () => ({
              onStart: () => undefined,
              onUpdate: () => undefined,
              onKeyDown: () => false,
              onExit: () => undefined,
            }),
          },
        }),
      ],
      content: '',
    },
  );

  // Update editor content when note loads
  useEffect(() => {
    if (editor && note?.body) {
      try {
        const body =
          typeof note.body === 'string' ? JSON.parse(note.body) : note.body;
        editor.commands.setContent(body);
      } catch {
        // If body can't be parsed, leave editor empty
      }
    }
  }, [editor, note]);

  // Handle clicks on wikilink nodes in the editor
  useEffect(() => {
    if (!editor) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const wikiLink = target.closest('[data-type="wiki-link"]');
      if (!wikiLink) return;

      event.preventDefault();
      event.stopPropagation();

      const linkId = wikiLink.getAttribute('data-id');
      const linkLabel = wikiLink.getAttribute('data-label');

      if (linkId && linkId !== 'unresolved') {
        navigate(`/kb/${linkId}`);
      } else if (linkLabel) {
        // Unresolved — offer to create
        handleUnresolvedClick(linkLabel);
      }
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener('click', handleClick);
    return () => {
      editorDom.removeEventListener('click', handleClick);
    };
  }, [editor, navigate]);

  const handleUnresolvedClick = useCallback(
    async (label: string) => {
      const confirmed = window.confirm(
        `Note "${label}" not found. Create it?`
      );
      if (!confirmed || !note) return;

      try {
        const newNote = await createNote({
          campaignId: note.campaignId,
          sessionId: note.sessionId,
          title: label,
          body: null,
          type: 'generic',
          typeData: {},
          status: 'active',
          pinned: false,
        });
        navigate(`/kb/note-${newNote.id}`);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[NoteReader] Failed to create note', err);
      }
    },
    [note, navigate]
  );

  if (notFound) {
    return (
      <div className="p-8 text-center text-[var(--color-text-muted)]">
        Note not found.
      </div>
    );
  }

  if (!note) {
    return (
      <div className="p-4 text-center text-[var(--color-text-muted)]">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] bg-transparent border-none cursor-pointer p-0 self-start"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          {note.title}
        </h1>
        <button
          onClick={() => navigate(`/note/${note.id}/edit`)}
          className="px-4 py-2 min-h-[44px] bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer"
        >
          Edit
        </button>
      </div>

      {/* Type badge */}
      {kbNode && (
        <div className="flex items-center gap-2">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-500">
            {kbNode.type}
          </span>
          {note.tags && note.tags.length > 0 && (
            <div className="flex gap-1">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-1.5 py-0.5 rounded text-xs bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Read-only Tiptap content */}
      <div className="prose max-w-none">
        <EditorContent
          editor={editor}
          className="text-[var(--color-text)] text-sm"
        />
      </div>

      {/* Attachment gallery */}
      {attachments.length > 0 && (
        <div className="border-t border-[var(--color-border)] pt-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
            Attachments
          </h3>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="px-3 py-2 bg-[var(--color-surface-raised)] rounded text-xs text-[var(--color-text)]"
              >
                {att.caption || att.id}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forward links summary */}
      {forwardLinks.length > 0 && (
        <div className="border-t border-[var(--color-border)] pt-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
            Links from this note ({forwardLinks.length})
          </h3>
          <ForwardLinksList edges={forwardLinks} onPeek={setPeekNodeId} />
        </div>
      )}

      {/* Backlinks panel */}
      <BacklinksPanel nodeId={kbNodeId} onPeek={setPeekNodeId} />

      {/* Peek card */}
      {peekNodeId && (
        <PeekCard
          nodeId={peekNodeId}
          onClose={() => setPeekNodeId(null)}
          onOpen={() => {
            navigate(`/kb/${peekNodeId}`);
            setPeekNodeId(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Renders a list of forward links from the current note.
 */
function ForwardLinksList({
  edges,
  onPeek,
}: {
  edges: import('../../storage/db/client').KBEdge[];
  onPeek?: (nodeId: string) => void;
}) {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<KBNode[]>([]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadNodes() {
      const results: KBNode[] = [];
      for (const edge of edges) {
        const node = await db.kb_nodes.get(edge.toId);
        if (node) results.push(node);
      }
      if (mounted) setNodes(results);
    }
    loadNodes();
    return () => {
      mounted = false;
    };
  }, [edges]);

  return (
    <div className="flex flex-col gap-1">
      {nodes.map((node) => (
        <button
          key={node.id}
          onClick={() => navigate(`/kb/${node.id}`)}
          onPointerDown={() => {
            if (onPeek) {
              longPressTimer.current = setTimeout(() => onPeek(node.id), 500);
            }
          }}
          onPointerUp={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }}
          onPointerLeave={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }}
          className="text-left px-2 py-1 text-sm text-[var(--color-accent)] bg-transparent border-none cursor-pointer hover:underline"
        >
          {node.label}
          <span className="ml-1 text-xs text-[var(--color-text-muted)]">
            [{node.type}]
          </span>
        </button>
      ))}
    </div>
  );
}
