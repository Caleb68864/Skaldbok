/**
 * The note's attachment gallery: add a photo, see it, caption it.
 *
 * @remarks
 * This component is the missing half of a subsystem that was otherwise
 * complete. `attachmentRepository.createAttachment` had **zero callers**, so
 * the app could not produce an attachment at all, while `README.md` listed
 * "attachments" as a shipped Notes feature — a false statement to a user rather
 * than dead code. Everything around the hole was already built and hardened:
 * downscale-and-re-encode, a `QuotaExceededError` re-label, a soft-delete
 * cascade with restore-by-txId, a `RESTORE_WITHOUT_LISTING` exemption, ZIP
 * sidecar rendering, base64 bundle round-tripping and a mime/size/base64
 * restore guard. Deleting the entry point would have discarded all of it; the
 * decision was to wire it.
 *
 * The *read* half was half-wired too. `NoteReader` rendered each attachment as
 * a text chip showing `att.caption || att.id` — a raw UUID, since nothing could
 * set a caption either — and no `<img>` existed anywhere in the app. So the one
 * path that could produce a row (importing a bundle from a device that also
 * could not create one) displayed a photo as a hex string.
 *
 * ### What is deliberately not here
 *
 * **There is no per-photo remove control.** `trashRegistry.RESTORE_WITHOUT_LISTING`
 * exempts the `attachments` table from having a Trash listing on the recorded
 * grounds that an attachment is *"a cascade child, never deleted on its own"*.
 * A remove button here would either be a permanent delete on user content —
 * which `hardDeleteReachability.test.ts` forbids outside `src/storage` — or a
 * soft delete into a place the Trash cannot show, which is the exact bug that
 * exemption exists to prevent. Photos go when their note goes, and come back
 * with it. Adding the control means adding the listing first.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { createAttachment, updateAttachmentCaption } from '../../storage/repositories/attachmentRepository';
import { useToast } from '../../context/ToastContext';
import type { Attachment } from '../../types/attachment';

/** Props for {@link NoteAttachments}. */
export interface NoteAttachmentsProps {
  noteId: string;
  campaignId: string;
  attachments: Attachment[];
  /** Called after a successful add or caption edit so the parent can re-read. */
  onChanged: () => void;
}

/** Renders a byte count the way a person reads one. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One attachment: its image, its size, and an editable caption.
 *
 * @remarks
 * The object URL is created in an effect keyed on the Blob and revoked on
 * cleanup. Doing it during render leaks one URL per render, and the leak is
 * invisible — the images keep working while the tab's memory grows.
 */
function AttachmentTile({ attachment, onChanged }: { attachment: Attachment; onChanged: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [caption, setCaption] = useState(attachment.caption ?? '');
  const { showToast } = useToast();

  useEffect(() => {
    const url = URL.createObjectURL(attachment.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment.blob]);

  // A caption edited elsewhere (an import, a second tab) must not be masked by
  // this component's stale local copy.
  useEffect(() => {
    setCaption(attachment.caption ?? '');
  }, [attachment.caption]);

  const commit = useCallback(async () => {
    const next = caption.trim();
    if (next === (attachment.caption ?? '')) return;
    try {
      await updateAttachmentCaption(attachment.id, next);
      onChanged();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the caption', 'error');
    }
  }, [caption, attachment.caption, attachment.id, onChanged, showToast]);

  return (
    <figure className="m-0 w-40 shrink-0">
      {src && (
        <img
          src={src}
          // The caption when there is one, and otherwise a description of what
          // the image is rather than the empty string: this is a photo the user
          // chose to attach, so it is content, not decoration.
          alt={caption || `Attachment on this note (${attachment.filename})`}
          className="w-40 h-40 object-cover rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)]"
        />
      )}
      <figcaption className="mt-1">
        <label className="sr-only" htmlFor={`caption-${attachment.id}`}>
          Caption for {attachment.filename}
        </label>
        <input
          id={`caption-${attachment.id}`}
          value={caption}
          onChange={e => setCaption(e.target.value)}
          onBlur={commit}
          placeholder="Add a caption"
          className="w-full bg-transparent text-xs text-[var(--color-text)] border-b border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none"
        />
        <span className="block text-[10px] text-[var(--color-text-muted)] mt-0.5">
          {formatBytes(attachment.sizeBytes)}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Gallery plus the "Add photo" control.
 *
 * @param props - The note this gallery belongs to and its current attachments.
 */
export function NoteAttachments({ noteId, campaignId, attachments, onChanged }: NoteAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await createAttachment(noteId, campaignId, file);
      }
      onChanged();
    } catch (e) {
      // The repository re-labels a quota failure with its name preserved for
      // exactly this: "storage full" is advice the user can act on, and every
      // other failure is not.
      const full = e instanceof Error && e.name === 'QuotaExceededError';
      showToast(
        full
          ? 'Storage is full — this device could not save the photo.'
          : 'Could not attach that file.',
        'error',
      );
    } finally {
      setBusy(false);
      // Clear the input so choosing the same file twice fires `change` again.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="border-t border-[var(--color-border)] pt-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">
          Attachments{attachments.length > 0 ? ` (${attachments.length})` : ''}
        </h3>
        <label className="text-xs px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text)] cursor-pointer hover:border-[var(--color-accent)]">
          {busy ? 'Adding…' : 'Add photo'}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={e => void handleFiles(e.target.files)}
            className="sr-only"
          />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          No photos yet. Everything you add stays on this device.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {attachments.map(att => (
            <AttachmentTile key={att.id} attachment={att} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}
