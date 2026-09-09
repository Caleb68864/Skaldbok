import { describe, it, expect } from 'vitest';
import { modifiersEndingOn } from './modifierExpiry';
import type { CharacterRecord, TempModifier } from '../../types/character';
import type { SystemEngine } from '../systems/engine/types';
import { classicFantasyEngine } from '../systems/engine/classicFantasyEngine';
import { travellerEngine } from '../systems/engine/travellerEngine';
import { savageWorldsEngine } from '../systems/engine/savageWorldsEngine';

/**
 * Modifier expiry used to be `m.duration === rest.id`, fired only by pressing a
 * rest button. Traveller and Savage Worlds declare `rest: null`, so nothing in
 * either system could expire anything — every buff was permanent — and `scene`
 * expired nowhere in any system, because no rest is called "scene".
 */

function modifier(id: string, duration: string): TempModifier {
  return {
    id,
    label: `Buff ${id}`,
    effects: [{ stat: 'attr:str', delta: 2 }],
    duration,
    createdAt: '2026-01-01T00:00:00.000Z',
  } as unknown as TempModifier;
}

function characterWith(durations: string[]): CharacterRecord {
  return {
    id: 'c1',
    tempModifiers: durations.map((d, i) => modifier(`m${i}`, d)),
  } as unknown as CharacterRecord;
}

describe('modifiersEndingOn', () => {
  it('expires a rest-scoped modifier on that rest', () => {
    const character = characterWith(['round', 'stretch']);
    const { expiring, remaining } = modifiersEndingOn(character, classicFantasyEngine, {
      kind: 'rest',
      restId: 'round',
    });
    expect(expiring.map(m => m.duration)).toEqual(['round']);
    expect(remaining.map(m => m.duration)).toEqual(['stretch']);
  });

  it('does not expire a rest-scoped modifier on a different rest', () => {
    const character = characterWith(['shift']);
    const { expiring } = modifiersEndingOn(character, classicFantasyEngine, {
      kind: 'rest',
      restId: 'round',
    });
    expect(expiring).toEqual([]);
  });

  it('expires a scene modifier when an encounter ends', () => {
    // The regression: no rest is called "scene", so this never expired.
    const character = characterWith(['scene']);
    const { expiring } = modifiersEndingOn(character, classicFantasyEngine, { kind: 'encounterEnd' });
    expect(expiring).toHaveLength(1);
  });

  it('never expires a permanent modifier', () => {
    const character = characterWith(['permanent']);
    for (const trigger of [
      { kind: 'encounterEnd' } as const,
      { kind: 'sessionStart' } as const,
      { kind: 'rest', restId: 'shift' } as const,
    ]) {
      expect(modifiersEndingOn(character, classicFantasyEngine, trigger).expiring).toEqual([]);
    }
  });

  it('expires Traveller Watch and Day modifiers at session start', () => {
    // Traveller has rest: null, so before this nothing could expire here at all.
    const character = characterWith(['stretch', 'shift', 'permanent']);
    const { expiring } = modifiersEndingOn(character, travellerEngine, { kind: 'sessionStart' });
    expect(expiring.map(m => m.duration).sort()).toEqual(['shift', 'stretch']);
  });

  it('expires a Savage Worlds session modifier at session start, not at encounter end', () => {
    const character = characterWith(['session', 'scene']);
    expect(
      modifiersEndingOn(character, savageWorldsEngine, { kind: 'sessionStart' }).expiring.map(m => m.duration),
    ).toEqual(['session']);
    expect(
      modifiersEndingOn(character, savageWorldsEngine, { kind: 'encounterEnd' }).expiring.map(m => m.duration),
    ).toEqual(['scene']);
  });

  it('leaves a modifier whose duration names no declared unit alone', () => {
    // Data from another system, or an older version. Guessing at it would
    // silently delete something the player still wants.
    const character = characterWith(['fortnight']);
    for (const trigger of [
      { kind: 'encounterEnd' } as const,
      { kind: 'sessionStart' } as const,
      { kind: 'rest', restId: 'shift' } as const,
    ]) {
      expect(modifiersEndingOn(character, classicFantasyEngine, trigger).expiring).toEqual([]);
    }
  });

  it('handles a character with no modifiers, and no character at all', () => {
    expect(modifiersEndingOn(null, classicFantasyEngine, { kind: 'sessionStart' }).expiring).toEqual([]);
    expect(
      modifiersEndingOn({ id: 'c' } as CharacterRecord, classicFantasyEngine, { kind: 'sessionStart' })
        .remaining,
    ).toEqual([]);
  });

  it('treats a unit with no expiresOn as never expiring', () => {
    const engine = { timeUnits: [{ id: 'era', label: 'Era', abbrev: 'ERA' }] } as Pick<SystemEngine, 'timeUnits'>;
    const character = characterWith(['era']);
    expect(modifiersEndingOn(character, engine, { kind: 'sessionStart' }).expiring).toEqual([]);
  });
});
