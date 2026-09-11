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

/**
 * Hook for managing a single encounter: loading data, adding/updating
 * participants, auto-linking notes, and controlling lifecycle.
 *
 * @remarks
 * Took `sessionId`/`campaignId` only for a dead `startEncounter` variant that
 * created an encounter with `status: 'active'` without checking the
 * one-active-encounter invariant. `useSessionEncounter.startEncounter` is the
 * real one; this hook loads and mutates an encounter that already exists.
 *
 * @param encounterId - ID of the encounter to manage (null if none).
 */
export function useEncounter(encounterId: string | null) {
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

      const hp = isCreature
        ? (template as CreatureTemplate).stats?.hp
        : undefined;
      const participantType: EncounterParticipant['type'] = isCreature
        ? ((template as CreatureTemplate).category === 'monster' ? 'monster' : 'npc')
        : 'pc';

      // The transaction, the tombstone refusal, the PC deduplication and the
      // `represents` edge all live in the repository now. The rule this hook
      // used to be the only keeper of — "a tombstoned encounter is invisible in
      // the UI, so writing to one adds a participant nobody can see or remove"
      // — had three siblings that opened the identical transaction and never
      // made the check. It has one implementation now instead of a correct copy
      // and three wrong ones.
      await encounterRepository.addRepresentedParticipants(encounterId, [
        {
          name: template.name,
          type: participantType,
          instanceState: hp !== undefined ? { currentHp: hp } : {},
          represents: { id: template.id, type: isCreature ? 'creature' : 'character' },
        },
      ]);

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
      // Same move as the add path: the removal has to tombstone the
      // participant's `represents` edges in the same transaction that drops it
      // from the list, so both halves live behind one repository call.
      await encounterRepository.removeRepresentedParticipant(encounterId, participantId);

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

  /*
   * The five field editors below go through `encounterRepository.update`, not
   * `db.encounters.update`. Reaching past the repository skipped both of the
   * things that method exists for: the soft-delete guard, so an autosave
   * arriving after the encounter was deleted resurrected content into a
   * tombstoned row invisible in the UI; and the single read-modify-write
   * transaction, so two blurs in the same tick each read the pre-edit row and
   * the second silently discarded the first. `updateParticipant` beside them
   * always used the repository, and is the path that was tested.
   */

  /** Updates the encounter's `description` narrative field (ProseMirror JSON). */
  const updateDescription = useCallback(async (description: unknown) => {
    if (!encounterId) return;
    await encounterRepository.update(encounterId, { description });
    await loadEncounter();
  }, [encounterId, loadEncounter]);

  /** Updates the encounter's `body` narrative field (ProseMirror JSON). */
  const updateBody = useCallback(async (body: unknown) => {
    if (!encounterId) return;
    await encounterRepository.update(encounterId, { body });
    await loadEncounter();
  }, [encounterId, loadEncounter]);

  /** Updates the encounter's `summary` narrative field (ProseMirror JSON). */
  const updateSummary = useCallback(async (summary: unknown) => {
    if (!encounterId) return;
    await encounterRepository.update(encounterId, { summary });
    await loadEncounter();
  }, [encounterId, loadEncounter]);

  /** Updates the encounter's free-form tag list. */
  const updateTags = useCallback(async (tags: string[]) => {
    if (!encounterId) return;
    await encounterRepository.update(encounterId, { tags });
    await loadEncounter();
  }, [encounterId, loadEncounter]);

  /** Updates the encounter's optional location string. */
  const updateLocation = useCallback(async (location: string | undefined) => {
    if (!encounterId) return;
    await encounterRepository.update(encounterId, { location });
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
