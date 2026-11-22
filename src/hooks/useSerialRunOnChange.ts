import { useEffect, useRef, useState } from 'react';

/**
 * Runs `run` when `key` changes (and `enabled` is true), one run at a time,
 * and once more afterwards if `key` changed while a run was in flight.
 *
 * @remarks
 * Written for the ledger's recurring-charge posting. The screen guarded its
 * effect with a ref so two runs could not race the same watermark and post
 * every charge twice, and that part was right. But a date change that landed
 * while a run was in flight returned early and was never revisited, so the
 * charges it made due stayed unposted until the date moved again or the
 * screen was reopened. Here a skipped change is remembered and run after the
 * current one settles, against the latest `key`.
 *
 * `run` is read through a ref, so it may be a fresh closure every render.
 *
 * @param key - The value whose change should trigger a run.
 * @param enabled - Runs wait until this is true.
 * @param run - The work. Its errors are the caller's to handle; a rejection
 *   still releases the lock.
 */
export function useSerialRunOnChange(key: unknown, enabled: boolean, run: () => Promise<unknown>): void {
  const runRef = useRef(run);
  runRef.current = run;
  const running = useRef(false);
  const missed = useRef(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    if (running.current) {
      missed.current = true;
      return;
    }
    running.current = true;
    void runRef.current()
      .catch(() => {})
      .finally(() => {
        running.current = false;
        if (missed.current) {
          missed.current = false;
          setRetry((n) => n + 1);
        }
      });
  }, [key, enabled, retry]);
}
