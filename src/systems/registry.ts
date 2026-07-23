import { classicFantasySystem } from './classic-fantasy';
import { travellerSystem } from './traveller';
import type { SystemDefinition } from '../types/system';

/**
 * Every bundled game system, in the order they are offered to the user.
 *
 * @remarks
 * This is the single source of truth for "which systems can a character use".
 * Adding a system means adding its `SystemDefinition` here — the character
 * creation picker, and anything else that needs to enumerate systems, reads
 * from this list rather than hardcoding ids or display names.
 */
export const BUNDLED_SYSTEMS: SystemDefinition[] = [
  classicFantasySystem,
  travellerSystem,
];

/** The system used when none is specified (e.g. legacy characters). */
export const DEFAULT_SYSTEM_ID = 'classic-fantasy';

/** `{ id, displayName }` pairs for populating a system selector. */
export function getSelectableSystems(): Array<{ id: string; displayName: string }> {
  return BUNDLED_SYSTEMS.map(s => ({ id: s.id, displayName: s.displayName }));
}
