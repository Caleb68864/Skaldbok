import type { BundleContents } from '../../types/bundle';

/**
 * Removes private notes and all references to them from bundle contents.
 *
 * @remarks
 * This is a pure function with no side effects, no async calls, and no
 * database access. It returns a new `BundleContents` object — the input
 * is never mutated.
 *
 * Legacy notes without a `visibility` field are treated as `'public'` and
 * are never excluded.
 *
 * @param contents - The collected bundle contents to filter.
 * @param includePrivate - If `true`, all notes are retained regardless of visibility.
 * @returns A new `BundleContents` with private notes and orphaned references removed.
 */
export function applyPrivacyFilter(
  contents: BundleContents,
  includePrivate: boolean
): BundleContents {
  if (includePrivate) return contents;

  // Step 1: Identify private note IDs.
  // A note is only excluded if visibility is explicitly 'private'.
  // Missing or 'public' visibility keeps the note.
  const privateNoteIds = new Set(
    (contents.notes ?? [])
      .filter((note) => note.visibility === 'private')
      .map((note) => note.id)
  );

  if (privateNoteIds.size === 0) return contents;

  // Step 2: Filter out private notes.
  const filteredNotes = (contents.notes ?? []).filter(
    (note) => !privateNoteIds.has(note.id)
  );

  // Step 3: Filter entity links that reference removed notes (either direction).
  const filteredEntityLinks = (contents.entityLinks ?? []).filter((link) => {
    const fromIsPrivate =
      link.fromEntityType === 'note' && privateNoteIds.has(link.fromEntityId);
    const toIsPrivate =
      link.toEntityType === 'note' && privateNoteIds.has(link.toEntityId);
    return !fromIsPrivate && !toIsPrivate;
  });

  // Step 4: Filter attachments that reference removed notes.
  // The attachmentSchema uses `noteId` as the linking field.
  const filteredAttachments = (contents.attachments ?? []).filter((attachment) => {
    const linkedNoteId = (attachment as Record<string, unknown>).noteId as string | undefined;
    if (!linkedNoteId) return true; // keep attachments without a note link
    return !privateNoteIds.has(linkedNoteId);
  });

  return {
    ...contents,
    notes: filteredNotes,
    entityLinks: filteredEntityLinks,
    attachments: filteredAttachments,
  };
}
