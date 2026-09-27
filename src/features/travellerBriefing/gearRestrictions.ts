import type { CharacterRecord } from '../../types/character';
import type { InventoryContainer } from '../../types/inventoryContainer';
import { GOV } from './rules';

export interface GearCategory { id: string; label: string; lawLevel?: number; contraband?: string; }
export interface GearFinding { owner: string; item: string; category: string; action: 'leave aboard' | 'ask GM'; reason: string; }

/** Stable ids are stored on items; labels and Traveller law are resolved here. */
export const TRAVELLER_GEAR_CATEGORIES: GearCategory[] = [
  { id: 'wmd', label: 'WMD', lawLevel: 1 },
  { id: 'poisonGas', label: 'Poison gas', lawLevel: 1 },
  { id: 'explosive', label: 'Explosive or grenade', lawLevel: 1 },
  { id: 'undetectableWeapon', label: 'Undetectable weapon', lawLevel: 1 },
  { id: 'energyWeapon', label: 'Laser or energy weapon', lawLevel: 2 },
  { id: 'militaryWeapon', label: 'Military weapon', lawLevel: 3 },
  { id: 'assaultWeapon', label: 'Assault weapon or SMG', lawLevel: 4 },
  { id: 'concealableWeapon', label: 'Concealable weapon', lawLevel: 5 },
  { id: 'firearm', label: 'Firearm', lawLevel: 6 },
  { id: 'shotgun', label: 'Shotgun', lawLevel: 7 },
  { id: 'stunner', label: 'Stunner', lawLevel: 8 },
  { id: 'blade', label: 'Bladed weapon', lawLevel: 8 },
  { id: 'otherWeapon', label: 'Other weapon', lawLevel: 9 },
  { id: 'battleDress', label: 'Battle dress', lawLevel: 1 },
  { id: 'combatArmour', label: 'Combat armour', lawLevel: 2 },
  { id: 'flakArmour', label: 'Flak armour', lawLevel: 3 },
  { id: 'clothArmour', label: 'Cloth armour', lawLevel: 4 },
  { id: 'meshArmour', label: 'Mesh armour', lawLevel: 5 },
  { id: 'visibleArmour', label: 'Visible armour', lawLevel: 8 },
  { id: 'otherArmour', label: 'Other armour', lawLevel: 9 },
  { id: 'drugs', label: 'Drugs', contraband: 'Drugs' },
  { id: 'technology', label: 'Restricted technology', contraband: 'Technology' },
  { id: 'computer', label: 'Computer', contraband: 'Computers' },
  { id: 'psionicGear', label: 'Psionic equipment', contraband: 'Psionics' },
];

/** Narrow, ordered matches for existing names. Unclear names remain for review. */
export function inferTravellerGearCategory(name: string, kind: 'weapon' | 'armour' | 'item' = 'item'): string | null {
  const n = name.toLowerCase();
  const match = (pattern: RegExp) => pattern.test(n);
  if (match(/\b(nuclear|atomic|warhead|wmd)\b/)) return 'wmd';
  if (match(/\b(poison gas|nerve gas|toxic gas)\b/)) return 'poisonGas';
  if (match(/\b(grenades?|explosives?|detonators?|dynamite|plastic explosives?)\b/)) return 'explosive';
  if (match(/\b(undetectable|ceramic knife|ceramic pistol)\b/)) return 'undetectableWeapon';
  if (match(/\b(laser|plasma|fusion|particle beam|energy pistol|energy rifle)\b/)) return 'energyWeapon';
  if (match(/\b(gauss rifle|machine gun|rocket launcher|military rifle)\b/)) return 'militaryWeapon';
  if (match(/\b(assault rifle|submachine gun|smg|autorifle)\b/)) return 'assaultWeapon';
  if (match(/\b(pistols?|revolvers?|holdout|concealed gun)\b/)) return 'concealableWeapon';
  if (match(/\b(shotguns?)\b/)) return 'shotgun';
  if (match(/\b(stunner|stun gun|stun baton)\b/)) return 'stunner';
  if (match(/\b(rifles?|carbines?|firearms?|muskets?|guns?)\b/)) return 'firearm';
  if (match(/\b(swords?|daggers?|knife|knives|machetes?|bayonets?|blades?|cutlass)\b/)) return 'blade';
  if (match(/\b(battle dress|battledress)\b/)) return 'battleDress';
  if (match(/\b(combat armou?r)\b/)) return 'combatArmour';
  if (match(/\b(flak (armou?r|jacket|vest))\b/)) return 'flakArmour';
  if (match(/\b(cloth armou?r)\b/)) return 'clothArmour';
  if (match(/\b(mesh armou?r)\b/)) return 'meshArmour';
  if (match(/\b(helmet|breastplate|cuirass|shield|buckler|armou?red coat)\b/)) return 'visibleArmour';
  if (match(/\b(armou?r)\b/)) return 'otherArmour';
  if (match(/\b(drugs?|narcotics?|combat drugs?|stims?|stimulants?)\b/)) return 'drugs';
  if (match(/\b(computer|data pad|datapad)\b/)) return 'computer';
  if (match(/\b(psionic|psi amplifier|psi shield)\b/)) return 'psionicGear';
  if (match(/\b(sensor|surveillance|hacking kit|communicator|commlink|earpiece|robot|drone)\b/)) return 'technology';
  return kind === 'weapon' ? 'otherWeapon' : kind === 'armour' ? 'otherArmour' : null;
}

export function reviewTravellerGear(
  characters: CharacterRecord[], containers: InventoryContainer[], law: number, government: number,
): GearFinding[] {
  const contraband = new Set<string>((GOV as Record<string, readonly [string, string, readonly string[]]>)[String(government)]?.[2] ?? []);
  const findings: GearFinding[] = [];
  const consider = (owner: string, item: string, explicit: string | undefined, kind: 'weapon' | 'armour' | 'item') => {
    const categoryId = explicit || inferTravellerGearCategory(item, kind);
    if (!categoryId) return;
    const category = TRAVELLER_GEAR_CATEGORIES.find(value => value.id === categoryId);
    if (!category) {
      findings.push({ owner, item, category: categoryId, action: 'ask GM', reason: 'Unknown classification' });
      return;
    }
    if (category.lawLevel !== undefined && law >= category.lawLevel) {
      findings.push({ owner, item, category: category.label, action: 'leave aboard', reason: `Law ${law} restricts ${category.label.toLowerCase()} (from Law ${category.lawLevel})` });
      return;
    }
    if (category.contraband && contraband.has(category.contraband)) {
      findings.push({ owner, item, category: category.label, action: 'ask GM', reason: `Government ${government} lists ${category.contraband.toLowerCase()} as typical contraband` });
      return;
    }
    if (contraband.has('Varies')) {
      findings.push({ owner, item, category: category.label, action: 'ask GM', reason: `Government ${government} has variable contraband rules` });
      return;
    }
    if (category.id === 'otherWeapon' || category.id === 'otherArmour' || (category.lawLevel !== undefined && kind === 'weapon' && contraband.has('Weapons'))) {
      findings.push({ owner, item, category: category.label, action: 'ask GM', reason: 'Check local rules and permits for this gear' });
    }
  };
  for (const character of characters) {
    for (const weapon of character.weapons ?? []) consider(character.name, weapon.name, weapon.restrictionClass, weapon.isShield ? 'armour' : 'weapon');
    if (character.armor) consider(character.name, character.armor.name, character.armor.restrictionClass, 'armour');
    if (character.helmet) consider(character.name, character.helmet.name, character.helmet.restrictionClass, 'armour');
    for (const item of character.inventory ?? []) if (item.quantity > 0) consider(character.name, item.name, item.restrictionClass, 'item');
    for (const name of character.tinyItems ?? []) consider(character.name, name, undefined, 'item');
  }
  for (const container of containers) {
    for (const item of container.items) if (item.quantity > 0) consider(container.name, item.name, item.restrictionClass, 'item');
  }
  return findings;
}
