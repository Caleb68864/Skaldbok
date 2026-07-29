import { describe, it, expect } from 'vitest';
import { applyDamage, damageStatus, statusConditions } from './damageTrack';
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
    // 'soc' is a characteristic but not part of the damage track, so the choice
    // is discarded. The damage is NOT discarded with it — it follows the model's
    // own overflow order (STR first). This assertion previously expected the
    // remaining 2 points to vanish, which encoded the stranding bug.
    const r = applyDamage(character(), model, 9, 'soc');
    expect(r.dealt).toEqual({ end: 7, str: 2 });
    expect(r.unassigned).toBe(0);
  });

  it('reports damage that has nowhere left to go', () => {
    // Every track full, so there is genuinely nowhere for it to go.
    const r = applyDamage(character({ end: 7, str: 7, dex: 7 }), model, 10, 'str');
    expect(r.unassigned).toBe(10);
    expect(r.dealt).toEqual({});
  });

  it('continues past the chosen overflow into the remaining tracks', () => {
    // The finding: STR/DEX/END all 7 and one hit of 20 used to fill END and STR,
    // silently strand 6, leave DEX untouched and report 'down'. deadAtDepleted
    // is 3, so death was unreachable in a single application.
    const r = applyDamage(character(), model, 20, 'str');
    expect(r.dealt).toEqual({ end: 7, str: 7, dex: 6 });
    expect(r.unassigned).toBe(0);
    expect(r.depleted).toEqual(expect.arrayContaining(['end', 'str']));
  });

  it('kills outright when one hit depletes every track', () => {
    const r = applyDamage(character(), model, 21, 'str');
    expect(r.unassigned).toBe(0);
    expect(r.depleted.sort()).toEqual(['dex', 'end', 'str']);
    expect(r.status).toBe('dead');
  });

  it('keeps the player choice first when continuing', () => {
    // DEX chosen, so DEX takes the first overflow and STR only the leftovers.
    const r = applyDamage(character(), model, 20, 'dex');
    expect(r.dealt).toEqual({ end: 7, dex: 7, str: 6 });
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
    // DEX fills too. The old assertion here was that DEX stayed untouched
    // because "only one overflow target is chosen per hit" — that premise was
    // the bug, not the rule.
    expect(r.resources['dex']).toBe(7);
    expect(r.unassigned).toBe(100 - 21);
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

describe('statusConditions', () => {
  it('sets the down condition when the character is down', () => {
    expect(statusConditions(model, 'down')).toEqual({ unconscious: true });
  });

  it('sets it when dead too — dead implies down', () => {
    expect(statusConditions(model, 'dead')).toEqual({ unconscious: true });
  });

  // Without this, Recover All cleared every track but left the character
  // flagged unconscious, and the print sheet kept reporting them out.
  it('clears the condition when the status returns to ok', () => {
    expect(statusConditions(model, 'ok')).toEqual({ unconscious: false });
  });

  it('never mentions a condition the model does not claim', () => {
    // 'fatigued' and 'wounded' are the player's to tick, so they must not
    // appear in the update at all — not even as false.
    const keys = Object.keys(statusConditions(model, 'down'));
    expect(keys).not.toContain('fatigued');
    expect(keys).not.toContain('wounded');
  });

  it('is empty for a system that declares no mapping', () => {
    const noMapping = { ...model, statusConditions: undefined };
    expect(statusConditions(noMapping, 'dead')).toEqual({});
  });
});
