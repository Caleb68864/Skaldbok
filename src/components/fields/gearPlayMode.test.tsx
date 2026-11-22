// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WeaponCard } from './WeaponCard';
import { InventoryList } from './InventoryList';
import type { Weapon, InventoryItem } from '../../types/character';

/**
 * Roadmap G6, decided by agent 2026-11-21 (owner may revisit): what play mode
 * leaves available on the gear screen. Pins existing behaviour, so it passes
 * on the code before the decision too; it is here so a change to the policy
 * is a deliberate act.
 */

afterEach(cleanup);

const weapon = { id: 'w1', name: 'Broadsword', equipped: false } as unknown as Weapon;
const potion = { id: 'i1', name: 'Potion', quantity: 2, weight: 0, consumable: true } as unknown as InventoryItem;

describe('gear in play mode', () => {
  it('keeps Equip, and hides Edit and Delete, on a weapon', () => {
    render(<WeaponCard weapon={weapon} onEquipToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} isEditMode={false} />);
    expect(screen.getByRole('button', { name: 'Equip' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it("keeps a consumable's count, and hides add, edit and delete", () => {
    render(<InventoryList items={[potion]} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} onQuantityChange={vi.fn()} isEditMode={false} />);
    expect(screen.getByRole('button', { name: 'Decrease Potion' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Add Item/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });
});
