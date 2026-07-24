import { describe, it, expect } from 'vitest';
import { applyDamage, damageStatus } from './damageTrack';
import { travellerEngine } from '../features/systems/engine/travellerEngine';
import type { CharacterRecord } from '../types/character';
import type { DamageTrackModel } from '../features/systems/engine/types';

const model = travellerEngine.damageTrack as DamageTrackModel;

/** Traveller character with all three physical tracks at 0/7 damage taken. */
function character(damage: { str?: number; dex?: number; end?: number } = {}): CharacterRecord {
  return {
    attributes: { str: 7, dex: 7, end: 7, int: 7, edu: 7, soc: 7 },
    resources: {
      str: { current: damage.str ?? 0, max: 7 },
      dex: { current: damage.dex ?? 0, max: 7 },
      end: { current: damage.end ?? 0, max: 7 },
    },
  } as unknown as CharacterRecord;
}

describe('applyDamage', () => {
  it('fills END before touching anything else', () => {
    const r = applyDamage(character(), model, 5, 'str');
    expect(r.dealt).toEqual({ end: 5 });
    expect(r.resources).toEqual({ end: 5 });
    expect(r.status).toBe('ok');
  });

  it('spills the remainder into the chosen characteristic', () => {
    // END 7 absorbs 7, the other 2 go to STR.
    const r = applyDamage(character(), model, 9, 'str');
    expect(r.dealt).toEqual({ end: 7, str: 2 });
    expect(r.unassigned).toBe(0);
  });

  it('honours the player choice of overflow target', () => {
    const r = applyDamage(character(), model, 9, 'dex');
    expect(r.dealt).toEqual({ end: 7, dex: 2 });
  });

  it('ignores an overflow target the system does not allow', () => {
    // 'soc' is a characteristic but not part of the damage track.
    const r = applyDamage(character(), model, 9, 'soc');
    expect(r.dealt).toEqual({ end: 7 });
    expect(r.unassigned).toBe(2);
  });

  it('reports damage that has nowhere left to go', () => {
    const r = applyDamage(character({ end: 7, str: 7 }), model, 10, 'str');
    expect(r.unassigned).toBe(10);
    expect(r.dealt).toEqual({});
  });

  it('skips a track that is already full and uses the next one', () => {
    const r = applyDamage(character({ end: 7 }), model, 3, 'dex');
    expect(r.dealt).toEqual({ dex: 3 });
  });

  it('is a no-op for zero or negative damage', () => {
    expect(applyDamage(character(), model, 0, 'str').dealt).toEqual({});
    expect(applyDamage(character(), model, -5, 'str').dealt).toEqual({});
  });

  it('applies to a chosen primary track before overflow', () => {
    // Apply straight to STR, overflow to DEX. END is untouched.
    const r = applyDamage(character(), model, 9, 'dex', 'str');
    expect(r.dealt).toEqual({ str: 7, dex: 2 });
    expect(r.resources['end']).toBeUndefined();
  });

  it('defaults the primary to the model order when none is given', () => {
    // No primaryTarget → END-first, unchanged legacy behaviour.
    const r = applyDamage(character(), model, 5);
    expect(r.dealt).toEqual({ end: 5 });
  });

  it('ignores a primary the model does not know about', () => {
    // 'soc' is not a damage track → falls back to the model order (END).
    const r = applyDamage(character(), model, 5, 'str', 'soc');
    expect(r.dealt).toEqual({ end: 5 });
  });

  it('never exceeds a track maximum', () => {
    const r = applyDamage(character(), model, 100, 'str');
    expect(r.resources['end']).toBe(7);
    expect(r.resources['str']).toBe(7);
    // dex is untouched: only one overflow target is chosen per hit.
    expect(r.resources['dex']).toBeUndefined();
    expect(r.unassigned).toBe(86);
  });
});

describe('down and dead thresholds', () => {
  it('stays up with a single depleted track', () => {
    expect(applyDamage(character(), model, 7, 'str').status).toBe('ok');
  });

  it('goes down when two tracks are depleted', () => {
    const r = applyDamage(character(), model, 14, 'str');
    expect(r.depleted.sort()).toEqual(['end', 'str']);
    expect(r.status).toBe('down');
  });

  it('is dead only when all three are depleted', () => {
    // Already at two depleted; this hit empties the third.
    const r = applyDamage(character({ end: 7, str: 7 }), model, 7, 'dex');
    expect(r.status).toBe('dead');
  });

  it('reads standing status without applying damage', () => {
    expect(damageStatus(character(), model)).toBe('ok');
    expect(damageStatus(character({ end: 7, str: 7 }), model)).toBe('down');
    expect(damageStatus(character({ end: 7, str: 7, dex: 7 }), model)).toBe('dead');
  });
});

describe('systems without a cascading track', () => {
  it('classic fantasy declares no damage track', async () => {
    const { classicFantasyEngine } = await import('../features/systems/engine/classicFantasyEngine');
    // null means "damage lands on one pool and stops" — the death-roll model
    // handles being at 0, so no cascade UI should render.
    expect(classicFantasyEngine.damageTrack).toBeNull();
  });
});
