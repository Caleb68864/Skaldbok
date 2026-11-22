// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useSerialRunOnChange } from './useSerialRunOnChange';

/**
 * The ledger posted recurring charges from an effect guarded by a ref. A date
 * change that landed while a post was running returned early and was never
 * revisited, so the charges it made due were not posted until the next change.
 * The first case reproduces that: with the old guard (skip, and forget), the
 * second key is never run.
 */

afterEach(cleanup);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('useSerialRunOnChange', () => {
  it('runs again, with the latest key, after a change that landed mid-run', async () => {
    const seen: string[] = [];
    const gates: Array<ReturnType<typeof deferred>> = [];
    let key = 'day-1';
    const run = () => {
      seen.push(key);
      const gate = deferred();
      gates.push(gate);
      return gate.promise;
    };
    const { rerender } = renderHook(({ k }) => useSerialRunOnChange(k, true, run), { initialProps: { k: key } });
    expect(seen).toEqual(['day-1']);

    key = 'day-9';
    rerender({ k: key });
    expect(seen, 'never two at once').toEqual(['day-1']);

    await act(async () => { gates[0]!.resolve(); });
    await waitFor(() => expect(seen).toEqual(['day-1', 'day-9']));
  });

  it('does not run again when nothing changed during the run', async () => {
    let runs = 0;
    const { rerender } = renderHook(({ k }) => useSerialRunOnChange(k, true, async () => { runs++; }), {
      initialProps: { k: 'a' },
    });
    await waitFor(() => expect(runs).toBe(1));
    rerender({ k: 'a' });
    await new Promise((r) => setTimeout(r, 10));
    expect(runs).toBe(1);
  });

  it('waits until enabled, and releases the lock after a rejection', async () => {
    let runs = 0;
    const { rerender } = renderHook(({ k, on }) => useSerialRunOnChange(k, on, async () => { runs++; throw new Error('x'); }), {
      initialProps: { k: 'a', on: false },
    });
    expect(runs).toBe(0);
    rerender({ k: 'a', on: true });
    await waitFor(() => expect(runs).toBe(1));
    rerender({ k: 'b', on: true });
    await waitFor(() => expect(runs).toBe(2));
  });
});
