// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor, act } from '@testing-library/react';

// The repository is mocked: jsdom's Blob is not the one fake-indexeddb hands
// back, so a real round trip fails the schema's `instanceof Blob` here (it does
// not in a browser). `portraitRepository.test.ts` covers the storage itself.
const rows = new Map<string, { id: string; characterId: string; blob: Blob; mimeType: string }>();
vi.mock('../../storage/repositories/portraitRepository', () => ({
  getPortrait: vi.fn(async (id: string) => rows.get(id)),
  savePortrait: vi.fn(async (characterId: string, blob: Blob, existing?: string) => {
    const id = existing ?? `p${rows.size + 1}`;
    rows.set(id, { id, characterId, blob, mimeType: blob.type });
    return id;
  }),
}));
const { dataUrlToBlob, usePortraitSrc, useSetPortrait } = await import('./usePortrait');
const portraits = await import('../../storage/repositories/portraitRepository');

/**
 * H8 from the screen's side: both portrait forms are read, and a new portrait
 * goes to the table and off the record.
 */

const updateCharacter = vi.fn();
let active: Record<string, unknown> | null = null;
vi.mock('../../context/ActiveCharacterContext', () => ({
  useActiveCharacter: () => ({ character: active, updateCharacter }),
}));

beforeEach(async () => {
  rows.clear();
  updateCharacter.mockReset();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:portrait/${n++}`) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe('usePortraitSrc', () => {
  it('still shows a pre-v21 inline portrait', () => {
    const { result } = renderHook(() => usePortraitSrc({ portraitUri: 'data:image/png;base64,AAAA' }));
    expect(result.current).toBe('data:image/png;base64,AAAA');
  });

  it('shows the stored image when the record names one', async () => {
    const id = await portraits.savePortrait('ch1', new Blob(['x'], { type: 'image/jpeg' }));
    const { result } = renderHook(() => usePortraitSrc({ portraitId: id, portraitUri: 'data:old' }));
    await waitFor(() => expect(result.current).toBe('blob:portrait/0'));
  });
});

describe('useSetPortrait', () => {
  it('stores the image in the table and takes it off the record', async () => {
    active = { id: 'ch1', portraitUri: 'data:image/png;base64,AAAA' };
    const { result } = renderHook(() => useSetPortrait());
    await act(async () => { await result.current('data:image/jpeg;base64,/9j/4A=='); });

    const patch = updateCharacter.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch.portraitUri).toBeUndefined();
    expect('portraitUri' in patch, 'the inline copy is dropped').toBe(true);
    const row = await portraits.getPortrait(patch.portraitId as string);
    expect(row?.characterId).toBe('ch1');
    expect(row?.mimeType).toBe('image/jpeg');
  });
});

describe('dataUrlToBlob', () => {
  it('decodes base64 data URLs', async () => {
    const blob = dataUrlToBlob('data:image/jpeg;base64,/9j/4A==');
    expect(blob.type).toBe('image/jpeg');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });
});
