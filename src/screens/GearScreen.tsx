import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAutosave } from '../hooks/useAutosave';
import { WeaponCard } from '../components/fields/WeaponCard';
import { CurrencyAdjuster } from '../components/fields/CurrencyAdjuster';
import { WeaponEditor } from '../components/fields/WeaponEditor';
import { InventoryList } from '../components/fields/InventoryList';
import { InventoryItemEditor } from '../components/fields/InventoryItemEditor';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { DerivedFieldDisplay } from '../components/fields/DerivedFieldDisplay';
import { Button } from '../components/primitives/Button';
import { Drawer } from '../components/primitives/Drawer';
import type { Weapon, InventoryItem, ArmorPiece } from '../types/character';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { useIsEditMode, useFieldEditable } from '../utils/modeGuards';
import { useSessionLog } from '../features/session/useSessionLog';
import { PartyInventoryTab } from '../features/party/PartyInventoryTab';
import { useSystemEngine } from '../features/systems/engine';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import * as characterRepository from '../storage/repositories/characterRepository';

const inputClasses = "w-full p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)] font-[family-name:inherit] box-border";

/**
 * Drops a trailing plural `s` so a denomination label reads naturally in a
 * one-unit aria-label ("Credits" → "Gain 1 credit"). Labels that are already
 * singular ("Gold") are returned unchanged.
 */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * One extra per-item field declared by the active system in
 * `SystemDefinition.itemFields`. Structurally identical to the entries in that
 * array, kept local so the screen does not depend on the system module.
 */
type SystemItemField = { id: string; label: string; type?: 'text' | 'number' };

/** An empty declaration and an absent one behave the same: nothing extra renders. */
const NO_ITEM_FIELDS: SystemItemField[] = [];

/** Shared empty hide-list, so an undeclared system shows every built-in. */
const NO_HIDDEN_FIELDS: string[] = [];

/**
 * Reads one value out of an item's `systemFields` bag as an input-ready string.
 * The `unknown` cast lives here so no call site has to repeat it.
 */
function readSystemField(bag: Record<string, unknown> | undefined, fieldId: string): string {
  const raw = bag?.[fieldId];
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : '';
  return '';
}

/**
 * Returns a new `systemFields` bag with one field replaced — every other key is
 * carried across untouched. A cleared input drops the key rather than storing an
 * empty string or a coerced `0`.
 */
function writeSystemField(
  bag: Record<string, unknown> | undefined,
  field: SystemItemField,
  raw: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(bag ?? {}) };
  if (raw === '') {
    delete next[field.id];
    return next;
  }
  next[field.id] = field.type === 'number' ? Number(raw) : raw;
  return next;
}

/**
 * Keeps a `systemFields` bag off the saved item entirely when it holds nothing,
 * so a system that declares no extra fields writes byte-identical records.
 */
function withSystemFields(bag: Record<string, unknown> | undefined): { systemFields?: Record<string, unknown> } {
  return bag && Object.keys(bag).length > 0 ? { systemFields: bag } : {};
}

/**
 * Renders the system-declared extra inputs for one item, using the same markup
 * as the built-in fields around them. Renders nothing when `fields` is empty.
 */
function SystemItemFieldInputs({
  fields,
  values,
  onChange,
}: {
  fields: SystemItemField[];
  values: Record<string, unknown> | undefined;
  onChange: (next: Record<string, unknown>) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <>
      {fields.map(field => (
        <div key={field.id}>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">{field.label}</label>
          <input
            type={field.type === 'number' ? 'number' : 'text'}
            className={inputClasses}
            value={readSystemField(values, field.id)}
            onChange={e => onChange(writeSystemField(values, field, e.target.value))}
          />
        </div>
      ))}
    </>
  );
}

/**
 * The Gear screen — manages all equipment for the active character.
 */
export default function GearScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const engine = useSystemEngine();
  const { system } = useSystemDefinition(character?.systemId ?? 'classic-fantasy');
  const isEditMode = useIsEditMode();
  const armorEquipEditable = useFieldEditable('armor.equipped');
  const helmetEquipEditable = useFieldEditable('helmet.equipped');
  const derivedEditable = useFieldEditable('derivedOverrides');
  const { logToSession, logCoinChange } = useSessionLog();

  const [activeTab, setActiveTab] = useState<'mine' | 'party'>('mine');
  const [weaponDrawerOpen, setWeaponDrawerOpen] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  // System-declared weapon fields are collected in their own step because the
  // built-in weapon form lives in <WeaponEditor>, which only knows the core fields.
  const [weaponSystemFields, setWeaponSystemFields] = useState<Record<string, unknown>>({});
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
  const [armorSystemFields, setArmorSystemFields] = useState<Record<string, unknown>>({});

  // Helmet drawer state
  const [helmetDrawerOpen, setHelmetDrawerOpen] = useState(false);
  const [helmetName, setHelmetName] = useState('');
  const [helmetRating, setHelmetRating] = useState(0);
  const [helmetWeight, setHelmetWeight] = useState(0);
  const [helmetEquipped, setHelmetEquipped] = useState(false);
  const [helmetSystemFields, setHelmetSystemFields] = useState<Record<string, unknown>>({});
  useAutosave(character, characterRepository.save, 1000);

  // Populate armor form when drawer opens
  useEffect(() => {
    if (armorDrawerOpen && character?.armor) {
      setArmorName(character.armor.name);
      setArmorRating(character.armor.rating);
      setArmorBodyPart(character.armor.bodyPart ?? '');
      setArmorWeight(character.armor.weight ?? 0);
      setArmorMovementPenalty(character.armor.movementPenalty ?? 0);
      setArmorEquipped(character.armor.equipped);
      setArmorSystemFields(character.armor.systemFields ?? {});
    } else if (armorDrawerOpen && !character?.armor) {
      setArmorName('');
      setArmorRating(0);
      setArmorBodyPart('');
      setArmorWeight(0);
      setArmorMovementPenalty(0);
      setArmorEquipped(false);
      setArmorSystemFields({});
    }
  }, [armorDrawerOpen, character?.armor]);

  // Populate helmet form when drawer opens
  useEffect(() => {
    if (helmetDrawerOpen && character?.helmet) {
      setHelmetName(character.helmet.name);
      setHelmetRating(character.helmet.rating);
      setHelmetWeight(character.helmet.weight ?? 0);
      setHelmetEquipped(character.helmet.equipped);
      setHelmetSystemFields(character.helmet.systemFields ?? {});
    } else if (helmetDrawerOpen && !character?.helmet) {
      setHelmetName('');
      setHelmetRating(0);
      setHelmetWeight(0);
      setHelmetEquipped(false);
      setHelmetSystemFields({});
    }
  }, [helmetDrawerOpen, character?.helmet]);

  useEffect(() => {
    if (!isLoading && !character) {
      navigate('/library');
    }
  }, [isLoading, character, navigate]);

  if (isLoading) return <div className="p-[var(--space-md)] text-[var(--color-text)]">Loading...</div>;
  if (!character) return null;

  // Extra per-item fields the active system asks for. Undefined for systems that
  // declare none, in which case every form below renders exactly its built-ins.
  const weaponItemFields = system?.itemFields?.weapon ?? NO_ITEM_FIELDS;
  const armorItemFields = system?.itemFields?.armor ?? NO_ITEM_FIELDS;
  // Built-ins a system declares it does not use. Empty means show everything,
  // so a system that declares nothing renders exactly as before.
  const hiddenWeaponBuiltIns = system?.itemFields?.hiddenBuiltIns?.weapon ?? NO_HIDDEN_FIELDS;
  const hiddenArmorBuiltIns = system?.itemFields?.hiddenBuiltIns?.armor ?? NO_HIDDEN_FIELDS;
  const showsArmorField = (id: string) => !hiddenArmorBuiltIns.includes(id);

  function handleWeaponSave(weapon: Weapon) {
    if (!character) return;
    const existing = character.weapons.findIndex(w => w.id === weapon.id);
    // The system-declared inputs live in the same drawer, so their values come
    // from local state here rather than from the editor's own form.
    const saved: Weapon = { ...weapon, ...withSystemFields(weaponSystemFields) };
    const weapons = existing >= 0
      ? character.weapons.map(w => w.id === saved.id ? saved : w)
      : [...character.weapons, saved];
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

  /**
   * Adjusts one denomination of the active system's currency by `delta`.
   *
   * @remarks
   * Denominations are ordered highest-value first. When a denomination would go
   * negative, one unit of the nearest higher denomination that still has stock
   * is broken down, converting via the denominations' `value` fields (so
   * 1 gold → 9 silver + 10 copper falls out of the data rather than a hardcoded
   * ladder). If no higher denomination can cover the shortfall, the whole
   * adjustment is refused and nothing is written.
   */
  function adjustCurrency(denominationId: string, delta: number) {
    if (!character) return;
    const denoms = engine.currency.denominations;
    const denom = denoms.find(d => d.id === denominationId);
    if (!denom) return;

    const current = engine.currency.read(character);
    const amounts: Record<string, number> = {};
    for (const d of denoms) amounts[d.id] = current[d.id] ?? 0;
    amounts[denominationId] += delta;

    for (let i = denoms.length - 1; i >= 1; i--) {
      while (amounts[denoms[i].id] < 0) {
        let donor = -1;
        for (let j = i - 1; j >= 0; j--) {
          if (amounts[denoms[j].id] > 0) { donor = j; break; }
        }
        if (donor < 0) break;
        amounts[denoms[donor].id] -= 1;
        // Intermediate denominations keep the change from breaking the donor.
        for (let k = donor + 1; k < i; k++) {
          amounts[denoms[k].id] += denoms[k - 1].value / denoms[k].value - 1;
        }
        amounts[denoms[i].id] += denoms[i - 1].value / denoms[i].value;
      }
    }

    if (denoms.some(d => amounts[d.id] < 0)) return; // not enough total currency
    updateCharacter({ ...engine.currency.write(character, amounts), updatedAt: nowISO() });
    if (delta !== 0) logCoinChange(character.name, denominationId, delta, denom.abbr);
  }

  function handleInventoryQuantity(id: string, quantity: number) {
    if (!character) return;
    const inventory = character.inventory.map(i => i.id === id ? { ...i, quantity: clamp(quantity, 0, 999) } : i);
    updateCharacter({ inventory, updatedAt: nowISO() });
  }

  function setDerivedOverride(key: string, value: number) {
    if (!character) return;
    updateCharacter({ derivedOverrides: { ...character.derivedOverrides, [key]: value }, updatedAt: nowISO() });
  }

  function resetDerivedOverride(key: string) {
    if (!character) return;
    updateCharacter({ derivedOverrides: { ...character.derivedOverrides, [key]: null }, updatedAt: nowISO() });
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
      rating: clamp(armorRating, 0, 99),
      features: character.armor?.features ?? '',
      equipped: armorEquipped,
      weight: clamp(armorWeight, 0, 999),
      bodyPart: armorBodyPart,
      movementPenalty: clamp(armorMovementPenalty, 0, 99),
      ...withSystemFields(armorItemFields.length > 0 ? armorSystemFields : character.armor?.systemFields),
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
      rating: clamp(helmetRating, 0, 99),
      features: character.helmet?.features ?? '',
      equipped: helmetEquipped,
      weight: clamp(helmetWeight, 0, 999),
      ...withSystemFields(armorItemFields.length > 0 ? helmetSystemFields : character.helmet?.systemFields),
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

  const totalWeight = character.inventory.reduce((sum, i) => sum + (i.tiny ? 0 : i.weight), 0)
    + (character.armor?.weight ?? 0)
    + (character.helmet?.weight ?? 0);
  // The carry limit is engine-computed (e.g. STR+END for Traveller, ceil(STR/2)
  // for classic-fantasy) but the user may hand-tune it through the same
  // derivedOverrides channel the sheet uses. engine.derivedStats does not fold
  // overrides in, so we apply it here on top of the computed value.
  const computedEncumbranceLimit = engine.derivedStats(character, system ?? undefined).encumbranceLimit;
  const encumbranceField = engine.derivedFields.find(f => f.key === 'encumbranceLimit');
  const encumbranceOverridable = !!encumbranceField?.overridable;
  const encumbranceOverrideRaw = character.derivedOverrides?.encumbranceLimit;
  const encumbranceOverride =
    encumbranceOverridable && typeof encumbranceOverrideRaw === 'number' ? encumbranceOverrideRaw : null;
  const encumbranceLimit = encumbranceOverride !== null ? encumbranceOverride : computedEncumbranceLimit;
  // A falsy limit means the active system does not track encumbrance — never
  // flag the character as overloaded in that case.
  const tracksEncumbrance = encumbranceLimit > 0;
  const isOverloaded = tracksEncumbrance && totalWeight > encumbranceLimit;

  const denominations = engine.currency.denominations;
  const currencyAmounts = engine.currency.read(character);
  const currencyTitle = engine.currency.mode === 'single'
    ? (denominations[0]?.label ?? 'Currency')
    : 'Coins';
  // e.g. "1 gold = 10 silver = 100 copper", derived from the denominations'
  // relative values rather than written out per system.
  const exchangeSubtitle = denominations.length > 1
    ? denominations
        .map((d, i) => `${i === 0 ? 1 : denominations[0].value / d.value} ${d.label.toLowerCase()}`)
        .join(' = ')
    : undefined;

  return (
    <div className="p-[var(--space-md)]">
      <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)] mb-[var(--space-md)]">Gear</h1>

      {/* Tab bar */}
      <div className="flex rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border)] mb-[var(--space-md)]" role="tablist" aria-label="Gear view">
        {(['mine', 'party'] as const).map(tab => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 px-4 py-2 min-h-[44px] text-sm font-semibold border-none cursor-pointer transition-colors',
              activeTab === tab
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
            )}
          >
            {tab === 'mine' ? 'My Gear' : 'Party'}
          </button>
        ))}
      </div>

      {activeTab === 'party' ? (
        <PartyInventoryTab />
      ) : (
        <>
      <SectionPanel title="Weapons" collapsible defaultOpen>
        {character.weapons.length === 0 && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No weapons.</p>}
        <div className="flex flex-col gap-[var(--space-md)]">
          {character.weapons.map(weapon => (
            <WeaponCard
              key={weapon.id}
              weapon={weapon}
              onEquipToggle={() => handleWeaponEquipToggle(weapon.id)}
              onEdit={() => { setEditingWeapon(weapon); setWeaponSystemFields(weapon.systemFields ?? {}); setWeaponDrawerOpen(true); }}
              onDelete={() => handleWeaponDelete(weapon.id)}
              isEditMode={isEditMode}
              hiddenBuiltIns={hiddenWeaponBuiltIns}
              systemFields={weaponItemFields}
            />
          ))}
        </div>
        {isEditMode && (
          <Button variant="secondary" size="sm" className="mt-[var(--space-sm)]" onClick={() => { setEditingWeapon(null); setWeaponSystemFields({}); setWeaponDrawerOpen(true); }}>
            + Add Weapon
          </Button>
        )}
      </SectionPanel>

      <SectionPanel title="Armor &amp; Helmet" collapsible defaultOpen>
        <div className="flex flex-col gap-[var(--space-md)]">
          {character.armor ? (
            <div className="flex justify-between items-center">
              <button
                className={cn(
                  "bg-transparent border-none p-0 text-left text-[var(--color-text)] flex-1",
                  isEditMode ? "cursor-pointer" : "cursor-default"
                )}
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
              : <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No armor.</p>
          )}

          {character.helmet ? (
            <div className="flex justify-between items-center">
              <button
                className={cn(
                  "bg-transparent border-none p-0 text-left text-[var(--color-text)] flex-1",
                  isEditMode ? "cursor-pointer" : "cursor-default"
                )}
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
              : <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No helmet.</p>
          )}
        </div>
      </SectionPanel>

      <SectionPanel title="Inventory" collapsible defaultOpen>
        <InventoryList
          items={character.inventory}
          onEdit={item => { setEditingItem(item); setInventoryDrawerOpen(true); }}
          onDelete={handleInventoryDelete}
          onAdd={() => { setEditingItem(null); setInventoryDrawerOpen(true); }}
          onQuantityChange={handleInventoryQuantity}
          isEditMode={isEditMode}
        />
      </SectionPanel>

      {denominations.length > 0 && (
      <SectionPanel title={currencyTitle} subtitle={exchangeSubtitle} collapsible defaultOpen>
        <CurrencyAdjuster
          denominations={denominations}
          amounts={currencyAmounts}
          onDelta={adjustCurrency}
        />
      </SectionPanel>
      )}

      {engine.labels.tinyItems && (
      <SectionPanel title={engine.labels.tinyItems} collapsible defaultOpen>
        <div className="flex flex-col gap-3">
          {character.tinyItems.length === 0 && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No tiny items.</p>}
          {character.tinyItems.map((item, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-[var(--color-text)] text-[length:var(--font-size-md)]">{item}</span>
              {isEditMode && (
                <Button size="sm" variant="secondary" onClick={() => removeTinyItem(index)}>Remove</Button>
              )}
            </div>
          ))}
          {isEditMode && (
            <div className="flex gap-3 mt-[var(--space-sm)]">
              <input
                type="text"
                value={newTinyItem}
                onChange={e => setNewTinyItem(e.target.value)}
                placeholder="New tiny item..."
                className="flex-1 p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)] font-[family-name:inherit]"
                onKeyDown={e => { if (e.key === 'Enter') addTinyItem(); }}
              />
              <Button size="sm" variant="secondary" onClick={addTinyItem}>Add</Button>
            </div>
          )}
        </div>
      </SectionPanel>
      )}

      {engine.labels.memento && (
      <SectionPanel title={engine.labels.memento.replace(/:$/, '')} collapsible defaultOpen>
        {isEditMode ? (
          <input
            type="text"
            value={character.memento}
            onChange={e => updateCharacter({ memento: e.target.value, updatedAt: nowISO() })}
            placeholder="Your memento..."
            className={inputClasses}
          />
        ) : (
          <span className={cn(
            "text-[length:var(--font-size-md)]",
            character.memento ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
          )}>
            {character.memento || 'No memento.'}
          </span>
        )}
      </SectionPanel>
      )}

      <SectionPanel title={engine.labels.encumbrance} collapsible defaultOpen>
        <p className={cn(
          "text-[length:var(--font-size-md)]",
          isOverloaded ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"
        )}>
          {tracksEncumbrance ? `${totalWeight} / ${encumbranceLimit}` : totalWeight}
          {isOverloaded ? ' (Overloaded!)' : ''}
        </p>
        {/* Carried weight is auto-summed from item weights above; the carry
            limit can be hand-tuned when a group plays encumbrance differently
            from the engine's default formula. Persisted to
            derivedOverrides.encumbranceLimit — the same channel the sheet uses. */}
        {encumbranceOverridable && (
          <DerivedFieldDisplay
            label={encumbranceField?.label ?? 'Carry Limit'}
            computedValue={computedEncumbranceLimit}
            override={encumbranceOverride}
            onOverride={v => setDerivedOverride('encumbranceLimit', v)}
            onReset={() => resetDerivedOverride('encumbranceLimit')}
            editable={derivedEditable}
          />
        )}
      </SectionPanel>

      <WeaponEditor
        open={weaponDrawerOpen}
        onClose={() => setWeaponDrawerOpen(false)}
        weapon={editingWeapon}
        onSave={handleWeaponSave}
        hiddenBuiltIns={hiddenWeaponBuiltIns}
        // System-declared fields render inside the same drawer as the built-in
        // ones, so there is a single save for the whole weapon.
        extraFields={
          <SystemItemFieldInputs
            fields={weaponItemFields}
            values={weaponSystemFields}
            onChange={setWeaponSystemFields}
          />
        }
      />

      <InventoryItemEditor
        open={inventoryDrawerOpen}
        onClose={() => setInventoryDrawerOpen(false)}
        item={editingItem}
        onSave={handleInventorySave}
      />

      {/* Armor Edit Drawer */}
      <Drawer open={armorDrawerOpen} onClose={() => setArmorDrawerOpen(false)} title={character.armor ? 'Edit Armor' : 'Add Armor'}>
        <div className="flex flex-col gap-[var(--space-md)]">
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Name</label>
            <input className={inputClasses} value={armorName} onChange={e => setArmorName(e.target.value)} placeholder="Armor name" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Rating / Protection</label>
              <input type="number" className={inputClasses} value={armorRating} min={0} onChange={e => setArmorRating(Number(e.target.value))} />
            </div>
            <div className="flex-1">
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Weight</label>
              <input type="number" className={inputClasses} value={armorWeight} min={0} onChange={e => setArmorWeight(Number(e.target.value))} />
            </div>
          </div>
          {showsArmorField('bodyPart') && (
            <div>
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Body Part</label>
              <input className={inputClasses} value={armorBodyPart} onChange={e => setArmorBodyPart(e.target.value)} placeholder="e.g. Torso, Full Body" />
            </div>
          )}
          {showsArmorField('movementPenalty') && (
            <div>
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Movement Penalty</label>
              <input type="number" className={inputClasses} value={armorMovementPenalty} min={0} onChange={e => setArmorMovementPenalty(Number(e.target.value))} />
            </div>
          )}
          <SystemItemFieldInputs fields={armorItemFields} values={armorSystemFields} onChange={setArmorSystemFields} />
          <div className="flex items-center gap-[var(--space-sm)]">
            <label className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">Equipped</label>
            <Button size="sm" variant={armorEquipped ? 'primary' : 'secondary'} onClick={() => setArmorEquipped(v => !v)}>
              {armorEquipped ? 'Yes' : 'No'}
            </Button>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setArmorDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleArmorSave}>Save</Button>
          </div>
        </div>
      </Drawer>

      {/* Helmet Edit Drawer */}
      <Drawer open={helmetDrawerOpen} onClose={() => setHelmetDrawerOpen(false)} title={character.helmet ? 'Edit Helmet' : 'Add Helmet'}>
        <div className="flex flex-col gap-[var(--space-md)]">
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Name</label>
            <input className={inputClasses} value={helmetName} onChange={e => setHelmetName(e.target.value)} placeholder="Helmet name" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Rating / Protection</label>
              <input type="number" className={inputClasses} value={helmetRating} min={0} onChange={e => setHelmetRating(Number(e.target.value))} />
            </div>
            <div className="flex-1">
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Weight</label>
              <input type="number" className={inputClasses} value={helmetWeight} min={0} onChange={e => setHelmetWeight(Number(e.target.value))} />
            </div>
          </div>
          <SystemItemFieldInputs fields={armorItemFields} values={helmetSystemFields} onChange={setHelmetSystemFields} />
          <div className="flex items-center gap-[var(--space-sm)]">
            <label className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">Equipped</label>
            <Button size="sm" variant={helmetEquipped ? 'primary' : 'secondary'} onClick={() => setHelmetEquipped(v => !v)}>
              {helmetEquipped ? 'Yes' : 'No'}
            </Button>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setHelmetDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleHelmetSave}>Save</Button>
          </div>
        </div>
      </Drawer>
        </>
      )}
    </div>
  );
}
