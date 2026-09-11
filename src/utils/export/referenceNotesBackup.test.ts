// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../storage/db/client';
import * as referenceNoteRepository from '../../storage/repositories/referenceNoteRepository';
import { collectCampaignBundle } from './collectors';
import { serializeBundle } from './bundleSerializer';
import { parseBundle } from '../import/bundleParser';
import { mergeBundle } from '../import/mergeEngine';
import { BUNDLE_PROCESSING_ORDER } from '../../types/bundleTables';
import { BUNDLED_SYSTEMS } from '../../systems/registry';

/**
 * Reference notes are live user content and must reach the backup.
 *
 * @remarks
 * `TABLES_OUTSIDE_BUNDLE` kept `referenceNotes` out of every bundle on the
 * stated grounds that "its live content is already exported as notes". No such
 * dual-write exists: `ReferenceScreen`'s Notes tab calls
 * `referenceNoteRepository.save(note)` and writes nothing to `notes`. Every
 * reference note written since v7 lived in exactly one table, and that table
 * was in no export — on a device where the settings screen calls a campaign
 * export "the only copy that survives this device".
 *
 * The registry that owns those exclusions checks that a reason is *recorded*,
 * never that the recorded reason is *true*, which is why this survived the
 * change that was supposed to end exactly this class of bug. The companion
 * guard is in `softDeleteCoverage.test.ts` ("exempts only tables that really
 * have no soft delete"), which checks an exclusion against the repository
 * layer's own writes rather than against the map it polices.
 */

const NOW = '2026-01-01T00:00:00.000Z';
const CAMPAIGN_ID = 'camp-refnotes';

describe('reference notes travel in the backup', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.campaigns.add({
      id: CAMPAIGN_ID,
      name: 'The Iron Circle',
      system: BUNDLED_SYSTEMS[0].id,
      status: 'active',
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    } as never);
    // Written exactly the way the Reference screen writes one.
    await referenceNoteRepository.save({
      id: 'refnote-1',
      title: 'House rule: flanking',
      content: 'A flanked target defends at a bane.',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('carries a reference note into a campaign bundle', async () => {
    const collected = await collectCampaignBundle(CAMPAIGN_ID);
    expect(collected.success).toBe(true);
    if (!collected.success) return;

    expect(
      collected.contents.referenceNotes?.map((n) => n.id),
      'the Notes tab of the Reference screen writes only this table, so a bundle '
      + 'without it is a backup that silently omits live user content.',
    ).toEqual(['refnote-1']);
  });

  it('restores that note onto a wiped device', async () => {
    const collected = await collectCampaignBundle(CAMPAIGN_ID);
    expect(collected.success).toBe(true);
    if (!collected.success) return;
    const json = await serializeBundle('campaign', collected.contents, { includePrivate: false });

    await db.delete();
    await db.open();
    expect(await db.referenceNotes.count()).toBe(0);

    const parsed = parseBundle(json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const report = await mergeBundle(parsed.bundle, {
      selectedEntityTypes: new Set(BUNDLE_PROCESSING_ORDER),
      targetCampaignId: CAMPAIGN_ID,
    });

    expect(report.errors).toEqual([]);
    const restored = await referenceNoteRepository.getAll();
    expect(restored.map((n) => n.title)).toEqual(['House rule: flanking']);
    expect(restored[0]?.content).toBe('A flanked target defends at a bane.');
  });

  it('leaves a soft-deleted reference note out of the bundle', async () => {
    await referenceNoteRepository.softDelete('refnote-1');
    const collected = await collectCampaignBundle(CAMPAIGN_ID);
    expect(collected.success).toBe(true);
    if (!collected.success) return;
    // Exports ship live data only, like every other table.
    expect(collected.contents.referenceNotes ?? []).toEqual([]);
  });
});
