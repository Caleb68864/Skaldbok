import { useState, useEffect } from 'react';
import * as systemRepository from '../../storage/repositories/systemRepository';
import { BUNDLED_SYSTEMS } from '../../systems/registry';
import type { SystemDefinition } from '../../types/system';

/** The bundled definition for an id, if this build ships one. */
function bundledSystem(systemId: string): SystemDefinition | undefined {
  return BUNDLED_SYSTEMS.find(s => s.id === systemId);
}

/**
 * Loads a {@link SystemDefinition}, preferring the stored copy but refreshing it
 * when this build ships a newer one.
 *
 * @remarks
 * System definitions are cached in IndexedDB so user-authored systems persist.
 * That previously meant an edit to a bundled `system.json` could never reach an
 * existing user — the stale stored copy won every time. Comparing `version`
 * lets a release ship new system data (skills, labels, identity fields) and
 * have it actually apply. **Bump the definition's `version` whenever you edit a
 * bundled `system.json`.**
 *
 * Systems this build does not bundle (user-authored) are always served from
 * storage untouched.
 *
 * ### `error` has a reader; `isLoading` had none and is gone
 *
 * Both were computed here and dropped at **all eighteen** call sites — every
 * one destructured `{ system }` and nothing else. Wire it or remove it, and the
 * two members got opposite answers.
 *
 * `error` is wired, through {@link features/systems/engine!getEngine}'s
 * `unresolvedSystemId`. It is the only thing that separates "this ruleset
 * failed to load" from "this ruleset has not finished loading" — both of which
 * reach a consumer as `system === null` — so without it the app served
 * classic-fantasy's derived stats, rest, death and encumbrance rules for a
 * ruleset that had simply gone missing, with nothing on screen to say so. That
 * is precisely what `fallbackRulesFor` and `CharacterSubNav`'s notice exist to
 * prevent, and they could not fire, because `getEngine` could not tell the two
 * cases apart from `null` alone.
 *
 * `isLoading` is removed. No consumer ever showed a spinner; readiness is
 * already expressed by `system === null`, which every consumer handles because
 * it is the initial state. A returned member nothing reads is the shape this
 * file's neighbours exist to catch, and adding it back is three lines on the
 * day something wants to distinguish the two nulls in a *third* way.
 */
export function useSystemDefinition(systemId: string) {
  const [system, setSystem] = useState<SystemDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // Reset before fetching. Without this, switching campaigns leaves the
    // *previous* system in state, so consumers spend a render or more resolving
    // the wrong ruleset — a Traveller ledger formatting money as Dragonbane
    // coins, for instance. A stale `error` was worse: it never cleared, so one
    // unknown system poisoned the hook for every campaign opened afterwards.
    // That matters more now than it did, because `error` reaches a screen.
    //
    // Resetting to null is safe by construction: null is the initial state, so
    // every consumer already handles it.
    setSystem(null);
    setError(null);
    systemRepository.getById(systemId).then(async stored => {
      if (!mounted) return;
      const bundled = bundledSystem(systemId);

      if (bundled && (!stored || (stored.version ?? 0) < bundled.version)) {
        await systemRepository.save(bundled);
        if (!mounted) return;
        setSystem(bundled);
      } else if (stored) {
        setSystem(stored);
      } else {
        setError(`Unknown system: ${systemId}`);
      }
    }).catch(err => {
      if (mounted) {
        setError(String(err));
      }
    });
    return () => { mounted = false; };
  }, [systemId]);

  return { system, error };
}
