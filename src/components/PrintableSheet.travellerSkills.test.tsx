// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PrintableSheet, { type PrintDerivedValues } from './PrintableSheet';
import { travellerEngine } from '../features/systems/engine/travellerEngine';
import { travellerSystem } from '../systems/traveller';
import { createBlankCharacter } from '../features/characters/characterMappers';
import type { CharacterRecord } from '../types/character';

afterEach(cleanup);

describe('Traveller printed skill rolls', () => {
  it('prints Recon level and the complete INT-adjusted roll modifier', () => {
    const base = createBlankCharacter('traveller') as CharacterRecord;
    const character = {
      ...base,
      attributes: { ...base.attributes, int: 9 },
      skills: { ...base.skills, recon: { value: 2, trained: true } },
    };
    const derived: PrintDerivedValues = {
      damageBonus: '', aglDamageBonus: '', movement: 0,
      encumbranceLimit: 0, hpMax: 0, wpMax: 0,
    };
    render(<PrintableSheet character={character} system={travellerSystem} derived={derived} colorMode="bw" engine={travellerEngine} />);
    const row = screen.getByText('Recon').closest('.sheet-skill-row');
    expect(row?.textContent).toContain('2 (roll +3)');
  });
});
