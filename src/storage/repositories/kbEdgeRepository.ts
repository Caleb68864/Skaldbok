import { db } from '../db/client';
import type { KBEdge } from '../db/client';
import { z } from 'zod';

/**
 * Zod schema for validating {@link KBEdge} records on read from IndexedDB.
 */
const kbEdgeSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  type: z.enum(['wikilink', 'mention', 'descriptor']),
  campaignId: z.string(),
  createdAt: z.string(),
});

/**
 * Returns all edges originating from a given node.
 */
export async function getEdgesFromNode(fromId: string): Promise<KBEdge[]> {
  try {
    const raw = await db.kb_edges.where('fromId').equals(fromId).toArray();
    return raw.map((r) => kbEdgeSchema.parse(r) as KBEdge);
  } catch (err) {
    throw new Error(
      `kbEdgeRepository.getEdgesFromNode(${fromId}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Returns all edges pointing to a given node (backlinks).
 */
export async function getEdgesToNode(toId: string): Promise<KBEdge[]> {
  try {
    const raw = await db.kb_edges.where('toId').equals(toId).toArray();
    return raw.map((r) => kbEdgeSchema.parse(r) as KBEdge);
  } catch (err) {
    throw new Error(
      `kbEdgeRepository.getEdgesToNode(${toId}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Returns all edges belonging to a given campaign.
 */
export async function getEdgesByCampaign(campaignId: string): Promise<KBEdge[]> {
  try {
    const raw = await db.kb_edges.where('campaignId').equals(campaignId).toArray();
    return raw.map((r) => kbEdgeSchema.parse(r) as KBEdge);
  } catch (err) {
    throw new Error(
      `kbEdgeRepository.getEdgesByCampaign(${campaignId}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Idempotent upsert of an edge.
 */
export async function upsertEdge(edge: KBEdge): Promise<void> {
  try {
    await db.kb_edges.put(edge);
  } catch (err) {
    throw new Error(
      `kbEdgeRepository.upsertEdge(${edge.id}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Deletes a single edge by ID.
 */
export async function deleteEdge(id: string): Promise<void> {
  try {
    await db.kb_edges.delete(id);
  } catch (err) {
    throw new Error(
      `kbEdgeRepository.deleteEdge(${id}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Removes all edges where `fromId === nodeId` (for node delete cascades).
 */
export async function deleteEdgesFromNode(nodeId: string): Promise<void> {
  try {
    await db.kb_edges.where('fromId').equals(nodeId).delete();
  } catch (err) {
    throw new Error(
      `kbEdgeRepository.deleteEdgesFromNode(${nodeId}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Removes all edges where `toId === nodeId`.
 */
export async function deleteEdgesToNode(nodeId: string): Promise<void> {
  try {
    await db.kb_edges.where('toId').equals(nodeId).delete();
  } catch (err) {
    throw new Error(
      `kbEdgeRepository.deleteEdgesToNode(${nodeId}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
