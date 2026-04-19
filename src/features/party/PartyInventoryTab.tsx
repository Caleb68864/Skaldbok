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
import type { CharacterRecord, InventoryItem } from '../../types/character';
import type {
  InventoryContainer,
  InventoryContainerKind,
} from '../../types/inventoryContainer';

type Carrier =
  | {
      kind: 'pc';
      id: string;
      name: string;
      items: InventoryItem[];
      coins: { gold: number; silver: number; copper: number };
      capacity: number;
      character: CharacterRecord;
    }
  | {
      kind: 'container';
      id: string;
      name: string;
      items: InventoryItem[];
      coins: { gold: number; silver: number; copper: number };
      capacity: number | null;
      container: InventoryContainer;
      containerKind: InventoryContainerKind;
    };

const inputClasses =
  'w-full p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)] font-[family-name:inherit]';

function coinTotalCopper(coins: { gold: number; silver: number; copper: number }): number {
  return coins.gold * 100 + coins.silver * 10 + coins.copper;
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
        coins: pc.coins,
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
        coins: c.coins,
        capacity: c.capacity,
        container: c,
        containerKind: c.kind,
      });
    }
    return out;
  }, [pcs, containers]);

  const grandGoldEquiv = useMemo(() => {
    const totalCopper = carriers.reduce((s, c) => s + coinTotalCopper(c.coins), 0);
    return totalCopper / 100;
  }, [carriers]);

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
    patch: Partial<{ items: InventoryItem[]; coins: Carrier['coins'] }>,
  ): Promise<void> {
    if (carrier.kind === 'pc') {
      const next: CharacterRecord = {
        ...carrier.character,
        inventory: patch.items ?? carrier.character.inventory,
        coins: patch.coins ?? carrier.character.coins,
        updatedAt: nowISO(),
      };
      await characterRepository.save(next);
    } else {
      const next: InventoryContainer = {
        ...carrier.container,
        items: patch.items ?? carrier.container.items,
        coins: patch.coins ?? carrier.container.coins,
      };
      await inventoryContainerRepository.save(next);
    }
  }

  async function adjustCoin(
    carrier: Carrier,
    coin: 'gold' | 'silver' | 'copper',
    delta: number,
  ) {
    let { gold, silver, copper } = carrier.coins;
    if (coin === 'gold') gold += delta;
    else if (coin === 'silver') silver += delta;
    else copper += delta;
    while (copper < 0 && silver > 0) {
      copper += 10;
      silver -= 1;
    }
    while (copper < 0 && gold > 0) {
      gold -= 1;
      silver += 9;
      copper += 10;
    }
    while (silver < 0 && gold > 0) {
      gold -= 1;
      silver += 10;
    }
    if (gold < 0 || silver < 0 || copper < 0) {
      showToast('Not enough coin');
      return;
    }
    await persistCarrier(carrier, { coins: { gold, silver, copper } });
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
    // Update destination — merge if an identically-named item already exists
    // with matching flags so stacks combine naturally.
    const mergeIdx = to.items.findIndex(
      i =>
        i.name === item.name &&
        i.weight === item.weight &&
        !!i.tiny === !!item.tiny &&
        !!i.consumable === !!item.consumable,
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

  async function handleMoveCoins(
    from: Carrier,
    toId: string,
    amounts: { gold: number; silver: number; copper: number },
  ) {
    const to = carriers.find(c => c.id === toId);
    if (!to) return;
    const need = amounts.gold * 100 + amounts.silver * 10 + amounts.copper;
    if (need <= 0) {
      setMoveCoinsSource(null);
      return;
    }
    if (coinTotalCopper(from.coins) < need) {
      showToast('Not enough coin to move');
      return;
    }
    // Deduct from source (preferring like denominations, borrowing as needed).
    let { gold: fg, silver: fs, copper: fc } = from.coins;
    fg -= amounts.gold;
    fs -= amounts.silver;
    fc -= amounts.copper;
    while (fc < 0 && fs > 0) {
      fc += 10;
      fs -= 1;
    }
    while (fc < 0 && fg > 0) {
      fg -= 1;
      fs += 9;
      fc += 10;
    }
    while (fs < 0 && fg > 0) {
      fg -= 1;
      fs += 10;
    }
    if (fg < 0 || fs < 0 || fc < 0) {
      showToast('Not enough coin to move');
      return;
    }
    const newToCoins = {
      gold: to.coins.gold + amounts.gold,
      silver: to.coins.silver + amounts.silver,
      copper: to.coins.copper + amounts.copper,
    };
    await persistCarrier(from, { coins: { gold: fg, silver: fs, copper: fc } });
    await persistCarrier(to, { coins: newToCoins });
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
            Total gold
          </div>
          <div className="text-[length:var(--font-size-lg)] text-[var(--color-text)] font-bold">
            ≈ {grandGoldEquiv.toFixed(2)} gp
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
                  {c.capacity !== null ? ` / ${c.capacity}` : ''} wt · {c.coins.gold}g{' '}
                  {c.coins.silver}s {c.coins.copper}c
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
                  {(['gold', 'silver', 'copper'] as const).map(coin => {
                    const label = coin.charAt(0).toUpperCase() + coin.slice(1);
                    const value = c.coins[coin];
                    const canDec = coinTotalCopper(c.coins) > 0;
                    return (
                      <div key={coin} className="flex items-center gap-[var(--space-sm)]">
                        <span className="text-xs text-[var(--color-text-muted)] min-w-[52px]">
                          {label}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustCoin(c, coin, -1)}
                          disabled={!canDec}
                          aria-label={`Spend 1 ${coin} from ${c.name}`}
                          className="min-w-[40px] min-h-[40px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)] cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:pointer-events-none"
                        >
                          −
                        </button>
                        <span className="min-w-[40px] text-center text-[var(--color-text)] font-bold">
                          {value}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustCoin(c, coin, 1)}
                          aria-label={`Add 1 ${coin} to ${c.name}`}
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
  onMove,
}: {
  open: boolean;
  onClose: () => void;
  source: Carrier | null;
  carriers: Carrier[];
  onMove: (
    from: Carrier,
    toId: string,
    amounts: { gold: number; silver: number; copper: number },
  ) => void;
}) {
  const [gold, setGold] = useState(0);
  const [silver, setSilver] = useState(0);
  const [copper, setCopper] = useState(0);
  const [destId, setDestId] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setGold(0);
      setSilver(0);
      setCopper(0);
      setDestId(null);
    }
  }, [open]);
  if (!source) return <Drawer open={open} onClose={onClose} title="Move coins"><div /></Drawer>;
  const destinations = carriers.filter(c => c.id !== source.id);
  return (
    <Drawer open={open} onClose={onClose} title={`Move coins from ${source.name}`}>
      <div className="flex flex-col gap-[var(--space-md)]">
        <div className="grid grid-cols-3 gap-[var(--space-sm)]">
          {(
            [
              ['Gold', gold, setGold],
              ['Silver', silver, setSilver],
              ['Copper', copper, setCopper],
            ] as const
          ).map(([label, value, setter]) => (
            <div key={label}>
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
                {label}
              </label>
              <input
                type="number"
                min={0}
                className={inputClasses}
                value={value}
                onChange={e => setter(Math.max(0, Number(e.target.value)))}
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
            disabled={!destId || gold + silver + copper === 0}
            onClick={() =>
              destId && onMove(source, destId, { gold, silver, copper })
            }
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
