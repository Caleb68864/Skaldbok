import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import * as portraits from './portraitRepository';
import { collectCharacterBundle } from '../../utils/export/collectors';
import { createBlankCharacter } from '../../features/characters/characterMappers';
import { BUNDLED_SYSTEMS } from '../../systems/registry';

/**
 * H8: portraits as Blobs in their own table. New code, so these pin the
 * repository's contract rather than fail against an old version of it.
 */

const jpeg = (n: number) => new Blob([new Uint8Array([0xff, 0xd8, n])], { type: 'image/jpeg' });

beforeEach(async () => {
  await resetDatabase();
});

describe('portraitRepository', () => {
  it('stores a portrait and replaces it in place on the next change', async () => {
    const first = await portraits.savePortrait('ch1', jpeg(1));
    const second = await portraits.savePortrait('ch1', jpeg(2), first);

    expect(second, 'the same row, not a second one beside it').toBe(first);
    expect(await db.portraits.count()).toBe(1);
    const row = await portraits.getPortrait(first);
    expect(new Uint8Array(await row!.blob.arrayBuffer())[2]).toBe(2);
  });

  it("does not overwrite another character's portrait", async () => {
    const theirs = await portraits.savePortrait('ch1', jpeg(1));
    const mine = await portraits.savePortrait('ch2', jpeg(2), theirs);
    expect(mine).not.toBe(theirs);
    expect((await portraits.getPortrait(theirs))?.characterId).toBe('ch1');
  });

  it('copies a portrait for a duplicated character', async () => {
    const id = await portraits.savePortrait('ch1', jpeg(1));
    const copy = await portraits.copyPortrait(id, 'ch2');
    expect(copy).toBeDefined();
    expect(copy).not.toBe(id);
    expect((await portraits.getPortraitsForCharacters(['ch2'])).map((p) => p.id)).toEqual([copy]);
  });

  it('travels in a character bundle', async () => {
    const character = { ...createBlankCharacter(BUNDLED_SYSTEMS[0]!.id), id: 'ch1', name: 'Astrid' };
    await db.characters.put({ ...character, portraitId: await portraits.savePortrait('ch1', jpeg(7)) } as never);

    const result = await collectCharacterBundle('ch1');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contents.portraits?.map((p) => p.characterId)).toEqual(['ch1']);
  });
});
