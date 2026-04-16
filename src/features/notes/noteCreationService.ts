import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';
import type { Note } from '../../types/note';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

export interface NoteEncounterTargetOptions {
  sessionId?: string;
  targetEncounterId?: string | null;
  resolveActiveEncounterId?: (sessionId: string) => Promise<string | null>;
}

export interface BuildNoteRecordInput {
  campaignId: string;
  sessionId?: string;
  title: string;
  type: string;
  body?: unknown;
  typeData?: unknown;
  status: Note['status'];
  pinned: boolean;
  tags?: string[];
  visibility?: Note['visibility'];
  scope?: Note['scope'];
}

export interface PersistCanonicalNoteLinksInput {
  note: Pick<Note, 'id' | 'type'>;
  sessionId?: string;
  encounterId?: string | null;
}

function splitNoteContent(body: unknown, typeData: unknown): { body: unknown; storedTypeData: unknown } {
  if (body !== undefined) {
    return {
      body,
      storedTypeData: typeData ?? {},
    };
  }

  if (typeData && typeof typeData === 'object' && 'body' in (typeData as Record<string, unknown>)) {
    const source = typeData as Record<string, unknown>;
    const extractedBody = source.body ?? null;
    const { body: _omit, ...rest } = source;
    void _omit;
    return {
      body: extractedBody,
      storedTypeData: rest,
    };
  }

  return {
    body: null,
    storedTypeData: typeData ?? {},
  };
}

export async function resolveEncounterAttachmentTarget({
  sessionId,
  targetEncounterId,
  resolveActiveEncounterId,
}: NoteEncounterTargetOptions): Promise<string | null> {
  if (targetEncounterId === null) {
    return null;
  }

  if (typeof targetEncounterId === 'string') {
    return targetEncounterId;
  }

  if (!sessionId || !resolveActiveEncounterId) {
    return null;
  }

  return await resolveActiveEncounterId(sessionId);
}

export function buildNoteRecord(input: BuildNoteRecordInput): Note {
  const now = nowISO();
  const normalized = splitNoteContent(input.body, input.typeData);

  return {
    id: generateId(),
    campaignId: input.campaignId,
    sessionId: input.sessionId,
    title: input.title,
    body: normalized.body,
    type: input.type,
    typeData: normalized.storedTypeData,
    status: input.status,
    pinned: input.pinned,
    tags: input.tags,
    visibility: input.visibility ?? 'public',
    scope: input.scope ?? 'campaign',
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureLink(
  fromEntityId: string,
  fromEntityType: string,
  toEntityId: string,
  toEntityType: string,
  relationshipType: string,
): Promise<void> {
  const existing = await entityLinkRepository.getLinksFrom(fromEntityId, relationshipType);
  const alreadyLinked = existing.some(
    (link) => link.toEntityId === toEntityId && link.toEntityType === toEntityType,
  );

  if (alreadyLinked) {
    return;
  }

  await entityLinkRepository.createLink({
    fromEntityId,
    fromEntityType,
    toEntityId,
    toEntityType,
    relationshipType,
  });
}

export async function persistCanonicalNoteLinks({
  note,
  sessionId,
  encounterId,
}: PersistCanonicalNoteLinksInput): Promise<void> {
  if (sessionId) {
    await ensureLink(sessionId, 'session', note.id, 'note', 'contains');

    if (note.type === 'npc') {
      await ensureLink(note.id, 'note', sessionId, 'session', 'introduced_in');
    }
  }

  if (encounterId) {
    await ensureLink(encounterId, 'encounter', note.id, 'note', 'contains');
  }
}
