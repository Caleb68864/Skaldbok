// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAutosave } from './useAutosave';
import { flushAll } from '../features/persistence/autosaveFlush';
import { createBlankCharacter } from '../features/characters/characterMappers';
import type { CharacterRecord } from '../types/character';

/**
 * `useAutosave` is the code that decides whether a user's edit survives, and it
 * had zero tests — not for want of value but for want of an environment: the
 * suite ran node-only, so no hook that renders could be mounted. This file runs
 * under jsdom via the docblock above rather than a global switch, so the other
 * ninety-odd pure test files keep the node environment and their speed.
 *
 * The behaviours pinned here are the ones the source comments claim and nothing
 * enforced: the unmount flush gated on the dirty flag rather than the timer, the
 * "don't re-save what was already saved" clear, the once-per-streak error toast,
 * and the flush-bus registration lifecycle.
 */

const showToast = vi.fn();
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: (...args: unknown[]) => showToast(...args) }),
}));

/** A character record that differs only in the field an edit would touch. */
function characterNamed(name: string): CharacterRecord {
  return { ...createBlankCharacter('classic-fantasy'), name } as unknown as CharacterRecord;
}

/**
 * A save spy typed with its parameter, so `mock.calls[n][0]` is a record.
 *
 * @remarks
 * `vi.fn(async () => {})` infers an empty tuple for the arguments and indexing
 * it does not compile — the parameter has to be declared for the assertions
 * about *which* record was written to typecheck.
 */
function saveSpy() {
  return vi.fn(async (_record: CharacterRecord) => {});
}

/** A promise whose settlement the test controls, standing in for a slow write. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Advances past the debounce window and lets the resulting save settle. */
async function runDebounce(ms = 1000): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  showToast.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutosave debounce', () => {
  it('writes once, with the newest record, after the debounce window', async () => {
    const saveFn = saveSpy();
    const { rerender } = renderHook(({ c }) => useAutosave(c, saveFn), {
      initialProps: { c: characterNamed('a') },
    });

    rerender({ c: characterNamed('b') });
    rerender({ c: characterNamed('c') });
    expect(saveFn).not.toHaveBeenCalled();

    await runDebounce();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn.mock.calls[0]![0]).toMatchObject({ name: 'c' });
  });

  it('reports the save through isSaving and lastSaved', async () => {
    const gate = deferred<void>();
    const saveFn = vi.fn(() => gate.promise);
    // Held in a const, not built inline: the hook keys the debounce on object
    // identity, so a fresh record per render would restart the timer forever.
    const character = characterNamed('a');
    const { result } = renderHook(() => useAutosave(character, saveFn));

    expect(result.current.isSaving).toBe(false);
    expect(result.current.lastSaved).toBeNull();

    await runDebounce();
    expect(result.current.isSaving).toBe(true);

    await act(async () => { gate.resolve(); await gate.promise; });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.lastSaved).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('does nothing at all for a null character', async () => {
    const saveFn = saveSpy();
    const { unmount } = renderHook(() => useAutosave(null, saveFn));

    await runDebounce();
    unmount();

    expect(saveFn).not.toHaveBeenCalled();
  });

  it('clears a pending edit when the character goes away', async () => {
    // Switching to no character must not leave the previous character's edit
    // queued for the unmount flush, which would resurrect a cleared selection.
    const saveFn = saveSpy();
    const { rerender, unmount } = renderHook(
      ({ c }: { c: CharacterRecord | null }) => useAutosave(c, saveFn),
      { initialProps: { c: characterNamed('a') as CharacterRecord | null } },
    );

    rerender({ c: null });
    unmount();

    expect(saveFn).not.toHaveBeenCalled();
  });
});

describe('useAutosave unmount flush', () => {
  it('persists the edit made in the final debounce window', async () => {
    // The regression the source comment describes: the debounce-cancel cleanup
    // runs first on unmount and nulls `timerRef`, so a timer-gated flush would
    // always skip and silently drop the edit made just before navigating away.
    const saveFn = saveSpy();
    const { rerender, unmount } = renderHook(({ c }) => useAutosave(c, saveFn), {
      initialProps: { c: characterNamed('a') },
    });

    rerender({ c: characterNamed('typed-just-before-leaving') });
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(saveFn).not.toHaveBeenCalled();

    await act(async () => { unmount(); });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn.mock.calls[0]![0]).toMatchObject({ name: 'typed-just-before-leaving' });
  });

  it('does not re-save a record the debounce already persisted', async () => {
    const saveFn = saveSpy();
    const character = characterNamed('a');
    const { unmount } = renderHook(() => useAutosave(character, saveFn));

    await runDebounce();
    expect(saveFn).toHaveBeenCalledTimes(1);

    await act(async () => { unmount(); });

    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it('still flushes a change that arrived while an earlier save was in flight', async () => {
    // `pendingRef` is only cleared when it still holds the exact record that
    // was written, so an edit made mid-await stays dirty for the next flush.
    const gate = deferred<void>();
    const saveFn = vi.fn()
      .mockImplementationOnce(() => gate.promise)
      .mockImplementation(async () => {});
    const { rerender, unmount } = renderHook(({ c }) => useAutosave(c, saveFn), {
      initialProps: { c: characterNamed('first') },
    });

    await runDebounce();
    expect(saveFn).toHaveBeenCalledTimes(1);

    rerender({ c: characterNamed('second') });
    await act(async () => { gate.resolve(); await gate.promise; });
    await act(async () => { unmount(); });

    expect(saveFn).toHaveBeenCalledTimes(2);
    expect(saveFn.mock.calls[1]![0]).toMatchObject({ name: 'second' });
  });

  it('tells the user when the last-chance save fails', async () => {
    // There is no later retry on this path: the component is gone, so a
    // console-only failure loses the edit and tells nobody.
    const saveFn = vi.fn(async () => { throw new Error('quota exceeded'); });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender, unmount } = renderHook(({ c }) => useAutosave(c, saveFn), {
      initialProps: { c: characterNamed('a') },
    });

    rerender({ c: characterNamed('b') });
    await act(async () => { unmount(); });
    await act(async () => { await Promise.resolve(); });

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(String(showToast.mock.calls[0]![0])).toContain('last change');
    expect(showToast.mock.calls[0]![1]).toBe('error');
    consoleError.mockRestore();
  });
});

describe('useAutosave error reporting', () => {
  it('surfaces a failure once per streak, not once per keystroke', async () => {
    const saveFn = vi.fn(async () => { throw new Error('disk full'); });
    const { result, rerender } = renderHook(({ c }) => useAutosave(c, saveFn), {
      initialProps: { c: characterNamed('a') },
    });

    await runDebounce();
    rerender({ c: characterNamed('b') });
    await runDebounce();
    rerender({ c: characterNamed('c') });
    await runDebounce();

    expect(saveFn).toHaveBeenCalledTimes(3);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(result.current.error).toContain('Failed to save changes');
  });

  it('reports again after a save succeeds and then fails once more', async () => {
    let fail = true;
    const saveFn = vi.fn(async () => { if (fail) throw new Error('disk full'); });
    const { rerender } = renderHook(({ c }) => useAutosave(c, saveFn), {
      initialProps: { c: characterNamed('a') },
    });

    await runDebounce();
    expect(showToast).toHaveBeenCalledTimes(1);

    fail = false;
    rerender({ c: characterNamed('b') });
    await runDebounce();

    fail = true;
    rerender({ c: characterNamed('c') });
    await runDebounce();

    expect(showToast).toHaveBeenCalledTimes(2);
  });
});

describe('useAutosave flush-bus registration', () => {
  it('flushAll persists the pending edit and leaves nothing behind', async () => {
    const saveFn = saveSpy();
    const { rerender, unmount } = renderHook(({ c }) => useAutosave(c, saveFn), {
      initialProps: { c: characterNamed('a') },
    });

    rerender({ c: characterNamed('pending') });
    await act(async () => { await flushAll(); });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn.mock.calls[0]![0]).toMatchObject({ name: 'pending' });

    // Dirty flag cleared, so neither a second flush nor the unmount re-writes.
    await act(async () => { await flushAll(); });
    await act(async () => { unmount(); });
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it('unregisters on unmount so a later flushAll cannot resurrect the record', async () => {
    const saveFn = saveSpy();
    const { rerender, unmount } = renderHook(({ c }) => useAutosave(c, saveFn), {
      initialProps: { c: characterNamed('a') },
    });

    rerender({ c: characterNamed('b') });
    await act(async () => { unmount(); });
    expect(saveFn).toHaveBeenCalledTimes(1);

    await act(async () => { await flushAll(); });

    expect(saveFn).toHaveBeenCalledTimes(1);
  });
});
