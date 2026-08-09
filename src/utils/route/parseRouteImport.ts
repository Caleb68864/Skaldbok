import type { RouteFieldSpec } from '../export/renderRoute';

/**
 * Parsing for route JSON pasted or exported from somewhere else — typically a
 * route planned in a chat with an AI and handed over as a file.
 *
 * @remarks
 * Deliberately forgiving about *shape* and strict about *fields*. Whatever
 * produced the file will not have read `routePlanner`, so it may wrap the stops
 * in an object or hand over a bare array, and it may use `Jump` where the
 * declaration says `jump`. None of that is worth rejecting a file over.
 *
 * What it will not do is invent fields. A key that matches no declared field is
 * dropped and **reported** — silently keeping it would put data in the record
 * that no screen renders and no export prints, which is worse than losing it
 * visibly.
 */

/** One stop as it will be created. `values` is keyed by declared field id. */
export interface ParsedRouteStop {
  name: string;
  values: Record<string, string>;
}

/** Outcome of parsing an import file. */
export type RouteImportResult =
  | { ok: true; stops: ParsedRouteStop[]; warnings: string[] }
  | { ok: false; error: string };

/** Pulls the stop array out of the shapes a generator plausibly produces. */
function findStopArray(root: unknown): unknown[] | null {
  if (Array.isArray(root)) return root;
  if (root && typeof root === 'object') {
    const obj = root as Record<string, unknown>;
    for (const key of ['stops', 'route', 'worlds', 'legs', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return null;
}

/** Normalises a key for matching: case- and separator-insensitive. */
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

/** Renders an imported value as the string the record stores. */
function asStoredString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return null;
}

/**
 * Parses route JSON against a system's declared fields.
 *
 * @param text - Raw file contents.
 * @param fields - `routePlanner.fields` for the active ruleset. Every key in the
 * file must match one of these (by id or label, loosely) or it is dropped.
 * @param maxStops - Guard against a runaway file; the default is far above any
 * plausible route and exists so a malformed 100k-element array cannot lock the
 * UI while it renders.
 */
export function parseRouteImport(
  text: string,
  fields: RouteFieldSpec[],
  maxStops = 500,
): RouteImportResult {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  const rawStops = findStopArray(root);
  if (!rawStops) {
    return {
      ok: false,
      error:
        'Could not find a list of stops. Expected a JSON array, or an object with a "stops" array.',
    };
  }
  if (rawStops.length === 0) {
    return { ok: false, error: 'That file has no stops in it.' };
  }
  if (rawStops.length > maxStops) {
    return { ok: false, error: `That file has ${rawStops.length} stops — more than ${maxStops}.` };
  }

  // Match on both id and label so a file written from the printed export ("UWP")
  // lands as readily as one written from the declaration ("uwp").
  const byKey = new Map<string, string>();
  for (const field of fields) {
    byKey.set(normaliseKey(field.id), field.id);
    byKey.set(normaliseKey(field.label), field.id);
  }

  const stops: ParsedRouteStop[] = [];
  const warnings: string[] = [];
  const unknownKeys = new Set<string>();
  let skipped = 0;

  rawStops.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      skipped += 1;
      return;
    }
    const entry = raw as Record<string, unknown>;
    const values: Record<string, string> = {};
    let name = '';

    for (const [key, value] of Object.entries(entry)) {
      const fieldId = byKey.get(normaliseKey(key));
      if (!fieldId) {
        unknownKeys.add(key);
        continue;
      }
      const stored = asStoredString(value);
      if (stored === null || stored === '') continue;
      if (fieldId === 'name') name = stored;
      else values[fieldId] = stored;
    }

    if (name === '') {
      // A stop with no name is unplaceable — the list and the export are both
      // keyed on it. Reported by position so it can be found in the file.
      skipped += 1;
      warnings.push(`Stop ${index + 1} has no name and was skipped.`);
      return;
    }
    stops.push({ name, values });
  });

  if (stops.length === 0) {
    return { ok: false, error: 'None of the stops in that file had a name.' };
  }
  if (unknownKeys.size > 0) {
    warnings.push(
      `Ignored ${unknownKeys.size} unrecognised field${unknownKeys.size === 1 ? '' : 's'}: ${[...unknownKeys].join(', ')}.`,
    );
  }
  if (skipped > 0 && !warnings.some(w => w.includes('no name'))) {
    warnings.push(`${skipped} entr${skipped === 1 ? 'y was' : 'ies were'} not readable and were skipped.`);
  }

  return { ok: true, stops, warnings };
}
