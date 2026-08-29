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
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(uri) ? uri : undefined;
}
