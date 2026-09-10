// Must run before the Dexie `db` singleton is imported.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RESTORE_WITHOUT_LISTING, TRASH_ENTITY_TYPES } from './trashRegistry';
import { readSoftDeleteCapabilities, tablesRestorableButUnlistable } from '../../test-utils/softDeleteCapabilities';
import { resetDatabase } from '../../test-utils/resetDatabase';
import * as shipRepository from '../../storage/repositories/shipRepository';
import * as inventoryContainerRepository from '../../storage/repositories/inventoryContainerRepository';
import * as ledgerRepository from '../../storage/repositories/ledgerRepository';
import * as ledgerAccountRepository from '../../storage/repositories/ledgerAccountRepository';
import * as recurringBillRepository from '../../storage/repositories/recurringBillRepository';
import * as routeRepository from '../../storage/repositories/routeRepository';
import * as referenceSectionRepository from '../../storage/repositories/referenceSectionRepository';
import * as partyRepository from '../../storage/repositories/partyRepository';

/**
 * The Trash used to be a hand-written list of four entity types inside
 * `TrashScreen`, while nine more had a working `restore` in their repository
 * and no caller anywhere. Ships, the party's shared inventory container,
 * ledger entries and reference cards were all user-deletable with no way back —
 * the delete was reversible in the database and irreversible in the product.
 *
 * Two things are checked here. That the registry is complete, enforced against
 * the repositories rather than against a second hand-written list. And that
 * each entry actually works end to end: soft-delete a real row through the
 * repository, find it through the registry's `load`, restore it through the row
 * the registry produced, and see it come back to the live listing.
 */

const CAMPAIGN = 'camp-trash';
const REPO_DIR = join(process.cwd(), 'src/storage/repositories');

beforeEach(async () => {
  await resetDatabase();
});

describe('registry completeness', () => {
  /**
   * Every repository that can list deleted rows must be in the registry.
   *
   * @remarks
   * This is the invariant that replaces the hand-maintained list. A repository
   * gains a `getDeleted` precisely when someone wants its rows restorable, and
   * the way that goes wrong is landing the repository half and forgetting the
   * surface — which is exactly what had happened to nine types.
   */
  it('lists every repository that exposes a deleted-row listing', () => {
    const files = readdirSync(REPO_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

    /** Each repository paired with the deleted-row listings it exports. */
    const listers = files
      .map((file) => {
        const source = readFileSync(join(REPO_DIR, file), 'utf8');
        const fns = [...source.matchAll(/export async function (getDeleted[A-Za-z]*)\s*\(/g)].map((m) => m[1]!);
        return { module: file.replace(/\.ts$/, ''), fns };
      })
      .filter((repo) => repo.fns.length > 0);

    const registrySource = readFileSync(join(process.cwd(), 'src/features/trash/trashRegistry.ts'), 'utf8');

    // Checked on the *call*, not the import: an import left behind after an
    // entry was deleted would otherwise pass while the rows stayed stranded.
    const missing = listers.flatMap((repo) =>
      repo.fns
        .filter((fn) => !registrySource.includes(`${repo.module}.${fn}(`))
        .map((fn) => `${repo.module}.${fn}`),
    );

    expect(
      missing,
      `${missing.join(', ')} can list deleted rows but the Trash registry never calls them — ` +
      'those rows are unrecoverable from the UI.',
    ).toEqual([]);
    expect(listers.length).toBeGreaterThan(4);
  });

  it('reads the repository layer, and every listing in it', () => {
    // Guards the guard twice over. A walk that found nothing would make both
    // assertions below vacuous, and a listing written in an idiom the reader
    // cannot recognise would make a listed table look unlistable — sending the
    // next person to write an exemption for a listing that already exists.
    const report = readSoftDeleteCapabilities(REPO_DIR);
    expect(report.tables.length, 'found no soft-deletable tables at all').toBeGreaterThanOrEqual(15);
    expect(
      report.unrecognisedListings,
      `${report.unrecognisedListings.join(', ')} is named as a deleted-row listing but `
      + 'its body is not one this guard can read. Use `onlyDeleted(...)` or '
      + "`.where('deletedAt').above('')`, or teach `readSoftDeleteCapabilities` the idiom.",
    ).toEqual([]);
  });

  /**
   * The other direction: a row that can be deleted and restored must be
   * listable, or say why not.
   *
   * @remarks
   * The completeness test above runs `getDeleted → registry`. That is the half
   * that had already failed, but it is the second half of the sequence. A
   * table gains a soft delete and a restore first, and until it also gains a
   * listing the rows it tombstones are invisible to the Trash — with the guard
   * above passing, because it is never asked about something with no listing.
   *
   * Judged per **table** and from the repository layer's own writes rather than
   * per module and from function names. That is what makes `parties` visible:
   * `partyRepository` soft-deletes and restores both the party row and its
   * member seats, lists only the seats, and a per-module check saw
   * `getDeletedMembers` and asked no further. The same change makes
   * `attachments` visible without a second, differently-detected copy of this
   * invariant living in `repositoryConventions.test.ts` — that copy is gone,
   * and `test-utils/softDeleteCapabilities.ts` explains why it could not simply
   * be merged.
   */
  it('lets no table be deleted and restored without either a listing or a stated reason', () => {
    const report = readSoftDeleteCapabilities(REPO_DIR);
    const undecided = tablesRestorableButUnlistable(report)
      .filter((table) => !(table in RESTORE_WITHOUT_LISTING));

    expect(
      undecided,
      `${undecided.join(', ')} can be soft-deleted and restored but never listed. `
      + 'Those rows are tombstoned somewhere the Trash cannot reach — the exact bug '
      + 'this registry exists to prevent, one step earlier than the guard above '
      + 'catches it. Add a listing and a registry entry, or add the table '
      + 'to RESTORE_WITHOUT_LISTING with the reason it stays out.',
    ).toEqual([]);
  });

  it('keeps the exemption list honest', () => {
    const report = readSoftDeleteCapabilities(REPO_DIR);
    const known = new Set(report.tables.map((t) => t.table));
    const unlistable = new Set(tablesRestorableButUnlistable(report));

    for (const [table, reason] of Object.entries(RESTORE_WITHOUT_LISTING)) {
      expect(known, `RESTORE_WITHOUT_LISTING names "${table}", which no repository soft-deletes`)
        .toContain(table);
      expect(reason.length, `"${table}" is exempted with no stated reason`).toBeGreaterThan(60);

      // And the exemption must still be needed: a table that has since gained a
      // listing belongs in the registry, not on this list.
      expect(
        unlistable.has(table),
        `"${table}" can now list its deleted rows, so its exemption is stale — `
        + 'give it a Trash entry and remove it from RESTORE_WITHOUT_LISTING.',
      ).toBe(true);
    }
  });

  it('gives every entry a distinct key and a heading', () => {
    const keys = TRASH_ENTITY_TYPES.map((e) => e.key);
    expect(new Set(keys).size, 'duplicate keys would collide as React keys').toBe(keys.length);
    for (const entity of TRASH_ENTITY_TYPES) {
      expect(entity.heading.length, `${entity.key} has no heading`).toBeGreaterThan(0);
      expect(['campaign', 'global']).toContain(entity.scope);
    }
  });

  it('covers the types that were previously unrecoverable', () => {
    // Named explicitly so removing one is a deliberate act, not an omission.
    const keys = new Set(TRASH_ENTITY_TYPES.map((e) => e.key));
    for (const key of [
      'ships', 'containers', 'partyMembers', 'ledgerEntries', 'ledgerAccounts',
      'recurringBills', 'routeStops', 'referenceSections', 'referenceGroups',
    ]) {
      expect(keys.has(key), `${key} is missing from the Trash registry`).toBe(true);
    }
  });

  it('never calls a campaign-scoped listing without a campaign', async () => {
    // The screen filters these out; this pins the contract the screen relies on.
    const globals = TRASH_ENTITY_TYPES.filter((e) => e.scope === 'global');
    expect(globals.length).toBeGreaterThan(0);
    for (const entity of globals) {
      await expect(entity.load(undefined)).resolves.toBeInstanceOf(Array);
    }
  });
});

/** Runs one entity type's whole loop: delete, find in trash, restore, gone. */
async function expectRoundTrip(
  key: string,
  create: () => Promise<string>,
  softDelete: (id: string) => Promise<void>,
  isLive: (id: string) => Promise<boolean>,
): Promise<void> {
  const entity = TRASH_ENTITY_TYPES.find((e) => e.key === key);
  expect(entity, `no registry entry for ${key}`).toBeDefined();

  const id = await create();
  expect(await isLive(id), `${key}: fixture was not live to begin with`).toBe(true);
  expect((await entity!.load(CAMPAIGN)).some((r) => r.id === id)).toBe(false);

  await softDelete(id);
  expect(await isLive(id), `${key}: soft delete left the row in the live listing`).toBe(false);

  const rows = await entity!.load(CAMPAIGN);
  const row = rows.find((r) => r.id === id);
  expect(row, `${key}: deleted row never appeared in the Trash`).toBeDefined();
  expect(row!.title.length, `${key}: row has no title to show`).toBeGreaterThan(0);
  expect(row!.deletedAt, `${key}: row has no deletion timestamp`).toBeTruthy();

  await row!.restore();
  expect(await isLive(id), `${key}: restore did not bring the row back`).toBe(true);
  expect((await entity!.load(CAMPAIGN)).some((r) => r.id === id)).toBe(false);
}

describe('delete → trash → restore, per entity type', () => {
  it('ships', async () => {
    await expectRoundTrip(
      'ships',
      async () => (await shipRepository.create({ campaignId: CAMPAIGN, name: 'The Kestrel' })).id,
      shipRepository.softDelete,
      async (id) => (await shipRepository.listByCampaign(CAMPAIGN)).some((s) => s.id === id),
    );
  });

  it('party inventory containers', async () => {
    await expectRoundTrip(
      'containers',
      async () => (await inventoryContainerRepository.create({ campaignId: CAMPAIGN, name: 'Party Chest', kind: 'coffer', capacity: 0 })).id,
      inventoryContainerRepository.softDelete,
      async (id) => (await inventoryContainerRepository.list(CAMPAIGN)).some((c) => c.id === id),
    );
  });

  it('party members', async () => {
    const party = await partyRepository.createParty({ campaignId: CAMPAIGN, name: 'The Company' });
    await expectRoundTrip(
      'partyMembers',
      async () => (await partyRepository.addPartyMember({ partyId: party.id, name: 'Hilda', isActivePlayer: false })).id,
      partyRepository.softDeletePartyMember,
      async (id) => (await partyRepository.getPartyMembers(party.id)).some((m) => m.id === id),
    );
  });

  it('ledger entries', async () => {
    await expectRoundTrip(
      'ledgerEntries',
      async () => (await ledgerRepository.create({
        campaignId: CAMPAIGN, date: '2026-09-09', memo: 'Rope and torches', amount: -25,
      })).id,
      ledgerRepository.softDelete,
      async (id) => (await ledgerRepository.listByCampaign(CAMPAIGN)).some((e) => e.id === id),
    );
  });

  it('ledger accounts', async () => {
    await expectRoundTrip(
      'ledgerAccounts',
      async () => (await ledgerAccountRepository.create({ campaignId: CAMPAIGN, name: 'Ship Fund' })).id,
      async (id) => { await ledgerAccountRepository.softDelete(id); },
      async (id) => (await ledgerAccountRepository.listByCampaign(CAMPAIGN)).some((a) => a.id === id),
    );
  });

  it('recurring bills', async () => {
    await expectRoundTrip(
      'recurringBills',
      async () => (await recurringBillRepository.create({
        campaignId: CAMPAIGN, name: 'Berth fees', amount: -100, startDate: '2026-09-01', everyDays: 30,
      })).id,
      recurringBillRepository.softDelete,
      async (id) => (await recurringBillRepository.listByCampaign(CAMPAIGN)).some((b) => b.id === id),
    );
  });

  it('route stops', async () => {
    await expectRoundTrip(
      'routeStops',
      async () => (await routeRepository.create({ campaignId: CAMPAIGN, name: 'Regina' })).id,
      routeRepository.softDelete,
      async (id) => (await routeRepository.listByCampaign(CAMPAIGN)).some((s) => s.id === id),
    );
  });

  it('reference sections', async () => {
    await expectRoundTrip(
      'referenceSections',
      async () => {
        await referenceSectionRepository.save({
          id: 'ref-1', title: 'Falling damage', category: 'Hazards', order: 0,
          type: 'rules_text', paragraphs: ['1d6 per 3 metres.'],
          createdAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z',
        });
        return 'ref-1';
      },
      referenceSectionRepository.remove,
      async (id) => (await referenceSectionRepository.getAll()).some((s) => s.id === id),
    );
  });

  it('reference cards, bringing their sections back with them', async () => {
    // The card's delete cascades to the sections it holds, and `restoreGroup`
    // matches on the cascade id. That path queries an index that only became
    // legal at schema v19, and until the Trash listed cards nothing had ever
    // called it — so this is the first exercise of it.
    await referenceSectionRepository.saveGroup({
      id: 'grp-1', title: 'Hazards', order: 0,
      createdAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z',
    });
    await referenceSectionRepository.save({
      id: 'sec-1', title: 'Falling', category: 'Hazards', groupId: 'grp-1', order: 0,
      type: 'rules_text', paragraphs: ['1d6 per 3 metres.'],
      createdAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z',
    });

    await referenceSectionRepository.removeGroup('grp-1');
    expect((await referenceSectionRepository.getAll()).map((s) => s.id)).not.toContain('sec-1');

    const entity = TRASH_ENTITY_TYPES.find((e) => e.key === 'referenceGroups')!;
    const row = (await entity.load(undefined)).find((r) => r.id === 'grp-1');
    expect(row, 'the deleted card never appeared in the Trash').toBeDefined();

    await row!.restore();

    expect((await referenceSectionRepository.getGroups()).map((g) => g.id)).toContain('grp-1');
    expect(
      (await referenceSectionRepository.getAll()).map((s) => s.id),
      'restoring the card left its sections in the trash',
    ).toContain('sec-1');
  });
});
