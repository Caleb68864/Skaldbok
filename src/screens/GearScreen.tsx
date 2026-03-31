import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { WeaponCard } from '../components/fields/WeaponCard';
import { WeaponEditor } from '../components/fields/WeaponEditor';
import { InventoryList } from '../components/fields/InventoryList';
import { InventoryItemEditor } from '../components/fields/InventoryItemEditor';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { CounterControl } from '../components/primitives/CounterControl';
import { Button } from '../components/primitives/Button';
import { Drawer } from '../components/primitives/Drawer';
import type { Weapon, InventoryItem, ArmorPiece } from '../types/character';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { computeEncumbranceLimit } from '../utils/derivedValues';
import { useIsEditMode, useFieldEditable } from '../utils/modeGuards';
import { useSessionLog } from '../features/session/useSessionLog';

export default function GearScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const isEditMode = useIsEditMode();
  const armorEquipEditable = useFieldEditable('armor.equipped');
  const helmetEquipEditable = useFieldEditable('helmet.equipped');
  const { logToSession } = useSessionLog();

  const [weaponDrawerOpen, setWeaponDrawerOpen] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  const [inventoryDrawerOpen, setInventoryDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newTinyItem, setNewTinyItem] = useState('');

  // Armor drawer state
  const [armorDrawerOpen, setArmorDrawerOpen] = useState(false);
  const [armorName, setArmorName] = useState('');
  const [armorRating, setArmorRating] = useState(0);
  const [armorBodyPart, setArmorBodyPart] = useState('');
  const [armorWeight, setArmorWeight] = useState(0);
  const [armorMovementPenalty, setArmorMovementPenalty] = useState(0);
  const [armorEquipped, setArmorEquipped] = useState(false);

  // Helmet drawer state
  const [helmetDrawerOpen, setHelmetDrawerOpen] = useState(false);
  const [helmetName, setHelmetName] = useState('');
  const [helmetRating, setHelmetRating] = useState(0);
  const [helmetWeight, setHelmetWeight] = useState(0);
  const [helmetEquipped, setHelmetEquipped] = useState(false);

  // Populate armor form when drawer opens
  useEffect(() => {
    if (armorDrawerOpen && character?.armor) {
      setArmorName(character.armor.name);
      setArmorRating(character.armor.rating);
      setArmorBodyPart(character.armor.bodyPart ?? '');
      setArmorWeight(character.armor.weight ?? 0);
      setArmorMovementPenalty(character.armor.movementPenalty ?? 0);
      setArmorEquipped(character.armor.equipped);
    } else if (armorDrawerOpen && !character?.armor) {
      setArmorName('');
      setArmorRating(0);
      setArmorBodyPart('');
      setArmorWeight(0);
      setArmorMovementPenalty(0);
      setArmorEquipped(false);
    }
  }, [armorDrawerOpen, character?.armor]);

  // Populate helmet form when drawer opens
  useEffect(() => {
    if (helmetDrawerOpen && character?.helmet) {
      setHelmetName(character.helmet.name);
      setHelmetRating(character.helmet.rating);
      setHelmetWeight(character.helmet.weight ?? 0);
      setHelmetEquipped(character.helmet.equipped);
    } else if (helmetDrawerOpen && !character?.helmet) {
      setHelmetName('');
      setHelmetRating(0);
      setHelmetWeight(0);
      setHelmetEquipped(false);
    }
  }, [helmetDrawerOpen, character?.helmet]);

  useEffect(() => {
    if (!isLoading && !character) {
      navigate('/library');
    }
  }, [isLoading, character, navigate]);

  if (isLoading) return <div style={{ padding: 'var(--space-md)', color: 'var(--color-text)' }}>Loading...</div>;
  if (!character) return null;

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
    const isNew = existing < 0;
    const inventory = existing >= 0
      ? character.inventory.map(i => i.id === item.id ? item : i)
      : [...character.inventory, item];
    updateCharacter({ inventory, updatedAt: nowISO() });
    if (isNew) {
      logToSession(`${character.name}: Acquired ${item.name}`);
    }
  }

  function handleInventoryDelete(id: string) {
    if (!character) return;
    const item = character.inventory.find(i => i.id === id);
    updateCharacter({ inventory: character.inventory.filter(i => i.id !== id), updatedAt: nowISO() });
    if (item) {
      logToSession(`${character.name}: Removed ${item.name}`);
    }
  }

  function updateCoin(coin: 'gold' | 'silver' | 'copper', value: number) {
    if (!character) return;
    const old = character.coins[coin] ?? 0;
    updateCharacter({ coins: { ...character.coins, [coin]: value }, updatedAt: nowISO() });
    const diff = value - old;
    if (diff !== 0) {
      const action = diff > 0 ? 'Gained' : 'Spent';
      logToSession(`${character.name}: ${action} ${Math.abs(diff)} ${coin}`);
    }
  }

  function addTinyItem() {
    if (!character) return;
    const trimmed = newTinyItem.trim();
    if (!trimmed) return;
    updateCharacter({ tinyItems: [...character.tinyItems, trimmed], updatedAt: nowISO() });
    setNewTinyItem('');
  }

  function removeTinyItem(index: number) {
    if (!character) return;
    updateCharacter({ tinyItems: character.tinyItems.filter((_, i) => i !== index), updatedAt: nowISO() });
  }

  function handleArmorSave() {
    if (!character) return;
    const existingId = character.armor?.id ?? generateId();
    const armor: ArmorPiece = {
      id: existingId,
      name: armorName,
      rating: armorRating,
      features: character.armor?.features ?? '',
      equipped: armorEquipped,
      weight: armorWeight,
      bodyPart: armorBodyPart,
      movementPenalty: armorMovementPenalty,
    };
    updateCharacter({ armor, updatedAt: nowISO() });
    setArmorDrawerOpen(false);
  }

  function handleHelmetSave() {
    if (!character) return;
    const existingId = character.helmet?.id ?? generateId();
    const helmet: ArmorPiece = {
      id: existingId,
      name: helmetName,
      rating: helmetRating,
      features: character.helmet?.features ?? '',
      equipped: helmetEquipped,
      weight: helmetWeight,
    };
    updateCharacter({ helmet, updatedAt: nowISO() });
    setHelmetDrawerOpen(false);
  }

  function handleAddArmor() {
    updateCharacter({ armor: { id: generateId(), name: 'New Armor', rating: 0, features: '', equipped: false, weight: 0 }, updatedAt: nowISO() });
    setArmorDrawerOpen(true);
  }

  function handleAddHelmet() {
    updateCharacter({ helmet: { id: generateId(), name: 'New Helmet', rating: 0, features: '', equipped: false, weight: 0 }, updatedAt: nowISO() });
    setHelmetDrawerOpen(true);
  }

  const totalWeight = character.inventory.reduce((sum, i) => sum + i.weight, 0)
    + (character.armor?.weight ?? 0)
    + (character.helmet?.weight ?? 0);
  const encumbranceLimit = computeEncumbranceLimit(character);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-sm)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-surface-alt)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <h1 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)', marginBottom: 'var(--space-md)' }}>Gear</h1>

      <SectionPanel title="Weapons" subtitle="p. 73-76" collapsible defaultOpen>
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

      <SectionPanel title="Armor &amp; Helmet" subtitle="p. 77" collapsible defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {character.armor ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: isEditMode ? 'pointer' : 'default',
                  textAlign: 'left',
                  color: 'var(--color-text)',
                  flex: 1,
                }}
                onClick={() => { if (isEditMode) setArmorDrawerOpen(true); }}
              >
                Armor: {character.armor.name} (rating {character.armor.rating}){character.armor.weight ? `, ${character.armor.weight} wt` : ''}
              </button>
              {armorEquipEditable && (
                <Button size="sm" variant={character.armor.equipped ? 'primary' : 'secondary'} onClick={() => {
                  if (!character?.armor) return;
                  updateCharacter({ armor: { ...character.armor, equipped: !character.armor.equipped }, updatedAt: nowISO() });
                }}>
                  {character.armor.equipped ? 'Equipped' : 'Equip'}
                </Button>
              )}
            </div>
          ) : (
            isEditMode
              ? <Button size="sm" variant="secondary" onClick={handleAddArmor}>+ Add Armor</Button>
              : <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No armor.</p>
          )}

          {character.helmet ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: isEditMode ? 'pointer' : 'default',
                  textAlign: 'left',
                  color: 'var(--color-text)',
                  flex: 1,
                }}
                onClick={() => { if (isEditMode) setHelmetDrawerOpen(true); }}
              >
                Helmet: {character.helmet.name} (rating {character.helmet.rating}){character.helmet.weight ? `, ${character.helmet.weight} wt` : ''}
              </button>
              {helmetEquipEditable && (
                <Button size="sm" variant={character.helmet.equipped ? 'primary' : 'secondary'} onClick={() => {
                  if (!character?.helmet) return;
                  updateCharacter({ helmet: { ...character.helmet, equipped: !character.helmet.equipped }, updatedAt: nowISO() });
                }}>
                  {character.helmet.equipped ? 'Equipped' : 'Equip'}
                </Button>
              )}
            </div>
          ) : (
            isEditMode
              ? <Button size="sm" variant="secondary" onClick={handleAddHelmet}>+ Add Helmet</Button>
              : <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No helmet.</p>
          )}
        </div>
      </SectionPanel>

      <SectionPanel title="Inventory" subtitle="p. 32" collapsible defaultOpen>
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

      <SectionPanel title="Tiny Items" collapsible defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {character.tinyItems.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No tiny items.</p>}
          {character.tinyItems.map((item, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-md)' }}>{item}</span>
              {isEditMode && (
                <Button size="sm" variant="secondary" onClick={() => removeTinyItem(index)}>Remove</Button>
              )}
            </div>
          ))}
          {isEditMode && (
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
              <input
                type="text"
                value={newTinyItem}
                onChange={e => setNewTinyItem(e.target.value)}
                placeholder="New tiny item..."
                style={{
                  flex: 1,
                  padding: 'var(--space-sm)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-surface-alt)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-size-md)',
                  fontFamily: 'inherit',
                }}
                onKeyDown={e => { if (e.key === 'Enter') addTinyItem(); }}
              />
              <Button size="sm" variant="secondary" onClick={addTinyItem}>Add</Button>
            </div>
          )}
        </div>
      </SectionPanel>

      <SectionPanel title="Memento" collapsible defaultOpen>
        {isEditMode ? (
          <input
            type="text"
            value={character.memento}
            onChange={e => updateCharacter({ memento: e.target.value, updatedAt: nowISO() })}
            placeholder="Your memento..."
            style={{
              width: '100%',
              padding: 'var(--space-sm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface-alt)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <span style={{ color: character.memento ? 'var(--color-text)' : 'var(--color-text-muted)', fontSize: 'var(--font-size-md)' }}>
            {character.memento || 'No memento.'}
          </span>
        )}
      </SectionPanel>

      <SectionPanel title="Encumbrance" subtitle="p. 32" collapsible defaultOpen>
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

      {/* Armor Edit Drawer */}
      <Drawer open={armorDrawerOpen} onClose={() => setArmorDrawerOpen(false)} title={character.armor ? 'Edit Armor' : 'Add Armor'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Name</label>
            <input style={inputStyle} value={armorName} onChange={e => setArmorName(e.target.value)} placeholder="Armor name" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Rating / Protection</label>
              <input type="number" style={inputStyle} value={armorRating} min={0} onChange={e => setArmorRating(Number(e.target.value))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Weight</label>
              <input type="number" style={inputStyle} value={armorWeight} min={0} onChange={e => setArmorWeight(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Body Part</label>
            <input style={inputStyle} value={armorBodyPart} onChange={e => setArmorBodyPart(e.target.value)} placeholder="e.g. Torso, Full Body" />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Movement Penalty</label>
            <input type="number" style={inputStyle} value={armorMovementPenalty} min={0} onChange={e => setArmorMovementPenalty(Number(e.target.value))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <label style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Equipped</label>
            <Button size="sm" variant={armorEquipped ? 'primary' : 'secondary'} onClick={() => setArmorEquipped(v => !v)}>
              {armorEquipped ? 'Yes' : 'No'}
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setArmorDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleArmorSave}>Save</Button>
          </div>
        </div>
      </Drawer>

      {/* Helmet Edit Drawer */}
      <Drawer open={helmetDrawerOpen} onClose={() => setHelmetDrawerOpen(false)} title={character.helmet ? 'Edit Helmet' : 'Add Helmet'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Name</label>
            <input style={inputStyle} value={helmetName} onChange={e => setHelmetName(e.target.value)} placeholder="Helmet name" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Rating / Protection</label>
              <input type="number" style={inputStyle} value={helmetRating} min={0} onChange={e => setHelmetRating(Number(e.target.value))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Weight</label>
              <input type="number" style={inputStyle} value={helmetWeight} min={0} onChange={e => setHelmetWeight(Number(e.target.value))} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <label style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Equipped</label>
            <Button size="sm" variant={helmetEquipped ? 'primary' : 'secondary'} onClick={() => setHelmetEquipped(v => !v)}>
              {helmetEquipped ? 'Yes' : 'No'}
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setHelmetDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleHelmetSave}>Save</Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
