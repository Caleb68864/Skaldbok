import { useEffect } from 'react';
import type { CharacterRecord } from '../../types/character';
import type { SystemDefinition } from '../../types/system';
import { syncDerivedResourceMaxima } from '../../utils/resourceMaxima';
import { nowISO } from '../../utils/dates';

type UpdateCharacter = (partialOrFn: (prev: CharacterRecord) => Partial<CharacterRecord>) => void;

/**
 * Keeps resource maxima in step with the attributes they are derived from.
 *
 * @remarks
 * Runs on the screens where the two can diverge: the sheet, where attributes
 * are edited, and the play dashboard, where the maxima are used. Because the
 * helper returns `null` when nothing differs, this both heals characters saved
 * before `derivedFrom` was honoured and stays inert afterwards — no write, no
 * render loop.
 */
export function useSyncedResourceMaxima(
  character: CharacterRecord | null,
  system: SystemDefinition | null,
  updateCharacter: UpdateCharacter,
): void {
  useEffect(() => {
    if (!character || !system) return;
    const resources = syncDerivedResourceMaxima(character, system);
    if (!resources) return;
    updateCharacter(() => ({ resources, updatedAt: nowISO() }));
  }, [character, system, updateCharacter]);
}
