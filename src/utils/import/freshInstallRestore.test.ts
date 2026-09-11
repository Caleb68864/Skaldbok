// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../storage/db/client';
import { collectCampaignBundle, collectCharacterBundle } from '../export/collectors';
import { serializeBundle } from '../export/bundleSerializer';
import { parseBundle } from './bundleParser';
import { mergeBundle } from './mergeEngine';
import { resolveImportCampaignTarget } from './importCampaignTarget';
import { BUNDLE_PROCESSING_ORDER } from '../../types/bundleTables';
import { getAllCampaigns } from '../../storage/repositories/campaignRepository';
import { createBlankCharacter } from '../../features/characters/characterMappers';
import { BUNDLED_SYSTEMS } from '../../systems/registry';
import type { MergeOptions } from './mergeEngine';

/**
 * Restoring a backup onto a device that has nothing on it.
 *
 * @remarks
 * This is the case the import path exists for and the one it used to refuse:
 * the Import action was rendered only when a campaign was active, and the
 * preview dialog demanded a target campaign for any bundle whose declared
 * `type` was `character` or `session`. On a genuinely fresh install — someone
 * who has lost their device — that meant creating a campaign before a campaign
 * could be restored, and picking a campaign from an empty list before a
 * character could be.
 *
 * The merge engine was never the problem; the decision above it was. These
 * tests drive that decision (`resolveImportCampaignTarget`) together with the
 * merge, against a wiped database, so the two cannot be fixed apart.
 */

const NOW = '2026-01-01T00:00:00.000Z';
const CAMPAIGN_ID = 'camp-restore';
const SYSTEM_ID = BUNDLED_SYSTEMS[0].id;

/** Seeds a small but cross-referencing campaign: campaign, session, party, character, note. */
async function seedCampaign(): Promise<void> {
  const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };

  await db.campaigns.add({
    id: CAMPAIGN_ID,
    name: 'The Iron Circle',
    system: SYSTEM_ID,
    status: 'active',
    ...stamp,
  } as never);

  await db.sessions.add({
    id: 'sess-1',
    campaignId: CAMPAIGN_ID,
    title: 'Session One',
    status: 'ended',
    date: '2026-01-01',
    startedAt: NOW,
    ...stamp,
  } as never);

  await db.parties.add({ id: 'party-1', campaignId: CAMPAIGN_ID, name: 'The Crew', ...stamp } as never);

  await db.characters.add({
    ...createBlankCharacter(SYSTEM_ID),
    id: 'char-1',
    name: 'Astrid',
  } as never);

  await db.partyMembers.add({
    id: 'member-1',
    partyId: 'party-1',
    linkedCharacterId: 'char-1',
    ...stamp,
  } as never);

  await db.notes.add({
    id: 'note-1',
    campaignId: CAMPAIGN_ID,
    sessionId: 'sess-1',
    title: 'The bridge at Halvard',
    type: 'generic',
    status: 'active',
    scope: 'campaign',
    pinned: false,
    content: 'They burned it.',
    ...stamp,
  } as never);

  await db.entityLinks.add({
    id: 'link-1',
    fromEntityId: 'sess-1',
    fromEntityType: 'session',
    toEntityId: 'note-1',
    toEntityType: 'note',
    relationshipType: 'contains',
    ...stamp,
  } as never);
}

/** Exports the seeded campaign to a bundle file, then wipes the device. */
async function exportThenWipe(): Promise<string> {
  const collected = await collectCampaignBundle(CAMPAIGN_ID);
  expect(collected.success).toBe(true);
  if (!collected.success) throw new Error(collected.error);
  const json = await serializeBundle('campaign', collected.contents);
  await db.delete();
  await db.open();
  return json;
}

/**
 * Runs the import exactly as the app does: parse, resolve what campaign the
 * import needs, then merge with that answer.
 */
async function importAsTheAppWould(json: string) {
  const parsed = parseBundle(json);
  expect(parsed.success).toBe(true);
  if (!parsed.success) throw new Error(parsed.error);

  const selected = new Set(
    BUNDLE_PROCESSING_ORDER.filter((key) => {
      const value = (parsed.bundle.contents as Record<string, unknown>)[key];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }),
  );

  const target = resolveImportCampaignTarget(parsed.bundle, selected);
  const options: MergeOptions = {
    selectedEntityTypes: selected,
    targetCampaignId: target.kind === 'bundled' ? target.campaignId : undefined,
  };
  const report = await mergeBundle(parsed.bundle, options);
  return { parsed, target, report };
}

describe('restoring a campaign onto a device with no campaigns', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('needs no campaign to exist first, and restores the bundle’s own', async () => {
    await seedCampaign();
    const json = await exportThenWipe();

    // The precondition the old gate could not survive.
    expect(await getAllCampaigns()).toEqual([]);

    const { target, report } = await importAsTheAppWould(json);

    expect(
      target.kind,
      'a campaign bundle carries its own campaign; asking the user to supply one is the bug',
    ).toBe('bundled');
    expect(report.errors).toEqual([]);

    const campaigns = await getAllCampaigns();
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].id).toBe(CAMPAIGN_ID);
    expect(campaigns[0].name).toBe('The Iron Circle');

    // And the campaign's contents came with it, still pointing at it.
    expect(await db.sessions.count()).toBe(1);
    expect(await db.notes.count()).toBe(1);
    expect((await db.notes.get('note-1'))?.campaignId).toBe(CAMPAIGN_ID);
    expect((await db.sessions.get('sess-1'))?.campaignId).toBe(CAMPAIGN_ID);
    expect(await db.characters.count()).toBe(1);
    expect(await db.entityLinks.count()).toBe(1);
  });

  it('does not create a second campaign when the same backup is restored twice', async () => {
    await seedCampaign();
    const json = await exportThenWipe();

    await importAsTheAppWould(json);
    const second = await importAsTheAppWould(json);

    expect(await getAllCampaigns()).toHaveLength(1);
    // Nothing new landed and nothing was overwritten: same id, same createdAt,
    // same updatedAt, so every row is a no-op skip rather than a duplicate.
    expect(second.report.inserted).toBe(0);
    expect(second.report.errors).toEqual([]);
    expect(await db.notes.count()).toBe(1);
    expect(await db.sessions.count()).toBe(1);
  });

  /**
   * The rollback, exercised.
   *
   * @remarks
   * This test used to call `db.close()` **before** `mergeBundle`.
   * `db.transaction(...)` then failed at open, no row was ever written, and
   * "leaves nothing behind" was trivially true. It proved that a closed
   * database imports nothing; it never touched the rollback it is named for.
   * Deleting `if (isFatalMergeError(err)) throw err` from `mergeEngine.ts` —
   * the entire abort-and-roll-back mechanism — left the whole suite green.
   *
   * So the failure has to arrive *mid-import*, after rows have already been
   * written: `entityLinks` are processed last, so the campaign, session, party,
   * character and note are all in the transaction by the time this one throws.
   * A `QuotaExceededError` is what a full disk actually produces, and is one of
   * the names `isFatalMergeError` recognises.
   */
  it('leaves nothing behind when the restore is rolled back', async () => {
    await seedCampaign();
    const json = await exportThenWipe();

    const parsed = parseBundle(json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // Entity links are written last; everything else is already in the
    // transaction when this rejects.
    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    const put = vi.spyOn(db.table('entityLinks'), 'put').mockRejectedValue(quota);

    let report;
    try {
      report = await mergeBundle(parsed.bundle, {
        selectedEntityTypes: new Set(BUNDLE_PROCESSING_ORDER),
        targetCampaignId: CAMPAIGN_ID,
      });
    } finally {
      put.mockRestore();
    }

    // The whole import is void, not just the row that failed. A fresh install
    // has no earlier state to fall back on, so a campaign left with half its
    // rows is not recoverable by retrying from the UI.
    expect(await getAllCampaigns()).toEqual([]);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.notes.count()).toBe(0);
    expect(await db.characters.count()).toBe(0);
    expect(await db.entityLinks.count()).toBe(0);

    // And the report says so. `inserted`/`updated`/`skipped` all describe work
    // that was rolled back, so all three are void — `skipped` was left standing
    // at its running total, which is how "Import completed with N error(s).
    // Imported 0 new, updated 0, skipped 12." reached the screen after a restore
    // that restored nothing.
    expect(report.inserted).toBe(0);
    expect(report.updated).toBe(0);
    expect(report.skipped).toBe(0);

    // The one sentence saying nothing was restored has to be the one the user
    // sees: `useImportActions` renders `errors.slice(0, 3)` and puts the rest
    // in the console.
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]?.message).toMatch(/^Import rolled back:/);
  });

  /**
   * The same rollback, when the fatal error arrives wrapped.
   *
   * @remarks
   * The test above injects a `QuotaExceededError` **directly**, which is what a
   * raw `db.*` call produces — and `mergeEngine` makes raw `db.*` calls today,
   * so it passes. It therefore says nothing about the shape the repository
   * layer produces, which is what `CLAUDE.md` says this layer should be calling:
   * every repository write re-throws as `new Error("Failed to …", { cause: e })`,
   * a plain `Error` whose `name` is `'Error'`.
   *
   * `isFatalMergeError` read `err.name` off the top-level error only, so one
   * wrapping layer was enough to make a full disk read as a per-row problem —
   * the rollback that was just fixed and verified would not fire, and a fresh
   * install would be left holding half a campaign. The 130 `{ cause: … }` sites
   * `4083893` added exist for exactly this and nothing was reading them.
   *
   * Two layers deep, because one is the shape that happens to exist today and
   * two is the shape the next refactor produces.
   */
  it('rolls back when the fatal error arrives wrapped in a cause chain', async () => {
    await seedCampaign();
    const json = await exportThenWipe();

    const parsed = parseBundle(json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    const wrapped = new Error('Failed to save entity link: QuotaExceededError', { cause: quota });
    const outer = new Error('Import step failed', { cause: wrapped });
    const put = vi.spyOn(db.table('entityLinks'), 'put').mockRejectedValue(outer);

    let report;
    // Read before `mockRestore`, which clears the call history along with the
    // mock — asserting on the spy afterwards reports "never called" for a spy
    // that was called on every edge in the bundle.
    let putCalls: number;
    try {
      report = await mergeBundle(parsed.bundle, {
        selectedEntityTypes: new Set(BUNDLE_PROCESSING_ORDER),
        targetCampaignId: CAMPAIGN_ID,
      });
    } finally {
      putCalls = put.mock.calls.length;
      put.mockRestore();
    }

    // The fixture reached the subject: the merge got as far as writing edges,
    // so the rejection above is the one being classified.
    expect(putCalls, 'the bundle carried no edge, so nothing threw').toBeGreaterThan(0);

    expect(
      await getAllCampaigns(),
      'a quota failure one wrapper deep was classified as a per-row problem, so '
      + 'the import "finished" and left a fresh install holding half a campaign.',
    ).toEqual([]);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.notes.count()).toBe(0);
    expect(await db.characters.count()).toBe(0);
    expect(report.inserted).toBe(0);
    expect(report.updated).toBe(0);
    expect(report.skipped).toBe(0);
    expect(report.errors[0]?.message).toMatch(/^Import rolled back:/);
  });

  it('does not roll back on a wrapped error that is not DB-fatal', async () => {
    // The other direction: walking the chain must not turn every wrapped
    // failure into a whole-import abort. A malformed single row stays a
    // per-entity error, which is the distinction the function exists to draw.
    await seedCampaign();
    const json = await exportThenWipe();

    const parsed = parseBundle(json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const bad = new DOMException('Bad base64.', 'InvalidCharacterError');
    const outer = new Error('Failed to restore attachment', { cause: bad });
    const put = vi.spyOn(db.table('entityLinks'), 'put').mockRejectedValue(outer);

    let report;
    let putCalls: number;
    try {
      report = await mergeBundle(parsed.bundle, {
        selectedEntityTypes: new Set(BUNDLE_PROCESSING_ORDER),
        targetCampaignId: CAMPAIGN_ID,
      });
    } finally {
      putCalls = put.mock.calls.length;
      put.mockRestore();
    }

    expect(putCalls, 'the bundle carried no edge, so nothing threw').toBeGreaterThan(0);
    expect((await getAllCampaigns()).length).toBe(1);
    expect(report.errors.some((e) => /rolled back/.test(e.message))).toBe(false);
  });

  it('voids every tally and leads with the rollback when other errors preceded it', async () => {
    // What the user is told, on the shape that actually produces the bad copy:
    // a re-restore where most rows collide harmlessly (so `skipped` climbs) and
    // at least one row errors before the fatal failure arrives.
    await seedCampaign();
    const json = await exportThenWipe();
    await importAsTheAppWould(json);

    const parsed = parseBundle(json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    // An edge pointing at a note that is not in the bundle: a per-entity error,
    // collected and skipped, exactly as intended.
    (parsed.bundle.contents.entityLinks ??= []).unshift({
      id: 'link-dangling',
      fromEntityId: 'sess-1',
      fromEntityType: 'session',
      toEntityId: 'note-that-is-not-here',
      toEntityType: 'note',
      relationshipType: 'contains',
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    } as never);

    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    const get = vi.spyOn(db.table('entityLinks'), 'get').mockRejectedValue(quota);

    let report;
    try {
      report = await mergeBundle(parsed.bundle, {
        selectedEntityTypes: new Set(BUNDLE_PROCESSING_ORDER),
        targetCampaignId: CAMPAIGN_ID,
      });
    } finally {
      get.mockRestore();
    }

    // Rows were skipped as no-op collisions before the failure; the rollback
    // makes that work void too, so the count must not survive into the summary.
    expect(report.skipped).toBe(0);
    expect(report.inserted).toBe(0);
    expect(report.updated).toBe(0);
    // A per-entity error came first chronologically. The rollback still leads.
    expect(report.errors.length).toBeGreaterThan(1);
    expect(report.errors[0]?.message).toMatch(/^Import rolled back:/);
  });

  it('reports a per-row failure as one error and keeps the rest of the import', async () => {
    // The other side of the same branch, so "roll back on anything" cannot pass
    // for the fix. A malformed single row is not a DB-fatal failure: it is
    // collected and skipped, and the restore still lands.
    await seedCampaign();
    const json = await exportThenWipe();

    const parsed = parseBundle(json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    // The name `isFatalMergeError` does not recognise — a bad row, not a bad
    // database.
    const bad = new DOMException('bad base64', 'InvalidCharacterError');
    const put = vi.spyOn(db.table('entityLinks'), 'put').mockRejectedValue(bad);

    let report;
    try {
      report = await mergeBundle(parsed.bundle, {
        selectedEntityTypes: new Set(BUNDLE_PROCESSING_ORDER),
        targetCampaignId: CAMPAIGN_ID,
      });
    } finally {
      put.mockRestore();
    }

    expect(await getAllCampaigns()).toHaveLength(1);
    expect(await db.notes.count()).toBe(1);
    expect(await db.entityLinks.count()).toBe(0);
    expect(report.inserted).toBeGreaterThan(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.entityType).toBe('entityLinks');
  });
});

describe('restoring a character onto a device with no campaigns', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('imports the character with no campaign involved at all', async () => {
    // The owner's case. `CharacterRecord` has no `campaignId` — characters are a
    // device-global table joined to a campaign through `partyMembers` — so a
    // character bundle that carries no notes needs no campaign, and demanding
    // one was never right even before the fresh-install problem.
    await db.characters.add({
      ...createBlankCharacter(SYSTEM_ID),
      id: 'char-solo',
      name: 'Rurik',
    } as never);

    const collected = await collectCharacterBundle('char-solo');
    expect(collected.success).toBe(true);
    if (!collected.success) return;
    const json = await serializeBundle('character', collected.contents);

    await db.delete();
    await db.open();
    expect(await getAllCampaigns()).toEqual([]);

    const { target, report } = await importAsTheAppWould(json);

    expect(target.kind).toBe('not-required');
    expect(report.errors).toEqual([]);
    expect(await db.characters.count()).toBe(1);
    expect((await db.characters.get('char-solo'))?.name).toBe('Rurik');
    // No campaign was invented on the character's behalf.
    expect(await getAllCampaigns()).toEqual([]);
  });

  it('asks for a campaign only for the notes that travelled with the character', async () => {
    await seedCampaign();
    // Link the note to the character so the character bundle picks it up.
    await db.entityLinks.add({
      id: 'link-2',
      fromEntityId: 'char-1',
      fromEntityType: 'character',
      toEntityId: 'note-1',
      toEntityType: 'note',
      relationshipType: 'contains',
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    } as never);

    const collected = await collectCharacterBundle('char-1');
    expect(collected.success).toBe(true);
    if (!collected.success) return;
    const json = await serializeBundle('character', collected.contents);

    await db.delete();
    await db.open();

    const parsed = parseBundle(json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.bundle.contents.notes?.length).toBe(1);

    // With the notes selected there is a real choice to make, so it is asked.
    expect(
      resolveImportCampaignTarget(parsed.bundle, ['characters', 'notes', 'entityLinks']).kind,
    ).toBe('required');

    // Deselecting them is the escape hatch, and the character still lands.
    const target = resolveImportCampaignTarget(parsed.bundle, ['characters']);
    expect(target.kind).toBe('not-required');

    const report = await mergeBundle(parsed.bundle, {
      selectedEntityTypes: new Set(['characters'] as never),
    });
    expect(report.errors).toEqual([]);
    expect(await db.characters.count()).toBe(1);
    expect(await db.notes.count()).toBe(0);
  });
});
