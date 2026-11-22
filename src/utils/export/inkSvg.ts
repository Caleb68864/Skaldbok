import { deserializeStrokePage, INK_TYPE_DATA_KEY, strokeBounds } from '../../features/notes/ink/strokeModel';

/**
 * A note's handwriting as an SVG file, for the ZIP exports.
 *
 * @remarks
 * Roadmap wave 2, left: the Markdown exports said handwriting existed and drew
 * none of it. **Decided by agent 2026-11-21 (owner may revisit):** a sidecar
 * `.svg` beside the note in the ZIP, embedded with `![[…]]`, rather than inline
 * SVG in the Markdown, which most Markdown viewers strip. The single-file and
 * clipboard exports keep the text notice, since they have nowhere to put a
 * second file.
 *
 * Drawn the way `InkPad` draws: round caps and joins, the stroke's own width,
 * highlighter at 35% opacity, and the eraser as white paint over a white page.
 */

const escapeAttr = (value: string) => value.replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[c]!);

/**
 * Renders the ink page in a note's `typeData`, or `null` when it has none.
 *
 * @param typeData - The note's `typeData`.
 */
export function inkPageToSvg(typeData: unknown): string | null {
  if (!typeData || typeof typeData !== 'object') return null;
  const page = deserializeStrokePage((typeData as Record<string, unknown>)[INK_TYPE_DATA_KEY]);
  if (page.strokes.length === 0) return null;

  let maxX = 0;
  let maxY = page.pageHeight;
  for (const stroke of page.strokes) {
    const b = strokeBounds(stroke);
    maxX = Math.max(maxX, b.maxX + stroke.width);
    maxY = Math.max(maxY, b.maxY + stroke.width);
  }
  const width = Math.ceil(maxX);
  const height = Math.ceil(maxY);

  const paths = page.strokes.map((stroke) => {
    const [first, ...rest] = stroke.points;
    const d = [`M${first![0]} ${first![1]}`, ...rest.map(([x, y]) => `L${x} ${y}`)];
    // A single tap draws a dot, as on the pad.
    if (rest.length === 0) d.push(`L${first![0] + 0.01} ${first![1] + 0.01}`);
    const colour = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
    const opacity = stroke.tool === 'highlighter' ? ' stroke-opacity="0.35"' : '';
    return `<path d="${d.join(' ')}" fill="none" stroke="${escapeAttr(colour)}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round"${opacity}/>`;
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    ...paths,
    '</svg>',
    '',
  ].join('\n');
}
