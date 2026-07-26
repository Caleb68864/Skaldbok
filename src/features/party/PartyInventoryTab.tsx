import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, ArrowRightLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/primitives/Button';
import { Drawer } from '../../components/primitives/Drawer';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { InventoryItemEditor } from '../../components/fields/InventoryItemEditor';
import { DEFAULT_INVENTORY_CONTAINER_KINDS } from '../../config/defaults/inventoryContainerKinds';
import * as characterRepository from '../../storage/repositories/characterRepository';
import * as inventoryContainerRepository from '../../storage/repositories/inventoryContainerRepository';
import { computeEncumbranceLimit } from '../../utils/derivedValues';
import { nowISO } from '../../utils/dates';
import { useSystemEngine } from '../systems/engine';
import type { CurrencyDenomination } from '../systems/engine/types';
import type { CharacterRecord, InventoryItem } from '../../types/character';
import { containerWealth } from '../../types/inventoryContainer';
import type {
  InventoryContainer,
  InventoryContainerKind,
} from '../../types/inventoryContainer';

/** Money held by a carrier, keyed by the active system's denomination ids. */
type Wealth = Record<string, number>;

type Carrier =
  | {
      kind: 'pc';
      id: string;
      name: string;
      items: InventoryItem[];
      wealth: Wealth;
      capacity: number;
      character: CharacterRecord;
    }
  | {
      kind: 'container';
      id: string;
      name: string;
      items: InventoryItem[];
      wealth: Wealth;
      capacity: number | null;
      container: InventoryContainer;
      containerKind: InventoryContainerKind;
    };

const inputClasses =
  'w-full p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)] font-[family-name:inherit]';

/**
 * Value of `amounts` expressed in the smallest denomination the system defines.
 *
 * @remarks
 * Derived from each denomination's `value` rather than a 100/10/1 coin ladder,
 * so a system with different exchange rates (or a single abstract currency)
 * totals correctly without a code change.
 */
function totalInSmallest(denoms: CurrencyDenomination[], amounts: Wealth): number {
  return denoms.reduce((sum, d) => sum + (amounts[d.id] ?? 0) * d.value, 0);
}

/** Fills in every declared denomination so arithmetic never hits `undefined`. */
function normalizeWealth(denoms: CurrencyDenomination[], amounts: Wealth): Wealth {
  const out: Wealth = {};
  for (const d of denoms) out[d.id] = amounts[d.id] ?? 0;
  return out;
}

/**
 * Settles negative denominations by breaking down higher ones.
 *
 * @remarks
 * Denominations are ordered highest-value first. A shortfall borrows one unit
 * of the nearest higher denomination that still has stock, converting through
 * the `value` fields so "1 gold → 9 silver + 10 copper" falls out of the data.
 * Returns `null` when the carrier simply does not hold enough, so callers can
 * refuse the whole operation instead of writing a negative purse.
 */
function makeChange(denoms: CurrencyDenomination[], amounts: Wealth): Wealth | null {
  const next = { ...amounts };
  for (let i = denoms.length - 1; i >= 1; i--) {
    while (next[denoms[i].id] < 0) {
      let donor = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (next[denoms[j].id] > 0) { donor = j; break; }
      }
      if (donor < 0) break;
      next[denoms[donor].id] -= 1;
      // Intermediate denominations keep the change from breaking the donor.
      for (let k = donor + 1; k < i; k++) {
        next[denoms[k].id] += denoms[k - 1].value / denoms[k].value - 1;
      }
      next[denoms[i].id] += denoms[i - 1].value / denoms[i].value;
    }
  }
  if (denoms.some(d => next[d.id] < 0)) return null;
  return next;
}

function carrierWeight(items: InventoryItem[]): number {
  return items.reduce((sum, i) => sum + (i.tiny ? 0 : i.weight) * 1, 0);
}

function kindIcon(kind: InventoryContainerKind): string {
  return DEFAULT_INVENTORY_CONTAINER_KINDS.find(k => k.id === kind)?.icon ?? '📦';
}

export function PartyInventoryTab() {
  const { activeCampaign, activeParty } = useCampaignContext();
  const { showToast } = useToast();
  const engine = useSystemEngine();
  const denominations = engine.currency.denominations;

  const [pcs, setPcs] = useState<CharacterRecord[]>([]);
  const [containers, setContainers] = useState<InventoryContainer[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const [containerEditorOpen, setContainerEditorOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<InventoryContainer | null>(null);

  const [moveItemTarget, setMoveItemTarget] = useState<{
    carrierId: string;
    item: InventoryItem;
  } | null>(null);
  const [moveCoinsSource, setMoveCoinsSource] = useState<Carrier | null>(null);

  const [itemEditorState, setItemEditorState] = useState<{
    carrierId: string;
    item: InventoryItem | null;
  } | null>(null);

  // Load PCs + containers whenever campaign/party changes or reloadToken bumps.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!activeCampaign) {
        setPcs([]);
        setContainers([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const memberCharacterIds =
          activeParty?.members
            .filter(m => !m.deletedAt && m.linkedCharacterId)
            .map(m => m.linkedCharacterId!) ?? [];
        const pcRecords = (
          await Promise.all(memberCharacterIds.map(id => characterRepository.getById(id)))
        ).filter((c): c is CharacterRecord => !!c);
        const containerRows = await inventoryContainerRepository.list(activeCampaign.id);
        if (cancelled) return;
        setPcs(pcRecords);
        setContainers(containerRows);
      } catch (e) {
        console.error('PartyInventoryTab load failed', e);
        if (!cancelled) showToast('Failed to load party inventory', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeCampaign, activeParty, reloadToken, showToast]);

  const reload = useCallback(() => setReloadToken(t => t + 1), []);

  const carriers = useMemo<Carrier[]>(() => {
    const out: Carrier[] = [];
    for (const pc of pcs) {
      out.push({
        kind: 'pc',
        id: `pc:${pc.id}`,
        name: pc.name,
        items: pc.inventory,
        wealth: normalizeWealth(denominations, engine.currency.read(pc)),
        capacity: computeEncumbranceLimit(pc),
        character: pc,
      });
    }
    for (const c of containers) {
      out.push({
        kind: 'container',
        id: `container:${c.id}`,
        name: c.name,
        items: c.items,
        wealth: normalizeWealth(denominations, containerWealth(c)),
        capacity: c.capacity,
        container: c,
        containerKind: c.kind,
      });
    }
    return out;
  }, [pcs, containers, denominations, engine]);

  /**
   * Party-wide money, expressed in the highest denomination the system defines
   * (gold for Dragonbane, credits for a single-currency system).
   */
  const topDenomination = denominations[0] ?? null;
  const grandCurrencyTotal = useMemo(() => {
    if (!topDenomination) return 0;
    const total = carriers.reduce((s, c) => s + totalInSmallest(denominations, c.wealth), 0);
    return total / topDenomination.value;
  }, [carriers, denominations, topDenomination]);

  const grandWeight = useMemo(
    () => carriers.reduce((s, c) => s + carrierWeight(c.items), 0),
    [carriers],
  );

  const overCapCount = useMemo(
    () =>
      carriers.filter(c => c.capacity !== null && carrierWeight(c.items) > (c.capacity ?? 0))
        .length,
    [carriers],
  );

  // Default expansion: every carrier collapsed except the first PC (usually the
  // active player). The user can expand/collapse freely after initial load.
  useEffect(() => {
    setExpanded(prev => {
      const next = { ...prev };
      carriers.forEach((c, idx) => {
        if (next[c.id] === undefined) next[c.id] = c.kind === 'pc' && idx === 0;
      });
      return next;
    });
  }, [carriers]);

  // ── Writes ──────────────────────────────────────────────────────────

  async function persistCarrier(
    carrier: Carrier,
    patch: Partial<{ items: InventoryItem[]; wealth: Wealth }>,
  ): Promise<void> {
    if (carrier.kind === 'pc') {
      const next: CharacterRecord = {
        ...carrier.character,
        inventory: patch.items ?? carrier.character.inventory,
        ...(patch.wealth ? engine.currency.write(carrier.character, patch.wealth) : {}),
        updatedAt: nowISO(),
      };
      await characterRepository.save(next);
    } else {
      const next: InventoryContainer = {
        ...carrier.container,
        items: patch.items ?? carrier.container.items,
        // Containers hold denomination-keyed money now, so any currency the
        // active system defines round-trips instead of being dropped.
        wealth: patch.wealth ?? containerWealth(carrier.container),
      };
      await inventoryContainerRepository.save(next);
    }
  }

  async function adjustCurrency(carrier: Carrier, denominationId: string, delta: number) {
    const amounts = normalizeWealth(denominations, carrier.wealth);
    amounts[denominationId] = (amounts[denominationId] ?? 0) + delta;
    const settled = makeChange(denominations, amounts);
    if (!settled) {
      showToast('Not enough coin');
      return;
    }
    await persistCarrier(carrier, { wealth: settled });
    reload();
  }

  async function handleItemQuantity(carrier: Carrier, itemId: string, quantity: number) {
    const items = carrier.items.map(i =>
      i.id === itemId ? { ...i, quantity: Math.max(0, quantity) } : i,
    );
    await persistCarrier(carrier, { items });
    reload();
  }

  async function handleItemEditorSave(item: InventoryItem) {
    if (!itemEditorState) return;
    const carrier = carriers.find(c => c.id === itemEditorState.carrierId);
    if (!carrier) return;
    const existingIdx = carrier.items.findIndex(i => i.id === item.id);
    const items =
      existingIdx >= 0
        ? carrier.items.map(i => (i.id === item.id ? item : i))
        : [...carrier.items, item];
    await persistCarrier(carrier, { items });
    setItemEditorState(null);
    reload();
  }

  async function handleItemDelete(carrier: Carrier, itemId: string) {
    const items = carrier.items.filter(i => i.id !== itemId);
    await persistCarrier(carrier, { items });
    reload();
  }

  async function handleMoveItem(
    fromId: string,
    item: InventoryItem,
    toId: string,
    amount: number,
  ) {
    const from = carriers.find(c => c.id === fromId);
    const to = carriers.find(c => c.id === toId);
    if (!from || !to) return;
    const move = Math.max(1, Math.min(amount, item.quantity));
    // Update source
    const fromItems =
      move >= item.quantity
        ? from.items.filter(i => i.id !== item.id)
        : from.items.map(i => (i.id === item.id ? { ...i, quantity: i.quantity - move } : i));
    // Update destination — merge only into a TRULY identical item so stacks
    // combine naturally. capacityBonus and description must match too: without
    // them a magic backpack (capacityBonus 5) moved onto a mundane look-alike
    // (0) would merge and silently lose its +5 carry capacity — a real data loss
    // that also drops the owner's encumbrance limit.
    const mergeIdx = to.items.findIndex(
      i =>
        i.name === item.name &&
        i.weight === item.weight &&
        !!i.tiny === !!item.tiny &&
        !!i.consumable === !!item.consumable &&
        (i.capacityBonus ?? 0) === (item.capacityBonus ?? 0) &&
        (i.description ?? '') === (item.description ?? ''),
    );
    let toItems: InventoryItem[];
    if (mergeIdx >= 0) {
      toItems = to.items.map((i, idx) =>
        idx === mergeIdx ? { ...i, quantity: i.quantity + move } : i,
      );
    } else {
      toItems = [
        ...to.items,
        { ...item, id: crypto.randomUUID(), quantity: move },
      ];
    }
    await persistCarrier(from, { items: fromItems });
    await persistCarrier(to, { items: toItems });
    setMoveItemTarget(null);
    reload();
  }

  async function handleMoveCoins(from: Carrier, toId: string, amounts: Wealth) {
    const to = carriers.find(c => c.id === toId);
    if (!to) return;
    const need = totalInSmallest(denominations, amounts);
    if (need <= 0) {
      setMoveCoinsSource(null);
      return;
    }
    if (totalInSmallest(denominations, from.wealth) < need) {
      showToast('Not enough coin to move');
      return;
    }
    // Deduct from source (preferring like denominations, borrowing as needed).
    const fromNext = normalizeWealth(denominations, from.wealth);
    for (const d of denominations) fromNext[d.id] -= amounts[d.id] ?? 0;
    const settled = makeChange(denominations, fromNext);
    if (!settled) {
      showToast('Not enough coin to move');
      return;
    }
    const toNext = normalizeWealth(denominations, to.wealth);
    for (const d of denominations) toNext[d.id] += amounts[d.id] ?? 0;

    await persistCarrier(from, { wealth: settled });
    await persistCarrier(to, { wealth: toNext });
    setMoveCoinsSource(null);
    reload();
  }

  async function handleContainerSave(data: {
    id?: string;
    name: string;
    kind: InventoryContainerKind;
    capacity: number | null;
  }) {
    if (!activeCampaign) return;
    if (data.id) {
      const existing = containers.find(c => c.id === data.id);
      if (!existing) return;
      await inventoryContainerRepository.save({
        ...existing,
        name: data.name,
        kind: data.kind,
        capacity: data.capacity,
      });
    } else {
      await inventoryContainerRepository.create({
        campaignId: activeCampaign.id,
        name: data.name,
        kind: data.kind,
        capacity: data.capacity,
      });
    }
    setContainerEditorOpen(false);
    setEditingContainer(null);
    reload();
  }

  async function handleContainerDelete(id: string) {
    await inventoryContainerRepository.softDelete(id);
    reload();
  }

  // ── Rendering ───────────────────────────────────────────────────────

  if (!activeCampaign) {
    return (
      <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-md)] p-[var(--space-md)]">
        No active campaign. Select or create one to manage party inventory.
      </p>
    );
  }
  if (loading) {
    return <p className="text-[var(--color-text-muted)] p-[var(--space-md)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      {/* Totals strip */}
      <div className="grid grid-cols-3 gap-[var(--space-sm)] p-[var(--space-md)] rounded-[var(--radius-md)] bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
        <div>
          <div className="text-[length:var(--font-size-xs)] text-[var(--color-text-muted)]">
            Total {topDenomination ? topDenomination.label.toLowerCase() : 'currency'}
          </div>
          <div className="text-[length:var(--font-size-lg)] text-[var(--color-text)] font-bold">
            ≈ {grandCurrencyTotal.toFixed(2)} {topDenomination?.abbr ?? ''}
          </div>
        </div>
        <div>
          <div className="text-[length:var(--font-size-xs)] text-[var(--color-text-muted)]">
            Total weight
          </div>
          <div className="text-[length:var(--font-size-lg)] text-[var(--color-text)] font-bold">
            {grandWeight}
          </div>
        </div>
        <div>
          <div className="text-[length:var(--font-size-xs)] text-[var(--color-text-muted)]">
            Over capacity
          </div>
          <div
            className={cn(
              'text-[length:var(--font-size-lg)] font-bold',
              overCapCount > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]',
            )}
          >
            {overCapCount}
          </div>
        </div>
      </div>

      {carriers.length === 0 && (
        <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
          No carriers yet. Add a party or container below.
        </p>
      )}

      {carriers.map(c => {
        const isExpanded = !!expanded[c.id];
        const weight = carrierWeight(c.items);
        const overCap = c.capacity !== null && weight > c.capacity;
        return (
          <div
            key={c.id}
            className={cn(
              'rounded-[var(--radius-md)] border bg-[var(--color-surface-alt)]',
              overCap ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]',
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-[var(--space-sm)] p-[var(--space-sm)]">
              <button
                type="button"
                onClick={() => setExpanded(e => ({ ...e, [c.id]: !e[c.id] }))}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                className="min-w-[44px] min-h-[44px] bg-transparent border-none text-[var(--color-text)] cursor-pointer flex items-center justify-center"
              >
                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>
              <span className="text-[length:var(--font-size-lg)]">
                {c.kind === 'pc' ? '🧝' : kindIcon(c.containerKind)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[var(--color-text)] text-[length:var(--font-size-md)] font-bold truncate">
                  {c.name}
                </div>
                <div className="text-[var(--color-text-muted)] text-[length:var(--font-size-xs)]">
                  {weight}
                  {c.capacity !== null ? ` / ${c.capacity}` : ''} wt ·{' '}
                  {denominations.map(d => `${c.wealth[d.id] ?? 0}${d.abbr}`).join(' ')}
                </div>
              </div>
              {c.kind === 'container' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingContainer(c.container);
                      setContainerEditorOpen(true);
                    }}
                    aria-label={`Edit ${c.name}`}
                    className="min-w-[44px] min-h-[44px] bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer flex items-center justify-center"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${c.name}"?`)) handleContainerDelete(c.container.id);
                    }}
                    aria-label={`Delete ${c.name}`}
                    className="min-w-[44px] min-h-[44px] bg-transparent border-none text-[var(--color-danger)] cursor-pointer flex items-center justify-center"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>

            {isExpanded && (
              <div className="px-[var(--space-sm)] pb-[var(--space-sm)] flex flex-col gap-[var(--space-md)]">
                {/* Coin strip */}
                <div className="flex flex-col gap-[var(--space-xs)]">
                  {denominations.map(denom => {
                    const value = c.wealth[denom.id] ?? 0;
                    // Any stock at all can cover a decrement once change is made.
                    const canDec = totalInSmallest(denominations, c.wealth) > 0;
                    return (
                      <div key={denom.id} className="flex items-center gap-[var(--space-sm)]">
                        <span className="text-xs text-[var(--color-text-muted)] min-w-[52px]">
                          {denom.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustCurrency(c, denom.id, -1)}
                          disabled={!canDec}
                          aria-label={`Spend 1 ${denom.label.toLowerCase()} from ${c.name}`}
                          className="min-w-[40px] min-h-[40px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)] cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:pointer-events-none"
                        >
                          −
                        </button>
                        <span className="min-w-[40px] text-center text-[var(--color-text)] font-bold">
                          {value}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustCurrency(c, denom.id, 1)}
                          aria-label={`Add 1 ${denom.label.toLowerCase()} to ${c.name}`}
                          className="min-w-[40px] min-h-[40px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)] cursor-pointer flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setMoveCoinsSource(c)}
                    className="self-start text-[length:var(--font-size-sm)] text-[var(--color-accent)] bg-transparent border-none cursor-pointer px-0 py-[var(--space-xs)] inline-flex items-center gap-[var(--space-xs)]"
                  >
                    <ArrowRightLeft size={14} /> Move coins
                  </button>
                </div>

                {/* Items */}
                <div className="flex flex-col">
                  {c.items.length === 0 && (
                    <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
                      No items.
                    </p>
                  )}
                  {c.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-[var(--space-sm)] py-[var(--space-xs)] border-b border-[var(--color-divider)] flex-wrap"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setItemEditorState({ carrierId: c.id, item })
                        }
                        className="flex-1 text-left bg-transparent border-none text-[var(--color-text)] text-[length:var(--font-size-md)] cursor-pointer p-0"
                      >
                        {item.name}
                        {item.tiny && (
                          <span className="ml-1 text-[length:var(--font-size-xs)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-1">
                            tiny
                          </span>
                        )}
                        {item.consumable && (
                          <span className="ml-1 text-[length:var(--font-size-xs)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-1">
                            consumable
                          </span>
                        )}
                        <span className="ml-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
                          x{item.quantity} · {item.tiny ? 0 : item.weight} wt
                        </span>
                      </button>

                      {item.consumable && (
                        <div className="flex items-center gap-[var(--space-xs)]">
                          <button
                            type="button"
                            onClick={() =>
                              handleItemQuantity(c, item.id, item.quantity - 1)
                            }
                            disabled={item.quantity <= 0}
                            aria-label={`Decrease ${item.name}`}
                            className="min-w-[36px] min-h-[36px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)] cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:pointer-events-none"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleItemQuantity(c, item.id, item.quantity + 1)
                            }
                            aria-label={`Increase ${item.name}`}
                            className="min-w-[36px] min-h-[36px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)] cursor-pointer flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setMoveItemTarget({ carrierId: c.id, item })}
                        aria-label={`Move ${item.name}`}
                        className="min-w-[36px] min-h-[36px] bg-transparent border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] cursor-pointer flex items-center justify-center"
                        title="Move to another carrier"
                      >
                        <ArrowRightLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete "${item.name}"?`)) handleItemDelete(c, item.id);
                        }}
                        aria-label={`Delete ${item.name}`}
                        className="min-w-[36px] min-h-[36px] bg-transparent border-none text-[var(--color-danger)] cursor-pointer flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setItemEditorState({ carrierId: c.id, item: null })}
                    className="mt-[var(--space-sm)] self-start"
                  >
                    + Add Item
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Button
        variant="secondary"
        onClick={() => {
          setEditingContainer(null);
          setContainerEditorOpen(true);
        }}
      >
        <Plus size={16} /> Add Container
      </Button>

      <SectionPanel title="About party inventory" collapsible defaultOpen={false}>
        <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
          PCs and containers all live here. Tap an item's icon to move it to
          any other carrier. Containers can be coffers, pack animals, NPCs, or
          anything else — their capacity is a soft limit shown in red when
          exceeded.
        </p>
      </SectionPanel>

      {/* Move item drawer */}
      <MoveItemDrawer
        open={!!moveItemTarget}
        onClose={() => setMoveItemTarget(null)}
        target={moveItemTarget}
        carriers={carriers}
        onMove={handleMoveItem}
      />

      {/* Move coins drawer */}
      <MoveCoinsDrawer
        open={!!moveCoinsSource}
        onClose={() => setMoveCoinsSource(null)}
        source={moveCoinsSource}
        carriers={carriers}
        denominations={denominations}
        onMove={handleMoveCoins}
      />

      {/* Container editor */}
      <ContainerEditor
        open={containerEditorOpen}
        onClose={() => {
          setContainerEditorOpen(false);
          setEditingContainer(null);
        }}
        existing={editingContainer}
        onSave={handleContainerSave}
      />

      {/* Item editor */}
      <InventoryItemEditor
        open={!!itemEditorState}
        onClose={() => setItemEditorState(null)}
        item={itemEditorState?.item ?? null}
        onSave={handleItemEditorSave}
      />
    </div>
  );
}

// ── Sub-drawers ──────────────────────────────────────────────────────

function MoveItemDrawer({
  open,
  onClose,
  target,
  carriers,
  onMove,
}: {
  open: boolean;
  onClose: () => void;
  target: { carrierId: string; item: InventoryItem } | null;
  carriers: Carrier[];
  onMove: (fromId: string, item: InventoryItem, toId: string, amount: number) => void;
}) {
  const [amount, setAmount] = useState(1);
  useEffect(() => {
    if (open && target) setAmount(target.item.quantity);
  }, [open, target]);
  if (!target) return <Drawer open={open} onClose={onClose} title="Move"><div /></Drawer>;
  const destinations = carriers.filter(c => c.id !== target.carrierId);
  return (
    <Drawer open={open} onClose={onClose} title={`Move "${target.item.name}"`}>
      <div className="flex flex-col gap-[var(--space-md)]">
        {target.item.quantity > 1 && (
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
              How many? (of {target.item.quantity})
            </label>
            <input
              type="number"
              className={inputClasses}
              min={1}
              max={target.item.quantity}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
            />
          </div>
        )}
        <div className="flex flex-col gap-[var(--space-xs)]">
          <div className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            Move to…
          </div>
          {destinations.length === 0 && (
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
              No other carriers. Add a container first.
            </p>
          )}
          {destinations.map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => onMove(target.carrierId, target.item, d.id, amount)}
              className="text-left p-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] cursor-pointer min-h-[var(--touch-target-min)]"
            >
              <span className="mr-[var(--space-xs)]">
                {d.kind === 'pc' ? '🧝' : kindIcon(d.containerKind)}
              </span>
              {d.name}
            </button>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

function MoveCoinsDrawer({
  open,
  onClose,
  source,
  carriers,
  denominations,
  onMove,
}: {
  open: boolean;
  onClose: () => void;
  source: Carrier | null;
  carriers: Carrier[];
  denominations: CurrencyDenomination[];
  onMove: (from: Carrier, toId: string, amounts: Wealth) => void;
}) {
  const [amounts, setAmounts] = useState<Wealth>({});
  const [destId, setDestId] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setAmounts({});
      setDestId(null);
    }
  }, [open]);
  const totalEntered = denominations.reduce((s, d) => s + (amounts[d.id] ?? 0), 0);
  if (!source) return <Drawer open={open} onClose={onClose} title="Move coins"><div /></Drawer>;
  const destinations = carriers.filter(c => c.id !== source.id);
  return (
    <Drawer open={open} onClose={onClose} title={`Move coins from ${source.name}`}>
      <div className="flex flex-col gap-[var(--space-md)]">
        <div
          className="grid gap-[var(--space-sm)]"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, denominations.length)}, minmax(0, 1fr))` }}
        >
          {denominations.map(denom => (
            <div key={denom.id}>
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
                {denom.label}
              </label>
              <input
                type="number"
                min={0}
                className={inputClasses}
                value={amounts[denom.id] ?? 0}
                onChange={e =>
                  setAmounts(prev => ({
                    ...prev,
                    [denom.id]: Math.max(0, Number(e.target.value)),
                  }))
                }
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-[var(--space-xs)]">
          <div className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            Move to…
          </div>
          {destinations.map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDestId(d.id)}
              className={cn(
                'text-left p-[var(--space-sm)] rounded-[var(--radius-sm)] border text-[var(--color-text)] cursor-pointer min-h-[var(--touch-target-min)]',
                destId === d.id
                  ? 'border-[var(--color-accent)] bg-[var(--color-surface)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-alt)]',
              )}
            >
              <span className="mr-[var(--space-xs)]">
                {d.kind === 'pc' ? '🧝' : kindIcon(d.containerKind)}
              </span>
              {d.name}
            </button>
          ))}
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!destId || totalEntered === 0}
            onClick={() => destId && onMove(source, destId, amounts)}
          >
            Move
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function ContainerEditor({
  open,
  onClose,
  existing,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  existing: InventoryContainer | null;
  onSave: (data: {
    id?: string;
    name: string;
    kind: InventoryContainerKind;
    capacity: number | null;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<InventoryContainerKind>('coffer');
  const [unlimited, setUnlimited] = useState(true);
  const [capacity, setCapacity] = useState(30);

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? '');
      setKind(existing?.kind ?? 'coffer');
      setUnlimited(existing?.capacity === null || existing?.capacity === undefined);
      setCapacity(existing?.capacity ?? 30);
    }
  }, [open, existing]);

  return (
    <Drawer open={open} onClose={onClose} title={existing ? 'Edit Container' : 'Add Container'}>
      <div className="flex flex-col gap-[var(--space-md)]">
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
            Name
          </label>
          <input
            className={inputClasses}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Party Coffer / Donkey / Groom"
          />
        </div>
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
            Kind
          </label>
          <div className="grid grid-cols-2 gap-[var(--space-sm)]">
            {DEFAULT_INVENTORY_CONTAINER_KINDS.map(k => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={cn(
                  'p-[var(--space-sm)] rounded-[var(--radius-sm)] border text-[var(--color-text)] cursor-pointer min-h-[var(--touch-target-min)] text-left',
                  kind === k.id
                    ? 'border-[var(--color-accent)] bg-[var(--color-surface-alt)]'
                    : 'border-[var(--color-border)] bg-transparent',
                )}
              >
                <span className="mr-[var(--space-xs)]">{k.icon}</span>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-[var(--space-sm)] text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={e => setUnlimited(e.target.checked)}
            className="w-5 h-5"
          />
          Unlimited capacity
        </label>
        {!unlimited && (
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
              Capacity (weight units)
            </label>
            <input
              type="number"
              min={0}
              className={inputClasses}
              value={capacity}
              onChange={e => setCapacity(Math.max(0, Number(e.target.value)))}
            />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                id: existing?.id,
                name: name.trim(),
                kind,
                capacity: unlimited ? null : capacity,
              })
            }
          >
            Save
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
