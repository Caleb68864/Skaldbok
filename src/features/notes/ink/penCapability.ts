/**
 * Feature detection for pen/stylus input, used to decide whether to offer
 * handwriting notes at all.
 *
 * @remarks
 * Detection is by **feature probe only** — never by reading browser/OS
 * identification strings. That kind of sniffing is banned here because it is
 * both unreliable (spoofable, drifts as browsers change those strings) and
 * unnecessary — every signal used below is a direct capability check.
 *
 * Every probe is wrapped so a missing/throwing API yields `false` rather than
 * propagating an exception; a browser that doesn't implement `matchMedia` or
 * `navigator.ink` must degrade gracefully, not crash note rendering.
 *
 * `createHandwritingRecognizer` (the experimental Handwriting Recognition
 * API) is detected as a **bonus** signal only — nothing in this module, or
 * anything that depends on it, requires it to be present.
 */

function safeProbe(probe: () => boolean): boolean {
  try {
    return Boolean(probe());
  } catch {
    return false;
  }
}

/** Whether the environment reports a fine (stylus/mouse-precision) pointer via `matchMedia`. */
export function hasFinePointerMedia(): boolean {
  return safeProbe(() => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches);
}

/** Whether the experimental `navigator.ink` low-latency ink API is present. */
export function hasInkAPI(): boolean {
  return safeProbe(() => typeof navigator !== 'undefined' && 'ink' in navigator);
}

/**
 * Whether the experimental Handwriting Recognition API is present.
 *
 * @remarks
 * Bonus-only signal. No caller may branch on the *absence* of this in a way
 * that disables ink capture — handwriting notes must work identically
 * whether or not this API exists.
 */
export function hasHandwritingRecognition(): boolean {
  return safeProbe(() => typeof navigator !== 'undefined' && 'createHandwritingRecognizer' in navigator);
}

/** Aggregated capability probe result. */
export interface PenCapability {
  /** `matchMedia('(pointer: fine)')` reports a fine-precision pointer is available. */
  pointerFine: boolean;
  /** A `pen`-type pointer event has actually been observed this session. */
  observedPenPointer: boolean;
  /** The experimental `navigator.ink` API is present. */
  inkAPI: boolean;
  /** Bonus-only: the experimental Handwriting Recognition API is present. */
  handwritingRecognition: boolean;
}

/**
 * Runs all capability probes.
 *
 * @param observedPenPointer - Whether a `pointerType === 'pen'` event has
 *   been observed so far; this can only be known by the caller's own pointer
 *   event listeners, since it is a runtime observation, not a static
 *   capability. Defaults to `false` for callers that have not observed one.
 */
export function detectPenCapability(observedPenPointer = false): PenCapability {
  return {
    pointerFine: hasFinePointerMedia(),
    observedPenPointer,
    inkAPI: hasInkAPI(),
    handwritingRecognition: hasHandwritingRecognition(),
  };
}

/**
 * Small stateful tracker for recording whether a pen pointer has ever been
 * observed during the current session. Kept separate from the static probes
 * above since "has a pen pointer event actually occurred" is not something a
 * one-shot feature probe can answer.
 */
export function createPenObservationTracker(): {
  recordPointerType: (pointerType: string) => void;
  hasObservedPen: () => boolean;
} {
  let observed = false;
  return {
    recordPointerType(pointerType: string) {
      if (pointerType === 'pen') observed = true;
    },
    hasObservedPen() {
      return observed;
    },
  };
}
