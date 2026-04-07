/**
 * Vault Browser — reusable KB node list component.
 *
 * Works in two modes:
 * - **Full mode** (`/kb`): shows category tabs (All, People, Places, Loot, Rumors)
 *   and all campaign notes with search.
 * - **Compact mode** (Session screen): shows only session-scoped notes,
 *   hides category tabs, shows "Open Knowledge Base" link.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { KBNode } from '../../storage/db/client';
import {
  getNodesByCampaign,
  getSharedNodes,
} from '../../storage/repositories/kbNodeRepository';
import { getEdgesFromNode, getEdgesToNode } from '../../storage/repositories/kbEdgeRepository';
import { getNotesBySession } from '../../storage/repositories/noteRepository';
import { useKBSearch } from './useKBSearch';
import { VaultCard } from './VaultCard';

interface VaultBrowserProps {
  campaignId: string;
  sessionId?: string;
  typeFilter?: string;
  compact?: boolean;
}

const CATEGORY_TABS = [
  { value: 'all', label: 'All' },
  { value: 'character', label: 'People' },
  { value: 'location', label: 'Places' },
  { value: 'item', label: 'Loot' },
  { value: 'note', label: 'Notes' },
] as const;

export function VaultBrowser({
  campaignId,
  sessionId,
  typeFilter,
  compact,
}: VaultBrowserProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(typeFilter ?? 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [nodes, setNodes] = useState<KBNode[]>([]);
  const [linkCounts, setLinkCounts] = useState<Record<string, number>>({});
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagLinkedNodeIds, setTagLinkedNodeIds] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(50);
  const searchResults = useKBSearch(debouncedQuery, campaignId);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search query (200ms)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  // Load nodes
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        if (sessionId) {
          // Compact mode: load session notes and match them to KB nodes
          const sessionNotes = await getNotesBySession(sessionId);
          const [campaignNodes, sharedNodes] = await Promise.all([
            getNodesByCampaign(campaignId),
            getSharedNodes(),
          ]);
          const allNodes = [...campaignNodes, ...sharedNodes];
          const sessionNoteIds = new Set(sessionNotes.map((n) => n.id));
          // Filter to nodes whose sourceId matches a session note
          const filtered = allNodes.filter(
            (n) => n.sourceId && sessionNoteIds.has(n.sourceId)
          );
          if (mounted) setNodes(filtered);
        } else {
          // Full mode: all campaign + shared nodes
          const [campaignNodes, sharedNodes] = await Promise.all([
            getNodesByCampaign(campaignId),
            getSharedNodes(),
          ]);
          const combined = [...campaignNodes, ...sharedNodes];
          if (mounted) {
            setNodes(combined);
            // Extract tag labels for filter chips
            const tags = combined
              .filter((n) => n.type === 'tag')
              .map((n) => n.label)
              .sort();
            setAllTags(tags);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV)
          console.warn('[VaultBrowser] Failed to load nodes', err);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [campaignId, sessionId]);

  // Load link counts for visible nodes
  useEffect(() => {
    let mounted = true;

    async function loadCounts() {
      const counts: Record<string, number> = {};
      for (const node of nodes) {
        try {
          const edges = await getEdgesFromNode(node.id);
          counts[node.id] = edges.length;
        } catch {
          counts[node.id] = 0;
        }
      }
      if (mounted) setLinkCounts(counts);
    }

    if (nodes.length > 0) loadCounts();
    return () => {
      mounted = false;
    };
  }, [nodes]);

  // Load node IDs linked to selected tags via edges
  useEffect(() => {
    if (activeTags.size === 0) {
      setTagLinkedNodeIds(new Set());
      return;
    }
    let mounted = true;
    async function loadTagEdges() {
      const linkedIds = new Set<string>();
      const tagNodes = nodes.filter((n) => n.type === 'tag' && activeTags.has(n.label));
      for (const tagNode of tagNodes) {
        linkedIds.add(tagNode.id);
        try {
          const [fromEdges, toEdges] = await Promise.all([
            getEdgesFromNode(tagNode.id),
            getEdgesToNode(tagNode.id),
          ]);
          for (const e of fromEdges) linkedIds.add(e.toId);
          for (const e of toEdges) linkedIds.add(e.fromId);
        } catch { /* ignore */ }
      }
      if (mounted) setTagLinkedNodeIds(linkedIds);
    }
    loadTagEdges();
    return () => { mounted = false; };
  }, [activeTags, nodes]);

  // Filter nodes by tab, search, and tags
  const filteredNodes = useMemo(() => {
    const source = debouncedQuery.trim() ? searchResults : nodes;
    let filtered = source;

    // Apply type filter from tab
    if (activeTab !== 'all') {
      filtered = filtered.filter((n) => n.type === activeTab);
    }

    // Apply tag filter — only show nodes linked to selected tag nodes
    if (activeTags.size > 0) {
      filtered = filtered.filter((n) => tagLinkedNodeIds.has(n.id));
    }

    return filtered;
  }, [nodes, searchResults, debouncedQuery, activeTab, activeTags, tagLinkedNodeIds]);

  // Infinite scroll: load more on scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        setDisplayCount((c) => Math.min(c + 50, filteredNodes.length));
      }
    },
    [filteredNodes.length]
  );

  // Reset display count when filter changes
  useEffect(() => {
    setDisplayCount(50);
  }, [activeTab, debouncedQuery]);

  const displayedNodes = filteredNodes.slice(0, displayCount);

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="px-1">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes, characters, locations..."
          className="w-full px-3 py-2 min-h-[44px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
        />
      </div>

      {/* Category tabs (full mode only) */}
      {!compact && (
        <div className="flex gap-1 px-1 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border-none cursor-pointer ${
                activeTab === tab.value
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                  : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tag filter chips (full mode only) */}
      {!compact && allTags.length > 0 && (
        <div className="flex gap-1 px-1 overflow-x-auto flex-wrap">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setActiveTags((prev) => {
                  const next = new Set(prev);
                  if (next.has(tag)) next.delete(tag);
                  else next.add(tag);
                  return next;
                });
              }}
              className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap border-none cursor-pointer ${
                activeTags.has(tag)
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                  : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
              }`}
            >
              #{tag}
            </button>
          ))}
          {activeTags.size > 0 && (
            <button
              onClick={() => setActiveTags(new Set())}
              className="px-2 py-1 rounded-full text-xs font-medium text-[var(--color-text-muted)] bg-transparent border-none cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Open Knowledge Base link (compact mode only) */}
      {compact && (
        <div className="px-1">
          <button
            onClick={() => navigate('/kb')}
            className="text-sm text-[var(--color-accent)] cursor-pointer bg-transparent border-none font-medium"
          >
            Open Knowledge Base &rarr;
          </button>
        </div>
      )}

      {/* Node card list */}
      <div
        className="flex flex-col gap-2 px-1 max-h-[60vh] overflow-y-auto"
        onScroll={handleScroll}
      >
        {displayedNodes.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            {debouncedQuery.trim()
              ? `No results for "${debouncedQuery}"`
              : 'No notes yet. Create one to get started.'}
          </div>
        ) : (
          displayedNodes.map((node) => (
            <VaultCard
              key={node.id}
              node={node}
              linkCount={linkCounts[node.id] ?? 0}
              onClick={() => navigate(`/kb/${node.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
