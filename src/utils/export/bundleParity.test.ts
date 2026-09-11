// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../storage/db/client';
import {
  BUNDLE_ENTITY_LABELS,
  BUNDLE_PROCESSING_ORDER,
  BUNDLE_TABLE_BY_KEY,
  TABLES_OUTSIDE_BUNDLE,
} from '../../types/bundleTables';
import { bundleContentsSchema } from '../../types/bundle';
import { collectCampaignBundle } from './collectors';
import { serializeBundle } from './bundleSerializer';
import { parseBundle } from '../import/bundleParser';
import { mergeBundle } from '../import/mergeEngine';
import { createBlankCharacter } from '../../features/characters/characterMappers';
import { BUNDLED_SYSTEMS } from '../../systems/registry';
import type { BundleContents } from '../../types/bundle';

/**
 * Dexie-schema ↔ bundle-schema parity.
 *
 * @remarks
 * The campaign export is the app's only backup — the settings screen calls it
 * "the only copy that survives this device". It nonetheless shipped for several
 * releases omitting ships, every ledger table, routes, the knowledge-base graph
 * and the reference library, because "add a table" and "add it to the export"
 * were two separate acts of memory in four hand-maintained lists.
 *
 * These tests remove the memory. A new `version(n).stores({...})` entry in
 * `client.ts` fails `covers every Dexie table` until it is either mapped into
 * the bundle or listed in `TABLES_OUTSIDE_BUNDLE` with a stated reason; and
 * `carries a row from every exported table` fails until the collector actually
 * emits it, so a mapping with no collector behind it does not pass either.
 */

const CAMPAIGN_ID = 'camp-parity';
const NOW = '2026-01-01T00:00:00.000Z';
const LATER = '2026-06-01T00:00:00.000Z';

/** Every table a campaign export is expected to carry, and one valid row for it. */
async function seedOneRowPerTable(): Promise<void> {
  const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };

  await db.campaigns.add({
    id: CAMPAIGN_ID,
    name: 'Parity',
    system: BUNDLED_SYSTEMS[0].id,
    status: 'active',
    ...stamp,
  } as never);

  await db.systems.add(BUNDLED_SYSTEMS[0] as never);

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

  const character = { ...createBlankCharacter(BUNDLED_SYSTEMS[0].id), id: 'char-1', name: 'Astrid' };
  await db.characters.add(character as never);

  await db.partyMembers.add({
    id: 'member-1',
    partyId: 'party-1',
    linkedCharacterId: 'char-1',
    ...stamp,
  } as never);

  await db.creatureTemplates.add({
    id: 'creature-1',
    campaignId: CAMPAIGN_ID,
    name: 'Wolf',
    category: 'animal',
    stats: {},
    attacks: [],
    abilities: [],
    skills: [],
    tags: [],
    status: 'active',
    ...stamp,
  } as never);

  await db.encounters.add({
    id: 'enc-1',
    sessionId: 'sess-1',
    campaignId: CAMPAIGN_ID,
    title: 'Ambush',
    type: 'combat',
    status: 'ended',
    tags: [],
    segments: [],
    // A participant, not an empty list. This seed used to have none, so the
    // round-trip below passed on a bundle with nothing to lose — which is
    // exactly why every `represents` edge could be dropped from every export
    // without a test noticing. See `participantLinks.test.ts`.
    participants: [
      { id: 'part-1', name: 'Wolf', type: 'monster', instanceState: {}, sortOrder: 0 },
    ],
    ...stamp,
  } as never);

  await db.inventoryContainers.add({
    id: 'cont-1',
    campaignId: CAMPAIGN_ID,
    name: 'Coffer',
    kind: 'coffer',
    capacity: null,
    wealth: {},
    items: [],
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  await db.notes.add({
    id: 'note-1',
    campaignId: CAMPAIGN_ID,
    sessionId: 'sess-1',
    title: 'A Note',
    body: null,
    type: 'general',
    status: 'active',
    pinned: false,
    scope: 'campaign',
    ...stamp,
  } as never);

  // An edge whose endpoints are both in the bundle, so referential closure keeps it.
  await db.entityLinks.add({
    id: 'link-1',
    fromEntityId: 'sess-1',
    fromEntityType: 'session',
    toEntityId: 'note-1',
    toEntityType: 'note',
    relationshipType: 'contains',
    ...stamp,
  } as never);

  // The binding between the participant above and the bestiary creature — the
  // only record that this combatant is the Wolf. Its `from` end is an encounter
  // *participant*, an id nested inside the encounter row, which is the endpoint
  // kind the old hand-written `entityIds` list could not contain.
  await db.entityLinks.add({
    id: 'link-represents',
    fromEntityId: 'part-1',
    fromEntityType: 'encounterParticipant',
    toEntityId: 'creature-1',
    toEntityType: 'creature',
    relationshipType: 'represents',
    ...stamp,
  } as never);

  await db.attachments.add({
    id: 'att-1',
    noteId: 'note-1',
    campaignId: CAMPAIGN_ID,
    filename: 'map.png',
    mimeType: 'image/png',
    sizeBytes: 4,
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
    createdAt: NOW,
  } as never);

  await db.ships.add({
    id: 'ship-1',
    campaignId: CAMPAIGN_ID,
    name: 'Kestrel',
    counters: {},
    specs: {},
    weapons: [],
    crew: [],
    notes: '',
    ...stamp,
  } as never);

  await db.ledgerAccounts.add({
    id: 'acct-1',
    campaignId: CAMPAIGN_ID,
    name: 'Ship Fund',
    kind: 'asset',
    isPrimary: true,
    contingent: false,
    note: '',
    ...stamp,
  } as never);

  await db.ledgerEntries.add({
    id: 'entry-1',
    campaignId: CAMPAIGN_ID,
    date: '2026-01-02',
    memo: 'Cargo sale',
    amount: 12000,
    accountId: 'acct-1',
    ...stamp,
  } as never);

  await db.ledgerSplits.add({
    id: 'split-1',
    campaignId: CAMPAIGN_ID,
    shipFundPct: 20,
    rows: [],
    ...stamp,
  } as never);

  await db.recurringBills.add({
    id: 'bill-1',
    campaignId: CAMPAIGN_ID,
    name: 'Berthing',
    amount: 500,
    everyDays: 30,
    startDate: '',
    postedThrough: '',
    postedCount: 0,
    active: true,
    note: '',
    ...stamp,
  } as never);

  await db.routeStops.add({
    id: 'stop-1',
    campaignId: CAMPAIGN_ID,
    name: 'Regina',
    order: 0,
    values: {},
    ...stamp,
  } as never);

  await db.routePlans.add({
    id: 'plan-1',
    campaignId: CAMPAIGN_ID,
    startDate: '',
    targetDate: '',
    targetNote: '',
    ...stamp,
  } as never);

  await db.referenceGroups.add({
    id: 'refgroup-1',
    title: 'Combat',
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  await db.referenceSections.add({
    id: 'refsec-1',
    title: 'Cover',
    category: 'Combat',
    groupId: 'refgroup-1',
    order: 0,
    type: 'rules_text',
    paragraphs: ['Half cover grants a bane.'],
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  await db.referenceNotes.add({
    id: 'refnote-1',
    title: 'House rule: flanking',
    content: 'A flanked target defends at a bane.',
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  await db.kb_nodes.add({
    id: 'kbnode-1',
    type: 'note',
    label: 'A Note',
    scope: 'campaign',
    campaignId: CAMPAIGN_ID,
    sourceId: 'note-1',
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  await db.kb_edges.add({
    id: 'kbedge-1',
    fromId: 'kbnode-1',
    toId: 'kbnode-1',
    type: 'wikilink',
    campaignId: CAMPAIGN_ID,
    createdAt: NOW,
  } as never);
}

/** Row count for a bundle key — 1 for the singular `campaign`, array length otherwise. */
function countIn(contents: BundleContents, key: string): number {
  const value = (contents as Record<string, unknown>)[key];
  if (!value) return 0;
  return Array.isArray(value) ? value.length : 1;
}

describe('Dexie ↔ bundle schema parity', () => {
  it('accounts for every Dexie table, either in the bundle or with a stated reason', () => {
    const tableNames = db.tables.map((t) => t.name).sort();
    const exported = new Set(Object.values(BUNDLE_TABLE_BY_KEY));
    const excluded = new Set(Object.keys(TABLES_OUTSIDE_BUNDLE));

    const unaccounted = tableNames.filter((name) => !exported.has(name) && !excluded.has(name));
    expect(
      unaccounted,
      'A table was added to client.ts without deciding whether it belongs in a backup. '
      + 'Add it to BUNDLE_TABLE_BY_KEY (and collect it in collectCampaignBundle), '
      + 'or to TABLES_OUTSIDE_BUNDLE with the reason it stays behind.',
    ).toEqual([]);

    // And the reverse: nothing in the registry may name a table that is gone.
    for (const table of [...exported, ...excluded]) {
      expect(tableNames, `registry names "${table}", which is not a Dexie table`).toContain(table);
    }
    // No table may be claimed both ways.
    for (const table of excluded) {
      expect(exported.has(table), `"${table}" is both exported and excluded`).toBe(false);
    }
  });

  it('keeps bundleContentsSchema and the table registry in step', () => {
    const schemaKeys = Object.keys(bundleContentsSchema.shape).sort();
    const registryKeys = Object.keys(BUNDLE_TABLE_BY_KEY).sort();
    expect(registryKeys).toEqual(schemaKeys);
    expect([...BUNDLE_PROCESSING_ORDER].sort()).toEqual(schemaKeys);
  });

  it('gives every exported entity group a label for the import dialog', () => {
    // getAvailableEntityTypes iterates the labels, so an unlabelled group is not
    // merely unnamed in the dialog — it cannot be selected, and never imports.
    for (const key of Object.keys(BUNDLE_TABLE_BY_KEY)) {
      expect(BUNDLE_ENTITY_LABELS[key], `no import-dialog label for "${key}"`).toBeTruthy();
    }
  });
});

describe('campaign export completeness', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('carries a row from every exported table', async () => {
    await seedOneRowPerTable();

    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const empty = Object.keys(BUNDLE_TABLE_BY_KEY).filter((key) => countIn(result.contents, key) === 0);
    expect(
      empty,
      'These tables have a bundle key but collectCampaignBundle emits nothing for them. '
      + 'A mapping with no collector behind it is the same silent data loss as no mapping.',
    ).toEqual([]);
  });

  it('restores every table on a round trip through export and import', async () => {
    await seedOneRowPerTable();

    const collected = await collectCampaignBundle(CAMPAIGN_ID);
    expect(collected.success).toBe(true);
    if (!collected.success) return;

    const json = await serializeBundle('campaign', collected.contents, { includePrivate: false });

    // Wipe the device, then restore from the file alone.
    await db.delete();
    await db.open();

    const parsed = parseBundle(json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.warnings, 'a pristine export must re-parse with no warnings').toEqual([]);

    const report = await mergeBundle(parsed.bundle, {
      selectedEntityTypes: new Set(BUNDLE_PROCESSING_ORDER),
    });
    expect(report.errors).toEqual([]);

    for (const [key, table] of Object.entries(BUNDLE_TABLE_BY_KEY)) {
      expect(await db.table(table).count(), `nothing restored into "${table}" (bundle key "${key}")`)
        .toBeGreaterThan(0);
    }
  });

  it('leaves the excluded tables out rather than forgetting them', async () => {
    await seedOneRowPerTable();
    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // The exclusions are a decision, so pin it: device settings and internal
    // bookkeeping must not ride along into another device's database.
    for (const table of Object.keys(TABLES_OUTSIDE_BUNDLE)) {
      expect(Object.values(BUNDLE_TABLE_BY_KEY)).not.toContain(table);
    }
    expect(TABLES_OUTSIDE_BUNDLE.appSettings).toBeTruthy();
    expect(TABLES_OUTSIDE_BUNDLE.metadata).toBeTruthy();
  });

  it('does not create rows in the database it is backing up', async () => {
    // `getOrCreateForCampaign` is the only read path the split and route-plan
    // screens had; an export calling it would write into the database while
    // claiming to observe it. Both now have read-only list methods.
    await db.campaigns.add({
      id: CAMPAIGN_ID,
      name: 'Untouched',
      system: BUNDLED_SYSTEMS[0].id,
      status: 'active',
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: LATER,
    } as never);

    await collectCampaignBundle(CAMPAIGN_ID);

    expect(await db.ledgerSplits.count()).toBe(0);
    expect(await db.routePlans.count()).toBe(0);
    expect(await db.ledgerAccounts.count()).toBe(0);
  });
});
