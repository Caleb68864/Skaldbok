import type { SystemEngine } from '../engine/types';
import type { CardGuard } from './types';

/**
 * One pure predicate per {@link CardGuard} value, evaluated against the
 * active system's {@link SystemEngine} to decide whether a card renders.
 */
export const GUARDS: Record<CardGuard, (engine: SystemEngine) => boolean> = {
  always: () => true,
  hasMagic: (engine) => engine.hasMagic,
  hasRest: (engine) => engine.rest !== null,
  hasDamageTrack: (engine) => engine.damageTrack !== null,
  hasCurrency: (engine) => engine.currency.denominations.length > 0,
  hasStoryBank: () => true,
};
