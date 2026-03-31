import { useState } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { PartyPicker } from '../../../components/fields/PartyPicker';
import type { ResolvedMember } from '../../../components/fields/PartyPicker';
import { CounterControl } from '../../../components/primitives/CounterControl';
import { useNoteActions } from '../../notes/useNoteActions';
import { useToast } from '../../../context/ToastContext';

const chipStyle = {
  minHeight: '44px',
  padding: '0 14px',
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '22px',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
  flexShrink: 0,
} as const;

export interface ShoppingDrawerProps {
  open: boolean;
  onClose: () => void;
  members: ResolvedMember[];
  selectedMembers: string[];
  onSelectMembers: (ids: string[]) => void;
  onLogged: () => void;
}

export function ShoppingDrawer({ open, onClose, members, selectedMembers, onSelectMembers, onLogged }: ShoppingDrawerProps) {
  const { createNote } = useNoteActions();
  const { showToast } = useToast();
  const [shopItem, setShopItem] = useState('');
  const [shopAction, setShopAction] = useState<'buy' | 'sell'>('buy');
  const [shopGold, setShopGold] = useState(0);
  const [shopSilver, setShopSilver] = useState(0);
  const [shopCopper, setShopCopper] = useState(0);
  const [shopQuantity, setShopQuantity] = useState(1);

  const selectedNames = () => {
    if (selectedMembers.length === 0) return 'Unknown';
    if (selectedMembers.length === members.length && members.length > 1) return 'Party';
    return selectedMembers.map(id => members.find(m => m.id === id)?.name ?? 'Unknown').join(', ');
  };

  const handleClose = () => {
    setShopItem('');
    setShopAction('buy');
    setShopGold(0);
    setShopSilver(0);
    setShopCopper(0);
    setShopQuantity(1);
    onClose();
  };

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

    await createNote({
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
    });
    showToast(`Logged: ${fullTitle}`);
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
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <button
          onClick={() => setShopAction('buy')}
          style={{
            ...chipStyle,
            flex: 1,
            background: shopAction === 'buy' ? '#27ae60' : 'var(--color-surface-raised)',
            color: shopAction === 'buy' ? '#fff' : 'var(--color-text)',
          }}
        >
          Buy
        </button>
        <button
          onClick={() => setShopAction('sell')}
          style={{
            ...chipStyle,
            flex: 1,
            background: shopAction === 'sell' ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            color: shopAction === 'sell' ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
          }}
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
        style={{
          width: '100%',
          padding: '10px 12px',
          minHeight: '44px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          fontSize: '16px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        Cost per item
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <CounterControl label="Gold" value={shopGold} min={0} onChange={setShopGold} />
        <CounterControl label="Silver" value={shopSilver} min={0} onChange={setShopSilver} />
        <CounterControl label="Copper" value={shopCopper} min={0} onChange={setShopCopper} />
        <CounterControl label="Qty" value={shopQuantity} min={1} onChange={setShopQuantity} />
      </div>
      {hasAnyCoin && shopQuantity > 1 && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '12px' }}>
          Total: {totalStr}
        </p>
      )}
      <button
        onClick={handleLog}
        style={{
          width: '100%',
          minHeight: '44px',
          background: shopAction === 'buy' ? '#27ae60' : 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Log {shopAction === 'buy' ? 'Purchase' : 'Sale'}
      </button>
    </Drawer>
  );
}
