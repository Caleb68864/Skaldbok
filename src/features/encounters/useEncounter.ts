import { useState, useEffect, useCallback } from 'react';
import type { Encounter, EncounterParticipant } from '../../types/encounter';
import type { Note } from '../../types/note';
import * as encounterRepository from '../../storage/repositories/encounterRepository';
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';
import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import { getNoteById } from '../../storage/repositories/noteRepository';
import { getLinksFrom } from '../../storage/repositories/entityLinkRepository';
import { nowISO } from '../../utils/dates';

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
        const links = await getLinksFrom(encounterId, 'contains');
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
        startedAt: now,
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

  const addParticipantFromTemplate = useCallback(
    async (templateId: string) => {
      if (!encounterId) return;
      const template = await creatureTemplateRepository.getById(templateId);
      if (!template) return;
      const updated = await encounterRepository.addParticipant(encounterId, {
        name: template.name,
        type: template.category === 'monster' ? 'monster' : 'npc',
        linkedCreatureId: templateId,
        instanceState: { currentHp: template.stats.hp },
        sortOrder: (encounter?.participants.length ?? 0) + 1,
      });
      if (updated) setEncounter(updated);
    },
    [encounterId, encounter]
  );

  const addParticipantFromCharacter = useCallback(
    async (characterId: string) => {
      if (!encounterId) return;
      const character = await getCharacterById(characterId);
      if (!character) return;
      const updated = await encounterRepository.addParticipant(encounterId, {
        name: character.name,
        type: 'pc',
        linkedCharacterId: characterId,
        instanceState: {},
        sortOrder: (encounter?.participants.length ?? 0) + 1,
      });
      if (updated) setEncounter(updated);
    },
    [encounterId, encounter]
  );

  const quickCreateParticipant = useCallback(
    async (name: string, stats: { hp?: number; armor?: number; movement?: number }) => {
      if (!encounterId) return;
      // Check if a creature template with this name already exists
      const existing = (await creatureTemplateRepository.listByCampaign(campaignId)).find(
        t => t.name.toLowerCase() === name.toLowerCase()
      );
      const template = existing ?? await creatureTemplateRepository.create({
        campaignId,
        name,
        category: 'monster',
        stats: {
          hp: stats.hp ?? 0,
          armor: stats.armor ?? 0,
          movement: stats.movement ?? 0,
        },
        attacks: [],
        abilities: [],
        skills: [],
        tags: [],
        status: 'active',
      });
      if (!template) return;
      // Add as participant
      const updated = await encounterRepository.addParticipant(encounterId, {
        name: template.name,
        type: 'monster',
        linkedCreatureId: template.id,
        instanceState: { currentHp: template.stats.hp },
        sortOrder: (encounter?.participants.length ?? 0) + 1,
      });
      if (updated) setEncounter(updated);
    },
    [encounterId, campaignId, encounter]
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

  return {
    encounter,
    participants: encounter?.participants ?? [],
    linkedNotes,
    startEncounter,
    endEncounter,
    addParticipantFromTemplate,
    addParticipantFromCharacter,
    quickCreateParticipant,
    updateParticipantState,
    refresh: loadEncounter,
  };
}
