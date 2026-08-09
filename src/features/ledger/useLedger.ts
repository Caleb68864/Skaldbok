import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useSystemDefinition } from '../systems/useSystemDefinition';
import { getEngine } from '../systems/engine';
import * as ledgerRepository from '../../storage/repositories/ledgerRepository';
import { computeRunningBalance } from '../../utils/ledgerMath';
import type { EntryWithBalance } from '../../utils/ledgerMath';
import type { LedgerLeg, SplitSnapshot } from '../../types/ledger';

/**
 * The active campaign's cashbook, with running balances folded on read.
 *
 * @remarks
 * The engine is resolved from the **campaign's** system rather than the active
 * character's: a campaign ledger exists whether or not a character is loaded,
 * so `useSystemEngine()` (which keys off the active character) is the wrong
 * door. This mirrors `ParticipantDrawer`.
 */
export function useLedger() {
  const { activeCampaign } = useCampaignContext();
  const { system } = useSystemDefinition(activeCampaign?.system ?? 'classic-fantasy');
  const [rows, setRows] = useState<EntryWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const campaignId = activeCampaign?.id;
  const engine = useMemo(() => (system ? getEngine(system) : null), [system]);

  const reload = useCallback(async () => {
    if (!campaignId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    const entries = await ledgerRepository.listByCampaign(campaignId);
    setRows(computeRunningBalance(entries));
    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    reload().catch(console.error);
  }, [reload]);

  const balance = rows.length > 0 ? rows[rows.length - 1].balance : 0;

  /** Formats a signed base-unit integer using the campaign system's currency. */
  const formatMoney = useCallback(
    (baseUnits: number) => engine?.currency.formatAmount(baseUnits) ?? String(baseUnits),
    [engine],
  );

  /**
   * The denomination amounts are counted in — used to label the amount input,
   * and the shipped reader for `CurrencyModel.baseDenominationId`.
   */
  const baseDenomination = useMemo(() => {
    if (!engine) return null;
    const id = engine.currency.baseDenominationId;
    return engine.currency.denominations.find(d => d.id === id) ?? null;
  }, [engine]);

  /** Records a movement. `direction` decides the sign so the user never types one. */
  const addEntry = useCallback(
    async (input: { date: string; memo: string; amount: number; direction: 'in' | 'out' }) => {
      if (!campaignId) return;
      const magnitude = Math.abs(Math.trunc(input.amount));
      if (magnitude === 0) return;
      await ledgerRepository.create({
        campaignId,
        date: input.date,
        memo: input.memo,
        amount: input.direction === 'out' ? -magnitude : magnitude,
      });
      await reload();
    },
    [campaignId, reload],
  );

  /** Writes a distribution as one entry carrying its legs and a frozen snapshot. */
  const addDistribution = useCallback(
    async (input: {
      date: string;
      memo: string;
      gross: number;
      net: number;
      legs: LedgerLeg[];
      splitSnapshot: SplitSnapshot;
    }) => {
      if (!campaignId) return;
      await ledgerRepository.create({
        campaignId,
        date: input.date,
        memo: input.memo,
        amount: input.net,
        gross: input.gross,
        legs: input.legs,
        splitSnapshot: input.splitSnapshot,
      });
      await reload();
    },
    [campaignId, reload],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      await ledgerRepository.softDelete(id);
      await reload();
    },
    [reload],
  );

  return {
    rows,
    balance,
    isLoading,
    formatMoney,
    baseDenomination,
    currencyLabel: engine?.currency.label ?? 'Money',
    addEntry,
    addDistribution,
    removeEntry,
    reload,
  };
}
