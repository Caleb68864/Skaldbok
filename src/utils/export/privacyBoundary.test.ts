// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../storage/db/client';
import {
  collectCampaignBundle,
  collectSessionBundle,
  collectCharacterBundle,
  type CollectorResult,
} from './collectors';
import { serializeBundle } from './bundleSerializer';
import { PrivacyLeakError } from './privacyFilter';
import { createBlankCharacter } from '../../features/characters/characterMappers';
import { BUNDLED_SYSTEMS } from '../../systems/registry';

/**
 * The confidentiality promise, checked end to end on the artefact that leaves
 * the device.
 *
 * @remarks
 * `privacyFilter.test.ts` tests the rule. This tests the **promise**: seed a
 * campaign the way the app really writes one, export it the way the app really
 * exports it, and read the bytes.
 *
 * It exists because the rule was right and the promise was broken anyway.
 * `applyPrivacyFilter` filtered `notes`, `entityLinks` and `attachments`
 * correctly for years while `kb_nodes` — whose `label` is the note's title and
 * whose `sourceId` is its id — and `kb_edges` — one row per wiki-link, mention
 * and tag the note carries — travelled untouched, because they joined the bundle
 * after the filter was written and nothing connected the two facts. Every unit
 * test of the filter passed throughout.
 *
 * So the assertions here are deliberately blunt and content-shaped: the private
 * note's title and id must not occur **anywhere in the serialized bundle**, in
 * any scope. A blunt assertion over the whole artefact is the only kind that
 * cannot be satisfied by a filter that knows about the wrong tables.
 */

const CAMPAIGN_ID = 'camp-privacy';
const NOW = '2026-01-01T00:00:00.000Z';
const SECRET_TITLE = 'Lady Sable is the Cult Hierophant';
const SECRET_ID = 'note-secret';
const SECRET_NODE = 'note-note-secret';

async function seed(): Promise<void> {
  const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };

  await db.campaigns.add({
    id: CAMPAIGN_ID, name: 'Privacy', system: BUNDLED_SYSTEMS[0].id, status: 'active', ...stamp,
  } as never);
  await db.sessions.add({
    id: 'sess-1', campaignId: CAMPAIGN_ID, title: 'Session One', status: 'ended',
    date: '2026-01-01', startedAt: NOW, ...stamp,
  } as never);
  await db.parties.add({ id: 'party-1', campaignId: CAMPAIGN_ID, name: 'The Crew', ...stamp } as never);
  await db.characters.add({
    ...createBlankCharacter(BUNDLED_SYSTEMS[0].id), id: 'char-1', name: 'Astrid',
  } as never);
  await db.partyMembers.add({
    id: 'member-1', partyId: 'party-1', linkedCharacterId: 'char-1', ...stamp,
  } as never);

  await db.notes.add({
    id: SECRET_ID, campaignId: CAMPAIGN_ID, sessionId: 'sess-1', title: SECRET_TITLE,
    body: null, type: 'npc', status: 'active', pinned: false, scope: 'campaign',
    visibility: 'private', ...stamp,
  } as never);
  await db.notes.add({
    id: 'note-open', campaignId: CAMPAIGN_ID, sessionId: 'sess-1', title: 'The Harbour Inn',
    body: null, type: 'location', status: 'active', pinned: false, scope: 'campaign',
    visibility: 'public', ...stamp,
  } as never);

  // The KB projection, written exactly as `linkSyncEngine.syncNote` writes it:
  // one node per note carrying the note's own title, one edge per link.
  await db.kb_nodes.add({
    id: SECRET_NODE, type: 'character', label: SECRET_TITLE, scope: 'campaign',
    campaignId: CAMPAIGN_ID, sourceId: SECRET_ID, createdAt: NOW, updatedAt: NOW,
  } as never);
  await db.kb_nodes.add({
    id: 'note-note-open', type: 'location', label: 'The Harbour Inn', scope: 'campaign',
    campaignId: CAMPAIGN_ID, sourceId: 'note-open', createdAt: NOW, updatedAt: NOW,
  } as never);
  await db.kb_nodes.add({
    id: 'tag:camp-privacy:the crimson hand', type: 'tag', label: 'The Crimson Hand',
    scope: 'campaign', campaignId: CAMPAIGN_ID, createdAt: NOW, updatedAt: NOW,
  } as never);
  await db.kb_edges.add({
    id: 'kbedge-faction', fromId: SECRET_NODE, toId: 'tag:camp-privacy:the crimson hand',
    type: 'descriptor', campaignId: CAMPAIGN_ID, createdAt: NOW,
  } as never);
  await db.kb_edges.add({
    id: 'kbedge-inn', fromId: SECRET_NODE, toId: 'note-note-open',
    type: 'wikilink', campaignId: CAMPAIGN_ID, createdAt: NOW,
  } as never);

  await db.entityLinks.add({
    id: 'link-session-secret', fromEntityId: 'sess-1', fromEntityType: 'session',
    toEntityId: SECRET_ID, toEntityType: 'note', relationshipType: 'contains', ...stamp,
  } as never);
  // The edge that pulls the private note into a *character* bundle, which
  // collects notes by following the character's own edges.
  await db.entityLinks.add({
    id: 'link-char-secret', fromEntityId: SECRET_ID, fromEntityType: 'note',
    toEntityId: 'char-1', toEntityType: 'character', relationshipType: 'introduced_in', ...stamp,
  } as never);
  await db.attachments.add({
    id: 'att-secret', noteId: SECRET_ID, campaignId: CAMPAIGN_ID, filename: 'sable-sigil.png',
    mimeType: 'image/png', sizeBytes: 4,
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }), createdAt: NOW,
  } as never);
}

/** The three export scopes, each with the collector the app calls for it. */
const SCOPES: Array<[
  'campaign' | 'session' | 'character',
  () => Promise<CollectorResult>,
]> = [
  ['campaign', () => collectCampaignBundle(CAMPAIGN_ID)],
  ['session', () => collectSessionBundle('sess-1')],
  ['character', () => collectCharacterBundle('char-1')],
];

describe('privacy boundary — end to end, every scope', () => {
  beforeEach(async () => {
    for (const table of db.tables) await table.clear();
    await seed();
  });

  for (const [scope, collect] of SCOPES) {
    it(`a ${scope} export carries no trace of a private note`, async () => {
      const result = await collect();
      expect(result.success).toBe(true);
      if (!result.success) return;

      // Fixture sanity before any claim about the result: the private note has
      // to have reached this collector, or "absent from the output" proves
      // nothing. This is the check that would have caught three of the false
      // results recorded in `vault/scan2-findings.md`.
      const unfiltered = JSON.stringify(result.contents);
      expect([scope, unfiltered.includes(SECRET_ID)]).toEqual([scope, true]);

      const json = await serializeBundle(scope, result.contents, { includePrivate: false });
      expect([scope, json.includes(SECRET_TITLE)]).toEqual([scope, false]);
      expect([scope, json.includes(SECRET_ID)]).toEqual([scope, false]);
      expect([scope, json.includes(SECRET_NODE)]).toEqual([scope, false]);
      expect([scope, json.includes('sable-sigil.png')]).toEqual([scope, false]);
    });
  }

  it('a campaign export still carries the public note and its graph', async () => {
    // The control. A boundary that deletes everything keeps no promise either,
    // and a backup that silently restores less is its own kind of data loss.
    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const json = await serializeBundle('campaign', result.contents, { includePrivate: false });
    expect(json).toContain('The Harbour Inn');
    expect(json).toContain('note-note-open');
    // The tag node is shared with the private note and belongs to the campaign,
    // not to the note — only the *edge* to it was confidential.
    expect(json).toContain('The Crimson Hand');
  });

  it('includePrivate carries everything, which is what the checkbox promises', async () => {
    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const json = await serializeBundle('campaign', result.contents, { includePrivate: true });
    expect(json).toContain(SECRET_TITLE);
    expect(json).toContain(SECRET_NODE);
  });

  it('refuses to serialize a bundle a private id survived, rather than delivering it', async () => {
    // The fail-closed half, exercised by a row shaped so the row-level filter
    // cannot see it: the private id is nested, not a top-level field. The filter
    // keeps the row; the check over the finished text still catches it, and the
    // export is abandoned instead of quietly delivered.
    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const smuggled = {
      ...result.contents,
      ships: [
        { id: 'ship-1', campaignId: CAMPAIGN_ID, name: 'Kestrel', specs: { seenWith: SECRET_ID } },
      ],
    } as unknown as typeof result.contents;

    await expect(
      serializeBundle('campaign', smuggled, { includePrivate: false }),
    ).rejects.toBeInstanceOf(PrivacyLeakError);
    await expect(
      serializeBundle('campaign', smuggled, { includePrivate: false }),
    ).rejects.toThrow(SECRET_ID);
  });

  it('lets the same smuggled row through when the user opted in', async () => {
    // The must-be-accepted case for the refusing check: `includePrivate` means
    // there is no promise to break, so the check must not fire at all.
    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const smuggled = {
      ...result.contents,
      ships: [
        { id: 'ship-1', campaignId: CAMPAIGN_ID, name: 'Kestrel', specs: { seenWith: SECRET_ID } },
      ],
    } as unknown as typeof result.contents;
    const json = await serializeBundle('campaign', smuggled, { includePrivate: true });
    expect(json).toContain(SECRET_ID);
  });
});
