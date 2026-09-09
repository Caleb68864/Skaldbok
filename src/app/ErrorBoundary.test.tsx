// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useAutosave } from '../hooks/useAutosave';
import { flushAll } from '../features/persistence/autosaveFlush';
import { createBlankCharacter } from '../features/characters/characterMappers';
import type { CharacterRecord } from '../types/character';

/**
 * The boundary's recovery button used to cost the user the edit that probably
 * caused the crash.
 *
 * @remarks
 * "Character Library" is `window.location.assign('/library')` — a full page
 * navigation. Two things go wrong with that, and only the second is obvious:
 *
 * 1. React unmounts the subtree that threw, so `useAutosave`'s unmount flush
 *    *does* fire. But it is fire-and-forget: the promise is never awaited by
 *    anyone, and a navigation that starts before the IndexedDB write settles
 *    takes the write with it.
 * 2. `flushAll()` was never called on this path at all, so anything still
 *    registered — a note editor or encounter view outside the crashed subtree,
 *    or a boundary scoped to less than the whole app — was not flushed either.
 *
 * These tests pin both: that the write is tracked so `flushAll()` waits for it,
 * and that the boundary does not navigate until it has settled.
 */

const showToast = vi.fn();
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: (...args: unknown[]) => showToast(...args) }),
}));

function characterNamed(name: string): CharacterRecord {
  return { ...createBlankCharacter('classic-fantasy'), name } as unknown as CharacterRecord;
}

/** A promise the test settles by hand, standing in for a slow IndexedDB write. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(res => { resolve = res; });
  return { promise, resolve };
}

/**
 * A screen that autosaves and can be made to throw, the shape the boundary
 * actually wraps: an edit is pending when the crash happens.
 */
function CrashingScreen({ saveFn, boom }: { saveFn: (c: CharacterRecord) => Promise<void>; boom: boolean }) {
  const [character] = useState(() => characterNamed('a'));
  useAutosave(character, saveFn);
  if (boom) throw new Error('render exploded');
  return <div>screen</div>;
}

let assignSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  showToast.mockClear();
  assignSpy = vi.fn();
  // jsdom's `location.assign` is not implemented and logs a navigation error;
  // replacing it also lets the test observe *when* the navigation happens.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: assignSpy },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ErrorBoundary recovery and unsaved edits', () => {
  it('waits for the pending write before navigating away', async () => {
    const gate = deferred();
    const order: string[] = [];
    const saveFn = vi.fn(async (_record: CharacterRecord) => {
      order.push('save:start');
      await gate.promise;
      order.push('save:done');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary>
        <CrashingScreen saveFn={saveFn} boom={false} />
      </ErrorBoundary>,
    );

    // Crash it. React unmounts the subtree, which fires the unmount flush.
    await act(async () => {
      rerender(
        <ErrorBoundary>
          <CrashingScreen saveFn={saveFn} boom={true} />
        </ErrorBoundary>,
      );
    });
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['save:start']);

    // Click recovery while the write is still in flight.
    await act(async () => {
      screen.getByRole('button', { name: 'Character Library' }).click();
    });

    // The navigation must not have happened yet — the write is unfinished.
    expect(order).toEqual(['save:start']);
    expect(assignSpy).not.toHaveBeenCalled();

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });

    expect(order).toEqual(['save:start', 'save:done']);
    expect(assignSpy).toHaveBeenCalledWith('/library');
    consoleError.mockRestore();
  });

  it('navigates even when the pending write fails', async () => {
    // A failed save must not strand the user on the error screen: recovery is
    // the one action left, and it has to work.
    const saveFn = vi.fn(async (_record: CharacterRecord) => { throw new Error('quota exceeded'); });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary>
        <CrashingScreen saveFn={saveFn} boom={false} />
      </ErrorBoundary>,
    );
    await act(async () => {
      rerender(
        <ErrorBoundary>
          <CrashingScreen saveFn={saveFn} boom={true} />
        </ErrorBoundary>,
      );
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Character Library' }).click();
    });
    await act(async () => { await Promise.resolve(); });

    expect(assignSpy).toHaveBeenCalledWith('/library');
    consoleError.mockRestore();
  });

  it('flushes a registration that outlived the crashed subtree', async () => {
    // The boundary wraps the routes, not the providers, so a flush registered
    // above it — or by a sibling that did not crash — is still live here.
    const order: string[] = [];
    const gate = deferred();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Boom(): React.ReactElement {
      throw new Error('render exploded');
    }

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    const { registerFlush } = await import('../features/persistence/autosaveFlush');
    const handle = registerFlush(async () => {
      order.push('flush:start');
      await gate.promise;
      order.push('flush:done');
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Character Library' }).click();
    });
    expect(order).toEqual(['flush:start']);
    expect(assignSpy).not.toHaveBeenCalled();

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });

    expect(order).toEqual(['flush:start', 'flush:done']);
    expect(assignSpy).toHaveBeenCalledWith('/library');
    handle.unregister();
    consoleError.mockRestore();
  });

  it('Try Again clears the error without navigating', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Boom(): React.ReactElement {
      throw new Error('render exploded');
    }

    const { rerender } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    await act(async () => {
      screen.getByRole('button', { name: 'Try Again' }).click();
      rerender(
        <ErrorBoundary>
          <div>recovered</div>
        </ErrorBoundary>,
      );
    });

    expect(screen.getByText('recovered')).toBeTruthy();
    expect(assignSpy).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('flushAll and in-flight writes', () => {
  it('waits for a write the unmount flush already started', async () => {
    // The unmount flush is fire-and-forget by necessity — the component is
    // gone, there is nothing left to await it. Tracking the promise is what
    // lets `flushAll()` still mean "everything is on disk".
    const gate = deferred();
    const order: string[] = [];
    const saveFn = vi.fn(async (_record: CharacterRecord) => {
      order.push('save:start');
      await gate.promise;
      order.push('save:done');
    });

    const { unmount } = render(<CrashingScreen saveFn={saveFn} boom={false} />);
    await act(async () => { unmount(); });
    expect(order).toEqual(['save:start']);

    let flushed = false;
    const flushing = flushAll().then(() => { flushed = true; });
    await act(async () => { await Promise.resolve(); });
    expect(flushed, 'flushAll resolved while a write was still in flight').toBe(false);

    await act(async () => {
      gate.resolve();
      await flushing;
    });
    expect(order).toEqual(['save:start', 'save:done']);
    expect(flushed).toBe(true);
  });
});
