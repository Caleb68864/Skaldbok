import type { CharacterRecord, CharacterResource } from '../types/character';
import type { SystemDefinition } from '../types/system';

/**
 * Applies `ResourceDefinition.derivedFrom`, syncing a resource's maximum to the
 * attribute it is derived from.
 *
 * @remarks
 * Traveller's damage tracks *are* the characteristics — a character with STR 10
 * can absorb 10 points of Strength damage. The system definition already
 * declared `derivedFrom: "str"` on each track, but nothing read it, so raising
 * a characteristic left its track stuck at the creation default. That silently
 * broke two things: the track capped damage too early, and the
 * "two tracks depleted" unconscious threshold fired at the wrong totals.
 *
 * Returns `null` when nothing needs to change, so callers can skip a write and
 * avoid a render loop.
 */
export function syncDerivedResourceMaxima(
  character: CharacterRecord,
  system: SystemDefinition | null,
): Record<string, CharacterResource> | null {
  if (!system?.resources?.length) return null;

  const next: Record<string, CharacterResource> = { ...character.resources };
  let changed = false;

  for (const definition of system.resources) {
    if (!definition.derivedFrom) continue;
    const attributeValue = character.attributes?.[definition.derivedFrom];
    if (attributeValue === undefined || attributeValue === null) continue;

    const resource = character.resources?.[definition.id];
    if (!resource) continue;
    if (resource.max === attributeValue) continue;

    next[definition.id] = {
      ...resource,
      max: attributeValue,
      // A shrinking maximum must not leave `current` stranded above it.
      current: Math.min(resource.current, attributeValue),
    };
    changed = true;
  }

  return changed ? next : null;
}
