import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import { TABLES_WITHOUT_SOFT_DELETE } from '../../types/bundleTables';
import * as attachmentRepository from './attachmentRepository';
import * as campaignRepository from './campaignRepository';
import * as characterRepository from './characterRepository';
import * as creatureTemplateRepository from './creatureTemplateRepository';
import * as encounterRepository from './encounterRepository';
import * as entityLinkRepository from './entityLinkRepository';
import * as inventoryContainerRepository from './inventoryContainerRepository';
import * as ledgerAccountRepository from './ledgerAccountRepository';
import * as ledgerRepository from './ledgerRepository';
import * as ledgerSplitRepository from './ledgerSplitRepository';
import * as noteRepository from './noteRepository';
import * as partyRepository from './partyRepository';
import * as recurringBillRepository from './recurringBillRepository';
import * as referenceNoteRepository from './referenceNoteRepository';
import * as referenceSectionRepository from './referenceSectionRepository';
import * as routePlanRepository from './routePlanRepository';
import * as routeRepository from './routeRepository';
import * as sessionRepository from './sessionRepository';
import * as shipRepository from './shipRepository';

/**
 * Roadmap F6: delete → absent from the default read → restore → back, with its
 * cascaded rows, for every soft-deletable table.
 *
 * @remarks
 * Each repository's own tests cover some of this, and `sessionRepository` had no
 * restore test at all. What they could not say is "every entity", so the table
 * list here is checked against the live schema: a new soft-deletable table fails
 * until it is given a round trip or a written reason.
 *
 * `read` is deliberately the repository's *default* read, with no options. A row
 * that a tombstone cannot hide from there is the bug this exists to catch.
 */

const CAMPAIGN = 'camp-1';
const NOW = '2026-01-01T00:00:00.000Z';
const stamp = { createdAt: NOW, updatedAt: NOW, schemaVersion: 1 };

interface RoundTrip {
  table: string;
  seed: Record<string, unknown>;
  softDelete: (id: string) => Promise<unknown>;
  restore: (id: string) => Promise<unknown>;
  read: (id: string) => Promise<unknown>;
}

const inList = async <T extends { id: string }>(rows: Promise<T[]>, id: string) =>
  (await rows).find(row => row.id === id);

const ROUND_TRIPS: RoundTrip[] = [
  {
    table: 'campaigns',
    seed: { ...stamp, id: 'x', name: 'C', status: 'active', systemId: 'classic-fantasy' },
    softDelete: id => campaignRepository.softDelete(id),
    restore: id => campaignRepository.restore(id),
    read: id => campaignRepository.getCampaignById(id),
  },
  {
    table: 'sessions',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN, title: 'S', status: 'ended', date: '2026-01-01', startedAt: NOW },
    softDelete: id => sessionRepository.softDelete(id),
    restore: id => sessionRepository.restore(id),
    read: id => sessionRepository.getSessionById(id),
  },
  {
    table: 'notes',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN, title: 'N', type: 'generic', body: null, status: 'active', pinned: false },
    softDelete: id => noteRepository.softDelete(id),
    restore: id => noteRepository.restore(id),
    read: id => noteRepository.getNoteById(id),
  },
  {
    table: 'characters',
    seed: {
      ...stamp, id: 'x', name: 'Hero', systemId: 'classic-fantasy', attributes: {}, skills: {}, resources: {},
      weapons: [], armor: {}, inventory: [], conditions: {},
    },
    softDelete: id => characterRepository.softDelete(id),
    restore: id => characterRepository.restore(id),
    read: id => characterRepository.getById(id),
  },
  {
    table: 'parties',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN },
    softDelete: id => partyRepository.softDelete(id),
    restore: id => partyRepository.restore(id),
    read: async () => partyRepository.getPartyByCampaign(CAMPAIGN),
  },
  {
    table: 'partyMembers',
    seed: { ...stamp, id: 'x', partyId: 'party-1', linkedCharacterId: 'char-1', isActivePlayer: false },
    softDelete: id => partyRepository.softDeletePartyMember(id),
    restore: id => partyRepository.restorePartyMember(id),
    read: id => inList(partyRepository.getPartyMembers('party-1'), id),
  },
  {
    table: 'encounters',
    seed: {
      ...stamp, id: 'x', campaignId: CAMPAIGN, sessionId: 'sess-1', title: 'E', type: 'combat',
      status: 'ended', segments: [], participants: [], tags: [],
    },
    softDelete: id => encounterRepository.softDelete(id),
    restore: id => encounterRepository.restore(id),
    read: id => encounterRepository.getById(id),
  },
  {
    table: 'entityLinks',
    seed: {
      ...stamp, id: 'x', fromEntityId: 'a', fromEntityType: 'session', toEntityId: 'b', toEntityType: 'note',
      relationshipType: 'contains',
    },
    softDelete: id => entityLinkRepository.softDelete(id),
    restore: id => entityLinkRepository.restore(id),
    read: id => inList(entityLinkRepository.getAllLinks(), id),
  },
  {
    table: 'creatureTemplates',
    seed: {
      ...stamp, id: 'x', campaignId: CAMPAIGN, name: 'Orc', category: 'monster', description: '',
      stats: {}, attacks: [], abilities: [], skills: [], tags: [], status: 'active',
    },
    softDelete: id => creatureTemplateRepository.softDelete(id),
    restore: id => creatureTemplateRepository.restore(id),
    read: id => inList(creatureTemplateRepository.listByCampaign(CAMPAIGN), id),
  },
  {
    table: 'inventoryContainers',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN, name: 'Chest', kind: 'chest', items: [] },
    softDelete: id => inventoryContainerRepository.softDelete(id),
    restore: id => inventoryContainerRepository.restore(id),
    read: id => inventoryContainerRepository.getById(id),
  },
  {
    table: 'ledgerAccounts',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN, name: 'Purse', isPrimary: false },
    softDelete: id => ledgerAccountRepository.softDelete(id),
    restore: id => ledgerAccountRepository.restore(id),
    read: id => inList(ledgerAccountRepository.listByCampaign(CAMPAIGN), id),
  },
  {
    table: 'ledgerEntries',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN, accountId: 'acc', date: '2026-01-01', description: 'D', amount: 1 },
    softDelete: id => ledgerRepository.softDelete(id),
    restore: id => ledgerRepository.restore(id),
    read: id => ledgerRepository.getById(id),
  },
  {
    table: 'ledgerSplits',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN, shares: [] },
    softDelete: id => ledgerSplitRepository.softDelete(id),
    restore: id => ledgerSplitRepository.restore(id),
    read: id => ledgerSplitRepository.getById(id),
  },
  {
    table: 'recurringBills',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN, name: 'Rent', amount: 1, active: true },
    softDelete: id => recurringBillRepository.softDelete(id),
    restore: id => recurringBillRepository.restore(id),
    read: id => inList(recurringBillRepository.listByCampaign(CAMPAIGN), id),
  },
  {
    table: 'routeStops',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN, name: 'Stop', order: 0 },
    softDelete: id => routeRepository.softDelete(id),
    restore: id => routeRepository.restore(id),
    read: id => routeRepository.getById(id),
  },
  {
    table: 'routePlans',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN },
    softDelete: id => routePlanRepository.softDelete(id),
    restore: id => routePlanRepository.restore(id),
    read: id => inList(routePlanRepository.listByCampaign(CAMPAIGN), id),
  },
  {
    table: 'ships',
    seed: { ...stamp, id: 'x', campaignId: CAMPAIGN, name: 'Beowulf' },
    softDelete: id => shipRepository.softDelete(id),
    restore: id => shipRepository.restore(id),
    read: id => shipRepository.getById(id),
  },
  {
    table: 'referenceNotes',
    seed: { ...stamp, id: 'x', title: 'R', content: '' },
    softDelete: id => referenceNoteRepository.softDelete(id),
    restore: id => referenceNoteRepository.restore(id),
    read: id => inList(referenceNoteRepository.getAll(), id),
  },
  {
    table: 'referenceSections',
    seed: { ...stamp, id: 'x', title: 'R', category: 'c', order: 0, content: '' },
    softDelete: id => referenceSectionRepository.remove(id),
    restore: id => referenceSectionRepository.restore(id),
    read: id => inList(referenceSectionRepository.getAll(), id),
  },
  {
    table: 'referenceGroups',
    seed: { ...stamp, id: 'x', title: 'G', order: 0 },
    softDelete: id => referenceSectionRepository.removeGroup(id),
    restore: id => referenceSectionRepository.restoreGroup(id),
    read: id => inList(referenceSectionRepository.getGroups(), id),
  },
];

/**
 * Soft-deletable, and reached only as a cascade child rather than by a
 * single-row delete. The round trip for each is in the cascade block below.
 */
const COVERED_BY_CASCADE = ['attachments'];

beforeEach(async () => {
  await resetDatabase();
});

describe('soft delete round trip', () => {
  it('covers every soft-deletable table in the live schema', () => {
    const exempt = new Set(Object.keys(TABLES_WITHOUT_SOFT_DELETE));
    const covered = new Set([...ROUND_TRIPS.map(t => t.table), ...COVERED_BY_CASCADE]);
    const missing = db.tables.map(t => t.name).filter(name => !exempt.has(name) && !covered.has(name));
    expect(missing, 'give these a round trip here, or an exemption with a reason').toEqual([]);
  });

  it.each(ROUND_TRIPS.map(t => [t.table, t] as const))('%s: delete, hide, restore', async (table, trip) => {
    await db.table(table).put(trip.seed);
    expect(await trip.read('x'), 'the fixture is not visible to the default read').toBeTruthy();

    await trip.softDelete('x');
    expect(await trip.read('x'), 'a tombstoned row escaped the default read').toBeFalsy();
    const tombstone = await db.table(table).get('x');
    expect(tombstone.deletedAt).toBeTruthy();
    expect(tombstone.softDeletedBy).toBeTruthy();

    await trip.restore('x');
    expect(await trip.read('x'), 'restore did not bring the row back').toBeTruthy();
    const restored = await db.table(table).get('x');
    expect(restored.deletedAt).toBeUndefined();
    expect(restored.softDeletedBy).toBeUndefined();
  });
});

describe('soft delete round trip: cascaded rows', () => {
  it('a note brings back its edges and attachments, and only those', async () => {
    await db.notes.put({
      ...stamp, id: 'n1', campaignId: CAMPAIGN, title: 'N', type: 'generic', body: null, status: 'active', pinned: false,
    } as never);
    await db.entityLinks.bulkPut([
      { ...stamp, id: 'mine', fromEntityId: 's1', fromEntityType: 'session', toEntityId: 'n1', toEntityType: 'note', relationshipType: 'contains' },
      { ...stamp, id: 'other', fromEntityId: 's1', fromEntityType: 'session', toEntityId: 'n2', toEntityType: 'note', relationshipType: 'contains' },
    ] as never);
    await db.attachments.put({
      id: 'att', noteId: 'n1', campaignId: CAMPAIGN, createdAt: NOW, filename: 'a.png', mimeType: 'image/png', sizeBytes: 1, blob: new Blob(['x']),
    } as never);

    await noteRepository.softDeleteWithLinks('n1');

    expect(await noteRepository.getNoteById('n1')).toBeFalsy();
    expect((await entityLinkRepository.getAllLinks()).map(l => l.id)).toEqual(['other']);
    expect(await attachmentRepository.getAttachmentsByNote('n1')).toEqual([]);

    await noteRepository.restore('n1');

    expect(await noteRepository.getNoteById('n1')).toBeTruthy();
    expect((await entityLinkRepository.getAllLinks()).map(l => l.id).sort()).toEqual(['mine', 'other']);
    expect((await attachmentRepository.getAttachmentsByNote('n1')).map(a => a.id)).toEqual(['att']);
  });

  it('a reference group brings back the sections deleted with it, not one deleted earlier', async () => {
    await db.referenceGroups.put({ ...stamp, id: 'g1', title: 'G', order: 0 } as never);
    await db.referenceSections.bulkPut([
      { ...stamp, id: 'held', groupId: 'g1', title: 'A', category: 'c', order: 0, content: '' },
      { ...stamp, id: 'gone', groupId: 'g1', title: 'B', category: 'c', order: 1, content: '' },
    ] as never);
    await referenceSectionRepository.remove('gone');

    await referenceSectionRepository.removeGroup('g1');
    expect(await referenceSectionRepository.getAll()).toEqual([]);

    await referenceSectionRepository.restoreGroup('g1');
    expect((await referenceSectionRepository.getAll()).map(s => s.id)).toEqual(['held']);
  });
});
