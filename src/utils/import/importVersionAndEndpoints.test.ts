import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../storage/db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import { CURRENT_SCHEMA_VERSION, migrateCharacter } from '../migrations';
import { createBlankCharacter } from '../../features/characters/characterMappers';
import { mergeBundle } from './mergeEngine';
import type { BundleEnvelope } from '../../types/bundle';

const OPTIONS = { selectedEntityTypes: new Set(['notes', 'entityLinks']) } as never;

beforeEach(async () => {
  await resetDatabase();
});

describe('importing a character from a newer app', () => {
  it('is refused rather than stored under a schema this app cannot read', () => {
    const future = { ...createBlankCharacter('classic-fantasy'), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(() => migrateCharacter(future)).toThrow(/newer/);
  });

  it('still accepts the current version', () => {
    expect(() => migrateCharacter(createBlankCharacter('classic-fantasy'))).not.toThrow();
  });
});

describe('an imported edge pointing at a deleted row', () => {
  it('is skipped as dangling, not left live against a tombstone', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    await db.notes.put({ id: 'live', campaignId: 'c', title: 'L', type: 'generic', createdAt: now, updatedAt: now } as never);
    await db.notes.put({ id: 'dead', campaignId: 'c', title: 'D', type: 'generic', createdAt: now, updatedAt: now, deletedAt: now, softDeletedBy: 'tx' } as never);

    const report = await mergeBundle({
      type: 'campaign', version: 1, exportedAt: now,
      contents: {
        entityLinks: [{
          id: 'edge', fromEntityId: 'live', fromEntityType: 'note', toEntityId: 'dead', toEntityType: 'note',
          relationshipType: 'promoted_into', createdAt: now, updatedAt: now, schemaVersion: 1,
        }],
      },
    } as unknown as BundleEnvelope, OPTIONS);

    expect(await db.entityLinks.get('edge')).toBeUndefined();
    expect(report.errors.map(e => e.message).join()).toMatch(/missing/);
  });
});

describe('re-importing rows that have no updatedAt (roadmap R, recorded)', () => {
  it('skips an unchanged attachment instead of reporting an error per row', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    const row = { id: 'a1', noteId: 'n', campaignId: 'c', filename: 'a.png', mimeType: 'image/png', sizeBytes: 1, createdAt: now };
    await db.attachments.put({ ...row, blob: new Blob(['x']) } as never);

    const report = await mergeBundle({
      type: 'campaign', version: 1, exportedAt: now, contents: { attachments: [{ ...row, blobBase64: 'eA==' }] },
    } as unknown as BundleEnvelope, { selectedEntityTypes: new Set(['attachments']) } as never);

    expect(report.errors).toEqual([]);
    expect(report.skipped).toBe(1);
  });

  it('still reports a local row that does have updatedAt when the bundle lacks one', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    await db.characters.put({ id: 'c1', name: 'Real', createdAt: now, updatedAt: now } as never);
    const report = await mergeBundle({
      type: 'campaign', version: 1, exportedAt: now, contents: { characters: [{ id: 'c1', name: 'Real', createdAt: now }] },
    } as unknown as BundleEnvelope, { selectedEntityTypes: new Set(['characters']) } as never);
    expect(report.errors.some(e => e.message.includes('Could not compare'))).toBe(true);
  });
});
