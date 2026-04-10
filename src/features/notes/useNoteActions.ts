import { useCallback } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import * as noteRepository from '../../storage/repositories/noteRepository';
import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';
import * as attachmentRepository from '../../storage/repositories/attachmentRepository';
import { listBySession as listEncountersBySession } from '../../storage/repositories/encounterRepository';
import type { Note } from '../../types/note';

/**
 * Shape of data required when creating a new note via {@link useNoteActions.createNote}.
 * Omits fields that are auto-populated by the repository (`id`, `createdAt`,
 * `updatedAt`, `schemaVersion`) and those injected from context (`campaignId`,
 * `sessionId`).
 */
type CreateNoteData = Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion' | 'campaignId' | 'sessionId' | 'scope'> & { scope?: Note['scope'] };

/**
 * Options accepted by {@link useNoteActions.createNote} that control the
 * automatic encounter-attach behavior.
 *
 * - `undefined` (or omitted) — auto-attach to the currently-active encounter,
 *   matching legacy behavior.
 * - `null` — do NOT attach to any encounter (session-level log).
 * - `string` — attach to the specified encounter id.
 */
export interface CreateNoteOptions {
  targetEncounterId?: string | null;
}

/**
 * Hook providing CRUD and linking operations for notes, scoped to the active
 * campaign and session.
 *
 * @remarks
 * All operations are null-safe with respect to the active campaign — `createNote`
 * shows a toast and returns `undefined` when no campaign is selected. Other
 * operations do not require an active campaign but will show error toasts on
 * failure. Entity links are managed automatically:
 * - `createNote` auto-links new notes to the active session (`session → note:contains`).
 * - NPC notes additionally receive a `note → session:introduced_in` link.
 * - `deleteNote` cascades to remove all entity links and attachments before
 *   deleting the note record.
 * - `linkNote` adds a `session → note:linked_to` link and, for NPC notes
 *   linked across sessions, an `note → session:appears_in` link.
 *
 * @returns An object with six note-action helpers.
 *
 * @example
 * ```tsx
 * const { createNote, deleteNote } = useNoteActions();
 *
 * await createNote({ title: 'Ran Ormson', type: 'npc', body: null, pinned: false, status: 'active', typeData: {} });
 * ```
 */
export function useNoteActions() {
  const { activeCampaign, activeSession } = useCampaignContext();
  const { showToast } = useToast();

  /**
   * Creates a new note attached to the active campaign and session.
   *
   * @remarks
   * Automatically creates entity links after the note is persisted:
   * - `session → note` with relationship `contains` (when a session is active).
   * - `note → session` with relationship `introduced_in` (NPC notes only).
   *
   * @param data - Note fields to persist; `campaignId` and `sessionId` are
   * injected from context and must not be provided.
   * @returns The newly created {@link Note}, or `undefined` on failure.
   */
  const createNote = useCallback(async (
    data: CreateNoteData,
    options?: CreateNoteOptions,
  ): Promise<Note | undefined> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return undefined;
    }
    try {
      const note = await noteRepository.createNote({
        scope: 'campaign',
        ...data,
        campaignId: activeCampaign.id,
        sessionId: activeSession?.id,
      } as Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>);

      // Auto-link to active session
      if (activeSession) {
        // session → note ("contains")
        const existingContains = await entityLinkRepository.getLinksFrom(activeSession.id, 'contains');
        const alreadyLinked = existingContains.some(l => l.toEntityId === note.id);
        if (!alreadyLinked) {
          await entityLinkRepository.createLink({
            fromEntityId: activeSession.id,
            fromEntityType: 'session',
            toEntityId: note.id,
            toEntityType: 'note',
            relationshipType: 'contains',
          });
        }

        // Encounter linkage: honor an explicit targetEncounterId override if
        // provided (Sub-Spec 8), otherwise fall back to the legacy
        // auto-attach-to-active-encounter behavior.
        try {
          let attachEncounterId: string | null = null;
          if (options && options.targetEncounterId === null) {
            attachEncounterId = null;
          } else if (options && typeof options.targetEncounterId === 'string') {
            attachEncounterId = options.targetEncounterId;
          } else {
            const encounters = await listEncountersBySession(activeSession.id);
            const activeEncounter = encounters.find(e => e.status === 'active');
            attachEncounterId = activeEncounter?.id ?? null;
          }
          if (attachEncounterId) {
            await entityLinkRepository.createLink({
              fromEntityId: attachEncounterId,
              fromEntityType: 'encounter',
              toEntityId: note.id,
              toEntityType: 'note',
              relationshipType: 'contains',
            });
          }
        } catch (linkErr) {
          console.warn('useNoteActions: encounter auto-link failed', linkErr);
        }

        // NPC: note → session ("introduced_in")
        if (note.type === 'npc') {
          const existingIntroduced = await entityLinkRepository.getLinksFrom(note.id, 'introduced_in');
          const alreadyIntroduced = existingIntroduced.some(l => l.toEntityId === activeSession.id);
          if (!alreadyIntroduced) {
            await entityLinkRepository.createLink({
              fromEntityId: note.id,
              fromEntityType: 'note',
              toEntityId: activeSession.id,
              toEntityType: 'session',
              relationshipType: 'introduced_in',
            });
          }
        }
      }

      return note;
    } catch (e) {
      showToast('Failed to create note');
      console.error('useNoteActions.createNote failed:', e);
      return undefined;
    }
  }, [activeCampaign, activeSession, showToast]);

  /**
   * Applies a partial update to an existing note.
   *
   * @param id - ID of the note to update.
   * @param data - Partial {@link Note} fields to merge into the existing record.
   * @returns The updated {@link Note}, or `undefined` on failure.
   */
  const updateNote = useCallback(async (id: string, data: Partial<Note>): Promise<Note | undefined> => {
    try {
      return await noteRepository.updateNote(id, data);
    } catch (e) {
      showToast('Failed to update note');
      console.error('useNoteActions.updateNote failed:', e);
      return undefined;
    }
  }, [showToast]);

  /**
   * Deletes a note along with all of its entity links and attachments.
   *
   * @remarks
   * Deletion is cascaded in order: entity links first, then attachments,
   * then the note record itself.
   *
   * @param id - ID of the note to delete.
   */
  const deleteNote = useCallback(async (id: string): Promise<void> => {
    try {
      await entityLinkRepository.deleteLinksForNote(id);
      await attachmentRepository.deleteAttachmentsByNote(id);
      await noteRepository.deleteNote(id);
    } catch (e) {
      showToast('Failed to delete note');
      console.error('useNoteActions.deleteNote failed:', e);
    }
  }, [showToast]);

  /**
   * Links a note to a session with a `linked_to` relationship, deduplicating
   * if the link already exists.
   *
  /**
   * Marks a note as pinned.
   *
   * @param noteId - ID of the note to pin.
   */
  const pinNote = useCallback(async (noteId: string): Promise<void> => {
    try {
      await noteRepository.updateNote(noteId, { pinned: true });
    } catch (e) {
      showToast('Failed to pin note');
      console.error('useNoteActions.pinNote failed:', e);
    }
  }, [showToast]);

  /**
   * Removes the pinned flag from a note.
   *
   * @param noteId - ID of the note to unpin.
   */
  const unpinNote = useCallback(async (noteId: string): Promise<void> => {
    try {
      await noteRepository.updateNote(noteId, { pinned: false });
    } catch (e) {
      showToast('Failed to unpin note');
      console.error('useNoteActions.unpinNote failed:', e);
    }
  }, [showToast]);

  return { createNote, updateNote, deleteNote, pinNote, unpinNote };
}
