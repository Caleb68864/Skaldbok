// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../storage/db/client';
import { collectCampaignBundle, collectCharacterBundle, collectSessionBundle } from './collectors';
import { createBlankCharacter } from '../../features/characters/characterMappers';
import { BUNDLED_SYSTEMS } from '../../systems/registry';

/**
 * A user-authored ruleset has to travel with anything that names it.
 *
 * @remarks
 * A `CharacterRecord` carries `systemId` and a `Campaign` carries `system`;
 * neither carries the ruleset itself. A bundled ruleset ships with the app, so
 * an absent row is nothing to carry — but a ruleset the user wrote or imported
 * lives **only** in the local `systems` table. Export a character built on one
 * and the importing device gets a record naming a system it has never seen;
 * `engine/index.ts` falls back to classic-fantasy, which `CLAUDE.md` says "is
 * not a neutral default — it brings Dragonbane's formulas with it". The
 * character survives as bytes and is reinterpreted under the wrong rules.
 *
 * Only `collectCampaignBundle` used to load it, via a single hand-written
 * `getSystemById(campaign.system)`. That is one enumeration of "which rows name
 * a ruleset", maintained in one collector out of three, which is the shape this
 * repo keeps paying for. The ruleset ids are now *derived* from the assembled
 * rows the same way edge endpoints are (see `collectBundleSystemIds`), so a new
 * scope, or a new row kind that names a system, carries its ruleset with no
 * list to remember.
 *
 * Each test asserts the *naming row* reached the bundle before asserting
 * anything about `systems` — otherwise a fixture the collector never gathered
 * would look exactly like a missing ruleset.
 */

const NOW = '2026-01-01T00:00:00.000Z';
const CAMPAIGN_ID = 'camp-authored';
/** Not in `BUNDLED_SYSTEMS`: this ruleset exists only in this database. */
const AUTHORED_SYSTEM_ID = 'hand-authored-ruleset';

async function seedAuthoredSystemCampaign(): Promise<void> {
  const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };

  await db.systems.add({
    ...(BUNDLED_SYSTEMS[0] as unknown as Record<string, unknown>),
    id: AUTHORED_SYSTEM_ID,
    name: 'Hand-Authored Ruleset',
    version: 1,
  } as never);

  await db.campaigns.add({
    id: CAMPAIGN_ID,
    name: 'The Iron Circle',
    system: AUTHORED_SYSTEM_ID,
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

  await db.characters.add({
    ...createBlankCharacter(AUTHORED_SYSTEM_ID),
    id: 'char-1',
    name: 'Astrid',
  } as never);

  await db.parties.add({ id: 'party-1', campaignId: CAMPAIGN_ID, name: 'The Crew', ...stamp } as never);
  await db.partyMembers.add({
    id: 'member-1',
    partyId: 'party-1',
    linkedCharacterId: 'char-1',
    isActivePlayer: false,
    ...stamp,
  } as never);
}

/** The ruleset ids a collected bundle carries. */
function systemIds(systems: unknown): string[] {
  if (!Array.isArray(systems)) return [];
  return systems.map((s) => (s as { id: string }).id).sort();
}

/** The `systemId` values of the character rows a collected bundle carries. */
function characterSystemIds(characters: unknown): string[] {
  if (!Array.isArray(characters)) return [];
  return characters.map((c) => (c as { systemId?: string }).systemId ?? '<none>').sort();
}

describe('a user-authored ruleset travels with every scope that names it', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seedAuthoredSystemCampaign();
  });

  it('carries the ruleset in a character bundle', async () => {
    const result = await collectCharacterBundle('char-1');
    expect(result.success).toBe(true);
    if (!result.success) return;

    // The fixture reached the subject: the character is in the bundle and it is
    // the authored ruleset it names.
    expect(characterSystemIds(result.contents.characters)).toEqual([AUTHORED_SYSTEM_ID]);

    expect(
      systemIds(result.contents.systems),
      'a character bundle is the documented way to restore onto a fresh install, '
      + 'and it was the one scope carrying no ruleset: the record names a system '
      + 'the importing device has never seen and is silently reinterpreted under '
      + "classic-fantasy's formulas.",
    ).toEqual([AUTHORED_SYSTEM_ID]);
  });

  it('carries the ruleset in a session bundle', async () => {
    const result = await collectSessionBundle('sess-1');
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(characterSystemIds(result.contents.characters)).toEqual([AUTHORED_SYSTEM_ID]);
    expect(systemIds(result.contents.systems)).toEqual([AUTHORED_SYSTEM_ID]);
  });

  it('carries the ruleset in a campaign bundle', async () => {
    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect((result.contents.campaign as { system?: string } | undefined)?.system).toBe(AUTHORED_SYSTEM_ID);
    expect(systemIds(result.contents.systems)).toEqual([AUTHORED_SYSTEM_ID]);
  });

  it('carries every ruleset named, not just the campaign\'s', async () => {
    // A character imported from elsewhere, built on a second authored ruleset
    // and sitting in this campaign's party. The campaign collector used to load
    // exactly one system — the campaign's — so this character restored under
    // the wrong rules even though its ruleset was on the exporting device.
    await db.systems.add({
      ...(BUNDLED_SYSTEMS[0] as unknown as Record<string, unknown>),
      id: 'second-authored-ruleset',
      name: 'A Second Ruleset',
      version: 1,
    } as never);
    await db.characters.add({
      ...createBlankCharacter('second-authored-ruleset'),
      id: 'char-2',
      name: 'Bjorn',
    } as never);
    await db.partyMembers.add({
      id: 'member-2',
      partyId: 'party-1',
      linkedCharacterId: 'char-2',
      isActivePlayer: false,
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    } as never);

    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(characterSystemIds(result.contents.characters)).toEqual(
      ['second-authored-ruleset', AUTHORED_SYSTEM_ID].sort(),
    );
    expect(systemIds(result.contents.systems)).toEqual(
      ['second-authored-ruleset', AUTHORED_SYSTEM_ID].sort(),
    );
  });

  it('carries no ruleset row for a system that is not stored locally', async () => {
    // A bundled ruleset that was never written to the cache: there is nothing to
    // carry, and the collector must not invent an entry or fail.
    await db.systems.clear();

    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect((result.contents.campaign as { system?: string } | undefined)?.system).toBe(AUTHORED_SYSTEM_ID);
    expect(systemIds(result.contents.systems)).toEqual([]);
  });
});
