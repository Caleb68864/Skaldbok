/**
 * Pure data model for handwritten ink strokes.
 *
 * @remarks
 * Everything here is plain JSON — no `Blob`, no `Map`, no class instances —
 * because a {@link StrokePage} is stored inside a Dexie record's `typeData`
 * and must round-trip through `bundle.ts` export/import unchanged.
 *
 * Points are stored as flat `[x, y, pressure]` tuples rather than `{x,y,p}`
 * objects: it serialises smaller and reads back as plain JSON with no
 * decoding step.
 */

/** A single sampled point along a stroke: `[x, y, pressure]`. */
export type StrokePoint = [x: number, y: number, pressure: number];

/** One continuous pen/eraser stroke. */
export interface Stroke {
  /** Flat tuple points describing the path of the stroke. Must have at least one point. */
  points: StrokePoint[];
  /** The tool used to draw this stroke. */
  tool: 'pen' | 'eraser' | 'highlighter';
  /** Stroke color, as a CSS color string. */
  color: string;
  /** Stroke width in page units. */
  width: number;
}

/** A page of ink strokes, persisted as a single unit. */
export interface StrokePage {
  /** Schema version of this page's shape, for forward-compatible migrations. */
  version: number;
  /** All strokes on this page, in drawing order. */
  strokes: Stroke[];
  /** Logical height of the page (page grows to fit content), in page units. */
  pageHeight: number;
}

/** Axis-aligned bounding box, in the same coordinate space as stroke points. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidPoint(value: unknown): value is StrokePoint {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    isFiniteNumber(value[2])
  );
}

const VALID_TOOLS: ReadonlySet<string> = new Set(['pen', 'eraser', 'highlighter']);

function isValidStroke(value: unknown): value is Stroke {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.points) || candidate.points.length === 0) return false;
  if (!candidate.points.every(isValidPoint)) return false;
  if (typeof candidate.tool !== 'string' || !VALID_TOOLS.has(candidate.tool)) return false;
  if (typeof candidate.color !== 'string') return false;
  if (!isFiniteNumber(candidate.width)) return false;
  return true;
}

/**
 * Serializes a {@link StrokePage} to a plain-JSON-safe value.
 *
 * @remarks
 * Strict: refuses to serialize a page containing a zero-point stroke, since
 * such a stroke cannot be rendered or bounded and indicates an upstream bug
 * (e.g. a pointerdown/pointerup pair with no intervening samples). Use
 * {@link deserializeStrokePage} to read back untrusted/legacy data — it is
 * permissive and drops malformed strokes instead of throwing.
 *
 * @throws {Error} If any stroke has zero points.
 */
export function serializeStrokePage(page: StrokePage): StrokePage {
  for (const stroke of page.strokes) {
    if (!stroke.points || stroke.points.length === 0) {
      throw new Error('serializeStrokePage: cannot serialize a stroke with zero points');
    }
  }
  // Plain-object round-trip guarantees no non-JSON values (Map, Blob, class
  // instances) have snuck into the structure before it is handed to Dexie.
  return JSON.parse(JSON.stringify(page)) as StrokePage;
}

/**
 * Deserializes a raw value into a {@link StrokePage}, tolerating corruption.
 *
 * @remarks
 * Permissive: malformed strokes (missing points, unknown tool, non-finite
 * coordinates, etc.) are dropped silently and their well-formed siblings are
 * kept. Never throws — a corrupted ink page degrades to "fewer strokes",
 * never to "note fails to load".
 *
 * @param raw - Untrusted value, typically read from Dexie's `typeData`.
 * @returns A valid {@link StrokePage}; an empty page if `raw` is unusable.
 */
export function deserializeStrokePage(raw: unknown): StrokePage {
  if (raw === null || typeof raw !== 'object') {
    return { version: 1, strokes: [], pageHeight: 0 };
  }
  const candidate = raw as Record<string, unknown>;
  const version = isFiniteNumber(candidate.version) ? candidate.version : 1;
  const pageHeight = isFiniteNumber(candidate.pageHeight) ? candidate.pageHeight : 0;
  const rawStrokes = Array.isArray(candidate.strokes) ? candidate.strokes : [];
  const strokes: Stroke[] = rawStrokes.filter(isValidStroke).map((s) => ({
    points: s.points.map((p) => [...p] as StrokePoint),
    tool: s.tool,
    color: s.color,
    width: s.width,
  }));
  return { version, strokes, pageHeight };
}

/**
 * Computes the axis-aligned bounding box of a single stroke.
 *
 * @remarks
 * Used by SS-05 to determine which render tiles a stroke touches for
 * invalidation. A stroke with no points has no meaningful bounds.
 *
 * @throws {Error} If the stroke has zero points.
 */
export function strokeBounds(stroke: Stroke): Bounds {
  if (!stroke.points || stroke.points.length === 0) {
    throw new Error('strokeBounds: cannot compute bounds of a stroke with zero points');
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of stroke.points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}
