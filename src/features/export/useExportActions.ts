import { useCallback } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import { getNoteById, getNotesByCampaign, getNotesBySession } from '../../storage/repositories/noteRepository';
import { getLinksFrom } from '../../storage/repositories/entityLinkRepository';
import { getSessionById } from '../../storage/repositories/sessionRepository';
import { getAttachmentsByNote } from '../../storage/repositories/attachmentRepository';
import { renderNoteToMarkdown } from '../../utils/export/renderNote';
import { renderAttachmentSidecar } from '../../utils/export/renderAttachmentSidecar';
import { renderSessionBundle } from '../../utils/export/renderSession';
import { bundleToZip } from '../../utils/export/bundleToZip';
import { shareFile, copyToClipboard } from '../../utils/export/delivery';
import { generateFilename } from '../../utils/export/generateFilename';
import type { Note } from '../../types/note';
import type { EntityLink } from '../../types/entityLink';

export function useExportActions() {
  const { activeCampaign } = useCampaignContext();
  const { showToast } = useToast();

  const exportNote = useCallback(async (noteId: string): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const note = await getNoteById(noteId);
      if (!note) { showToast('Note not found'); return; }

      const links = [
        ...(await getLinksFrom(noteId, 'introduced_in')),
        ...(await getLinksFrom(noteId, 'contains')),
      ] as EntityLink[];
      const allNotes = await getNotesByCampaign(activeCampaign.id);
      const attachments = await getAttachmentsByNote(noteId);
      const attachmentFilenames = attachments.map(a => a.filename);
      const markdown = renderNoteToMarkdown(note, links, allNotes, attachmentFilenames);

      if (attachments.length === 0) {
        const blob = new Blob([markdown], { type: 'text/markdown' });
        await shareFile(blob, generateFilename(note));
      } else {
        const filesMap = new Map<string, string | Blob>();
        filesMap.set(generateFilename(note), markdown);
        for (const att of attachments) {
          filesMap.set(`attachments/${att.filename}`, att.blob);
          filesMap.set(`attachments/${att.filename.replace('.jpg', '.md')}`, renderAttachmentSidecar(att, note));
        }
        const zipBlob = await bundleToZip(filesMap);
        await shareFile(zipBlob, generateFilename(note).replace('.md', '.zip'));
      }
    } catch (e) {
      showToast('Export failed');
      console.error('useExportActions.exportNote failed:', e);
    }
  }, [activeCampaign, showToast]);

  const exportSessionMarkdown = useCallback(async (sessionId: string): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const session = await getSessionById(sessionId);
      if (!session) { showToast('Session not found'); return; }

      // Get notes by sessionId (primary) + any entity-linked notes as fallback
      const sessionNotes = await getNotesBySession(sessionId);
      const containsLinks = await getLinksFrom(sessionId, 'contains');
      const linkedNoteIds = containsLinks.map(l => l.toEntityId);
      const linkedNotes: Note[] = [...sessionNotes];
      const seenIds = new Set(sessionNotes.map(n => n.id));
      for (const nid of linkedNoteIds) {
        if (seenIds.has(nid)) continue;
        const n = await getNoteById(nid);
        if (n) linkedNotes.push(n);
      }

      const allEntityLinks: EntityLink[] = [];
      for (const note of linkedNotes) {
        const noteLinks = await getLinksFrom(note.id, 'introduced_in');
        allEntityLinks.push(...noteLinks);
      }

      const filesMap = renderSessionBundle(session, linkedNotes, allEntityLinks);
      // Export just the session index
      const sessionFilename = generateFilename({ title: session.title, id: session.id });
      const sessionMarkdown = filesMap.get(sessionFilename) ?? filesMap.values().next().value ?? '';
      const blob = new Blob([sessionMarkdown], { type: 'text/markdown' });
      await shareFile(blob, sessionFilename);
    } catch (e) {
      showToast('Export failed');
      console.error('useExportActions.exportSessionMarkdown failed:', e);
    }
  }, [activeCampaign, showToast]);

  const exportSessionBundle = useCallback(async (sessionId: string): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const session = await getSessionById(sessionId);
      if (!session) { showToast('Session not found'); return; }

      // Get notes by sessionId (primary) + any entity-linked notes as fallback
      const sessionNotes = await getNotesBySession(sessionId);
      const containsLinks = await getLinksFrom(sessionId, 'contains');
      const linkedNoteIds = containsLinks.map(l => l.toEntityId);
      const linkedNotes: Note[] = [...sessionNotes];
      const seenIds = new Set(sessionNotes.map(n => n.id));
      for (const nid of linkedNoteIds) {
        if (seenIds.has(nid)) continue;
        const n = await getNoteById(nid);
        if (n) linkedNotes.push(n);
      }

      const allEntityLinks: EntityLink[] = [];
      for (const note of linkedNotes) {
        const noteLinks = await getLinksFrom(note.id, 'introduced_in');
        allEntityLinks.push(...noteLinks);
      }

      const textFilesMap = renderSessionBundle(session, linkedNotes, allEntityLinks);
      const filesMap = new Map<string, string | Blob>(textFilesMap);
      const sessionSlug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

      for (const note of linkedNotes) {
        const attachments = await getAttachmentsByNote(note.id);
        for (const att of attachments) {
          filesMap.set(`attachments/${sessionSlug}/${att.filename}`, att.blob);
          filesMap.set(`attachments/${sessionSlug}/${att.filename.replace('.jpg', '.md')}`, renderAttachmentSidecar(att, note));
        }
      }

      const zipBlob = await bundleToZip(filesMap);
      const zipFilename = generateFilename({ title: session.title, id: session.id }).replace('.md', '.zip');
      await shareFile(zipBlob, zipFilename);
    } catch (e) {
      showToast('Export failed');
      console.error('useExportActions.exportSessionBundle failed:', e);
    }
  }, [activeCampaign, showToast]);

  const copyNoteAsMarkdown = useCallback(async (noteId: string): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const note = await getNoteById(noteId);
      if (!note) { showToast('Note not found'); return; }

      const links = [
        ...(await getLinksFrom(noteId, 'introduced_in')),
        ...(await getLinksFrom(noteId, 'contains')),
      ] as EntityLink[];
      const allNotes = await getNotesByCampaign(activeCampaign.id);

      const markdown = renderNoteToMarkdown(note, links, allNotes);
      await copyToClipboard(markdown);
      showToast('Copied to clipboard');
    } catch (e) {
      showToast('Copy failed');
      console.error('useExportActions.copyNoteAsMarkdown failed:', e);
    }
  }, [activeCampaign, showToast]);

  const exportAllNotes = useCallback(async (): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const allNotes = await getNotesByCampaign(activeCampaign.id);
      if (allNotes.length === 0) {
        showToast('No notes to export');
        return;
      }

      const filesMap = new Map<string, string | Blob>();
      for (const note of allNotes) {
        const links = [
          ...(await getLinksFrom(note.id, 'introduced_in')),
          ...(await getLinksFrom(note.id, 'contains')),
        ] as EntityLink[];
        const attachments = await getAttachmentsByNote(note.id);
        const attachmentFilenames = attachments.map(a => a.filename);
        const markdown = renderNoteToMarkdown(note, links, allNotes, attachmentFilenames);
        const filename = generateFilename(note);
        filesMap.set(filename, markdown);

        for (const att of attachments) {
          const folder = note.sessionId
            ? `attachments/${note.sessionId.slice(0, 8)}/`
            : 'attachments/unsorted/';
          filesMap.set(`${folder}${att.filename}`, att.blob);
          filesMap.set(`${folder}${att.filename.replace('.jpg', '.md')}`, renderAttachmentSidecar(att, note));
        }
      }

      const zipBlob = await bundleToZip(filesMap);
      const zipFilename = `${activeCampaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-all-notes.zip`;
      await shareFile(zipBlob, zipFilename);
    } catch (e) {
      showToast('Export failed');
      console.error('useExportActions.exportAllNotes failed:', e);
    }
  }, [activeCampaign, showToast]);

  return { exportNote, exportSessionMarkdown, exportSessionBundle, exportAllNotes, copyNoteAsMarkdown };
}
