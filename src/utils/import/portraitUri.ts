/**
 * The only portrait source an imported character may carry.
 *
 * @remarks
 * `portraitUri` is documented as "a data URL or a remote URI", and locally
 * created portraits are always data URLs (the picker re-encodes through a
 * canvas). An imported record could name any URL, and the sheet would render
 * it as an `<img>` — a beacon to an external host from an app that otherwise
 * makes no network requests, fired every time the sheet opens. Import keeps
 * inline images and drops everything else.
 */
export function importablePortraitUri(uri: unknown): string | undefined {
  if (typeof uri !== 'string') return undefined;
  if (uri.length > MAX_PORTRAIT_URI_LENGTH) return undefined;
  return PORTRAIT_DATA_URL.test(uri) ? uri : undefined;
}

/**
 * Raster image types only.
 *
 * @remarks
 * Was `data:image/<anything>`, which admits `image/svg+xml`. An SVG is a
 * document: it carries its own script and external references, and while a
 * browser will not run script in an SVG loaded through `<img>`, the portrait is
 * one `background-image` or `<object>` away from a context where it would. The
 * picker only ever produces JPEG, so nothing legitimate is lost.
 */
const PORTRAIT_DATA_URL = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;

/**
 * Ceiling on the encoded string, about 8 MB of base64.
 *
 * @remarks
 * The portrait rides inline on the character record, so an oversized one is
 * rewritten on every autosave and copied through every export. The picker caps
 * its output at 1920px JPEG; this is well above that and only rejects a file
 * that was never produced here.
 */
const MAX_PORTRAIT_URI_LENGTH = 8 * 1024 * 1024;
