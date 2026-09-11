import { describe, it, expect, vi, afterEach } from 'vitest';
import { getEngine, SYSTEM_ADAPTERS } from './index';
import { BUNDLED_SYSTEMS, DEFAULT_SYSTEM_ID } from '../../../systems/registry';
import type { SystemDefinition } from '../../../types/system';

/**
 * A system with no adapter must not quietly run somebody else's rules.
 *
 * @remarks
 * `getEngine` falls back to `classicFantasyEngine` for an unmapped system id.
 * The fallback itself is right — the alternative is a blank app — but it is not
 * a neutral default: it brings Dragonbane's derived-stat formulas, rest and
 * death rules, encumbrance and skill base chances with it. The only signal was
 * a `console.warn` behind `import.meta.env.DEV`, so in a production build the
 * headline "author your own system" feature failed silently, with wrong numbers
 * on the sheet and nothing anywhere to say why.
 */

/** A minimal definition for a ruleset nobody has written an adapter for. */
function authoredSystem(id: string): SystemDefinition {
  return {
    id,
    version: 1,
    displayName: 'Homebrew',
    attributes: [{ id: 'might', name: 'Might', abbreviation: 'MIG', min: 1, max: 10 }],
  } as unknown as SystemDefinition;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('adapter registry', () => {
  it('has an adapter for every bundled system', () => {
    // CLAUDE.md calls these two hand-maintained lists that must stay in
    // lockstep. Before this, a system added to the registry without an adapter
    // shipped as Dragonbane and only said so in a dev console.
    for (const system of BUNDLED_SYSTEMS) {
      expect(SYSTEM_ADAPTERS[system.id], `no adapter for bundled system "${system.id}"`).toBeDefined();
    }
  });

  it('has a bundled system for every adapter', () => {
    // The other direction, which nothing checked. An adapter left in the map
    // after its system.json is removed is dead weight that still answers "does
    // this system have an adapter?" with yes — and `getEngine` would hand a
    // stale ruleset to any character record still carrying that id, silently,
    // rather than falling back with the warning that path exists to give.
    const bundled = new Set(BUNDLED_SYSTEMS.map(s => s.id));
    const orphaned = Object.keys(SYSTEM_ADAPTERS).filter(id => !bundled.has(id));
    expect(
      orphaned,
      `${orphaned.join(', ')} has an adapter in SYSTEM_ADAPTERS but is not in ` +
      'BUNDLED_SYSTEMS. Register the system, or remove the adapter.',
    ).toEqual([]);
  });

  it('includes the default system', () => {
    expect(SYSTEM_ADAPTERS[DEFAULT_SYSTEM_ID]).toBeDefined();
  });
});

describe('getEngine fallback', () => {
  it('flags a system with no adapter, naming it', () => {
    const engine = getEngine(authoredSystem('my-homebrew'));
    expect(engine.fallbackRulesFor).toBe('my-homebrew');
  });

  it('leaves the flag unset for every system that has an adapter', () => {
    for (const system of BUNDLED_SYSTEMS) {
      expect(getEngine(system).fallbackRulesFor).toBeUndefined();
    }
  });

  it('leaves the flag unset when there is no system at all', () => {
    // No system and nothing else said means "still loading" or "legacy record",
    // not "unsupported ruleset" — a notice here would show on every cold start.
    expect(getEngine(null).fallbackRulesFor).toBeUndefined();
    expect(getEngine(undefined).fallbackRulesFor).toBeUndefined();
  });

  it('names the system when the caller says the load FAILED', () => {
    // These two assertions used to be the whole story, and between them they
    // defended a gap: `useSystemDefinition` knew the difference between a load
    // that failed and one that had not finished, computed it as `error`, and
    // every one of its eighteen consumers dropped it. So a campaign whose
    // ruleset had gone missing was served classic-fantasy's maths in silence —
    // the exact case this flag exists to announce — and the suite agreed that
    // was correct, because `getEngine(null)` is genuinely unable to tell.
    //
    // It cannot tell, so it is told.
    expect(getEngine(null, 'vanished-ruleset').fallbackRulesFor).toBe('vanished-ruleset');
    expect(getEngine(undefined, 'vanished-ruleset').fallbackRulesFor).toBe('vanished-ruleset');
  });

  it('does not let a failed load override a system that did resolve', () => {
    // Belt and braces: if a consumer ever passes a stale error alongside a
    // freshly-resolved system, the system wins. An adapter-backed ruleset is not
    // running anyone else's rules whatever the error says.
    for (const system of BUNDLED_SYSTEMS) {
      expect(getEngine(system, 'stale-error').fallbackRulesFor).toBeUndefined();
    }
  });

  it('warns in a production build, not only in dev', () => {
    // The regression: the warning was wrapped in `import.meta.env.DEV`, so the
    // one environment where a user hits this was the one with no signal.
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    getEngine(authoredSystem('prod-only-system'));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('prod-only-system');
  });

  it('warns once per system, not once per render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const system = authoredSystem('chatty-system');
    getEngine(system);
    getEngine(system);
    getEngine({ ...system, version: 2 } as SystemDefinition);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn for a system that has an adapter', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const system of BUNDLED_SYSTEMS) getEngine(system);
    expect(warn).not.toHaveBeenCalled();
  });
});
