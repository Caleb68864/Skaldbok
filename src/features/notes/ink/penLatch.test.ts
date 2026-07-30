import { describe, expect, it } from 'vitest';
import { createPenLatch } from './penLatch';

describe('PenLatch', () => {
  it('discards touch events while the pen is down', () => {
    const latch = createPenLatch();
    expect(latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'down', timestamp: 0 })).toBe(true);
    expect(latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'down', timestamp: 5 })).toBe(false);
    expect(latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'move', timestamp: 10 })).toBe(false);
    expect(latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'move', timestamp: 15 })).toBe(true);
  });

  it('discards touch events within 500ms of pointerup', () => {
    const latch = createPenLatch();
    // A touch pointer (e.g. a resting palm) stays down throughout so the
    // active-pointer-set never empties, isolating the suppression-window
    // behavior from the separate "set empties" reset rule below.
    latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'down', timestamp: 0 });
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'down', timestamp: 0 });
    expect(latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'up', timestamp: 100 })).toBe(true);

    expect(latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'move', timestamp: 200 })).toBe(false);
    expect(latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'move', timestamp: 599 })).toBe(false);
  });

  it('accepts touch events after the 500ms suppression window elapses', () => {
    const latch = createPenLatch();
    latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'down', timestamp: 0 });
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'down', timestamp: 0 });
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'up', timestamp: 100 });

    expect(latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'move', timestamp: 600 })).toBe(true);
    expect(latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'move', timestamp: 601 })).toBe(true);
  });

  it('discards the in-progress stroke on pointercancel and resets the latch', () => {
    const latch = createPenLatch();
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'down', timestamp: 0 });
    expect(latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'cancel', timestamp: 50 })).toBe(false);

    // The latch is fully released by the cancel — a touch pointer arriving
    // afterward is treated as a fresh interaction, not discarded.
    expect(latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'down', timestamp: 60 })).toBe(true);
  });

  it('resets all state, including an active suppression window, once the active pointer set empties', () => {
    const latch = createPenLatch();
    latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'down', timestamp: 0 });
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'down', timestamp: 0 });
    // Pen lifts, opening a 500ms suppression window; the touch pointer is
    // still down so the active pointer set is not yet empty.
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'up', timestamp: 100 });
    // Now the last remaining pointer also lifts — the active set empties.
    latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'up', timestamp: 110 });

    // Well within what would have been the 500ms suppression window, but
    // since the pointer set emptied, state reset unconditionally.
    expect(latch.processEvent({ pointerId: 3, pointerType: 'touch', phase: 'down', timestamp: 150 })).toBe(true);
  });
});
