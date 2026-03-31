import { useCallback } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import * as noteRepository from '../../storage/repositories/noteRepository';
import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';
import * as attachmentRepository from '../../storage/repositories/attachmentRepository';
import type { Note } from '../../types/note';

type CreateNoteData = Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion' | 'campaignId' | 'sessionId'>;

export function useNoteActions() {
  const { activeCampaign, activeSession } = useCampaignContext();
  const { showToast } = useToast();

  const createNote = useCallback(async (data: CreateNoteData): Promise<Note | undefined> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return undefined;
    }
    try {
      const note = await noteRepository.createNote({
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

  const updateNote = useCallback(async (id: string, data: Partial<Note>): Promise<Note | undefined> => {
    try {
      return await noteRepository.updateNote(id, data);
    } catch (e) {
      showToast('Failed to update note');
      console.error('useNoteActions.updateNote failed:', e);
      return undefined;
    }
  }, [showToast]);

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

  const linkNote = useCallback(async (noteId: string, sessionId: string): Promise<void> => {
    try {
      // Deduplicate: check if link already exists
      const existingLinks = await entityLinkRepository.getLinksFrom(sessionId, 'linked_to');
      const alreadyLinked = existingLinks.some(l => l.toEntityId === noteId);
      if (!alreadyLinked) {
        await entityLinkRepository.createLink({
          fromEntityId: sessionId,
          fromEntityType: 'session',
          toEntityId: noteId,
          toEntityType: 'note',
          relationshipType: 'linked_to',
        });
      }

      // For NPC notes linked to a different session than where introduced,
      // add an "appears_in" link
      const note = await noteRepository.getNoteById(noteId);
      if (note && note.type === 'npc' && note.sessionId !== sessionId) {
        const existingAppears = await entityLinkRepository.getLinksFrom(noteId, 'appears_in');
        const alreadyAppears = existingAppears.some(l => l.toEntityId === sessionId);
        if (!alreadyAppears) {
          await entityLinkRepository.createLink({
            fromEntityId: noteId,
            fromEntityType: 'note',
            toEntityId: sessionId,
            toEntityType: 'session',
            relationshipType: 'appears_in',
          });
        }
      }
    } catch (e) {
      showToast('Failed to link note');
      console.error('useNoteActions.linkNote failed:', e);
    }
  }, [showToast]);

  const pinNote = useCallback(async (noteId: string): Promise<void> => {
    try {
      await noteRepository.updateNote(noteId, { pinned: true });
    } catch (e) {
      showToast('Failed to pin note');
      console.error('useNoteActions.pinNote failed:', e);
    }
  }, [showToast]);

  const unpinNote = useCallback(async (noteId: string): Promise<void> => {
    try {
      await noteRepository.updateNote(noteId, { pinned: false });
    } catch (e) {
      showToast('Failed to unpin note');
      console.error('useNoteActions.unpinNote failed:', e);
    }
  }, [showToast]);

  return { createNote, updateNote, deleteNote, linkNote, pinNote, unpinNote };
}
