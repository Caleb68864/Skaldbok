import type { SystemEngine } from '../engine/types';
import type { CardGuard } from './types';

/**
 * One pure predicate per {@link CardGuard} value, evaluated against the
 * active system's {@link SystemEngine} to decide whether a card renders.
 */
export const GUARDS: Record<CardGuard, (engine: SystemEngine) => boolean> = {
  always: () => true,
  // The nullable model is the single source of truth; `engine.hasMagic` was a
  // second boolean saying the same thing, which two engines had to keep in
  // agreement by hand. The guard *name* is unchanged because it is written into
  // every sheet.json as `when: "hasMagic"` — that string is stored data.
  hasMagic: (engine) => engine.magic !== null,
  hasRest: (engine) => engine.rest !== null,
  hasDamageTrack: (engine) => engine.damageTrack !== null,
  hasCurrency: (engine) => engine.currency.denominations.length > 0,
  // Story Bank has no engine capability to gate on yet — it is universally
  // available, so this is intentionally always-true (not an unfinished guard).
  hasStoryBank: () => true,
};
