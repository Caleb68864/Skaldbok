import { db } from '../db/client';
import type { ReferenceGroup, ReferenceImportBundle, ReferenceSection } from '../../types/reference';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

export async function getAll(): Promise<ReferenceSection[]> {
  const rows = await db.referenceSections.toArray();
  return rows.sort((a, b) => a.order - b.order || a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

export async function getGroups(): Promise<ReferenceGroup[]> {
  const rows = await db.referenceGroups.toArray();
  return rows.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

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

export async function removeGroup(id: string): Promise<void> {
  try {
    await db.referenceGroups.delete(id);
  } catch (err) {
    throw new Error(`Failed to delete reference card: ${String(err)}`);
  }
}

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

export async function remove(id: string): Promise<void> {
  try {
    await db.referenceSections.delete(id);
  } catch (err) {
    throw new Error(`Failed to delete reference section: ${String(err)}`);
  }
}

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

export async function saveLayout(groups: ReferenceGroup[], sections: ReferenceSection[]): Promise<void> {
  const now = nowISO();
  await db.transaction('rw', [db.referenceSections, db.referenceGroups], async () => {
    await db.referenceGroups.bulkPut(groups.map((group, index) => ({ ...group, order: index, updatedAt: now })));
    await db.referenceSections.bulkPut(sections.map(section => ({ ...section, updatedAt: now })));
  });
}
