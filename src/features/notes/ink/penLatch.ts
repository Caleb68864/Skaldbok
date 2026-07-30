/**
 * Pure, framework-free pen-latch state machine.
 *
 * @remarks
 * Palm/touch rejection for stylus input: while a pen is in contact with the
 * surface (and for a short window after it lifts), incidental touch/mouse
 * pointer events must not be interpreted as ink. This module contains no DOM
 * access — it is fed a stream of already-normalized pointer events and
 * answers, per event, whether it should be accepted as ink input.
 */

/** The kind of pointer that produced an event. */
export type PenLatchPointerType = 'pen' | 'touch' | 'mouse';

/** The lifecycle phase of a pointer event. */
export type PenLatchPhase = 'down' | 'move' | 'up' | 'cancel';

/** A normalized pointer event fed into the latch state machine. */
export interface PenLatchEvent {
  /** Identifier of the physical pointer (stable across down/move/up/cancel for one contact). */
  pointerId: number;
  /** The kind of pointer that produced this event. */
  pointerType: PenLatchPointerType;
  /** The lifecycle phase this event represents. */
  phase: PenLatchPhase;
  /** Event timestamp in milliseconds (any monotonic clock; only deltas matter). */
  timestamp: number;
}

/** Milliseconds of non-pen suppression after a pen pointerup. */
export const PEN_SUPPRESSION_WINDOW_MS = 500;

/**
 * Stateful pen-latch machine. Feed it events via {@link processEvent}; each
 * call returns whether that event should be accepted as ink.
 */
export class PenLatch {
  private latchedPointerId: number | null = null;
  private suppressUntil: number | null = null;
  private activePointers = new Set<number>();

  /**
   * Processes one pointer event and returns whether it is accepted as ink.
   *
   * @remarks
   * Rules, in order:
   * 1. A pen `down` latches onto that pointer; while latched, all non-pen
   *    events are discarded.
   * 2. A pen `up` releases the latch and opens a 500ms suppression window
   *    during which non-pen events are still discarded.
   * 3. A `cancel` (of any pointer type) discards the in-progress stroke and
   *    fully resets the machine (latch and suppression both cleared).
   * 4. Whenever the set of currently-down pointers (of any type) becomes
   *    empty, the machine resets unconditionally — even mid-suppression —
   *    since nothing remains in contact with the surface to protect against.
   */
  processEvent(event: PenLatchEvent): boolean {
    let accepted: boolean;

    if (event.pointerType === 'pen') {
      if (event.phase === 'cancel') {
        accepted = false;
        this.reset();
      } else if (event.phase === 'down') {
        this.latchedPointerId = event.pointerId;
        accepted = true;
      } else if (event.phase === 'up') {
        accepted = true;
        this.latchedPointerId = null;
        this.suppressUntil = event.timestamp + PEN_SUPPRESSION_WINDOW_MS;
      } else {
        // 'move'
        accepted = true;
      }
    } else {
      if (event.phase === 'cancel') {
        accepted = false;
        this.reset();
      } else if (this.latchedPointerId !== null) {
        accepted = false;
      } else if (this.suppressUntil !== null && event.timestamp < this.suppressUntil) {
        accepted = false;
      } else {
        accepted = true;
      }
    }

    this.updateActivePointers(event);
    if (this.activePointers.size === 0) {
      this.reset();
    }

    return accepted;
  }

  private updateActivePointers(event: PenLatchEvent): void {
    if (event.phase === 'down') {
      this.activePointers.add(event.pointerId);
    } else if (event.phase === 'up' || event.phase === 'cancel') {
      this.activePointers.delete(event.pointerId);
    }
  }

  private reset(): void {
    this.latchedPointerId = null;
    this.suppressUntil = null;
  }
}

/** Convenience factory, matching the naming convention used elsewhere in the app. */
export function createPenLatch(): PenLatch {
  return new PenLatch();
}
