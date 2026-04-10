/**
 * Link Sync Engine — parses Tiptap JSON from note bodies, extracts references,
 * diffs against existing edges, and updates kb_nodes / kb_edges in IndexedDB.
 *
 * @remarks
 * The engine runs AFTER the note save completes. If the sync fails, note data
 * is always safe. The engine is idempotent — re-running produces identical results.
 */

import { getNoteById, getNotesByCampaign } from '../../storage/repositories/noteRepository';
import {
  getNodeByLabel,
  upsertNode,
  deleteNode,
} from '../../storage/repositories/kbNodeRepository';
import {
  getEdgesFromNode,
  upsertEdge,
  deleteEdge,
  deleteEdgesFromNode,
  deleteEdgesToNode,
} from '../../storage/repositories/kbEdgeRepository';
import { extractLinksFromTiptapJSON } from './tiptapParser';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { db } from '../../storage/db/client';
import type { KBNode, KBEdge } from '../../storage/db/client';

/**
 * Maps a note's type to the corresponding KB node type.
 * NPC notes become 'character' nodes, location/loot notes keep their type,
 * and everything else (generic, combat, rumor, quote, etc.) becomes 'note'.
 */
function noteTypeToKBNodeType(noteType: string): KBNode['type'] {
  switch (noteType) {
    case 'npc': return 'character';
    case 'location': return 'location';
    case 'loot': return 'item';
    default: return 'note';
  }
}

/**
 * Syncs a single note's KB graph data. Creates/updates the note's KBNode and
 * all outgoing edges based on the current Tiptap JSON body.
 *
 * Stale edges (links removed from note body) are cleaned up automatically.
 * If sync fails internally, the error is caught and logged — never propagated.
 */
export async function syncNote(noteId: string): Promise<void> {
  const startTime = import.meta.env.DEV ? performance.now() : 0;
  let addedCount = 0;
  let removedCount = 0;

  try {
    const note = await getNoteById(noteId);
    if (!note) {
      if (import.meta.env.DEV) console.warn('[linkSyncEngine] syncNote: note not found', noteId);
      return;
    }

    // Parse Tiptap JSON body
    let body: unknown;
    try {
      body = typeof note.body === 'string' ? JSON.parse(note.body) : note.body;
    } catch {
      if (import.meta.env.DEV) console.warn('[linkSyncEngine] syncNote: failed to parse body', noteId);
      return;
    }

    const { wikilinks, mentions, descriptors } = body
      ? extractLinksFromTiptapJSON(body)
      : { wikilinks: [], mentions: [], descriptors: [] };

    // Upsert the note's own KBNode
    const now = nowISO();
    const noteNodeId = `note-${noteId}`;
    const noteNode: KBNode = {
      id: noteNodeId,
      type: noteTypeToKBNodeType(note.type),
      label: note.title,
      scope: note.scope ?? 'campaign',
      campaignId: note.campaignId,
      sourceId: noteId,
      createdAt: now,
      updatedAt: now,
    };

    // Check if node already exists to preserve createdAt
    const existingNode = await db.kb_nodes.get(noteNodeId).catch(() => null);
    if (existingNode) {
      noteNode.createdAt = existingNode.createdAt;
    }
    await upsertNode(noteNode);

    // Build the desired edge set
    const desiredEdges = new Map<string, { toId: string; type: KBEdge['type'] }>();

    // Process wikilinks
    for (const label of wikilinks) {
      const target = await getNodeByLabel(label, note.campaignId);
      let targetId: string;
      if (target) {
        targetId = target.id;
      } else {
        // Create unresolved placeholder
        targetId = `unresolved-${label.toLowerCase().replace(/\s+/g, '-')}`;
        await upsertNode({
          id: targetId,
          type: 'unresolved',
          label,
          scope: 'campaign',
          campaignId: note.campaignId,
          createdAt: now,
          updatedAt: now,
        });
      }
      desiredEdges.set(`wikilink:${targetId}`, { toId: targetId, type: 'wikilink' });
    }

    // Process mentions
    for (const label of mentions) {
      const target = await getNodeByLabel(label, note.campaignId);
      let targetId: string;
      if (target) {
        targetId = target.id;
      } else {
        targetId = `unresolved-${label.toLowerCase().replace(/\s+/g, '-')}`;
        await upsertNode({
          id: targetId,
          type: 'unresolved',
          label,
          scope: 'campaign',
          campaignId: note.campaignId,
          createdAt: now,
          updatedAt: now,
        });
      }
      desiredEdges.set(`mention:${targetId}`, { toId: targetId, type: 'mention' });
    }

    // Process descriptors
    for (const label of descriptors) {
      // Descriptors become tag nodes
      let tagNodeId = `tag-${label.toLowerCase().replace(/\s+/g, '-')}`;
      const existingTag = await db.kb_nodes.get(tagNodeId).catch(() => null);
      if (!existingTag) {
        await upsertNode({
          id: tagNodeId,
          type: 'tag',
          label,
          scope: 'campaign',
          campaignId: note.campaignId,
          createdAt: now,
          updatedAt: now,
        });
      }
      desiredEdges.set(`descriptor:${tagNodeId}`, { toId: tagNodeId, type: 'descriptor' });
    }

    // Diff against existing edges from this node
    const existingEdges = await getEdgesFromNode(noteNodeId);
    const existingEdgeKeys = new Set(
      existingEdges.map((e) => `${e.type}:${e.toId}`)
    );
    const desiredEdgeKeys = new Set(desiredEdges.keys());

    // Add new edges
    for (const [key, { toId, type }] of desiredEdges.entries()) {
      if (!existingEdgeKeys.has(key)) {
        await upsertEdge({
          id: generateId(),
          fromId: noteNodeId,
          toId,
          type,
          campaignId: note.campaignId,
          createdAt: now,
        });
        addedCount++;
      }
    }

    // Remove stale edges
    for (const edge of existingEdges) {
      const key = `${edge.type}:${edge.toId}`;
      if (!desiredEdgeKeys.has(key)) {
        await deleteEdge(edge.id);
        removedCount++;
      }
    }

    if (import.meta.env.DEV) {
      const duration = performance.now() - startTime;
      console.debug(
        `[linkSyncEngine] syncNote(${noteId}): +${addedCount} -${removedCount} edges in ${duration.toFixed(1)}ms`
      );
    }
  } catch (err) {
    console.warn('[linkSyncEngine] syncNote failed', noteId, err);
  }
}

/**
 * Removes a note's KBNode and all associated edges (both incoming and outgoing).
 */
export async function deleteNoteNode(noteId: string): Promise<void> {
  try {
    const noteNodeId = `note-${noteId}`;
    const existing = await db.kb_nodes.get(noteNodeId).catch(() => null);
    if (existing) {
      await deleteEdgesFromNode(existing.id);
      await deleteEdgesToNode(existing.id);
      await deleteNode(existing.id);
    }
  } catch (err) {
    console.warn('[linkSyncEngine] deleteNoteNode failed', noteId, err);
  }
}

/**
 * Syncs a character entity into the KB graph as a character-type node.
 */
export async function syncCharacter(
  characterId: string,
  name: string,
  campaignId: string
): Promise<void> {
  try {
    const now = nowISO();
    const nodeId = `character-${characterId}`;
    const existing = await db.kb_nodes.get(nodeId).catch(() => null);
    await upsertNode({
      id: nodeId,
      type: 'character',
      label: name,
      scope: 'campaign',
      campaignId,
      sourceId: characterId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  } catch (err) {
    console.warn('[linkSyncEngine] syncCharacter failed', characterId, err);
  }
}

/**
 * Rebuilds the entire KB graph for a campaign from scratch.
 * Reads all notes, calls syncNote for each sequentially, then writes
 * the migration metadata key.
 */
export async function bulkRebuildGraph(campaignId: string): Promise<void> {
  try {
    const notes = await getNotesByCampaign(campaignId);
    for (const note of notes) {
      await syncNote(note.id);
    }
    await db.table('metadata').put({
      id: 'migration_kb_graph_v1',
      key: 'migration_kb_graph_v1',
      value: 'true',
    });
    if (import.meta.env.DEV) {
      console.debug(`[linkSyncEngine] bulkRebuildGraph: synced ${notes.length} notes for campaign ${campaignId}`);
    }
  } catch (err) {
    console.warn('[linkSyncEngine] bulkRebuildGraph failed', campaignId, err);
  }
}
