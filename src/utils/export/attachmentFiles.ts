import type { Attachment } from '../../types/attachment';
import type { Note } from '../../types/note';
import { renderAttachmentSidecar } from './renderAttachmentSidecar';
import { safeAttachmentFilename } from '../attachmentFilename';

/**
 * Builds the `attachments/` entries of a session ZIP from the notes that are
 * actually being shared.
 *
 * @remarks
 * Extracted from `useExportActions.exportSessionBundle` so the privacy rule is
 * testable. The bundle used to filter private notes out of the rendered
 * Markdown and then loop the *unfiltered* list here, so a private note's photos
 * — and their sidecars, which carry the note's title — shipped anyway. Pass
 * only the shareable notes; this function does no filtering of its own, on
 * purpose, so the caller cannot half-apply the policy.
 *
 * @param notes - The notes whose attachments may be shared.
 * @param attachmentsFor - Loads the attachments of one note.
 * @param folderFor - Directory each note's attachments go in, with no trailing
 * slash. A plain string is used for every note.
 */
export async function buildAttachmentFiles(
  notes: Note[],
  attachmentsFor: (noteId: string) => Promise<Attachment[]>,
  folderFor: string | ((note: Note) => string),
): Promise<Map<string, string | Blob>> {
  const files = new Map<string, string | Blob>();
  for (const note of notes) {
    const folder = typeof folderFor === 'string' ? folderFor : folderFor(note);
    for (const att of await attachmentsFor(note.id)) {
      // The stored name can have come from an imported bundle, and this string
      // becomes an entry path inside the ZIP. `../../x.jpg` would be written
      // outside the intended directory by whatever extracts it — aimed not at
      // this app but at whoever the user shares the bundle with.
      const name = safeAttachmentFilename(att.filename);
      const base = folder ? `${folder}/${name}` : name;
      files.set(base, att.blob);
      files.set(sidecarPath(base), renderAttachmentSidecar(att, note));
    }
  }
  return files;
}

/**
 * The sidecar path for an attachment file.
 *
 * @remarks
 * Replaces the final extension rather than the literal `.jpg` the caller used
 * to substitute: a `.png` attachment produced a sidecar named `photo.png`,
 * which overwrote the image itself in the ZIP. An extensionless filename gets
 * `.md` appended.
 */
function sidecarPath(path: string): string {
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  return dot > slash ? `${path.slice(0, dot)}.md` : `${path}.md`;
}
