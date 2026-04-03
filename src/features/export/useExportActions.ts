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

/**
 * Hook that provides all note and session export actions for the active campaign.
 *
 * @remarks
 * Every action is null-safe with respect to the active campaign — calling any
 * function when `activeCampaign` is null shows a toast and returns early.
 * Errors are caught internally; the caller never needs to handle rejections.
 *
 * @returns An object containing five export helpers:
 * - {@link exportNote} — share a single note as Markdown (or ZIP if it has attachments)
 * - {@link exportSessionMarkdown} — share a session's index Markdown file
 * - {@link exportSessionBundle} — share all session notes + attachments as a ZIP
 * - {@link exportAllNotes} — share every campaign note as a ZIP
 * - {@link copyNoteAsMarkdown} — copy a single note's Markdown to the clipboard
 *
 * @example
 * ```tsx
 * const { exportNote, copyNoteAsMarkdown } = useExportActions();
 * <button onClick={() => exportNote(note.id)}>Export</button>
 * ```
 */
export function useExportActions() {
  const { activeCampaign } = useCampaignContext();
  const { showToast } = useToast();

  /**
   * Exports a single note as a Markdown file, or as a ZIP archive when the note
   * has one or more attachments (images are placed in an `attachments/` folder
   * alongside auto-generated sidecar Markdown files).
   *
   * @param noteId - ID of the note to export.
   * @returns A promise that resolves when the file has been handed to the share
   * sheet / download mechanism, or immediately on early-exit conditions.
   */
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

  /**
   * Exports the index Markdown file for a single session (the top-level summary
   * document without individual note files).
   *
   * @remarks
   * Notes are resolved by `sessionId` first; any additional notes linked to the
   * session via `contains` entity-links are merged in without duplication.
   *
   * @param sessionId - ID of the session to export.
   * @returns A promise that resolves when the file has been shared, or immediately
   * on early-exit conditions.
   */
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

  /**
   * Exports a full session bundle as a ZIP archive: the session index, individual
   * note Markdown files, and any attachment images with their sidecar files.
   * Attachments are placed under `attachments/<session-slug>/`.
   *
   * @remarks
   * Notes are resolved by `sessionId` first; notes linked via `contains`
   * entity-links are merged in without duplication.
   *
   * @param sessionId - ID of the session to export.
   * @returns A promise that resolves when the ZIP has been shared, or immediately
   * on early-exit conditions.
   */
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

  /**
   * Copies the Markdown representation of a single note to the system clipboard.
   * Shows a "Copied to clipboard" toast on success.
   *
   * @param noteId - ID of the note to copy.
   * @returns A promise that resolves when the clipboard write completes, or
   * immediately on early-exit conditions.
   */
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

  /**
   * Exports every note in the active campaign as a single ZIP archive.
   * Each note becomes a Markdown file; attachments are placed in
   * `attachments/<session-prefix>/` (or `attachments/unsorted/` for session-less notes)
   * alongside auto-generated sidecar files.
   *
   * @remarks
   * Shows a "No notes to export" toast when the campaign has no notes yet.
   *
   * @returns A promise that resolves when the ZIP has been shared, or immediately
   * on early-exit conditions.
   */
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
