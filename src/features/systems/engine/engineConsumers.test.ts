import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Consumer-side guards on the System Engine's cardinal rules.
 *
 * @remarks
 * `engineContract.test.ts` asserts that an engine is internally consistent. That
 * is not the rule the project actually depends on — the rule is that *screens
 * read the engine*, and every real defect so far has been on the consumer side:
 *
 * - The temp-modifier bug: producers emitted namespaced keys (`attr:str`) and
 *   the resolver matched with exact string equality, but the only two production
 *   callers of `getEffectiveValue` passed **bare ids**. Every temp modifier in
 *   the app was inert. `statKeys.test.ts` called the resolver correctly, so the
 *   resolver was tested and the call sites were not.
 * - `AddModifierDrawer` initialised its duration to the literal `'stretch'`,
 *   a Dragonbane id absent from Savage Worlds' `timeUnits`.
 *
 * No amount of engine-internal assertion catches either. These tests read the
 * source instead, which is crude but is the only thing that fails when a screen
 * stops asking the engine. They are deliberately narrow: each encodes one
 * mistake that has actually been made and shipped.
 */

const SRC = join(process.cwd(), 'src');

/** Every `.ts`/`.tsx` file under `src/`, excluding tests. */
function sourceFiles(dir: string = SRC, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Strips comments so prose about a rule is not mistaken for a breach of it.
 *
 * @remarks
 * Not a parser, and does not need to be: it removes block comments and
 * whole-line `//` / JSDoc-continuation lines, which is where the false positives
 * came from — a docstring explaining that a map is used *rather than* a
 * `systemId === 'traveller'` branch, and the comment describing the `'stretch'`
 * default this very file forbids. Trailing comments after code on the same line
 * survive, so a breach hidden in one would be missed; that is an accepted
 * trade-off against mangling string literals containing `//`.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .join('\n');
}

const FILES = sourceFiles().map(path => ({
  path: relative(process.cwd(), path).replace(/\\/g, '/'),
  text: stripComments(readFileSync(path, 'utf8')),
}));

describe('engine consumer rules', () => {
  it('finds source files to scan', () => {
    // Guards the guards: a broken walk would make every test below vacuous.
    expect(FILES.length).toBeGreaterThan(100);
  });

  it('never calls getEffectiveValue with a bare, unnamespaced stat key', () => {
    // The exact shape of the temp-modifier bug. A literal without a `:` prefix
    // cannot match a stored namespaced key, so the modifier silently does
    // nothing. Build keys with attrKey()/resKey()/derivedKey() instead.
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      const calls = text.matchAll(/getEffectiveValue\(\s*(['"])([^'"]*)\1/g);
      for (const call of calls) {
        const key = call[2];
        if (!key.includes(':')) offenders.push(`${path}: getEffectiveValue('${key}')`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('never hardcodes a time-unit id', () => {
    // Duration ids come from engine.timeUnits. 'stretch'/'shift' are Dragonbane's;
    // writing one as a literal stores a duration other systems cannot resolve.
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      if (path.includes('/systems/')) continue; // adapters and system.json declare them
      for (const match of text.matchAll(/duration[^\n]*?(['"])(stretch|shift)\1/g)) {
        offenders.push(`${path}: duration '${match[2]}'`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('tests capability with the nullable model, not the panel list', () => {
    // `panels` and the nullable models are two hand-maintained lists that agree
    // only by hand. `engine.rest !== null` is the single source of truth; drift
    // otherwise yields a rest panel with no quick action, or a quick action
    // falling through to hardcoded Dragonbane rest types.
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      for (const match of text.matchAll(/panels\.includes\(\s*(['"])(rest|death|magic)\1/g)) {
        offenders.push(`${path}: panels.includes('${match[2]}')`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('branches on systemId only in the engine resolver', () => {
    // The project's cardinal rule. `baseEngineFor` in engine/index.ts is the one
    // sanctioned place; anywhere else, the value belongs on the engine instead.
    const allowed = 'src/features/systems/engine/index.ts';
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      if (path === allowed) continue;
      // `typeof x.systemId === 'string'` is a type check, not a branch on which
      // ruleset is active, so it is excluded.
      const branches = [...text.matchAll(/(typeof\s+)?[\w.?]*systemId\s*===\s*['"]/g)];
      if (branches.some(m => m[1] === undefined)) offenders.push(path);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
