import { useCallback, useEffect, useState } from 'react';
import * as portraitRepository from '../../storage/repositories/portraitRepository';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { nowISO } from '../../utils/dates';
import type { CharacterRecord } from '../../types/character';

/**
 * The image to show for a character's portrait (H8).
 *
 * @remarks
 * A `portraitId` wins and is loaded from the `portraits` table as an object
 * URL, revoked when it changes or the component goes. Otherwise the record's
 * inline `portraitUri` is used, which is how every portrait set before version
 * 21 is stored: nothing is migrated, so both forms are read.
 *
 * @returns The `src` to draw, or `undefined` when there is no portrait.
 */
export function usePortraitSrc(character: Pick<CharacterRecord, 'portraitId' | 'portraitUri'> | null | undefined): string | undefined {
  const portraitId = character?.portraitId;
  const [stored, setStored] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!portraitId) {
      setStored(null);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    portraitRepository.getPortrait(portraitId)
      .then((row) => {
        if (cancelled || !row) return;
        url = URL.createObjectURL(row.blob);
        setStored({ id: portraitId, url });
      })
      .catch((e) => console.error('usePortraitSrc: load failed', e));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [portraitId]);

  if (portraitId && stored?.id === portraitId) return stored.url;
  return character?.portraitUri;
}

/** Decodes a `data:` URL into a Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Not a data URL');
  const [, mime, isBase64, payload] = match;
  if (!isBase64) return new Blob([decodeURIComponent(payload!)], { type: mime || 'text/plain' });
  const binary = atob(payload!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

/**
 * Sets the active character's portrait, stored as a Blob in `portraits`.
 *
 * @remarks
 * The record keeps only the id and drops its inline `portraitUri`, so the
 * autosave no longer rewrites the image every second. The row is written at
 * once (not debounced) and replaced in place on the next change.
 *
 * @returns A function taking the compressed image as a data URL.
 */
export function useSetPortrait(): (dataUrl: string) => Promise<void> {
  const { character, updateCharacter } = useActiveCharacter();
  return useCallback(async (dataUrl: string) => {
    if (!character) return;
    const id = await portraitRepository.savePortrait(character.id, dataUrlToBlob(dataUrl), character.portraitId);
    updateCharacter({ portraitId: id, portraitUri: undefined, updatedAt: nowISO() });
  }, [character, updateCharacter]);
}
