import { db } from '../db/client';
import type { ReferenceGroup, ReferenceSection } from '../../types/reference';
import { parseReferenceBundle } from '../../utils/import/referenceBundleParser';
import type { ValidationWarning } from '../../utils/import/bundleParser';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { excludeDeleted, onlyDeleted } from '../../utils/softDelete';

/** Every user-owned reference section, sorted by explicit order then category then title. */
export async function getAll(options?: { includeDeleted?: boolean }): Promise<ReferenceSection[]> {
  const all = await db.referenceSections.toArray();
  const rows = options?.includeDeleted ? all : excludeDeleted(all);
  return rows.sort((a, b) => a.order - b.order || a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

/** The reorderable grouping cards for reference sections, sorted by order then title. */
export async function getGroups(options?: { includeDeleted?: boolean }): Promise<ReferenceGroup[]> {
  const all = await db.referenceGroups.toArray();
  const rows = options?.includeDeleted ? all : excludeDeleted(all);
  return rows.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** Upserts one grouping card, mapping a storage-quota failure to a user-friendly message. */
export async function saveGroup(group: ReferenceGroup): Promise<void> {
  try {
    await db.referenceGroups.put(group);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.', { cause: err });
    }
    throw new Error(`Failed to save reference card: ${String(err)}`, { cause: err });
  }
}

/**
 * Soft-deletes a grouping card, cascading to the sections it holds.
 *
 * @remarks
 * These two tables were the last hard-deleting ones in the app, having been
 * added after the soft-delete convention. Both rows and their sections share one
 * `softDeletedBy` id so {@link restoreGroup} can bring the card back intact.
 *
 * @param id - Group to soft-delete.
 */
export async function removeGroup(id: string): Promise<void> {
  try {
    const txId = generateId();
    const now = nowISO();
    await db.transaction('rw', [db.referenceGroups, db.referenceSections], async () => {
      await db.referenceGroups.update(id, { deletedAt: now, softDeletedBy: txId });
      const held = await db.referenceSections.where('groupId').equals(id).toArray();
      await db.referenceSections.bulkUpdate(
        held
          .filter(section => !section.deletedAt)
          .map(section => ({ key: section.id, changes: { deletedAt: now, softDeletedBy: txId } })),
      );
    });
  } catch (err) {
    throw new Error(`Failed to delete reference card: ${String(err)}`, { cause: err });
  }
}

/**
 * Restores a soft-deleted grouping card and everything deleted with it.
 *
 * @param id - Group to restore.
 */
export async function restoreGroup(id: string): Promise<void> {
  try {
    await db.transaction('rw', [db.referenceGroups, db.referenceSections], async () => {
      const group = await db.referenceGroups.get(id);
      if (!group?.softDeletedBy) {
        await db.referenceGroups.update(id, { deletedAt: undefined, softDeletedBy: undefined });
        return;
      }
      const txId = group.softDeletedBy;
      await db.referenceGroups.update(id, { deletedAt: undefined, softDeletedBy: undefined });
      const cascaded = await db.referenceSections.where('softDeletedBy').equals(txId).toArray();
      await db.referenceSections.bulkUpdate(
        cascaded.map(section => ({
          key: section.id,
          changes: { deletedAt: undefined, softDeletedBy: undefined },
        })),
      );
    });
  } catch (err) {
    throw new Error(`Failed to restore reference card: ${String(err)}`, { cause: err });
  }
}

/**
 * Creates any grouping cards missing for the given sections' categories.
 *
 * @remarks
 * Every section belongs to a category, and each distinct category needs a card
 * to live under. New cards are appended after the existing ones (order preserved)
 * so this can be called after an import without disturbing the user's layout.
 * Returns the full, sorted set of groups.
 */
export async function ensureGroupsForSections(sections: ReferenceSection[]): Promise<ReferenceGroup[]> {
  const existing = await getGroups();
  const existingTitles = new Set(existing.map(group => group.title));
  const missingTitles = Array.from(new Set(sections.map(section => section.category || 'General')))
    .filter(title => !existingTitles.has(title));
  if (missingTitles.length === 0) return existing;

  const now = nowISO();
  const start = existing.length;
  const groups = missingTitles.map((title, index): ReferenceGroup => ({
    id: generateId(),
    title,
    order: start + index,
    createdAt: now,
    updatedAt: now,
  }));
  await db.referenceGroups.bulkPut(groups);
  return [...existing, ...groups].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** Upserts one reference section, mapping a storage-quota failure to a user-friendly message. */
export async function save(section: ReferenceSection): Promise<void> {
  try {
    await db.referenceSections.put(section);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.', { cause: err });
    }
    throw new Error(`Failed to save reference section: ${String(err)}`, { cause: err });
  }
}

/** Soft-deletes a reference section by id. */
export async function remove(id: string): Promise<void> {
  try {
    await db.referenceSections.update(id, { deletedAt: nowISO(), softDeletedBy: generateId() });
  } catch (err) {
    throw new Error(`Failed to delete reference section: ${String(err)}`, { cause: err });
  }
}

/** Restores a soft-deleted reference section. */
export async function restore(id: string): Promise<void> {
  try {
    await db.referenceSections.update(id, { deletedAt: undefined, softDeletedBy: undefined });
  } catch (err) {
    throw new Error(`Failed to restore reference section: ${String(err)}`, { cause: err });
  }
}

/**
 * Every soft-deleted reference section, newest deletion first.
 *
 * @remarks
 * The reference library is campaign-independent — it is the user's own house
 * rules, shared across every campaign — so this listing is global, like
 * `characterRepository.getDeleted`, rather than campaign-scoped.
 *
 * A section deleted on its own is restored on its own. A section that went down
 * with its card is restored by {@link restoreGroup}, which matches on the
 * cascade id; restoring one of those individually is still correct, it just
 * brings back one section rather than the set.
 */
export async function getDeleted(): Promise<ReferenceSection[]> {
  try {
    return onlyDeleted(await db.referenceSections.toArray());
  } catch (err) {
    throw new Error(`Failed to list deleted reference sections: ${String(err)}`, { cause: err });
  }
}

/**
 * Every soft-deleted reference card, newest deletion first.
 *
 * @remarks
 * Restoring one of these goes through {@link restoreGroup}, which brings back
 * every section that went down with the card in the same cascade. That path
 * queries `referenceSections.softDeletedBy`, an index that only became legal at
 * schema v19 — until the Trash listed cards, nothing had ever called it.
 */
export async function getDeletedGroups(): Promise<ReferenceGroup[]> {
  try {
    return onlyDeleted(await db.referenceGroups.toArray());
  } catch (err) {
    throw new Error(`Failed to list deleted reference cards: ${String(err)}`, { cause: err });
  }
}

/**
 * What an import actually did: how many sections landed, and what was dropped.
 */
export interface ReferenceImportResult {
  /** Sections written. */
  imported: number;
  /** One entry per row rejected by validation; empty on a clean import. */
  skipped: ValidationWarning[];
  /**
   * One entry per row whose id already belonged to something local.
   *
   * @remarks
   * Separate from {@link skipped} because the two need different words on
   * screen: a skipped row was malformed and the user can fix the file, while a
   * collision means the local row was *kept* and the import deliberately did
   * less than it was asked to. Reporting them together is how a restore that
   * quietly replaced the user's own house rules could still read as a clean
   * import.
   */
  collisions: ValidationWarning[];
}

/** Why an incoming row may not be written over the local row sharing its id. */
type CollisionKind = 'deleted' | 'different-entity';

/**
 * Whether an incoming row may overwrite the local row sharing its id.
 *
 * @remarks
 * The rules are `mergeEngine.mergeEntity`'s, not new ones. `createdAt` is
 * immutable, so same-id-different-`createdAt` is two entities that happen to
 * share an id rather than one entity edited; a *missing* `createdAt` counts as
 * different because the engine's own comment records that requiring both to be
 * present let "a bundle row with no `createdAt` and a far-future `updatedAt`"
 * overwrite the local row — the one shape a hand-edited bundle actually has. A
 * tombstoned local row is a collision too: overwriting one resurrects a record
 * the user deleted, under whatever content the bundle carries.
 *
 * @param local - The stored row sharing the id, if there is one.
 * @param incomingCreatedAt - The bundle row's own `createdAt`, before synthesis.
 * @returns `null` when the write is safe, else why it is not.
 */
function collisionKind(
  local: { createdAt?: string; deletedAt?: string } | undefined,
  incomingCreatedAt: string | undefined,
): CollisionKind | null {
  if (local === undefined) return null;
  if (local.deletedAt) return 'deleted';
  if (
    incomingCreatedAt === undefined
    || local.createdAt === undefined
    || incomingCreatedAt !== local.createdAt
  ) {
    return 'different-entity';
  }
  return null;
}

/**
 * Imports a reference bundle, creating the sections and the grouping cards they
 * need in one transaction.
 *
 * @remarks
 * Takes `unknown` and validates it here rather than trusting a cast at the call
 * site. This was the last unvalidated JSON path in the app: the screen did
 * `JSON.parse(text) as ReferenceImportBundle` and handed it straight to the
 * `bulkPut` below. A section whose `rows` was a string, or whose `items` held
 * numbers where the renderer reads `label`, persisted and then crashed the
 * Reference screen on every later visit — and since the write is keyed by `id`,
 * a malformed row could land on top of a section that had been fine.
 *
 * Still tolerant of *partial* input, which is the point of the format: missing
 * ids, orders, categories and timestamps are synthesised so a hand-authored
 * bundle imports cleanly. A `referencePages` entry, if present, supplies the
 * category and ordering for its listed sections. What is no longer tolerated is
 * a field of the wrong type — that row is dropped and reported.
 *
 * Nor is a row that lands on top of a local one. This path used to `bulkPut`
 * both tables straight in, so an imported section replaced a locally-authored
 * section sharing its id and could resurrect a soft-deleted one — on the
 * restore path, a silent overwrite of the user's own house rules that still
 * reported "Imported 3 reference sections". The policy is
 * `mergeEngine.mergeEntity`'s rather than a new one (see {@link collisionKind}):
 * same `createdAt` is the same row and is written, anything else keeps the
 * local row and is reported. That does mean re-importing an *undated*
 * hand-authored file no longer overwrites what is already there — which is the
 * point, since that is exactly the file that cannot say whether its rows are
 * the local ones or someone else's.
 *
 * Cards differ from sections in one respect: a card's id is already
 * synthesisable by this format (`raw?.id ?? generateId()`), while a section's
 * content is the thing being imported. So a colliding card is re-keyed rather
 * than dropped, and the sections that named its title land under a card of that
 * title instead of being filed into an unrelated local one.
 *
 * @param bundle - The parsed JSON of an import file, unvalidated.
 * @throws If the file is not a reference bundle at all.
 * @returns What was imported, what was rejected, and what was kept local.
 */
export async function importBundle(bundle: unknown): Promise<ReferenceImportResult> {
  const parsed = parseReferenceBundle(bundle);
  if (!parsed.success) throw new Error(parsed.error);
  const validated = parsed.bundle;
  const now = nowISO();
  const pageOrder = new Map<string, { category: string; order: number }>();

  for (const page of validated.referencePages ?? []) {
    page.sections.forEach((sectionId, index) => {
      pageOrder.set(sectionId, { category: page.title, order: index });
    });
  }

  const sections = (validated.referenceSections ?? []).map((raw, index): ReferenceSection => {
    const id = raw.id ?? generateId();
    const page = pageOrder.get(id);
    return {
      id,
      title: raw.title ?? 'Untitled Reference',
      category: raw.category ?? page?.category ?? 'Imported',
      order: Number.isFinite(raw.order) ? Number(raw.order) : page?.order ?? index,
      pg: raw.pg,
      type: raw.type ?? 'rules_text',
      columns: raw.columns,
      rows: raw.rows,
      items: raw.items,
      paragraphs: raw.paragraphs,
      footnote: raw.footnote,
      createdAt: raw.createdAt ?? now,
      updatedAt: now,
    };
  });

  // The bundle's own `createdAt` per section, before the synthesis above
  // replaces a missing one with `now`. The collision check needs the raw value:
  // a row the bundle never dated must not read as "created at the same instant
  // as the local row" and sail through.
  const sectionCreatedAt = (validated.referenceSections ?? []).map(raw => raw.createdAt);

  const groupTitles = new Set<string>();
  for (const group of validated.referenceGroups ?? []) {
    if (group.title) groupTitles.add(group.title);
  }
  for (const section of sections) {
    groupTitles.add(section.category || 'General');
  }

  const groups = Array.from(groupTitles).map((title, index): ReferenceGroup & { rawCreatedAt?: string } => {
    const raw = validated.referenceGroups?.find(group => group.title === title);
    return {
      id: raw?.id ?? generateId(),
      title,
      order: Number.isFinite(raw?.order) ? Number(raw?.order) : index,
      createdAt: raw?.createdAt ?? now,
      updatedAt: now,
      // Kept alongside the synthesised value so the collision check can tell
      // "the bundle dated this row" from "we dated it just now". Stripped
      // before the write.
      rawCreatedAt: raw?.createdAt,
    };
  });

  const collisions: ValidationWarning[] = [];
  let imported = 0;

  await db.transaction('rw', [db.referenceSections, db.referenceGroups], async () => {
    // Cards first, because a card that has to be re-keyed changes which id the
    // sections below bind to.
    const localGroups = await db.referenceGroups.bulkGet(groups.map(group => group.id));
    const resolvedGroups = groups.map(({ rawCreatedAt, ...group }, index): ReferenceGroup => {
      const kind = collisionKind(localGroups[index], rawCreatedAt);
      if (kind === null) return group;
      const rekeyed = generateId();
      collisions.push({
        entityType: 'referenceGroup',
        entityIndex: index,
        path: 'id',
        message: kind === 'deleted'
          ? `Id "${group.id}" belongs to a deleted local card; imported "${group.title}" as a new card rather than resurrecting it.`
          : `Id "${group.id}" already belongs to a different local card; imported "${group.title}" as a new card rather than overwriting it.`,
      });
      return { ...group, id: rekeyed };
    });

    // Bind each imported section to its card by id. Title is the only key a
    // bundle carries, so matching on it here is right — but leaving it at that
    // wrote sections with no `groupId`, which has been the authoritative join
    // since v14. They rendered only through the legacy category fallback, and
    // renaming the card they arrived in stranded them.
    const groupIdByTitle = new Map(resolvedGroups.map(group => [group.title, group.id]));
    const boundSections = sections.map(section => ({
      ...section,
      groupId: groupIdByTitle.get(section.category || 'General') ?? section.groupId,
    }));

    const localSections = await db.referenceSections.bulkGet(boundSections.map(section => section.id));
    const toWrite: ReferenceSection[] = [];
    boundSections.forEach((section, index) => {
      const kind = collisionKind(localSections[index], sectionCreatedAt[index]);
      if (kind === null) {
        toWrite.push(section);
        return;
      }
      collisions.push({
        entityType: 'referenceSection',
        entityIndex: index,
        path: 'id',
        message: kind === 'deleted'
          ? `Id "${section.id}" belongs to a reference section you deleted; kept the deletion rather than restoring "${section.title}" over it.`
          : `Id "${section.id}" already belongs to a different local reference section; kept yours rather than overwriting it with "${section.title}".`,
      });
    });

    await db.referenceGroups.bulkPut(resolvedGroups);
    await db.referenceSections.bulkPut(toWrite);
    imported = toWrite.length;
  });
  return { imported, skipped: parsed.warnings, collisions };
}

/**
 * Persists a reordered layout, rewriting group `order` from array position.
 *
 * @remarks
 * Called after a drag-and-drop reorder. Group order is derived from the passed
 * array index so the stored order always matches what the user sees; every
 * touched row's `updatedAt` is refreshed in the same transaction.
 */
export async function saveLayout(groups: ReferenceGroup[], sections: ReferenceSection[]): Promise<void> {
  const now = nowISO();
  await db.transaction('rw', [db.referenceSections, db.referenceGroups], async () => {
    await db.referenceGroups.bulkPut(groups.map((group, index) => ({ ...group, order: index, updatedAt: now })));
    await db.referenceSections.bulkPut(sections.map(section => ({ ...section, updatedAt: now })));
  });
}
