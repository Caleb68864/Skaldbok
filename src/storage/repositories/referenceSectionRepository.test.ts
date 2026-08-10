// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/client';
import { importBundle, ensureGroupsForSections, getGroups } from './referenceSectionRepository';

/**
 * Covers the import path's binding of sections to their grouping card.
 *
 * @remarks
 * `groupId` has been the authoritative join since schema v14, but the importer
 * kept writing sections without one — they rendered only through the legacy
 * category fallback, and renaming the card they arrived in stranded them.
 */

beforeEach(async () => {
  await db.referenceSections.clear();
  await db.referenceGroups.clear();
});

describe('importBundle', () => {
  it('binds every imported section to its card by id', async () => {
    const count = await importBundle({
      referenceGroups: [{ id: 'g-combat', title: 'Combat', order: 0 }],
      referenceSections: [
        { id: 's1', title: 'Initiative', category: 'Combat', order: 0, type: 'rules_text' },
        { id: 's2', title: 'Cover', category: 'Combat', order: 1, type: 'rules_text' },
      ],
    });
    expect(count).toBe(2);
    const stored = await db.referenceSections.toArray();
    expect(stored.map(s => s.groupId)).toEqual(['g-combat', 'g-combat']);
  });

  it('binds a section whose card the bundle never declared', async () => {
    // The card is synthesised from the section's own category; the section must
    // still come out joined to it rather than relying on the label.
    await importBundle({
      referenceSections: [
        { id: 's1', title: 'Travel', category: 'Overland', order: 0, type: 'rules_text' },
      ],
    });
    const [section] = await db.referenceSections.toArray();
    const [group] = await db.referenceGroups.toArray();
    expect(section.groupId).toBe(group.id);
    expect(group.title).toBe('Overland');
  });

  it('files a section with no category under a card named Imported', async () => {
    await importBundle({ referenceSections: [{ id: 's1', title: 'Loose', type: 'rules_text' }] });
    const [section] = await db.referenceSections.toArray();
    const groups = await db.referenceGroups.toArray();
    expect(section.category).toBe('Imported');
    expect(section.groupId).toBe(groups.find(g => g.title === 'Imported')?.id);
  });

  it('takes the category and order from a referencePages entry', async () => {
    await importBundle({
      referencePages: [{ title: 'Combat', sections: ['s2', 's1'] }],
      referenceSections: [
        { id: 's1', title: 'Cover', type: 'rules_text' },
        { id: 's2', title: 'Initiative', type: 'rules_text' },
      ],
    });
    const stored = await db.referenceSections.toArray();
    const byId = new Map(stored.map(s => [s.id, s]));
    expect(byId.get('s1')?.category).toBe('Combat');
    expect(byId.get('s2')?.order).toBe(0);
    expect(byId.get('s1')?.order).toBe(1);
    // …and both still bound by id, not just by the label they were given.
    expect(byId.get('s1')?.groupId).toBeDefined();
    expect(byId.get('s1')?.groupId).toBe(byId.get('s2')?.groupId);
  });
});

describe('ensureGroupsForSections', () => {
  it('appends cards for categories that have none, preserving existing order', async () => {
    await db.referenceGroups.put({
      id: 'g-combat', title: 'Combat', order: 0, createdAt: 'x', updatedAt: 'x',
    });
    const groups = await ensureGroupsForSections([
      { id: 's1', title: 'A', category: 'Combat', order: 0, type: 'rules_text', createdAt: 'x', updatedAt: 'x' },
      { id: 's2', title: 'B', category: 'Overland', order: 1, type: 'rules_text', createdAt: 'x', updatedAt: 'x' },
    ]);
    expect(groups.map(g => g.title)).toEqual(['Combat', 'Overland']);
    expect(groups.find(g => g.title === 'Combat')?.id).toBe('g-combat');
  });

  it('does not resurrect a card for a soft-deleted category', async () => {
    // getGroups filters deleted rows, so a deleted card looks missing. Creating
    // a fresh one is correct — the alternative is a category with nowhere to go.
    await db.referenceGroups.put({
      id: 'g-gone', title: 'Combat', order: 0, createdAt: 'x', updatedAt: 'x', deletedAt: 'y', softDeletedBy: 'tx',
    });
    const groups = await ensureGroupsForSections([
      { id: 's1', title: 'A', category: 'Combat', order: 0, type: 'rules_text', createdAt: 'x', updatedAt: 'x' },
    ]);
    expect(groups.map(g => g.title)).toEqual(['Combat']);
    expect(groups[0].id).not.toBe('g-gone');
    expect((await getGroups()).length).toBe(1);
  });
});
