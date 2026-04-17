import { useState, useEffect, useCallback } from 'react';
import type { Encounter, EncounterParticipant } from '../../types/encounter';
import type { Note } from '../../types/note';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import type { CharacterRecord } from '../../types/character';
import * as encounterRepository from '../../storage/repositories/encounterRepository';
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';
import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import { getNoteById } from '../../storage/repositories/noteRepository';
import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';
import { db } from '../../storage/db/client';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { generateSoftDeleteTxId } from '../../utils/softDelete';

/**
 * Hook for managing a single encounter: loading data, adding/updating
 * participants, auto-linking notes, and controlling lifecycle.
 *
 * @param encounterId - ID of the encounter to manage (null if none).
 * @param sessionId - The current session ID.
 * @param campaignId - The current campaign ID.
 */
export function useEncounter(
  encounterId: string | null,
  sessionId: string,
  campaignId: string
) {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [linkedNotes, setLinkedNotes] = useState<Note[]>([]);

  const loadEncounter = useCallback(async () => {
    if (!encounterId) {
      setEncounter(null);
      setLinkedNotes([]);
      return;
    }
    const enc = await encounterRepository.getById(encounterId);
    setEncounter(enc ?? null);

    // Load notes linked to this encounter
    if (enc) {
      try {
        const links = await entityLinkRepository.getLinksFrom(encounterId, 'contains');
        const noteIds = links
          .filter((l) => l.toEntityType === 'note')
          .map((l) => l.toEntityId);
        const notes = (
          await Promise.all(noteIds.map((id) => getNoteById(id)))
        ).filter((n): n is Note => n !== undefined);
        setLinkedNotes(notes);
      } catch {
        setLinkedNotes([]);
      }
    }
  }, [encounterId]);

  useEffect(() => {
    loadEncounter();
  }, [loadEncounter]);

  const startEncounter = useCallback(
    async (type: 'combat' | 'social' | 'exploration', title: string): Promise<Encounter | undefined> => {
      const now = nowISO();
      const enc = await encounterRepository.create({
        sessionId,
        campaignId,
        title,
        type,
        status: 'active',
        tags: [],
        segments: [{ startedAt: now }],
        participants: [],
        combatData: type === 'combat' ? { currentRound: 1, events: [] } : undefined,
      });
      if (!enc) return undefined;
      setEncounter(enc);
      return enc;
    },
    [sessionId, campaignId]
  );

  const endEncounter = useCallback(async () => {
    if (!encounterId) return;
    const updated = await encounterRepository.end(encounterId);
    if (updated) setEncounter(updated);
  }, [encounterId]);

  /**
   * Adds a creature-template-backed participant and wires up the `represents`
   * edge in the same Dexie transaction.
   *
   * @param templateOrId - Either the already-loaded `CreatureTemplate` / `CharacterRecord`,
   * or the id of a creature template to fetch first.
   */
  const addParticipantFromTemplate = useCallback(
    async (templateOrId: CreatureTemplate | CharacterRecord | string) => {
      if (!encounterId) return;

      let template: CreatureTemplate | CharacterRecord | null;
      let isCreature: boolean;
      if (typeof templateOrId === 'string') {
        const fetched = await creatureTemplateRepository.getById(templateOrId);
        if (!fetched) return;
        template = fetched;
        isCreature = true;
      } else {
        template = templateOrId;
        // Duck-type: CreatureTemplate has category, CharacterRecord does not.
        isCreature = 'category' in template;
      }

      const now = nowISO();
      const participantId = generateId();

      await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
        const enc = await db.encounters.get(encounterId);
        if (!enc) throw new Error(`encounter ${encounterId} not found`);

        const participantType: EncounterParticipant['type'] = isCreature
          ? ((template as CreatureTemplate).category === 'monster' ? 'monster' : 'npc')
          : 'pc';

        // PCs should only appear once in an encounter. Creature templates are
        // intentionally allowed to repeat so the GM can add multiple goblins,
        // wolves, etc.
        if (!isCreature) {
          const participantIds = new Set((enc.participants ?? []).map((p) => p.id));
          const links = await db.entityLinks
            .where('toEntityId')
            .equals(template.id)
            .toArray();
          const alreadyPresent = links.some((link) =>
            !link.deletedAt
            && link.relationshipType === 'represents'
            && link.toEntityType === 'character'
            && participantIds.has(link.fromEntityId),
          );
          if (alreadyPresent) return;
        }

        const hp = isCreature
          ? (template as CreatureTemplate).stats?.hp
          : undefined;

        const newParticipant: EncounterParticipant = {
          id: participantId,
          name: template.name,
          type: participantType,
          instanceState: hp !== undefined ? { currentHp: hp } : {},
          sortOrder: (enc.participants?.length ?? 0) + 1,
        };

        const updatedParticipants = [...(enc.participants ?? []), newParticipant];
        await db.encounters.update(encounterId, {
          participants: updatedParticipants,
          updatedAt: now,
        });

        await entityLinkRepository.createLink({
          fromEntityId: participantId,
          fromEntityType: 'encounterParticipant',
          toEntityId: template.id,
          toEntityType: isCreature ? 'creature' : 'character',
          relationshipType: 'represents',
        });
      });

      await loadEncounter();
    },
    [encounterId, loadEncounter]
  );

  /**
   * Adds a player-character-backed participant and wires up the `represents`
   * edge in the same Dexie transaction.
   */
  const addParticipantFromCharacter = useCallback(
    async (characterId: string) => {
      if (!encounterId) return;
      const character = await getCharacterById(characterId);
      if (!character) return;
      await addParticipantFromTemplate(character);
    },
    [encounterId, addParticipantFromTemplate]
  );

  /**
   * Removes a participant from the encounter and soft-deletes all outgoing
   * `represents` edges from that participant in the same transaction. The
   * deleted edges share a single `softDeletedBy` UUID so restoration can
   * happen atomically later.
   */
  const removeParticipant = useCallback(
    async (participantId: string) => {
      if (!encounterId) return;
      const txId = generateSoftDeleteTxId();
      const now = nowISO();

      await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
        const enc = await db.encounters.get(encounterId);
        if (!enc || !enc.participants) return;

        const updatedParticipants = enc.participants.filter((p) => p.id !== participantId);
        await db.encounters.update(encounterId, {
          participants: updatedParticipants,
          updatedAt: now,
        });

        const edges = await db.entityLinks
          .where('fromEntityId')
          .equals(participantId)
          .and((l) => (l as { relationshipType?: string }).relationshipType === 'represents')
          .toArray();
        for (const edge of edges) {
          if ((edge as { deletedAt?: string }).deletedAt) continue;
          await db.entityLinks.update(edge.id, {
            deletedAt: now,
            softDeletedBy: txId,
            updatedAt: now,
          });
        }
      });

      await loadEncounter();
    },
    [encounterId, loadEncounter]
  );

  const updateParticipantState = useCallback(
    async (participantId: string, patch: Partial<EncounterParticipant['instanceState']>) => {
      if (!encounterId || !encounter) return;
      const participant = encounter.participants.find((p) => p.id === participantId);
      if (!participant) return;
      const updated = await encounterRepository.updateParticipant(encounterId, participantId, {
        instanceState: { ...participant.instanceState, ...patch },
      });
      if (updated) setEncounter(updated);
    },
    [encounterId, encounter]
  );

  /** Updates the encounter's `description` narrative field (ProseMirror JSON). */
  const updateDescription = useCallback(async (description: unknown) => {
    if (!encounterId) return;
    await db.encounters.update(encounterId, {
      description,
      updatedAt: nowISO(),
    });
    await loadEncounter();
  }, [encounterId, loadEncounter]);

  /** Updates the encounter's `body` narrative field (ProseMirror JSON). */
  const updateBody = useCallback(async (body: unknown) => {
    if (!encounterId) return;
    await db.encounters.update(encounterId, {
      body,
      updatedAt: nowISO(),
    });
    await loadEncounter();
  }, [encounterId, loadEncounter]);

  /** Updates the encounter's `summary` narrative field (ProseMirror JSON). */
  const updateSummary = useCallback(async (summary: unknown) => {
    if (!encounterId) return;
    await db.encounters.update(encounterId, {
      summary,
      updatedAt: nowISO(),
    });
    await loadEncounter();
  }, [encounterId, loadEncounter]);

  /** Updates the encounter's free-form tag list. */
  const updateTags = useCallback(async (tags: string[]) => {
    if (!encounterId) return;
    await db.encounters.update(encounterId, {
      tags,
      updatedAt: nowISO(),
    });
    await loadEncounter();
  }, [encounterId, loadEncounter]);

  /** Updates the encounter's optional location string. */
  const updateLocation = useCallback(async (location: string | undefined) => {
    if (!encounterId) return;
    await db.encounters.update(encounterId, {
      location,
      updatedAt: nowISO(),
    });
    await loadEncounter();
  }, [encounterId, loadEncounter]);

  /**
   * Returns encounters that occurred as children of this one, i.e. encounters
   * whose `happened_during` edge points at this encounter.
   */
  const getChildEncounters = useCallback(async (): Promise<Encounter[]> => {
    if (!encounterId) return [];
    const links = await entityLinkRepository.getLinksTo(encounterId, 'happened_during');
    const childIds = links
      .filter((l) => l.fromEntityType === 'encounter')
      .map((l) => l.fromEntityId);
    const children = await Promise.all(
      childIds.map((id) => encounterRepository.getById(id)),
    );
    return children.filter((e): e is Encounter => e !== undefined);
  }, [encounterId]);

  /**
   * Returns the single parent encounter this one happened during, if any.
   */
  const getParentEncounter = useCallback(async (): Promise<Encounter | null> => {
    if (!encounterId) return null;
    const links = await entityLinkRepository.getLinksFrom(encounterId, 'happened_during');
    const parentEdge = links.find((l) => l.toEntityType === 'encounter');
    if (!parentEdge) return null;
    const parent = await encounterRepository.getById(parentEdge.toEntityId);
    return parent ?? null;
  }, [encounterId]);

  return {
    encounter,
    participants: encounter?.participants ?? [],
    linkedNotes,
    startEncounter,
    endEncounter,
    addParticipantFromTemplate,
    addParticipantFromCharacter,
    removeParticipant,
    updateParticipantState,
    updateDescription,
    updateBody,
    updateSummary,
    updateTags,
    updateLocation,
    getChildEncounters,
    getParentEncounter,
    refresh: loadEncounter,
  };
}
