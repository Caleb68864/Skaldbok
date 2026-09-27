// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GearRestrictionSelect } from './GearRestrictionSelect';
import { travellerEngine } from '../../features/systems/engine/travellerEngine';

describe('gear restriction classification', () => {
  afterEach(cleanup);

  it('suggests a class from the item name and lets the player override it', () => {
    const onChange = vi.fn();
    render(<GearRestrictionSelect name="Laser pistol" kind="weapon" onChange={onChange} restrictions={travellerEngine.gearRestrictions} />);
    const select = screen.getByRole('combobox', { name: 'Restriction class' });
    expect(screen.getByRole('option', { name: 'Auto — Laser or energy weapon' })).toBeTruthy();
    fireEvent.change(select, { target: { value: 'stunner' } });
    expect(onChange).toHaveBeenCalledWith('stunner');
  });
});
