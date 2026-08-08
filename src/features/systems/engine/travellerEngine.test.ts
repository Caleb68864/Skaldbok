import { describe, it, expect } from 'vitest';
import {
  effectiveCharacteristic,
  travellerEngine,
  computeTravellerDerivedValues,
  TRAVELLER_DEFAULT_TARGET,
} from './travellerEngine';
import type { CharacterRecord, TempModifier } from '../../../types/character';
import { attrKey, resKey } from '../../../utils/statKeys';

/** A one-effect temp modifier targeting `stat`. */
function modifier(stat: TempModifier['effects'][number]['stat'], delta: number): TempModifier {
  return {
    id: `mod-${stat}-${delta}`,
    label: 'Test buff',
    effects: [{ stat, delta }],
    duration: 'scene',
    createdAt: '2026-07-28T00:00:00.000Z',
  };
}

/** A minimal Traveller character: all characteristics 7, an empty damage track. */
function character(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    attributes: { str: 7, dex: 7, end: 7, int: 7, edu: 7, soc: 7 },
    resources: {
      str: { current: 0, max: 7 },
      dex: { current: 0, max: 7 },
      end: { current: 0, max: 7 },
    },
    ...overrides,
  } as CharacterRecord;
}

describe('effectiveCharacteristic', () => {
  it('returns the raw score when undamaged', () => {
    expect(effectiveCharacteristic(character(), 'end')).toBe(7);
  });

  it('subtracts damage taken to that characteristic', () => {
    const wounded = character({
      resources: { str: { current: 0, max: 7 }, dex: { current: 0, max: 7 }, end: { current: 5, max: 7 } },
    });
    expect(effectiveCharacteristic(wounded, 'end')).toBe(2);
  });

  it('does not let damage push a characteristic below zero', () => {
    const downed = character({
      resources: { end: { current: 99, max: 7 } } as CharacterRecord['resources'],
    });
    expect(effectiveCharacteristic(downed, 'end')).toBe(0);
  });

  it('applies a res: temp modifier to the damage track', () => {
    // Traveller's modifiableStats offers the damage tracks as targets; nothing
    // read them, so every one was inert.
    const c = character({ tempModifiers: [modifier(resKey('end'), 3)] } as Partial<CharacterRecord>);
    expect(effectiveCharacteristic(c, 'end')).toBe(4);
  });

  it('does not let a negative damage modifier inflate a characteristic', () => {
    // Damage floors at 0: a -5 on an undamaged track must not read as END 12.
    const c = character({ tempModifiers: [modifier(resKey('end'), -5)] } as Partial<CharacterRecord>);
    expect(effectiveCharacteristic(c, 'end')).toBe(7);
  });

  it('keeps attr: and res: modifiers on the same id distinct', () => {
    // attr:end raises the score, res:end is damage against it. Both apply, and
    // neither is mistaken for the other.
    const c = character({
      tempModifiers: [modifier(attrKey('end'), 2), modifier(resKey('end'), 1)],
    } as Partial<CharacterRecord>);
    expect(effectiveCharacteristic(c, 'end')).toBe(8);
  });

  it('leaves characteristics without a damage track untouched', () => {
    // INT/EDU/SOC have no matching resource; a same-named resource must not leak in.
    expect(effectiveCharacteristic(character(), 'int')).toBe(7);
  });

  it('reads the characteristic, not the same-named resource', () => {
    // attr:str and res:str collide by id — the score must win here.
    const c = character({
      attributes: { str: 12, dex: 7, end: 7, int: 7, edu: 7, soc: 7 },
      resources: { str: { current: 2, max: 12 } } as CharacterRecord['resources'],
    });
    expect(effectiveCharacteristic(c, 'str')).toBe(10);
  });

  it('folds in an active temp modifier on the characteristic', () => {
    const buffed = character({ tempModifiers: [modifier('attr:dex', 2)] });
    expect(effectiveCharacteristic(buffed, 'dex')).toBe(9);
  });

  it('composes a modifier with damage', () => {
    // Battle Dress +1 STR while carrying 3 points of Strength damage.
    const c = character({
      resources: { str: { current: 3, max: 7 } } as CharacterRecord['resources'],
      tempModifiers: [modifier('attr:str', 1)],
    });
    expect(effectiveCharacteristic(c, 'str')).toBe(5);
  });

  it('treats a modifier on the same-named resource as damage, not as the score', () => {
    // res:dex is the damage track, attr:dex is the characteristic — still
    // distinct targets, which is what the namespace exists for. But distinct
    // does not mean inert: this previously asserted DEX stayed 7, pinning the
    // bug that every `res:` modifier did nothing. A "Radiation: +2 END damage"
    // buff has to reach the DM or the target is decorative.
    const c = character({ tempModifiers: [modifier('res:dex', 2)] });
    expect(effectiveCharacteristic(c, 'dex')).toBe(5);
    // The score itself is untouched — only the damage moved.
    expect(c.attributes['dex']).toBe(7);
  });

  it('ignores an unnamespaced legacy key so it cannot hit twice', () => {
    // resolveLegacy would resolve a bare 'dex' to the characteristic, but the
    // migration namespaces stored keys on read, so nothing should still be bare.
    const c = character({ tempModifiers: [modifier('dex' as TempModifier['effects'][number]['stat'], 2)] });
    expect(effectiveCharacteristic(c, 'dex')).toBe(7);
  });

  it('does not let a negative modifier push a characteristic below zero', () => {
    const c = character({ tempModifiers: [modifier('attr:soc', -99)] });
    expect(effectiveCharacteristic(c, 'soc')).toBe(0);
  });
});

describe('attributeBadge', () => {
  it('reports the DM of the modified characteristic, not the base', () => {
    // DEX 7 is DM +0; DEX 9 is DM +1. Before the stat-key fix the badge read +0
    // because the modifier never matched the bare key the sheet passed in.
    const buffed = character({ tempModifiers: [modifier('attr:dex', 2)] });
    expect(travellerEngine.attributeBadge!('dex', buffed)).toBe('+1');
  });

  it('still returns null for a characteristic the record does not have', () => {
    const c = character({ attributes: { str: 7 } as CharacterRecord['attributes'] });
    expect(travellerEngine.attributeBadge!('psi', c)).toBeNull();
  });
});

describe('damage feeds through to DMs', () => {
  it('drops the attribute badge as damage accumulates', () => {
    const healthy = character();
    expect(travellerEngine.attributeBadge('end', healthy)).toBe('+0');

    // END 7 - 5 damage = END 2, which is DM -2.
    const wounded = character({
      resources: { str: { current: 0, max: 7 }, dex: { current: 0, max: 7 }, end: { current: 5, max: 7 } },
    });
    expect(travellerEngine.attributeBadge('end', wounded)).toBe('-2');
  });

  it('drops the derived characteristic DM as damage accumulates', () => {
    const wounded = character({
      resources: { str: { current: 5, max: 7 }, dex: { current: 0, max: 7 }, end: { current: 0, max: 7 } },
    });
    const derived = computeTravellerDerivedValues(wounded);
    expect(derived.characteristicDMs['str']).toBe(-2);
    expect(derived.characteristicDMs['dex']).toBe(0);
  });

  it('publishes the score each DM was computed from, after damage', () => {
    const wounded = character({
      resources: { str: { current: 5, max: 7 }, dex: { current: 0, max: 7 }, end: { current: 0, max: 7 } },
    });
    const derived = computeTravellerDerivedValues(wounded);
    // STR 7 - 5 damage = 2, and 2 is DM -2. The pair must agree.
    expect(derived.characteristicScores['str']).toBe(2);
    expect(derived.characteristicScores['dex']).toBe(7);
  });

  it('lowers a skill check chance when the linked characteristic is damaged', () => {
    const healthy = character();
    const wounded = character({
      resources: { str: { current: 0, max: 7 }, dex: { current: 5, max: 7 }, end: { current: 0, max: 7 } },
    });
    const display = travellerEngine.skill.display;
    const healthyText = display(1, { character: healthy, linkedAttributeId: 'dex' });
    const woundedText = display(1, { character: wounded, linkedAttributeId: 'dex' });

    expect(healthyText).not.toContain('DM -2');
    expect(woundedText).toContain('DM -2');

    const pct = (s: string) => Number(/(\d+)%/.exec(s)?.[1]);
    expect(pct(woundedText)).toBeLessThan(pct(healthyText));
  });

  it('applies the -3 unskilled DM when the skill is untrained', () => {
    const c = character();
    const display = travellerEngine.skill.display;
    const pct = (s: string) => Number(/(\d+)%/.exec(s)?.[1]);
    // Same skill (level 0, DEX-linked): trained shows the level-0 baseline,
    // untrained folds in -3 and reads "Unskilled" with lower odds.
    const trainedText = display(0, { character: c, linkedAttributeId: 'dex', trained: true });
    const untrainedText = display(0, { character: c, linkedAttributeId: 'dex', trained: false });
    expect(trainedText).toContain('Level 0');
    expect(untrainedText).toContain('Unskilled');
    expect(untrainedText).toContain('-3');
    expect(pct(untrainedText)).toBeLessThan(pct(trainedText));
  });

  it('treats an undefined trained flag as trained (no unskilled penalty)', () => {
    const c = character();
    const display = travellerEngine.skill.display;
    expect(display(0, { character: c, linkedAttributeId: 'dex' })).toContain('Level 0');
  });

  it('reduces the unskilled penalty by the character\'s Jack of All Trades level', () => {
    const c = character({ skills: { jackOfAllTrades: { value: 2, trained: true } } } as Partial<CharacterRecord>);
    const display = travellerEngine.skill.display;
    const text = display(0, { character: c, linkedAttributeId: 'dex', trained: false });
    // JoT 2 turns the -3 into -1; the label must say the penalty actually applied.
    expect(text).toContain('Unskilled');
    expect(text).toContain('-1 unskilled');
    expect(text).not.toContain('-3');
  });

  it('cancels the unskilled penalty entirely at Jack of All Trades 3+', () => {
    const c = character({ skills: { jackOfAllTrades: { value: 4, trained: true } } } as Partial<CharacterRecord>);
    const display = travellerEngine.skill.display;
    const untrained = display(0, { character: c, linkedAttributeId: 'dex', trained: false });
    const trained = display(0, { character: c, linkedAttributeId: 'dex', trained: true });
    const pct = (s: string) => Number(/(\d+)%/.exec(s)?.[1]);
    // The penalty floors at 0 — JoT 4 must not become a *bonus* on unskilled rolls.
    expect(untrained).toContain('no unskilled penalty');
    expect(pct(untrained)).toBe(pct(trained));
  });

  it('leaves the penalty at -3 for a level-0 Jack of All Trades', () => {
    // Having the skill at 0 is not the same as having levels in it; the
    // reduction is by level, so a 0 reduces nothing.
    const c = character({ skills: { jackOfAllTrades: { value: 0, trained: true } } } as Partial<CharacterRecord>);
    const text = travellerEngine.skill.display(0, { character: c, linkedAttributeId: 'dex', trained: false });
    expect(text).toContain('-3 unskilled');
  });

  it('reports the same reduced penalty through probability.chance as through display', () => {
    // The two surfaces disagreed once before; JoT must not reintroduce the split.
    const c = character({ skills: { jackOfAllTrades: { value: 2, trained: true } } } as Partial<CharacterRecord>);
    const context = { character: c, linkedAttributeId: 'dex', trained: false };
    const fromChance = Math.round(travellerEngine.probability.chance(0, 'none', context) * 100);
    const fromDisplay = Number(/(\d+)%/.exec(travellerEngine.skill.display(0, context))?.[1]);
    expect(fromDisplay).toBe(fromChance);
  });

  it('does not apply the unskilled penalty to Jack of All Trades itself', () => {
    // JoT reduces the penalty on *other* skills; rolling it untrained is still -3.
    const c = character({ skills: { jackOfAllTrades: { value: 2, trained: true } } } as Partial<CharacterRecord>);
    const text = travellerEngine.skill.display(0, {
      character: c,
      linkedAttributeId: 'dex',
      trained: false,
      skillId: 'jackOfAllTrades',
    });
    expect(text).toContain('-3 unskilled');
  });

  it('states the target the odds assume', () => {
    // The app shows eight difficulty targets in its own Quick Reference while
    // the odds are always computed against Average (8+). Unlabelled, an 83%
    // reads as "83% at whatever the GM just called".
    const c = character();
    const text = travellerEngine.skill.display(2, { character: c, linkedAttributeId: 'dex' });
    expect(text).toContain(`vs ${TRAVELLER_DEFAULT_TARGET}+`);
  });
});

describe('carry limit', () => {
  it('is STR + END', () => {
    expect(computeTravellerDerivedValues(character()).encumbranceLimit).toBe(14);
  });

  it('uses base characteristics, so damage does not change carry capacity mid-fight', () => {
    const wounded = character({
      resources: { str: { current: 5, max: 7 }, dex: { current: 0, max: 7 }, end: { current: 3, max: 7 } },
    });
    expect(computeTravellerDerivedValues(wounded).encumbranceLimit).toBe(14);
  });

  it('is surfaced on the dashboard and print, not the sheet panel', () => {
    const field = travellerEngine.derivedFields.find(f => f.key === 'encumbranceLimit');
    expect(field?.surfaces).toEqual(['dashboard', 'print']);
    expect(field?.overridable).toBe(true);
  });
});

describe('creation skill budget', () => {
  it('caps total skill levels at 3 x (INT + EDU)', () => {
    // INT 7 + EDU 7 = 14, x3 = 42.
    expect(computeTravellerDerivedValues(character()).creationSkillCap).toBe(42);
  });

  it('sums every skill level held', () => {
    const c = character({ skills: { gunner: { value: 2, trained: true }, medic: { value: 3, trained: true } } } as Partial<CharacterRecord>);
    expect(computeTravellerDerivedValues(c).skillLevelTotal).toBe(5);
  });

  it('counts a trained level-0 speciality as free', () => {
    // Which is exactly why Traveller grants them a whole group at a time.
    const c = character({ skills: { gunner: { value: 0, trained: true }, gunnerCapital: { value: 0, trained: true } } } as Partial<CharacterRecord>);
    expect(computeTravellerDerivedValues(c).skillLevelTotal).toBe(0);
  });

  it('reads base characteristics, so a temp buff cannot inflate the cap', () => {
    // The cap is a fact about how the character was built. A drug that raises
    // INT for a scene must not appear to grant retroactive creation budget.
    const buffed = character({ tempModifiers: [modifier(attrKey('int'), 4)] } as Partial<CharacterRecord>);
    expect(computeTravellerDerivedValues(buffed).creationSkillCap).toBe(42);
    // ...while the DM that same buff feeds does move, proving the buff is live.
    expect(computeTravellerDerivedValues(buffed).characteristicDMs['int']).toBe(1);
  });

  it('is print-only — a creation check does not belong on every screen', () => {
    for (const key of ['skillLevelTotal', 'creationSkillCap']) {
      expect(travellerEngine.derivedFields.find(f => f.key === key)?.surfaces).toEqual(['print']);
    }
  });

  it('is not user-overridable', () => {
    // It is arithmetic over the character's own data; an override would only
    // ever be a way to hide going over.
    for (const key of ['skillLevelTotal', 'creationSkillCap']) {
      expect(travellerEngine.derivedFields.find(f => f.key === key)?.overridable).toBeFalsy();
    }
  });

  it('handles a character with no skills at all', () => {
    const bare = character({ skills: {} } as Partial<CharacterRecord>);
    expect(computeTravellerDerivedValues(bare).skillLevelTotal).toBe(0);
  });
});

describe('currency', () => {
  it('steps credits in hundreds, not single units', () => {
    // Traveller prices run to thousands; a step of 1 makes purchases unusable.
    expect(travellerEngine.currency.denominations[0].step).toBe(100);
  });
});
