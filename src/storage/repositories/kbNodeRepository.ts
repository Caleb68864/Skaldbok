import { db } from '../db/client';
import type { KBNode } from '../db/client';
import { z } from 'zod';

/**
 * Zod schema for validating {@link KBNode} records on read from IndexedDB.
 */
const kbNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['note', 'character', 'location', 'item', 'tag', 'unresolved']),
  label: z.string(),
  scope: z.enum(['campaign', 'shared']),
  campaignId: z.string(),
  sourceId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Retrieves a single {@link KBNode} by its unique identifier.
 */
export async function getNodeById(id: string): Promise<KBNode | undefined> {
  try {
    const raw = await db.kb_nodes.get(id);
    if (!raw) return undefined;
    return kbNodeSchema.parse(raw) as KBNode;
  } catch (err) {
    throw new Error(
      `kbNodeRepository.getNodeById(${id}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Retrieves all {@link KBNode} records of a given type for a campaign,
 * using the `[campaignId+type]` compound index.
 */
export async function getNodesByType(
  campaignId: string,
  type: KBNode['type']
): Promise<KBNode[]> {
  try {
    const raw = await db.kb_nodes
      .where('[campaignId+type]')
      .equals([campaignId, type])
      .toArray();
    return raw.map((r) => kbNodeSchema.parse(r) as KBNode);
  } catch (err) {
    throw new Error(
      `kbNodeRepository.getNodesByType(${campaignId}, ${type}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Returns all nodes belonging to a given campaign (any scope).
 * Callers should merge with {@link getSharedNodes} client-side per ASM-13.
 */
export async function getNodesByCampaign(campaignId: string): Promise<KBNode[]> {
  try {
    const raw = await db.kb_nodes.where('campaignId').equals(campaignId).toArray();
    return raw.map((r) => kbNodeSchema.parse(r) as KBNode);
  } catch (err) {
    throw new Error(
      `kbNodeRepository.getNodesByCampaign(${campaignId}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Returns all nodes where `scope === 'shared'`.
 * Callers merge with {@link getNodesByCampaign} client-side (ASM-13).
 */
export async function getSharedNodes(): Promise<KBNode[]> {
  try {
    const raw = await db.kb_nodes.where('scope').equals('shared').toArray();
    return raw.map((r) => kbNodeSchema.parse(r) as KBNode);
  } catch (err) {
    throw new Error(
      `kbNodeRepository.getSharedNodes(): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Case-insensitive label lookup using Dexie's `equalsIgnoreCase`.
 * Single indexed lookup, not a table scan.
 */
export async function getNodeByLabel(
  label: string,
  campaignId: string
): Promise<KBNode | undefined> {
  try {
    const raw = await db.kb_nodes
      .where('label')
      .equalsIgnoreCase(label)
      .and((node) => node.campaignId === campaignId)
      .first();
    if (!raw) return undefined;
    return kbNodeSchema.parse(raw) as KBNode;
  } catch (err) {
    throw new Error(
      `kbNodeRepository.getNodeByLabel(${label}, ${campaignId}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Idempotent upsert — safe to call repeatedly.
 */
export async function upsertNode(node: KBNode): Promise<void> {
  try {
    await db.kb_nodes.put(node);
  } catch (err) {
    throw new Error(
      `kbNodeRepository.upsertNode(${node.id}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Deletes a single {@link KBNode} by ID.
 */
export async function deleteNode(id: string): Promise<void> {
  try {
    await db.kb_nodes.delete(id);
  } catch (err) {
    throw new Error(
      `kbNodeRepository.deleteNode(${id}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Deletes all nodes where `sourceId === sourceId` (e.g. all nodes from a deleted note).
 */
export async function deleteNodesBySource(sourceId: string): Promise<void> {
  try {
    await db.kb_nodes.where('sourceId').equals(sourceId).delete();
  } catch (err) {
    throw new Error(
      `kbNodeRepository.deleteNodesBySource(${sourceId}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
