// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/client';
import {
  importBundle,
  ensureGroupsForSections,
  getGroups,
  getAll,
  removeGroup,
  restoreGroup,
} from './referenceSectionRepository';
import { resetDatabase } from '../../test-utils/resetDatabase';
import type { ReferenceSection } from '../../types/reference';

/**
 * Covers the import path's binding of sections to their grouping card.
 *
 * @remarks
 * `groupId` has been the authoritative join since schema v14, but the importer
 * kept writing sections without one — they rendered only through the legacy
 * category fallback, and renaming the card they arrived in stranded them.
 */

beforeEach(async () => {
  await resetDatabase();
});

describe('importBundle', () => {
  it('binds every imported section to its card by id', async () => {
    const result = await importBundle({
      referenceGroups: [{ id: 'g-combat', title: 'Combat', order: 0 }],
      referenceSections: [
        { id: 's1', title: 'Initiative', category: 'Combat', order: 0, type: 'rules_text' },
        { id: 's2', title: 'Cover', category: 'Combat', order: 1, type: 'rules_text' },
      ],
    });
    expect(result).toEqual({ imported: 2, skipped: [], collisions: [] });
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

/**
 * The import used to be `JSON.parse(text) as ReferenceImportBundle` straight
 * into a `bulkPut`. A row of the wrong shape was written to IndexedDB, where it
 * stayed — and because the write is keyed by `id`, it could land on top of a
 * section that had been fine, so re-importing the good file was the only way
 * back and there was nothing to say that was needed.
 */
describe('importBundle validation', () => {
  it('drops a section whose rows are not rows, and keeps the rest', async () => {
    const result = await importBundle({
      referenceSections: [
        { id: 'good', title: 'Cover', category: 'Combat', type: 'rules_text' },
        { id: 'bad', title: 'Ranges', category: 'Combat', type: 'table', rows: 'not-an-array' },
      ],
    });

    expect(result.imported).toBe(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ entityType: 'referenceSection', entityIndex: 1, path: 'rows' });
    expect((await db.referenceSections.toArray()).map(s => s.id)).toEqual(['good']);
  });

  it('drops a key-value section whose items are missing the fields the renderer reads', async () => {
    // `ReferenceSectionRenderer` reads `item.label` and `item.description`.
    const result = await importBundle({
      referenceSections: [
        { id: 'bad', title: 'Conditions', type: 'key_value_list', items: [{ label: 42 }] },
      ],
    });

    expect(result.imported).toBe(0);
    expect(result.skipped[0]?.path).toBe('items.0.label');
    expect(await db.referenceSections.count()).toBe(0);
  });

  it('drops a section whose type is not one the renderer knows', async () => {
    const result = await importBundle({
      referenceSections: [{ id: 'bad', title: 'Mystery', type: 'flowchart' }],
    });

    expect(result.imported).toBe(0);
    expect(result.skipped[0]?.path).toBe('type');
  });

  it('never overwrites a good section with a malformed one of the same id', async () => {
    await importBundle({
      referenceSections: [{ id: 's1', title: 'Initiative', category: 'Combat', type: 'rules_text', paragraphs: ['Roll.'] }],
    });

    const result = await importBundle({
      referenceSections: [{ id: 's1', title: 'Initiative', category: 'Combat', type: 'table', columns: [1, 2] }],
    });

    expect(result.imported).toBe(0);
    const [stored] = await db.referenceSections.toArray();
    expect(stored.paragraphs).toEqual(['Roll.']);
  });

  it('rejects a file that is not a reference bundle at all', async () => {
    await expect(importBundle({ characters: [] })).rejects.toThrow(/Not a reference file/);
    await expect(importBundle('a string')).rejects.toThrow(/expected a JSON object/);
    await expect(importBundle(null)).rejects.toThrow(/expected a JSON object/);
    expect(await db.referenceSections.count()).toBe(0);
  });

  it('still accepts a partial hand-authored bundle', async () => {
    // Tolerance of *missing* fields is the point of the format and must survive.
    const result = await importBundle({
      referenceSections: [{ title: 'Falling' }],
    });

    expect(result).toEqual({ imported: 1, skipped: [], collisions: [] });
    const [stored] = await db.referenceSections.toArray();
    expect(stored.id).toBeTruthy();
    expect(stored.type).toBe('rules_text');
    expect(stored.category).toBe('Imported');
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

describe('removeGroup / restoreGroup round trip', () => {
  it('brings back the card and every section deleted with it', async () => {
    // restoreGroup queries `where('softDeletedBy')`, an index referenceSections
    // did not declare until schema v19. Dexie throws SchemaError on an
    // undeclared index, so this whole path was dead — it just had no caller yet
    // to fire it.
    await db.referenceGroups.put({
      id: 'g-combat', title: 'Combat', order: 0, createdAt: 'x', updatedAt: 'x',
    });
    await db.referenceSections.bulkPut([
      { id: 's1', title: 'Initiative', category: 'Combat', groupId: 'g-combat', order: 0, type: 'rules_text', createdAt: 'x', updatedAt: 'x' },
      { id: 's2', title: 'Cover', category: 'Combat', groupId: 'g-combat', order: 1, type: 'rules_text', createdAt: 'x', updatedAt: 'x' },
    ]);

    await removeGroup('g-combat');
    expect((await getGroups()).length).toBe(0);
    expect((await getAll()).length).toBe(0);

    await restoreGroup('g-combat');
    expect((await getGroups()).map(g => g.id)).toEqual(['g-combat']);
    expect((await getAll()).map(s => s.id).sort()).toEqual(['s1', 's2']);
  });

  it('leaves a section that was deleted on its own deleted', async () => {
    // Only rows carrying the group's own transaction id come back; a section
    // the user removed separately stays removed.
    await db.referenceGroups.put({
      id: 'g-combat', title: 'Combat', order: 0, createdAt: 'x', updatedAt: 'x',
    });
    await db.referenceSections.bulkPut([
      { id: 's1', title: 'Initiative', category: 'Combat', groupId: 'g-combat', order: 0, type: 'rules_text', createdAt: 'x', updatedAt: 'x' },
      { id: 's2', title: 'Cover', category: 'Combat', groupId: 'g-combat', order: 1, type: 'rules_text', createdAt: 'x', updatedAt: 'x', deletedAt: 'earlier', softDeletedBy: 'other-tx' },
    ]);

    await removeGroup('g-combat');
    await restoreGroup('g-combat');
    expect((await getAll()).map(s => s.id)).toEqual(['s1']);
  });
});

/**
 * An import may not overwrite a local row just because it re-uses its id.
 *
 * @remarks
 * `importBundle` used to `bulkPut` groups and sections straight in. The
 * reference library is the user's own house rules, and on the restore path a
 * silent overwrite is data loss wearing the costume of a successful import: the
 * screen said "Imported 3 reference sections" and three sections the user wrote
 * were gone, with no trace and nothing to restore from.
 *
 * The policy is not invented here — `mergeEngine.mergeEntity` already decides
 * this for every other table, and these tests are written against its rules
 * rather than against a new one:
 *
 * - **Same id, same `createdAt`** — the same row, newer content. Write it.
 * - **Same id, different or missing `createdAt`** — two different entities that
 *   happen to share an id. Keep local, report. (Missing counts as different:
 *   the engine's comment records that requiring *both* to be present let "a
 *   bundle row with no `createdAt` and a far-future `updatedAt`" through, which
 *   is the one shape a careless hand-edited bundle actually has.)
 * - **Local row soft-deleted** — keep the deletion rather than resurrecting a
 *   record the user deleted, under whatever content the bundle carries.
 *
 * Cards differ from sections in one respect, and only one: a card is a
 * container whose id this format *already* synthesises when the bundle omits it
 * (`raw?.id ?? generateId()`), while a section is the content itself. So a
 * colliding card is re-keyed rather than dropped — the sections that named its
 * title still land under a card with the right title instead of being filed
 * into an unrelated local card. Both are reported.
 */
describe('importBundle collisions', () => {
  const T1 = '2026-01-01T00:00:00.000Z';
  const T2 = '2026-02-02T00:00:00.000Z';

  /** A local section the user wrote, under an id an import may re-use. */
  async function seedLocalSection(overrides: Partial<ReferenceSection> = {}): Promise<void> {
    await db.referenceSections.put({
      id: 's1',
      title: 'My House Rule',
      category: 'Combat',
      order: 0,
      type: 'rules_text',
      paragraphs: ['Mine.'],
      createdAt: T1,
      updatedAt: T1,
      ...overrides,
    });
  }

  it('keeps a local section whose id an import re-uses', async () => {
    await seedLocalSection();

    const result = await importBundle({
      referenceSections: [
        { id: 's1', title: 'Somebody Else\'s Rule', category: 'Combat', type: 'rules_text', createdAt: T2, paragraphs: ['Theirs.'] },
      ],
    });

    // The fixture reached the subject: the parser accepted the row, so this is
    // a decision about a collision and not a row that never arrived.
    expect(result.skipped).toEqual([]);

    const stored = await db.referenceSections.get('s1');
    expect(stored?.title, 'the user\'s own section was overwritten by an import').toBe('My House Rule');
    expect(stored?.paragraphs).toEqual(['Mine.']);
    expect(result.imported).toBe(0);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]).toMatchObject({ entityType: 'referenceSection', path: 'id' });
    expect(result.collisions[0]?.message).toContain('s1');
  });

  it('treats a bundle row with no createdAt as a collision, not a pass', async () => {
    await seedLocalSection();

    const result = await importBundle({
      referenceSections: [
        { id: 's1', title: 'Undated', category: 'Combat', type: 'rules_text', paragraphs: ['Theirs.'] },
      ],
    });

    expect(result.skipped).toEqual([]);
    expect((await db.referenceSections.get('s1'))?.title).toBe('My House Rule');
    expect(result.imported).toBe(0);
    expect(result.collisions).toHaveLength(1);
  });

  it('updates the same section when createdAt matches', async () => {
    await seedLocalSection();

    const result = await importBundle({
      referenceSections: [
        { id: 's1', title: 'My House Rule, Revised', category: 'Combat', type: 'rules_text', createdAt: T1, paragraphs: ['Revised.'] },
      ],
    });

    expect(result.collisions).toEqual([]);
    expect(result.imported).toBe(1);
    const stored = await db.referenceSections.get('s1');
    expect(stored?.title).toBe('My House Rule, Revised');
    expect(stored?.paragraphs).toEqual(['Revised.']);
  });

  it('does not resurrect a soft-deleted section', async () => {
    await seedLocalSection({ deletedAt: T1, softDeletedBy: 'tx-1' });

    const result = await importBundle({
      referenceSections: [
        { id: 's1', title: 'Back From The Dead', category: 'Combat', type: 'rules_text', createdAt: T1 },
      ],
    });

    const stored = await db.referenceSections.get('s1');
    expect(stored?.deletedAt, 'an import resurrected a section the user deleted').toBe(T1);
    expect(stored?.title).toBe('My House Rule');
    expect(result.imported).toBe(0);
    expect(result.collisions).toHaveLength(1);
  });

  it('keeps a local card whose id an import re-uses, and still files the sections under their own', async () => {
    await db.referenceGroups.put({
      id: 'g1', title: 'Rituals', order: 0, createdAt: T1, updatedAt: T1,
    });

    const result = await importBundle({
      referenceGroups: [{ id: 'g1', title: 'Combat', order: 0, createdAt: T2 }],
      referenceSections: [
        { id: 's9', title: 'Initiative', category: 'Combat', type: 'rules_text', createdAt: T2 },
      ],
    });

    expect(result.skipped).toEqual([]);
    expect((await db.referenceGroups.get('g1'))?.title, 'the local card was renamed by an import').toBe('Rituals');

    // The imported section still reached a card of its own title rather than
    // being filed into the unrelated local one.
    const section = await db.referenceSections.get('s9');
    expect(section?.groupId).toBeDefined();
    expect(section?.groupId).not.toBe('g1');
    expect((await db.referenceGroups.get(section!.groupId!))?.title).toBe('Combat');
    expect(result.imported).toBe(1);
    expect(result.collisions.some(c => c.entityType === 'referenceGroup')).toBe(true);
  });
});
