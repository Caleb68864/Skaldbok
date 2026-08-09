import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useSystemDefinition } from '../systems/useSystemDefinition';
import * as routeRepository from '../../storage/repositories/routeRepository';
import { reorder, totalDistance } from '../../utils/routeMath';
import type { RouteStop } from '../../types/routeStop';

/**
 * The active campaign's route, and the field declaration that shapes it.
 *
 * @remarks
 * The system definition is resolved from the **campaign**, not from the active
 * character — a campaign's route exists whether or not anybody has a character
 * open. Mirrors `ParticipantDrawer`'s resolution and the ledger's.
 *
 * `planner` being `undefined` is meaningful: it is how a ruleset says it has no
 * route concept at all, and the screen redirects rather than rendering an empty
 * one.
 *
 * No numeric parsing happens here or in the screen. Every declared field is
 * stored as a string and read back through `routeMath.readNumericField`, which
 * is the feature's single parse boundary.
 */
export function useRoute() {
  const { activeCampaign } = useCampaignContext();
  const { system } = useSystemDefinition(activeCampaign?.system ?? 'classic-fantasy');
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const campaignId = activeCampaign?.id;
  const planner = system?.routePlanner;

  const reload = useCallback(async () => {
    if (!campaignId) {
      setStops([]);
      setIsLoading(false);
      return;
    }
    setStops(await routeRepository.listByCampaign(campaignId));
    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    reload().catch(console.error);
  }, [reload]);

  /** Declared fields other than `name`, which is a real column on the record. */
  const valueFields = useMemo(
    () => (planner?.fields ?? []).filter(f => f.id !== 'name'),
    [planner],
  );

  const nameField = useMemo(
    () => (planner?.fields ?? []).find(f => f.id === 'name'),
    [planner],
  );

  const distanceLabel = useMemo(() => {
    if (!planner?.distanceFieldId) return undefined;
    return planner.fields.find(f => f.id === planner.distanceFieldId)?.label;
  }, [planner]);

  const total = useMemo(
    () => totalDistance(stops, planner?.distanceFieldId),
    [stops, planner],
  );

  const addStop = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || !campaignId) return;
      await routeRepository.create({ campaignId, name: trimmed });
      await reload();
    },
    [campaignId, reload],
  );

  const updateStop = useCallback(
    async (stop: RouteStop, changes: Partial<Pick<RouteStop, 'name' | 'values'>>) => {
      await routeRepository.update(stop.id, changes);
      setStops(prev => prev.map(s => (s.id === stop.id ? { ...s, ...changes } : s)));
    },
    [],
  );

  /**
   * Moves a stop and persists the whole renumbered order.
   *
   * @remarks
   * Optimistic: local state updates first so the list does not lurch while the
   * write lands. The repository rewrites every affected row in one transaction,
   * so an interrupted move cannot leave two stops sharing an index.
   */
  const moveStop = useCallback(
    async (index: number, delta: number) => {
      if (!campaignId) return;
      const next = reorder(stops, index, index + delta);
      setStops(next);
      await routeRepository.reorder(campaignId, next.map(s => s.id));
    },
    [campaignId, stops],
  );

  /**
   * Imports a parsed route, appending or replacing.
   *
   * @remarks
   * The whole file lands in one transaction — see `routeRepository.importStops`.
   * A half-imported route reads as a successful one, which is the failure worth
   * preventing.
   */
  const importStops = useCallback(
    async (
      parsed: Array<{ name: string; values?: Record<string, string> }>,
      replace: boolean,
    ) => {
      if (!campaignId) return 0;
      const count = await routeRepository.importStops(campaignId, parsed, { replace });
      await reload();
      return count;
    },
    [campaignId, reload],
  );

  const removeStop = useCallback(
    async (id: string) => {
      await routeRepository.softDelete(id);
      await reload();
    },
    [reload],
  );

  return {
    stops,
    isLoading,
    planner,
    /**
     * Whether the system definition has resolved.
     *
     * @remarks
     * Distinct from `isLoading`, which tracks the *stops* query. The two race:
     * stops resolve first, so a redirect gated on `isLoading` fires while
     * `planner` is still undefined and bounces a Traveller crew off their own
     * route. Gate the redirect on this instead.
     */
    systemResolved: !!system,
    systemName: system?.displayName,
    valueFields,
    nameField,
    distanceLabel,
    total,
    addStop,
    importStops,
    updateStop,
    moveStop,
    removeStop,
    reload,
  };
}
