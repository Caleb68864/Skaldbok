import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import * as ledgerSplitRepository from '../../storage/repositories/ledgerSplitRepository';
import * as partyRepository from '../../storage/repositories/partyRepository';
import * as characterRepository from '../../storage/repositories/characterRepository';
import { validateSplit, evenSplit } from '../../utils/ledgerMath';
import { generateId } from '../../utils/ids';
import type { PayoutSplit, PayoutSplitRow } from '../../types/payoutSplit';
import type { SplitSnapshot } from '../../types/ledger';

/** A party seat offered by the payee picker. */
export interface PayeeOption {
  memberId: string;
  name: string;
}

/**
 * The campaign's current payout agreement, plus the party seats it can name.
 *
 * @remarks
 * This record is the *current* agreement only. It is deliberately mutable and
 * deliberately not the record of what any past payout used — a distribution
 * snapshots it onto the ledger entry at write time.
 */
export function useLedgerSplit() {
  const { activeCampaign } = useCampaignContext();
  const [split, setSplit] = useState<PayoutSplit | null>(null);
  const [payeeOptions, setPayeeOptions] = useState<PayeeOption[]>([]);

  const campaignId = activeCampaign?.id;

  const reload = useCallback(async () => {
    if (!campaignId) {
      setSplit(null);
      return;
    }
    setSplit(await ledgerSplitRepository.getOrCreateForCampaign(campaignId));

    // Party seats are a convenience for the picker, never a requirement: a row
    // can name anyone, and the ledger works with no party configured at all.
    const party = await partyRepository.getPartyByCampaign(campaignId);
    if (!party) {
      setPayeeOptions([]);
      return;
    }
    const members = await partyRepository.getPartyMembers(party.id);
    const characters = await characterRepository.getAll();
    setPayeeOptions(
      members.map(m => ({
        memberId: m.id,
        name:
          m.name ??
          characters.find(c => c.id === m.linkedCharacterId)?.name ??
          'Unnamed crew member',
      })),
    );
  }, [campaignId]);

  useEffect(() => {
    reload().catch(console.error);
  }, [reload]);

  const validation = useMemo(
    () => validateSplit({ shipFundPct: split?.shipFundPct ?? 0, rows: split?.rows ?? [] }),
    [split],
  );

  /** The split in the shape the arithmetic and the snapshot both use. */
  const snapshot: SplitSnapshot = useMemo(
    () => ({ shipFundPct: split?.shipFundPct ?? 0, rows: split?.rows ?? [] }),
    [split],
  );

  const persist = useCallback(
    async (patch: Partial<{ shipFundPct: number; rows: PayoutSplitRow[] }>) => {
      if (!split) return;
      setSplit({ ...split, ...patch });
      await ledgerSplitRepository.update(split.id, patch);
    },
    [split],
  );

  const setShipFundPct = useCallback(
    (pct: number) => persist({ shipFundPct: Math.max(0, Math.min(100, pct)) }),
    [persist],
  );

  const setRow = useCallback(
    (id: string, patch: Partial<PayoutSplitRow>) => {
      if (!split) return Promise.resolve();
      return persist({ rows: split.rows.map(r => (r.id === id ? { ...r, ...patch } : r)) });
    },
    [split, persist],
  );

  const addRow = useCallback(
    (name = '') => {
      if (!split) return Promise.resolve();
      const row: PayoutSplitRow = { id: generateId(), payeeName: name, pct: 0 };
      return persist({ rows: [...split.rows, row] });
    },
    [split, persist],
  );

  const removeRow = useCallback(
    (id: string) => {
      if (!split) return Promise.resolve();
      return persist({ rows: split.rows.filter(r => r.id !== id) });
    },
    [split, persist],
  );

  /** Divides 100 evenly across the current rows — useful when renegotiating from scratch. */
  const applyEvenSplit = useCallback(() => {
    if (!split || split.rows.length === 0) return Promise.resolve();
    const shares = evenSplit(split.rows.length);
    return persist({ rows: split.rows.map((r, i) => ({ ...r, pct: shares[i] })) });
  }, [split, persist]);

  return {
    split,
    snapshot,
    validation,
    payeeOptions,
    setShipFundPct,
    setRow,
    addRow,
    removeRow,
    applyEvenSplit,
    reload,
  };
}
