import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect } from 'vitest';
import { dumpRawDatabase } from './rawDump';

/**
 * The recovery read behind "Save a raw copy of my data". It must read a
 * database at whatever version it is, without upgrading or creating one.
 */

function seed(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = factory.open(name, 7);
    open.onupgradeneeded = () => {
      const db = open.result;
      db.createObjectStore('notes', { keyPath: 'id' }).add({ id: 'n1', title: 'Docks at dawn' });
      db.createObjectStore('attachments', { keyPath: 'id' })
        .add({ id: 'a1', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) });
    };
    open.onsuccess = () => { open.result.close(); resolve(); };
    open.onerror = () => reject(open.error);
  });
}

describe('dumpRawDatabase', () => {
  it('reads every store at its stored version, with Blobs as data URLs', async () => {
    const factory = new IDBFactory();
    await seed(factory, 'db-a');

    const dump = await dumpRawDatabase(factory, 'db-a');

    expect(dump.version).toBe(7);
    expect(dump.stores.notes).toEqual([{ id: 'n1', title: 'Docks at dawn' }]);
    expect(dump.stores.attachments).toEqual([{ id: 'a1', blob: 'data:image/png;base64,AQID' }]);
    expect(() => JSON.stringify(dump)).not.toThrow();
  });

  it('creates nothing when there is no database', async () => {
    const factory = new IDBFactory();
    const dump = await dumpRawDatabase(factory, 'missing');
    expect(dump.stores).toEqual({});
    const names = (await factory.databases()).map((d) => d.name);
    expect(names).not.toContain('missing');
  });
});
