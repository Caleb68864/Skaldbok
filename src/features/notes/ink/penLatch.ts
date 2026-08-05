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
   *    fully resets the machine (latch and suppression both cleared) — a
   *    cancelled gesture is an abandoned one, so there is nothing to protect.
   * 4. Whenever the set of currently-down pointers (of any type) becomes
   *    empty, the *latch* is released — it is per-contact, and no contact
   *    remains. The suppression window is **not** cleared: it is a time-based
   *    guard against contact that has not happened yet.
   *
   * @remarks
   * Rule 4 used to reset both, on the reasoning that nothing remained in
   * contact to protect against. That defeated rule 2 entirely. The set is
   * empty at precisely the moment a pen lifts with no palm down, which is the
   * only scenario the window exists for — so the window was cleared on every
   * normal pen stroke and a palm landing 50ms later was accepted as ink.
   */
  processEvent(event: PenLatchEvent): boolean {
    let accepted: boolean;

    if (event.pointerType === 'pen') {
      if (event.phase === 'cancel') {
        accepted = false;
        this.resetAll();
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
        this.resetAll();
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
      this.releaseLatch();
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

  /**
   * Releases the per-contact latch, leaving any suppression window intact.
   * Used when the surface goes untouched — the latch tracks a contact that no
   * longer exists, but the window guards against the *next* one.
   */
  private releaseLatch(): void {
    this.latchedPointerId = null;
  }

  /** Clears every guard. Only a cancel warrants this — see {@link processEvent}. */
  private resetAll(): void {
    this.latchedPointerId = null;
    this.suppressUntil = null;
  }
}

/** Convenience factory, matching the naming convention used elsewhere in the app. */
export function createPenLatch(): PenLatch {
  return new PenLatch();
}
