import { db } from '../db/client';
import type { ReferenceGroup, ReferenceImportBundle, ReferenceSection } from '../../types/reference';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

/** Every user-owned reference section, sorted by explicit order then category then title. */
export async function getAll(): Promise<ReferenceSection[]> {
  const rows = await db.referenceSections.toArray();
  return rows.sort((a, b) => a.order - b.order || a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

/** The reorderable grouping cards for reference sections, sorted by order then title. */
export async function getGroups(): Promise<ReferenceGroup[]> {
  const rows = await db.referenceGroups.toArray();
  return rows.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** Upserts one grouping card, mapping a storage-quota failure to a user-friendly message. */
export async function saveGroup(group: ReferenceGroup): Promise<void> {
  try {
    await db.referenceGroups.put(group);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to save reference card: ${String(err)}`);
  }
}

/** Deletes a grouping card by id. */
export async function removeGroup(id: string): Promise<void> {
  try {
    await db.referenceGroups.delete(id);
  } catch (err) {
    throw new Error(`Failed to delete reference card: ${String(err)}`);
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
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to save reference section: ${String(err)}`);
  }
}

/** Deletes a reference section by id. */
export async function remove(id: string): Promise<void> {
  try {
    await db.referenceSections.delete(id);
  } catch (err) {
    throw new Error(`Failed to delete reference section: ${String(err)}`);
  }
}

/**
 * Imports a reference bundle, creating the sections and the grouping cards they
 * need in one transaction.
 *
 * @remarks
 * Tolerant of partial input: missing ids, orders, categories, and timestamps are
 * synthesised so a hand-authored or third-party bundle still imports cleanly.
 * A `referencePages` entry, if present, supplies the category and ordering for
 * its listed sections.
 *
 * @returns The number of sections imported.
 */
export async function importBundle(bundle: ReferenceImportBundle): Promise<number> {
  const now = nowISO();
  const pageOrder = new Map<string, { category: string; order: number }>();

  for (const page of bundle.referencePages ?? []) {
    page.sections.forEach((sectionId, index) => {
      pageOrder.set(sectionId, { category: page.title, order: index });
    });
  }

  const sections = (bundle.referenceSections ?? []).map((raw, index): ReferenceSection => {
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

  const groupTitles = new Set<string>();
  for (const group of bundle.referenceGroups ?? []) {
    if (group.title) groupTitles.add(group.title);
  }
  for (const section of sections) {
    groupTitles.add(section.category || 'General');
  }

  const groups = Array.from(groupTitles).map((title, index): ReferenceGroup => {
    const raw = bundle.referenceGroups?.find(group => group.title === title);
    return {
      id: raw?.id ?? generateId(),
      title,
      order: Number.isFinite(raw?.order) ? Number(raw?.order) : index,
      createdAt: raw?.createdAt ?? now,
      updatedAt: now,
    };
  });

  await db.transaction('rw', [db.referenceSections, db.referenceGroups], async () => {
    await db.referenceGroups.bulkPut(groups);
    await db.referenceSections.bulkPut(sections);
  });
  return sections.length;
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
