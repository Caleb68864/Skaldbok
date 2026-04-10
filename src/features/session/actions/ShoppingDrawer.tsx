import { useState } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { PartyPicker } from '../../../components/fields/PartyPicker';
import type { ResolvedMember } from '../../../components/fields/PartyPicker';
import { CounterControl } from '../../../components/primitives/CounterControl';
import { useNoteActions } from '../../notes/useNoteActions';
import { useToast } from '../../../context/ToastContext';
import { useSessionEncounterContextSafe } from '../SessionEncounterContext';
import { AttachToControl, resolveAttach, type AttachToValue } from '../quickActions/AttachToControl';
import { cn } from '../../../lib/utils';

/**
 * Props for the {@link ShoppingDrawer} component.
 */
export interface ShoppingDrawerProps {
  /** Whether the drawer is currently open. */
  open: boolean;
  /** Called when the drawer should be closed. */
  onClose: () => void;
  /** All available party members for the {@link PartyPicker}. */
  members: ResolvedMember[];
  /** IDs of the currently selected party members. */
  selectedMembers: string[];
  /** Called when the member selection changes. */
  onSelectMembers: (ids: string[]) => void;
  /** Called after a purchase or sale has been logged as a note. */
  onLogged: () => void;
}

/**
 * Drawer for logging a buy or sell transaction to the active session.
 *
 * @remarks
 * Lets the GM record which party members were involved, the action (Buy / Sell),
 * an optional item name, per-item costs in gold / silver / copper, and a quantity.
 * When quantity > 1 and a cost is entered, the total cost is shown as a preview
 * before logging.
 *
 * The log entry is created as a `generic` note with structured `typeData`
 * containing the action, item, quantity, unit costs, and computed totals.
 * Closing or logging resets all fields to their defaults.
 *
 * @param props - {@link ShoppingDrawerProps}
 *
 * @example
 * ```tsx
 * <ShoppingDrawer
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   members={resolvedMembers}
 *   selectedMembers={selectedIds}
 *   onSelectMembers={setSelectedIds}
 *   onLogged={refreshNotes}
 * />
 * ```
 */
export function ShoppingDrawer({ open, onClose, members, selectedMembers, onSelectMembers, onLogged }: ShoppingDrawerProps) {
  const { createNote } = useNoteActions();
  const { showToast } = useToast();
  const sessionEncounterCtx = useSessionEncounterContextSafe();
  const [shopItem, setShopItem] = useState('');
  const [shopAction, setShopAction] = useState<'buy' | 'sell'>('buy');
  const [shopGold, setShopGold] = useState(0);
  const [shopSilver, setShopSilver] = useState(0);
  const [shopCopper, setShopCopper] = useState(0);
  const [shopQuantity, setShopQuantity] = useState(1);
  const [attachTo, setAttachTo] = useState<AttachToValue>('auto');

  /** Returns the display label for the current member selection. */
  const selectedNames = () => {
    if (selectedMembers.length === 0) return 'Unknown';
    if (selectedMembers.length === members.length && members.length > 1) return 'Party';
    return selectedMembers.map(id => members.find(m => m.id === id)?.name ?? 'Unknown').join(', ');
  };

  /** Resets all form fields to their defaults and closes the drawer. */
  const handleClose = () => {
    setShopItem('');
    setShopAction('buy');
    setShopGold(0);
    setShopSilver(0);
    setShopCopper(0);
    setShopQuantity(1);
    setAttachTo('auto');
    onClose();
  };

  /**
   * Creates a `generic` note recording the transaction, shows a toast, and
   * resets the form. The note title is auto-formatted, e.g.:
   * `"Party: Bought Iron Sword ×3 for 9g"`
   */
  const handleLog = async () => {
    const totalGold = shopGold * shopQuantity;
    const totalSilver = shopSilver * shopQuantity;
    const totalCopper = shopCopper * shopQuantity;
    const hasAnyCoin = shopGold > 0 || shopSilver > 0 || shopCopper > 0;
    const totalStr = hasAnyCoin
      ? [
          totalGold > 0 ? `${totalGold}g` : '',
          totalSilver > 0 ? `${totalSilver}s` : '',
          totalCopper > 0 ? `${totalCopper}c` : '',
        ].filter(Boolean).join(' ')
      : '';

    const verb = shopAction === 'buy' ? 'Bought' : 'Sold';
    const itemPart = shopItem.trim() ? ` ${shopItem.trim()}` : '';
    const coinPart = totalStr ? ` for ${totalStr}` : '';
    const qtyPart = shopQuantity > 1 ? ` ×${shopQuantity}` : '';
    const fullTitle = `${selectedNames()}: ${verb}${itemPart}${qtyPart}${coinPart}`;

    const currentAttach = attachTo;
    await createNote(
      {
        title: fullTitle,
        type: 'generic',
        body: null,
        pinned: false,
        status: 'active',
        typeData: {
          action: shopAction,
          item: shopItem.trim() || undefined,
          quantity: shopQuantity,
          costGold: shopGold,
          costSilver: shopSilver,
          costCopper: shopCopper,
          totalGold,
          totalSilver,
          totalCopper,
        },
      },
      { targetEncounterId: resolveAttach(currentAttach) },
    );
    let encounterTitle: string | null = null;
    if (currentAttach === 'auto') {
      encounterTitle = sessionEncounterCtx?.activeEncounter?.title ?? null;
    } else if (typeof currentAttach === 'string') {
      encounterTitle = 'encounter';
    }
    if (encounterTitle) {
      showToast(`Logged to ${encounterTitle}`, 'success', 2000);
    } else {
      showToast('Logged to session', 'success', 2000);
    }
    handleClose();
    onLogged();
  };

  const hasAnyCoin = shopGold > 0 || shopSilver > 0 || shopCopper > 0;
  const totalGold = shopGold * shopQuantity;
  const totalSilver = shopSilver * shopQuantity;
  const totalCopper = shopCopper * shopQuantity;
  const totalStr = hasAnyCoin
    ? [
        totalGold > 0 ? `${totalGold}g` : '',
        totalSilver > 0 ? `${totalSilver}s` : '',
        totalCopper > 0 ? `${totalCopper}c` : '',
      ].filter(Boolean).join(' ')
    : '';

  return (
    <Drawer open={open} onClose={handleClose} title="Shopping">
      <PartyPicker members={members} selected={selectedMembers} onSelect={onSelectMembers} />
      <div className="flex gap-3 mb-3">
        <button
          onClick={() => setShopAction('buy')}
          className={cn(
            'min-h-11 px-3.5 border border-[var(--color-border)] rounded-full cursor-pointer text-sm font-semibold shrink-0 flex-1',
            shopAction === 'buy'
              ? 'bg-[#27ae60] text-white'
              : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
          )}
        >
          Buy
        </button>
        <button
          onClick={() => setShopAction('sell')}
          className={cn(
            'min-h-11 px-3.5 border border-[var(--color-border)] rounded-full cursor-pointer text-sm font-semibold shrink-0 flex-1',
            shopAction === 'sell'
              ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
              : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
          )}
        >
          Sell
        </button>
      </div>
      <input
        type="text"
        placeholder="Item name (optional)"
        value={shopItem}
        onChange={e => setShopItem(e.target.value)}
        autoFocus
        className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-3 box-border"
      />
      <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
        Cost per item
      </p>
      <div className="flex flex-col gap-2 mb-3">
        <CounterControl label="Gold" value={shopGold} min={0} onChange={setShopGold} />
        <CounterControl label="Silver" value={shopSilver} min={0} onChange={setShopSilver} />
        <CounterControl label="Copper" value={shopCopper} min={0} onChange={setShopCopper} />
        <CounterControl label="Qty" value={shopQuantity} min={1} onChange={setShopQuantity} />
      </div>
      {hasAnyCoin && shopQuantity > 1 && (
        <p className="text-[var(--color-text-muted)] text-sm mb-3">
          Total: {totalStr}
        </p>
      )}
      <AttachToControl value={attachTo} onChange={setAttachTo} />
      <button
        onClick={handleLog}
        className={cn(
          'w-full min-h-11 border-none rounded-lg text-base font-semibold cursor-pointer text-white',
          shopAction === 'buy' ? 'bg-[#27ae60]' : 'bg-[var(--color-accent)]'
        )}
      >
        Log {shopAction === 'buy' ? 'Purchase' : 'Sale'}
      </button>
    </Drawer>
  );
}
