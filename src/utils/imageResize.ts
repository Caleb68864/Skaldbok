/**
 * Downscales and re-encodes an image file to a JPEG blob for storage.
 *
 * @remarks
 * Runs entirely client-side via `OffscreenCanvas`, keeping the app backend-free.
 * Attachments are user photos that can be many megapixels; shrinking them before
 * they land in IndexedDB keeps the local database from ballooning. Images already
 * at or below `maxWidth` are re-encoded at their native size (scale clamps to 1),
 * never upscaled.
 *
 * @param file - Source image chosen by the user.
 * @param maxWidth - Longest edge in pixels the output is allowed to reach.
 * @param quality - JPEG quality from 0 to 1.
 * @returns A JPEG blob ready to persist.
 */
export async function resizeAndCompress(
  file: File,
  maxWidth: number = 1920,
  quality: number = 0.8
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return await canvas.convertToBlob({ type: 'image/jpeg', quality });
}
