import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { useCampaignContext } from '../campaign/CampaignContext';
import * as attachmentRepository from '../../storage/repositories/attachmentRepository';
import type { Attachment } from '../../types/attachment';

/** An attachment record paired with a live object URL for rendering its blob. */
type AttachmentWithUrl = Attachment & { objectUrl: string };

/**
 * Loads and mutates the image attachments for a note, managing blob object-URL
 * lifetimes.
 *
 * @remarks
 * Attachment blobs live in IndexedDB; each is exposed as an `objectUrl` created with
 * `URL.createObjectURL`, and the hook revokes every URL it made on reload and unmount
 * so blob memory isn't leaked. Guards enforce the rules that a note must be saved
 * (have an id) and a campaign active before attaching, and caps a note at 10
 * attachments. `addAttachment` distinguishes a quota error from an unreadable image
 * so the toast is actionable. A `noteId` of `undefined` clears state (the new-note
 * case).
 */
export function useNoteAttachments(noteId: string | undefined) {
  const { activeCampaign } = useCampaignContext();
  const { showToast } = useToast();

  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Track object URLs for cleanup
  const objectUrlsRef = useRef<string[]>([]);

  const revokeAll = useCallback(() => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => {
    if (!noteId) {
      revokeAll();
      setAttachments([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    attachmentRepository.getAttachmentsByNote(noteId)
      .then(records => {
        if (cancelled) return;
        // Revoke any previously created URLs before creating new ones
        revokeAll();
        const withUrls: AttachmentWithUrl[] = records.map(record => {
          const objectUrl = URL.createObjectURL(record.blob);
          objectUrlsRef.current.push(objectUrl);
          return { ...record, objectUrl };
        });
        setAttachments(withUrls);
      })
      .catch(e => {
        if (cancelled) return;
        showToast('Failed to load attachments');
        console.error('useNoteAttachments: load failed', e);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      revokeAll();
    };
  }, [noteId, showToast, revokeAll]);

  const addAttachment = useCallback(async (file: File): Promise<void> => {
    if (!noteId) {
      showToast('Save the note before adding attachments');
      return;
    }
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    if (attachments.length >= 10) {
      showToast('Maximum 10 attachments per note');
      return;
    }

    try {
      const record = await attachmentRepository.createAttachment(noteId, activeCampaign.id, file);
      const objectUrl = URL.createObjectURL(record.blob);
      objectUrlsRef.current.push(objectUrl);
      setAttachments(prev => [...prev, { ...record, objectUrl }]);
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        showToast('Storage full');
      } else {
        try {
          await createImageBitmap(file);
        } catch {
          showToast('Could not read image');
          return;
        }
        showToast('Failed to add attachment');
      }
      console.error('useNoteAttachments.addAttachment failed:', e);
    }
  }, [noteId, activeCampaign, attachments.length, showToast]);

  const removeAttachment = useCallback(async (id: string): Promise<void> => {
    try {
      await attachmentRepository.deleteAttachment(id);
      setAttachments(prev => {
        const target = prev.find(a => a.id === id);
        if (target) {
          URL.revokeObjectURL(target.objectUrl);
          objectUrlsRef.current = objectUrlsRef.current.filter(u => u !== target.objectUrl);
        }
        return prev.filter(a => a.id !== id);
      });
    } catch (e) {
      showToast('Failed to remove attachment');
      console.error('useNoteAttachments.removeAttachment failed:', e);
    }
  }, [showToast]);

  const updateCaption = useCallback(async (id: string, caption: string): Promise<void> => {
    try {
      await attachmentRepository.updateAttachmentCaption(id, caption);
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, caption } : a));
    } catch (e) {
      showToast('Failed to update caption');
      console.error('useNoteAttachments.updateCaption failed:', e);
    }
  }, [showToast]);

  return { attachments, addAttachment, removeAttachment, updateCaption, isLoading };
}
