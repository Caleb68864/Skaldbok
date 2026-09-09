// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActiveCharacterProvider, useActiveCharacter } from './ActiveCharacterContext';
import { registerFlush } from '../features/persistence/autosaveFlush';
import { createBlankCharacter } from '../features/characters/characterMappers';
import type { CharacterRecord } from '../types/character';
import type { AppSettings } from '../types/settings';

/**
 * Regression cover for the flush-before-read ordering in `setCharacter`.
 *
 * @remarks
 * That fix shipped untested because the suite had no DOM environment to mount a
 * provider in. The bug it fixed: `setCharacter` read the character row *before*
 * awaiting `flushAll()`, so re-selecting the character already open read the
 * stale row, the flush then wrote the pending edit to that same row, and the
 * pre-flush snapshot was installed over it — the sheet reverted to the value the
 * user had just changed away from. Campaign-switch reconciliation calls
 * `setCharacter` in place while the sheet stays mounted, so this is reachable
 * without any navigation at all.
 *
 * The store below is the row on disk; the registered flush is a pending
 * autosave. Swap the two statements in `setCharacter` and every ordering
 * assertion here fails.
 */

const store = new Map<string, CharacterRecord>();
const calls: string[] = [];
/** Flush registrations to tear down, so a failed assertion cannot leak one. */
const registrations: { unregister: () => void }[] = [];
const updateSettings = vi.fn(async () => {});
let settings: AppSettings;

vi.mock('./AppStateContext', () => ({
  useAppState: () => mockAppState(),
}));

vi.mock('../storage/repositories/characterRepository', () => ({
  getById: async (id: string) => {
    calls.push(`read:${id}`);
    return store.get(id) ?? null;
  },
}));

vi.mock('../storage/repositories/systemRepository', () => ({
  getById: async () => null,
}));

/** The slice of app state the provider reads, controlled per test. */
function mockAppState() {
  return { settings, updateSettings, isLoading: false };
}

/** Registers a flush for the duration of one test. */
function flushDuringTest(fn: () => Promise<void>): void {
  registrations.push(registerFlush(fn));
}

/** A character record with a single distinguishing field. */
function characterNamed(id: string, name: string): CharacterRecord {
  return { ...createBlankCharacter('classic-fantasy'), id, name } as unknown as CharacterRecord;
}

function wrapper({ children }: { children: ReactNode }) {
  return <ActiveCharacterProvider>{children}</ActiveCharacterProvider>;
}

beforeEach(() => {
  store.clear();
  calls.length = 0;
  updateSettings.mockClear();
  settings = { activeCharacterId: null } as unknown as AppSettings;
});

afterEach(() => {
  for (const handle of registrations.splice(0)) handle.unregister();
  // Testing Library only auto-cleans when Vitest globals are on, and they are
  // not; an unmount here is also what unregisters the provider's own flushes.
  cleanup();
});

describe('setCharacter', () => {
  it('flushes the pending autosave before reading the row back', async () => {
    store.set('c1', characterNamed('c1', 'stale-on-disk'));
    flushDuringTest(async () => {
      calls.push('flush');
      store.set('c1', characterNamed('c1', 'edit-the-user-just-made'));
    });

    const { result } = renderHook(() => useActiveCharacter(), { wrapper });
    await act(async () => { await result.current.setCharacter('c1'); });

    // The ordering itself, and the value it protects.
    expect(calls).toEqual(['flush', 'read:c1']);
    expect(result.current.character?.name).toBe('edit-the-user-just-made');
  });

  it('installs the character and records the selection', async () => {
    store.set('c1', characterNamed('c1', 'Hilda'));

    const { result } = renderHook(() => useActiveCharacter(), { wrapper });
    await act(async () => { await result.current.setCharacter('c1'); });

    expect(result.current.character?.id).toBe('c1');
    expect(updateSettings).toHaveBeenCalledWith({ activeCharacterId: 'c1' });
  });

  it('leaves the selection alone when the id has no row', async () => {
    store.set('c1', characterNamed('c1', 'Hilda'));

    const { result } = renderHook(() => useActiveCharacter(), { wrapper });
    await act(async () => { await result.current.setCharacter('c1'); });
    await act(async () => { await result.current.setCharacter('missing'); });

    // A failed lookup must not blank the sheet or repoint the setting at a
    // character that does not exist.
    expect(result.current.character?.id).toBe('c1');
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });

  it('still flushes when the row it is switching to does not exist', async () => {
    flushDuringTest(async () => { calls.push('flush'); });

    const { result } = renderHook(() => useActiveCharacter(), { wrapper });
    await act(async () => { await result.current.setCharacter('missing'); });

    expect(calls).toEqual(['flush', 'read:missing']);
  });
});

describe('clearCharacter', () => {
  it('flushes before clearing, so a debounced save cannot resurrect the record', async () => {
    store.set('c1', characterNamed('c1', 'Hilda'));
    const { result } = renderHook(() => useActiveCharacter(), { wrapper });
    await act(async () => { await result.current.setCharacter('c1'); });

    calls.length = 0;
    flushDuringTest(async () => { calls.push('flush'); });
    await act(async () => { await result.current.clearCharacter(); });

    expect(calls).toEqual(['flush']);
    expect(result.current.character).toBeNull();
    expect(updateSettings).toHaveBeenLastCalledWith({ activeCharacterId: null });
  });
});

describe('updateCharacter', () => {
  it('merges a partial and a reducer update into the in-memory record', async () => {
    store.set('c1', characterNamed('c1', 'Hilda'));
    const { result } = renderHook(() => useActiveCharacter(), { wrapper });
    await act(async () => { await result.current.setCharacter('c1'); });

    act(() => { result.current.updateCharacter({ name: 'Hilda the Bold' }); });
    expect(result.current.character?.name).toBe('Hilda the Bold');

    act(() => {
      result.current.updateCharacter(prev => ({ name: `${prev.name}er` }));
    });
    expect(result.current.character?.name).toBe('Hilda the Bolder');
  });

  it('is a no-op when no character is selected', () => {
    const { result } = renderHook(() => useActiveCharacter(), { wrapper });
    act(() => { result.current.updateCharacter({ name: 'nobody' }); });
    expect(result.current.character).toBeNull();
  });
});

describe('loading the persisted selection', () => {
  it('loads the active character named in settings', async () => {
    store.set('c1', characterNamed('c1', 'Hilda'));
    settings = { activeCharacterId: 'c1' } as unknown as AppSettings;

    const { result } = renderHook(() => useActiveCharacter(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.character?.name).toBe('Hilda');
  });

  it('self-heals a settings id whose character has been deleted', async () => {
    settings = { activeCharacterId: 'gone' } as unknown as AppSettings;

    const { result } = renderHook(() => useActiveCharacter(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.character).toBeNull();
    expect(updateSettings).toHaveBeenCalledWith({ activeCharacterId: null });
  });
});

describe('useActiveCharacter', () => {
  it('throws outside the provider rather than handing back a null context', () => {
    expect(() => renderHook(() => useActiveCharacter())).toThrow(
      /must be used within ActiveCharacterProvider/,
    );
  });
});
