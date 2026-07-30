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
  getEdgesToNode,
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
 * Id for the placeholder node standing in for an unresolved `[[label]]`.
 *
 * @remarks
 * Scoped by campaign and built from the normalised label rather than a slug.
 * The previous form, `unresolved-${label.toLowerCase().replace(/\s+/g, '-')}`,
 * had two failure modes:
 *
 * 1. **No campaign in the id.** `[[Ostrand]]` in two campaigns produced one
 *    shared row, whose `campaignId` was whichever synced last — so one
 *    campaign's edges pointed at a node claiming to belong to the other.
 * 2. **Slugging merged distinct labels.** `Sir Aldric` and `Sir-Aldric` both
 *    collapsed to `sir-aldric` and became the same node.
 *
 * Whitespace is still collapsed and case still folded, because resolution
 * (`getNodeByLabel`) is case-insensitive — those two must agree or a placeholder
 * would never match the note that resolves it.
 *
 * @param campaignId - Campaign the link was written in.
 * @param label - Raw link label.
 * @returns Deterministic node id.
 */
function placeholderNodeId(campaignId: string, label: string): string {
  return `unresolved:${campaignId}:${label.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

/**
 * Repoints edges from a placeholder onto the real node that now carries its
 * label, then removes the placeholder.
 *
 * @remarks
 * A `[[target]]` written before its note exists creates a placeholder. Nothing
 * used to revisit it, so creating the note afterwards left every earlier
 * reference pointing at the stub: the backlinks panel showed nothing and the
 * graph kept a permanent orphan beside the real node.
 *
 * An inbound edge whose source *already* links to the real node is deleted
 * rather than repointed, since repointing it would duplicate the edge it would
 * become.
 *
 * @param realNodeId - Node that should own the label from now on.
 * @param label - Label being resolved.
 * @param campaignId - Campaign scope.
 */
async function absorbPlaceholder(
  realNodeId: string,
  label: string,
  campaignId: string,
): Promise<void> {
  const stubId = placeholderNodeId(campaignId, label);
  if (stubId === realNodeId) return;
  const stub = await db.kb_nodes.get(stubId).catch(() => null);
  if (!stub || stub.type !== 'unresolved') return;

  const inbound = await getEdgesToNode(stubId);
  const realInbound = await getEdgesToNode(realNodeId);
  const alreadyLinked = new Set(realInbound.map(e => `${e.fromId}:${e.type}`));

  for (const edge of inbound) {
    if (alreadyLinked.has(`${edge.fromId}:${edge.type}`)) {
      await deleteEdge(edge.id);
      continue;
    }
    await upsertEdge({ ...edge, toId: realNodeId });
    alreadyLinked.add(`${edge.fromId}:${edge.type}`);
  }
  await deleteNode(stubId);
}

/**
 * Deletes unresolved placeholders in a campaign that nothing points at any more.
 *
 * @remarks
 * Placeholders were only ever created, never reaped, so removing the last
 * `[[link]]` to a name left its stub in the graph forever. This also clears
 * stubs left behind by the id-format change, which are unreachable by
 * construction: nothing can link to an id no code generates.
 *
 * @param campaignId - Campaign to sweep.
 */
async function reapOrphanPlaceholders(campaignId: string): Promise<void> {
  const stubs = await db.kb_nodes
    .where('campaignId')
    .equals(campaignId)
    .and(node => node.type === 'unresolved')
    .toArray()
    .catch(() => []);
  for (const stub of stubs) {
    const inbound = await getEdgesToNode(stub.id);
    if (inbound.length === 0) await deleteNode(stub.id);
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
  // Serialised per note. Callers fire this and forget it — `noteRepository`
  // kicks it off with `.then().catch(() => {})` from create, update and
  // append — so two edits landing close together previously ran two syncs
  // concurrently over the same node. Both read the existing edge set before
  // either wrote, so both decided the same edges were missing and inserted
  // them: duplicate edges, and a backlink counted twice.
  //
  // Chaining onto the note's in-flight sync makes the read-then-write
  // sequence atomic with respect to other syncs of the same note, without
  // serialising unrelated notes against each other.
  const previous = inFlightSyncs.get(noteId) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(() => syncNoteUnsafe(noteId));
  inFlightSyncs.set(noteId, run);
  try {
    await run;
  } finally {
    // Only clear when this is still the newest, or a queued sync would be
    // dropped from the chain and lose its ordering guarantee.
    if (inFlightSyncs.get(noteId) === run) inFlightSyncs.delete(noteId);
  }
}

/**
 * In-flight sync per note id, so concurrent syncs of the same note queue rather
 * than racing. Keyed by note, so unrelated notes still sync in parallel.
 */
const inFlightSyncs = new Map<string, Promise<void>>();

/** The actual sync. Call {@link syncNote}, which serialises per note. */
async function syncNoteUnsafe(noteId: string): Promise<void> {
  const startTime = import.meta.env.DEV ? performance.now() : 0;
  let addedCount = 0;
  let removedCount = 0;

  try {
    const note = await getNoteById(noteId);
    if (!note) {
      if (import.meta.env.DEV) console.warn('[linkSyncEngine] syncNote: note not found', noteId);
      return;
    }

    // Log entries are raw capture, not knowledge nodes — skip the KB graph
    // entirely. `promoted_into` entity links already record lineage.
    if (note.type === 'log') {
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

    // This note may be the thing earlier links were waiting for. Fold any
    // placeholder carrying its title into it before building edges, so the
    // diff below sees the real node rather than re-creating the stub.
    if (noteNode.label) {
      await absorbPlaceholder(noteNodeId, noteNode.label, note.campaignId);
    }

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
        targetId = placeholderNodeId(note.campaignId, label);
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
        targetId = placeholderNodeId(note.campaignId, label);
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

    // A removed `[[link]]` can leave its placeholder with no inbound edges.
    await reapOrphanPlaceholders(note.campaignId);

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
    // A character can be what earlier `[[Name]]` links were waiting for just as
    // a note can, so it absorbs a matching placeholder too.
    await absorbPlaceholder(nodeId, name, campaignId);
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
