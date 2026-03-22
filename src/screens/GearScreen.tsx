import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { WeaponCard } from '../components/fields/WeaponCard';
import { WeaponEditor } from '../components/fields/WeaponEditor';
import { InventoryList } from '../components/fields/InventoryList';
import { InventoryItemEditor } from '../components/fields/InventoryItemEditor';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { CounterControl } from '../components/primitives/CounterControl';
import { Button } from '../components/primitives/Button';
import type { Weapon, InventoryItem } from '../types/character';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { computeEncumbranceLimit } from '../utils/derivedValues';

export default function GearScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { settings } = useAppState();
  const [weaponDrawerOpen, setWeaponDrawerOpen] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  const [inventoryDrawerOpen, setInventoryDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  if (isLoading) return <div style={{ padding: 'var(--space-md)', color: 'var(--color-text)' }}>Loading...</div>;
  if (!character) { navigate('/library'); return null; }

  const isEditMode = settings.mode === 'edit';

  function handleWeaponSave(weapon: Weapon) {
    if (!character) return;
    const existing = character.weapons.findIndex(w => w.id === weapon.id);
    const weapons = existing >= 0
      ? character.weapons.map(w => w.id === weapon.id ? weapon : w)
      : [...character.weapons, weapon];
    updateCharacter({ weapons, updatedAt: nowISO() });
  }

  function handleWeaponEquipToggle(weaponId: string) {
    if (!character) return;
    const weapons = character.weapons.map(w => w.id === weaponId ? { ...w, equipped: !w.equipped } : w);
    updateCharacter({ weapons, updatedAt: nowISO() });
  }

  function handleWeaponDelete(weaponId: string) {
    if (!character) return;
    updateCharacter({ weapons: character.weapons.filter(w => w.id !== weaponId), updatedAt: nowISO() });
  }

  function handleInventorySave(item: InventoryItem) {
    if (!character) return;
    const existing = character.inventory.findIndex(i => i.id === item.id);
    const inventory = existing >= 0
      ? character.inventory.map(i => i.id === item.id ? item : i)
      : [...character.inventory, item];
    updateCharacter({ inventory, updatedAt: nowISO() });
  }

  function handleInventoryDelete(id: string) {
    if (!character) return;
    updateCharacter({ inventory: character.inventory.filter(i => i.id !== id), updatedAt: nowISO() });
  }

  function updateCoin(coin: 'gold' | 'silver' | 'copper', value: number) {
    if (!character) return;
    updateCharacter({ coins: { ...character.coins, [coin]: value }, updatedAt: nowISO() });
  }

  const totalWeight = character.inventory.reduce((sum, i) => sum + i.weight * i.quantity, 0);
  const encumbranceLimit = computeEncumbranceLimit(character);

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <h1 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)', marginBottom: 'var(--space-md)' }}>Gear</h1>

      <SectionPanel title="Weapons" collapsible defaultOpen>
        {character.weapons.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No weapons.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {character.weapons.map(weapon => (
            <WeaponCard
              key={weapon.id}
              weapon={weapon}
              onEquipToggle={() => handleWeaponEquipToggle(weapon.id)}
              onEdit={() => { setEditingWeapon(weapon); setWeaponDrawerOpen(true); }}
              onDelete={() => handleWeaponDelete(weapon.id)}
              isEditMode={isEditMode}
            />
          ))}
        </div>
        {isEditMode && (
          <Button variant="secondary" size="sm" style={{ marginTop: 'var(--space-sm)' }} onClick={() => { setEditingWeapon(null); setWeaponDrawerOpen(true); }}>
            + Add Weapon
          </Button>
        )}
      </SectionPanel>

      <SectionPanel title="Armor &amp; Helmet" collapsible defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {character.armor ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text)' }}>Armor: {character.armor.name} (rating {character.armor.rating})</span>
              <Button size="sm" variant={character.armor.equipped ? 'primary' : 'secondary'} onClick={() => {
                if (!character?.armor) return;
                updateCharacter({ armor: { ...character.armor, equipped: !character.armor.equipped }, updatedAt: nowISO() });
              }}>
                {character.armor.equipped ? 'Equipped' : 'Equip'}
              </Button>
            </div>
          ) : <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No armor.</p>}
          {character.helmet ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text)' }}>Helmet: {character.helmet.name} (rating {character.helmet.rating})</span>
              <Button size="sm" variant={character.helmet.equipped ? 'primary' : 'secondary'} onClick={() => {
                if (!character?.helmet) return;
                updateCharacter({ helmet: { ...character.helmet, equipped: !character.helmet.equipped }, updatedAt: nowISO() });
              }}>
                {character.helmet.equipped ? 'Equipped' : 'Equip'}
              </Button>
            </div>
          ) : <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No helmet.</p>}
          {isEditMode && (
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
              <Button size="sm" variant="secondary" onClick={() => updateCharacter({ armor: { id: generateId(), name: 'Armor', rating: 2, features: '', equipped: false }, updatedAt: nowISO() })}>
                Set Armor
              </Button>
              <Button size="sm" variant="secondary" onClick={() => updateCharacter({ helmet: { id: generateId(), name: 'Helmet', rating: 1, features: '', equipped: false }, updatedAt: nowISO() })}>
                Set Helmet
              </Button>
            </div>
          )}
        </div>
      </SectionPanel>

      <SectionPanel title="Inventory" collapsible defaultOpen>
        <InventoryList
          items={character.inventory}
          onEdit={item => { setEditingItem(item); setInventoryDrawerOpen(true); }}
          onDelete={handleInventoryDelete}
          onAdd={() => { setEditingItem(null); setInventoryDrawerOpen(true); }}
          isEditMode={isEditMode}
        />
      </SectionPanel>

      <SectionPanel title="Coins" collapsible defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <CounterControl label="Gold" value={character.coins.gold} min={0} onChange={v => updateCoin('gold', v)} />
          <CounterControl label="Silver" value={character.coins.silver} min={0} onChange={v => updateCoin('silver', v)} />
          <CounterControl label="Copper" value={character.coins.copper} min={0} onChange={v => updateCoin('copper', v)} />
        </div>
      </SectionPanel>

      <SectionPanel title="Encumbrance" collapsible defaultOpen>
        <p style={{ color: totalWeight > encumbranceLimit ? 'var(--color-danger)' : 'var(--color-text)', fontSize: 'var(--font-size-md)' }}>
          {totalWeight} / {encumbranceLimit} {totalWeight > encumbranceLimit ? '(Overloaded!)' : ''}
        </p>
      </SectionPanel>

      <WeaponEditor
        open={weaponDrawerOpen}
        onClose={() => setWeaponDrawerOpen(false)}
        weapon={editingWeapon}
        onSave={handleWeaponSave}
      />

      <InventoryItemEditor
        open={inventoryDrawerOpen}
        onClose={() => setInventoryDrawerOpen(false)}
        item={editingItem}
        onSave={handleInventorySave}
      />
    </div>
  );
}
