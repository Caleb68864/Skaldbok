import type { SystemDefinition } from '../../../types/system';
import type { SystemEngine } from './types';

/**
 * The label a modifier target was offered under, for printing it back.
 *
 * @remarks
 * Upper-casing the stored key printed `ATTR:STR +2`: the namespaced id, shown as a
 * label. A target the engine no longer offers keeps its id so it stays identifiable.
 */
export function formatStatLabel(stat: string, engine: SystemEngine, system?: SystemDefinition | null): string {
  const offered = engine.modifiableStats(system ?? undefined);
  return (offered.find(option => option.id === stat) ?? offered.find(option => option.id.endsWith(`:${stat}`)))?.label ?? stat;
}
