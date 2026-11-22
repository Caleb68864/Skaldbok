/**
 * The system used when none is specified (legacy characters, a bundle or a
 * campaign row with no system id).
 *
 * @remarks
 * Its own module, with no imports, so the type and bundle layers can read it
 * without pulling in `registry.ts` and every bundled `system.json` with it.
 * `registry.ts` re-exports it. `defaultSystemId.test.ts` fails on a
 * `'classic-fantasy'` string literal anywhere else in `src` that is not on its
 * written allowlist, so a fallback cannot quietly name the id again.
 */
export const DEFAULT_SYSTEM_ID = 'classic-fantasy';
