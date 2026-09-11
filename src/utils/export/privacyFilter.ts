import type { BundleContents } from '../../types/bundle';

/**
 * The entity type string an `entityLinks` row uses for a note endpoint.
 *
 * @remarks
 * The one type name this module spells. It is not a ruleset id — it is the
 * `fromEntityType` / `toEntityType` vocabulary listed at the top of
 * `entityLinkRepository.ts` — and it is used only to *narrow* an exclusion, so
 * getting it wrong over-filters rather than leaks.
 */
const NOTE_ENTITY_TYPE = 'note';

/**
 * Every private note id in a set of bundle contents.
 *
 * @remarks
 * Absent or `'public'` visibility is retained: a note written before the field
 * existed is legacy, not confidential, and treating it as private would gut
 * every old campaign's export.
 */
export function privateNoteIdsIn(contents: BundleContents): Set<string> {
  return new Set(
    (contents.notes ?? [])
      .filter((note) => note.visibility === 'private')
      .map((note) => note.id),
  );
}

/**
 * Removes private notes and everything that carries them from bundle contents.
 *
 * @remarks
 * This is a pure function with no side effects, no async calls, and no database
 * access. It returns a new `BundleContents` object — the input is never mutated.
 *
 * **Why this is not a list of tables.** It used to be. It spread `...contents`
 * and replaced exactly three keys — `notes`, `entityLinks`, `attachments` — so
 * every table added to the bundle after it was written was outside the
 * confidentiality boundary by default. `kbNodes` and `kbEdges` joined the bundle
 * later, and `kb_nodes` is a projection of a note: its `label` **is** the note's
 * title and its `sourceId` **is** the note's id, with one row per note and one
 * `kb_edges` row per wiki-link, mention and tag the note carries. So a campaign
 * bundle the user was told excluded a private note shipped that note's title and
 * its entire edge set — enough to reconstruct who a character secretly is or
 * which faction a location belongs to. Only the body was actually withheld.
 *
 * That is the same shape this repository has now hit five times: a rule enforced
 * at one of several exits. The export omitted 12 of 26 tables, then `represents`
 * edges, then reference notes, then rulesets — each at a different exit, each
 * fixed by deriving instead of enumerating. So this derives too.
 *
 * **The rule.** Seed an excluded-id set with the private note ids, then repeat
 * until it stops growing: a row anywhere in the bundle is excluded when its own
 * `id` is excluded, or when any of its own string-valued properties holds an
 * excluded id. An excluded row's `id` joins the set, so exclusion follows the
 * references outward — note → its `kb_nodes` projection (`sourceId`) → the
 * `kb_edges` on that node (`fromId`/`toId`) — without this module naming a
 * single table.
 *
 * **The one narrowing.** A property named `<x>Id` whose row also carries
 * `<x>Type` is a typed reference, and a typed reference to something that is not
 * a note does not match. That is what keeps a `character` endpoint that happens
 * to share an id with a note from being deleted — the over-filtering half of the
 * same mistake. `id` itself is exempt from the narrowing, because a row's
 * sibling `type` field describes the row, not a reference (a note's `type` is
 * `'npc'`, not `'note'`).
 *
 * Over-capture beyond that is bounded by ids being UUIDs (`utils/ids.ts`): a
 * top-level field holding a private note's id is a reference to that note.
 *
 * @param contents - The collected bundle contents to filter.
 * @param includePrivate - If `true`, all notes are retained regardless of visibility.
 * @returns A new `BundleContents` with private notes and everything carrying them removed.
 */
export function applyPrivacyFilter(
  contents: BundleContents,
  includePrivate: boolean,
): BundleContents {
  if (includePrivate) return contents;

  const excluded = new Map<string, string | null>();
  for (const id of privateNoteIdsIn(contents)) excluded.set(id, NOTE_ENTITY_TYPE);
  if (excluded.size === 0) return contents;

  const collections = bundleCollections(contents);

  // Fixpoint: each pass may exclude rows whose ids let the next pass exclude
  // more (a note excludes its kb node, whose id excludes the kb edges on it).
  const dropped = new Set<object>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [, rows] of collections) {
      for (const row of rows) {
        if (dropped.has(row)) continue;
        if (!referencesExcluded(row, excluded)) continue;
        dropped.add(row);
        const id = row.id;
        // `null` rather than a type name: nothing type-tags a reference to a
        // kb node or an attachment, so any field holding this id matches.
        if (typeof id === 'string' && !excluded.has(id)) excluded.set(id, null);
        grew = true;
      }
    }
  }

  if (dropped.size === 0) return contents;

  const result = { ...contents } as Record<string, unknown>;
  for (const [key, rows] of collections) {
    if (!rows.some((row) => dropped.has(row))) continue;
    // Filtered off the original array, not off `rows`: a non-object entry is
    // not a row this filter can reason about, and must not be removed by one.
    const original = (contents as unknown as Record<string, unknown[]>)[key];
    result[key] = original.filter((row) => !dropped.has(row as object));
  }
  return result as BundleContents;
}

/**
 * Every array-of-rows key in a set of bundle contents, with its rows.
 *
 * @remarks
 * Read off the object rather than from `BUNDLE_TABLE_ENTRIES`, so a key present
 * in the contents but missing from the registry is still filtered. The registry
 * is the right source for "what must an export carry"; for "what must privacy
 * reach", the safe answer is whatever is actually here.
 *
 * `campaign` is a single object, not an array, and is skipped: a campaign row
 * cannot be a note and cannot reference one.
 */
function bundleCollections(
  contents: BundleContents,
): Array<[string, Record<string, unknown>[]]> {
  const out: Array<[string, Record<string, unknown>[]]> = [];
  for (const [key, value] of Object.entries(contents)) {
    if (!Array.isArray(value)) continue;
    out.push([
      key,
      value.filter(
        (row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
      ),
    ]);
  }
  return out;
}

/**
 * Whether a row is the thing an excluded id names, or points at one.
 *
 * @param row - A bundle row.
 * @param excluded - Excluded id → the entity type that id names, or `null` for "any".
 */
function referencesExcluded(
  row: Record<string, unknown>,
  excluded: ReadonlyMap<string, string | null>,
): boolean {
  for (const [key, value] of Object.entries(row)) {
    if (typeof value !== 'string') continue;
    if (!excluded.has(value)) continue;
    // The row *is* the excluded entity. A sibling `type` describes the row, not
    // a reference, so the narrowing below must not be applied here.
    if (key === 'id') return true;
    const declaredType = excluded.get(value) ?? null;
    if (declaredType !== null) {
      const typeKey = key.endsWith('Id') ? `${key.slice(0, -2)}Type` : null;
      if (typeKey !== null && typeKey in row && row[typeKey] !== declaredType) continue;
    }
    return true;
  }
  return false;
}

/**
 * Every place a private note id still appears in a serialized bundle.
 *
 * @remarks
 * The assertion half of the boundary, and the reason it is stated over the
 * finished artefact rather than inside a collector. {@link applyPrivacyFilter}
 * removes rows; this checks the *file that leaves the device*, after
 * serialization, after base64, after every transform. Nothing about it knows
 * which tables exist, so a table, a nested id or a shape nobody anticipated is
 * covered the day it appears.
 *
 * Ids only, deliberately. A private note's *title* can legitimately occur in a
 * public note's body — the user typed it there — and refusing to export that
 * would be the over-filtering failure wearing the shape of the fix. Ids are
 * UUIDs; one appearing at all is a carried reference, never a coincidence.
 *
 * @param json - The serialized bundle.
 * @param privateNoteIds - Ids of the notes the export promised to exclude.
 * @returns The ids still present, in the order given; empty when the bundle is clean.
 */
export function privateResidueIn(json: string, privateNoteIds: ReadonlySet<string>): string[] {
  const found: string[] = [];
  for (const id of privateNoteIds) {
    if (id.length > 0 && json.includes(id)) found.push(id);
  }
  return found;
}

/**
 * Thrown when a bundle would have left the device still carrying a private note.
 *
 * @remarks
 * Fails closed: the export is abandoned rather than delivered. A user who marked
 * a note private and was told the export excludes it is better served by an
 * export that did not happen than by one that quietly did not keep the promise.
 */
export class PrivacyLeakError extends Error {
  constructor(public readonly leakedNoteIds: string[]) {
    super(
      `Export blocked: ${leakedNoteIds.length} private note(s) are still referenced by the bundle `
      + `(${leakedNoteIds.join(', ')}). Nothing was written.`,
    );
    this.name = 'PrivacyLeakError';
  }
}

/**
 * Drops notes explicitly marked `visibility: 'private'`.
 *
 * @remarks
 * The Markdown / ZIP export paths do not build a `BundleContents`, so they
 * cannot use {@link applyPrivacyFilter}. They had no filtering at all, which
 * meant `exportAllNotes`, `exportSessionMarkdown` and `exportSessionBundle`
 * rendered private notes verbatim into files whose whole purpose is sharing —
 * while the JSON bundle paths beside them filtered correctly.
 *
 * Absent or `'public'` visibility is retained, matching {@link applyPrivacyFilter}:
 * only an explicit `'private'` is excluded.
 */
export function excludePrivateNotes<T extends { visibility?: string }>(
  notes: T[],
  includePrivate = false,
): T[] {
  if (includePrivate) return notes;
  return notes.filter((note) => note.visibility !== 'private');
}
