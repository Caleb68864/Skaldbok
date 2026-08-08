import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every capability a system definition can declare must have a reader.
 *
 * @remarks
 * This sweep found the same bug five separate times, in five unrelated places:
 *
 * | Declared | Read by | Effect |
 * |---|---|---|
 * | `derived:` / `armor:` / `res:` modifier targets | nothing | modifiers inert |
 * | `hiddenBuiltIns.armor: ['weight']` | nothing | hiding it did nothing |
 * | `damageTrack.penaltyPerLevel` | nothing | stated a rule it did not apply |
 * | `scale.allowsPlus` | nothing | d12+1 unrepresentable |
 * | `resource.refresh: 'session'` | nothing | Bennies never refreshed |
 *
 * Every one passed `tsc`, passed every test, and looked like working
 * configuration. The shared failure is that declaring something and consuming it
 * are separate edits, and only the first is enforced.
 *
 * So: a field declared on the system-definition or engine contract must be
 * referenced somewhere outside the type files and the adapters that populate it.
 * A field with no reader is either a bug or a promise — and if it is a promise,
 * it belongs in {@link KNOWN_UNIMPLEMENTED} where it is written down rather than
 * merely absent.
 */

/** Files whose interfaces define the contract. */
const DECLARATION_FILES = [
  'src/types/system.ts',
  'src/features/systems/engine/types.ts',
];

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** Property names declared in an interface in the given source. */
function declaredProperties(source: string): string[] {
  return [...source.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\??\s*:/gm)].map(m => m[1]);
}

/**
 * The corpus searched for reads: all of `src` except tests.
 *
 * @remarks
 * Nothing else is excluded, deliberately — an earlier version filtered out the
 * declaration files and the engine adapters by path, and the Windows path
 * handling was subtle enough that it silently dropped files and produced eight
 * false positives. It does not need to exclude them: a *declaration* reads
 * `field: Type` and a *population* reads `field: value`, neither of which
 * matches the `.field` / `['field']` patterns below. Only a genuine read does.
 * A guard whose own correctness is hard to check is a guard that gets disabled.
 */
function stripComments(source: string): string {
  // Line-based: a doc comment mentioning `engine.advancement.sessionEvents[].id`
  // is prose, not a read, and counting it made the allowlist self-check report a
  // reader that does not exist.
  return source
    .split(String.fromCharCode(10))
    .filter(line => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join(String.fromCharCode(10));
}

const consumerSource = walk('src')
  .filter(f => !/\.test\.tsx?$/.test(f))
  .map(f => stripComments(readFileSync(f, 'utf8')))
  .join(String.fromCharCode(10));

/**
 * Declared-and-unread on purpose, with the reason. Anything here is a promise
 * the codebase is knowingly not keeping; anything NOT here and unread is a bug.
 */
const KNOWN_UNIMPLEMENTED: Record<string, string> = {
  sessionEvents: 'engine.advancement is designed but unbuilt - decisions.md 2026-08-08 pass 13',
  usesMarks: 'part of the unbuilt advancement model',
  maxSkillValue: 'part of the unbuilt advancement model',
  advancementMax: 'part of the unbuilt advancement model',
  rollPrompt: 'part of the unbuilt advancement model',
  advancement: 'the advancement checklist is designed but unbuilt',
  advancementChecks: 'written by nothing until advancement is built',
  penaltyPerLevel: 'the number is single-sourced in savageWorldsEngine (pass 11); the FIELD still has no reader',
  defaultValue: 'read only through engine.skill.computeValue, never as a field',
  roleFallback: 'no surface shows a profession fallback yet; the library card now uses identityFields instead',
  sectionLayouts: 'sheet layout comes from sheet.json; this predates it',
  themesSupported: 'theming is app-level, not per-system',
};

/**
 * Names too generic to attribute to one contract - matching them anywhere in
 * `src` proves nothing. Excluded rather than allowlisted so this stays a signal.
 */
const TOO_GENERIC = new Set([
  'id', 'name', 'label', 'value', 'type', 'min', 'max', 'key', 'mode', 'kind',
  'text', 'order', 'group', 'step', 'levels', 'apply', 'read', 'write', 'die',
  'fields', 'tone', 'range', 'display', 'character', 'resources', 'skills',
  'conditions', 'attributes', 'status', 'messages', 'prompt', 'chance',
  'abbr', 'abbrev', 'description', 'version', 'columns', 'cells', 'regions',
  'layout', 'card', 'when', 'note', 'rows', 'title', 'effect', 'recovery',
  'duration', 'summary', 'cost', 'ladder', 'scale', 'noop', 'tracks', 'panels',
  'terms', 'labels', 'currency', 'magic', 'rest', 'death', 'probability',
  'skill', 'armor', 'weapon', 'direction', 'surfaces', 'denominations',
]);

const declared = [
  ...new Set(DECLARATION_FILES.flatMap(f => declaredProperties(readFileSync(f, 'utf8')))),
].filter(name => !TOO_GENERIC.has(name));

describe('declared capabilities have readers', () => {
  it('found a meaningful number of declared fields to check', () => {
    // A broken regex silently checking nothing is this test's failure mode.
    expect(declared.length).toBeGreaterThan(20);
  });

  it.each(declared)('%s is read somewhere', name => {
    // A genuine read looks like `.name` or `['name']` or destructuring.
    const read =
      new RegExp(`\\.${name}\\b`).test(consumerSource) ||
      new RegExp(`\\['${name}'\\]`).test(consumerSource) ||
      new RegExp(`\\b${name}\\s*[,}]`).test(consumerSource);

    if (!read && KNOWN_UNIMPLEMENTED[name]) {
      // Documented promise, not a bug. Still surfaced, so the list stays honest.
      return;
    }

    expect(
      read,
      `"${name}" is declared on the system/engine contract and read by nothing. ` +
        `Either wire a consumer, or add it to KNOWN_UNIMPLEMENTED with the reason. ` +
        `Five bugs in this codebase have had exactly this shape — a field that ` +
        `type-checks, validates, and does nothing.`,
    ).toBe(true);
  });

  it('every KNOWN_UNIMPLEMENTED entry is still genuinely unread', () => {
    // Stops the allowlist rotting into a list of things that were fixed years
    // ago, which is how an exemption list stops meaning anything.
    for (const [name, reason] of Object.entries(KNOWN_UNIMPLEMENTED)) {
      const read =
        new RegExp(`\\.${name}\\b`).test(consumerSource) ||
        new RegExp(`\\['${name}'\\]`).test(consumerSource);
      expect(
        read,
        `"${name}" is listed as unimplemented ("${reason}") but now HAS a reader — ` +
          `remove it from KNOWN_UNIMPLEMENTED`,
      ).toBe(false);
    }
  });
});
