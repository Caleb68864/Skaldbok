import { describe, it, expect } from 'vitest';
import { sessionRefreshPatch } from './sessionRefresh';
import type { CharacterRecord } from '../../types/character';
import type { SystemDefinition } from '../../types/system';

const swade = {
  resources: [
    { id: 'wounds', name: 'Wounds', min: 0, defaultMax: 3, direction: 'accumulates' },
    { id: 'bennies', name: 'Bennies', min: 0, defaultMax: 3, direction: 'depletes', refresh: 'session' },
  ],
} as unknown as SystemDefinition;

const dragonbane = {
  resources: [{ id: 'hp', name: 'HP', min: 0, defaultMax: 10, direction: 'depletes' }],
} as unknown as SystemDefinition;

const character = (resources: Record<string, { current: number; max: number }>) =>
  ({ resources }) as unknown as CharacterRecord;

describe('sessionRefreshPatch', () => {
  it('refills a spent session resource to its max', () => {
    const patch = sessionRefreshPatch(swade, character({ bennies: { current: 1, max: 3 } }));
    expect(patch?.resources.bennies).toEqual({ current: 3, max: 3 });
  });

  it('leaves resources without a session refresh alone', () => {
    // Wounds must survive a session boundary — they are not a weekly reset.
    const patch = sessionRefreshPatch(
      swade,
      character({ bennies: { current: 0, max: 3 }, wounds: { current: 2, max: 3 } }),
    );
    expect(patch?.resources.wounds).toEqual({ current: 2, max: 3 });
  });

  it('returns null when nothing needs changing, so no write happens', () => {
    // Otherwise every character's updatedAt is bumped at every session start.
    expect(sessionRefreshPatch(swade, character({ bennies: { current: 3, max: 3 } }))).toBeNull();
  });

  it('returns null for a system with no session-refreshing resources', () => {
    expect(sessionRefreshPatch(dragonbane, character({ hp: { current: 4, max: 10 } }))).toBeNull();
  });

  it('returns null for a null system', () => {
    expect(sessionRefreshPatch(null, character({ bennies: { current: 0, max: 3 } }))).toBeNull();
  });

  it('honours the character\'s own max rather than the definition default', () => {
    // An edge or a house rule may raise the pool; refreshing to defaultMax
    // would silently cap it back down every week.
    const patch = sessionRefreshPatch(swade, character({ bennies: { current: 0, max: 5 } }));
    expect(patch?.resources.bennies).toEqual({ current: 5, max: 5 });
  });

  it('empties rather than fills an accumulating session resource', () => {
    const system = {
      resources: [{ id: 'heat', name: 'Heat', min: 0, defaultMax: 6, direction: 'accumulates', refresh: 'session' }],
    } as unknown as SystemDefinition;
    const patch = sessionRefreshPatch(system, character({ heat: { current: 4, max: 6 } }));
    expect(patch?.resources.heat).toEqual({ current: 0, max: 6 });
  });

  it('skips a resource the character record does not have', () => {
    // Older or imported data: fabricating a maxless resource would put a broken
    // entry on the sheet.
    expect(sessionRefreshPatch(swade, character({ wounds: { current: 0, max: 3 } }))).toBeNull();
  });

  it('does not mutate the character it was given', () => {
    const c = character({ bennies: { current: 1, max: 3 } });
    sessionRefreshPatch(swade, c);
    expect(c.resources.bennies.current).toBe(1);
  });
});
