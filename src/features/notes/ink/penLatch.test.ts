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

  it('suppresses a palm that lands after the pen lifts, with nothing else touching', () => {
    const latch = createPenLatch();
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'down', timestamp: 0 });
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'up', timestamp: 100 });

    // This is the scenario the suppression window exists for, and the only one
    // that actually happens at a table: you lift the pen and your hand settles.
    // Nothing else is in contact, so the active pointer set is empty here — an
    // earlier version reset on that and accepted the palm as ink.
    expect(latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'down', timestamp: 150 })).toBe(false);
    expect(latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'move', timestamp: 300 })).toBe(false);
    // And it still lapses on schedule.
    expect(latch.processEvent({ pointerId: 3, pointerType: 'touch', phase: 'down', timestamp: 601 })).toBe(true);
  });

  it('releases the latch, but not the suppression window, once the active pointer set empties', () => {
    const latch = createPenLatch();
    latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'down', timestamp: 0 });
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'down', timestamp: 0 });
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'up', timestamp: 100 });
    // The last remaining pointer lifts — the active set empties.
    latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'up', timestamp: 110 });

    // Emptying the set clears the per-contact latch, so a fresh pen stroke is
    // unaffected — but the time-based window survives it.
    expect(latch.processEvent({ pointerId: 3, pointerType: 'touch', phase: 'down', timestamp: 150 })).toBe(false);
    expect(latch.processEvent({ pointerId: 4, pointerType: 'pen', phase: 'down', timestamp: 160 })).toBe(true);
  });

  it('clears the suppression window on cancel, which means the gesture was abandoned', () => {
    const latch = createPenLatch();
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'down', timestamp: 0 });
    latch.processEvent({ pointerId: 1, pointerType: 'pen', phase: 'up', timestamp: 100 });
    latch.processEvent({ pointerId: 2, pointerType: 'touch', phase: 'cancel', timestamp: 120 });

    expect(latch.processEvent({ pointerId: 3, pointerType: 'touch', phase: 'down', timestamp: 150 })).toBe(true);
  });
});
