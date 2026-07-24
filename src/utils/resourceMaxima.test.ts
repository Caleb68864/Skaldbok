import { describe, it, expect } from 'vitest';
import { syncDerivedResourceMaxima } from './resourceMaxima';
import { travellerSystem } from '../systems/traveller';
import type { CharacterRecord } from '../types/character';

function character(attrs: Record<string, number>, resources: CharacterRecord['resources']): CharacterRecord {
  return { attributes: attrs, resources } as unknown as CharacterRecord;
}

const attrs = { str: 10, dex: 12, end: 8, int: 9, edu: 7, soc: 7 };

describe('syncDerivedResourceMaxima', () => {
  it('raises each damage track to its characteristic', () => {
    const next = syncDerivedResourceMaxima(
      character(attrs, {
        str: { current: 0, max: 7 },
        dex: { current: 0, max: 7 },
        end: { current: 0, max: 7 },
      }),
      travellerSystem,
    );
    expect(next).not.toBeNull();
    expect(next!['str'].max).toBe(10);
    expect(next!['dex'].max).toBe(12);
    expect(next!['end'].max).toBe(8);
  });

  it('returns null when everything already matches, so no write happens', () => {
    const next = syncDerivedResourceMaxima(
      character(attrs, {
        str: { current: 0, max: 10 },
        dex: { current: 0, max: 12 },
        end: { current: 0, max: 8 },
      }),
      travellerSystem,
    );
    expect(next).toBeNull();
  });

  it('never strands current damage above a shrunken maximum', () => {
    const next = syncDerivedResourceMaxima(
      character({ ...attrs, str: 4 }, {
        str: { current: 7, max: 10 },
        dex: { current: 0, max: 12 },
        end: { current: 0, max: 8 },
      }),
      travellerSystem,
    );
    expect(next!['str']).toEqual({ current: 4, max: 4 });
  });

  it('leaves current damage alone when the maximum grows', () => {
    const next = syncDerivedResourceMaxima(
      character(attrs, {
        str: { current: 3, max: 7 },
        dex: { current: 0, max: 12 },
        end: { current: 0, max: 8 },
      }),
      travellerSystem,
    );
    expect(next!['str']).toEqual({ current: 3, max: 10 });
  });

  it('is inert for a system with no derivedFrom resources', () => {
    const noDerived = { ...travellerSystem, resources: [{ id: 'x', name: 'X', min: 0, defaultMax: 5 }] };
    expect(syncDerivedResourceMaxima(character(attrs, { x: { current: 0, max: 5 } }), noDerived)).toBeNull();
  });

  it('ignores a resource the character does not have', () => {
    expect(syncDerivedResourceMaxima(character(attrs, {}), travellerSystem)).toBeNull();
  });
});
