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

/**
 * Files entitled to spell a creature stat id, and why.
 *
 * @remarks
 * Two, and the reasons are different in kind. `creatureStats.ts` *is* the
 * declaration — `DEFAULT_CREATURE_STAT_FIELDS` is the stat block a ruleset gets
 * when it declares none, so it has to name the three ids somewhere and this is
 * that somewhere.
 *
 * `client.ts` is a released Dexie upgrade body writing the shape that existed at
 * that version. Editing it is forbidden twice over: by the house rule that a
 * `version(n)` block is never edited retroactively, and by
 * `releasedSchemaVersions.test.ts`, which fingerprints the block and would fail
 * on the change. An exemption whose reason is "and the repo will stop you" is
 * the only kind worth having.
 */
const SPELLS_STAT_IDS_BY_RIGHT: Record<string, string> = {
  'src/features/bestiary/creatureStats.ts':
    'the default stat block itself — the ids have to be written down once, and this is once',
  'src/storage/db/client.ts':
    'a released upgrade body, frozen by the migration rule and fingerprinted by releasedSchemaVersions.test.ts',
};

/**
 * Stat ids spelled as literal keys of a `stats: { … }` block.
 *
 * @remarks
 * Walks to the balanced closing brace rather than matching `[^{}]*`, so a nested
 * call in a value does not truncate the block — and an *unbalanced* block is
 * reported as `UNRESOLVED` rather than silently producing no offence. Computed
 * keys (`[healthStatId]:`) are the sanctioned form and yield nothing.
 *
 * Returns one entry per stat block, listing the literal ids in it.
 */
function spelledStatIds(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\bstats\s*:\s*\{/g)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) { close = i; break; }
      }
    }
    if (close === -1) {
      found.push('UNRESOLVED — the stat block has no balanced closing brace');
      continue;
    }
    // Collapse nested groups before reading keys, or a key belonging to a value
    // counts as a stat id: `stats: { hp: fn({ a: 1 }) }` reported `hp, a` until
    // the pinned example above caught it.
    let inner = text.slice(open + 1, close);
    for (;;) {
      const next = inner.replace(/\{[^{}]*\}/g, '{}');
      if (next === inner) break;
      inner = next;
    }
    const keys = [...inner.matchAll(/(?:^|[,;])\s*([A-Za-z_$][\w$]*)\s*\??\s*:/g)].map(m => m[1]);
    if (keys.length > 0) found.push(keys.join(', '));
  }
  return found;
}

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

  it('never uses a capability flag as a stand-in for a ruleset', () => {
    // A `systemId ===` branch in disguise. Each of these named exactly one
    // shipped system while looking generic:
    //   `engine.resolution === 'd20-roll-under'`  — layout, in SkillModule
    //   `!engine.skill.supportsMarks`             — "not d20", in SkillsScreen
    //   `!engine.damageTrack`                     — where the purse lives
    // The `resolution` field is gone entirely; the other two are real
    // capabilities that must be read for what they say, not as proxies.
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      if (path.startsWith('src/features/systems/engine/')) continue; // adapters declare them
      for (const match of text.matchAll(/engine\.resolution\s*===/g)) {
        offenders.push(`${path}: ${match[0]}`);
      }
      // damageTrack says how damage cascades, not how a screen is arranged.
      for (const match of text.matchAll(/![\w.]*\bengine\.damageTrack\b(?!\s*\))/g)) {
        offenders.push(`${path}: ${match[0]} (damage cascade is not a layout switch)`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('gets a skill row from the engine rather than composing odds itself', () => {
    // A screen that assembles its own odds line has to decide what shape that
    // line takes, and both screens decided it by asking an unrelated question:
    // SkillModule branched on `engine.resolution`, SkillsScreen on
    // `!engine.skill.supportsMarks`. `skill.describe` returns the parts —
    // headline, detail, alternatives, note — so neither has to know the
    // mechanic. `probability.chance` stays available to the engines that build
    // those parts, and to nothing else.
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      if (path.startsWith('src/features/systems/engine/')) continue;
      for (const match of text.matchAll(/\bprobability\.chance\s*\(/g)) {
        offenders.push(`${path}: ${match[0]} — use engine.skill.describe()`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('never duck-types a system by a key only one engine returns', () => {
    // `'characteristicDMs' in derived` read as a structural check and was a
    // system-id branch: only Traveller's derived block has that key, so a
    // second modifier-based system would have had to adopt Traveller's key
    // name to get the same layout. Ask the engine instead.
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      if (path.startsWith('src/features/systems/engine/')) continue;
      for (const match of text.matchAll(/(['"])(\w+)\1\s+in\s+derived\b/g)) {
        offenders.push(`${path}: '${match[2]}' in derived`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('logs every resource the engine declares, not two Dragonbane ids', () => {
    // `id === 'hp' || id === 'wp'` gated session logging, so Wounds, Fatigue,
    // Bennies and any user-authored pool changed silently.
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      if (path.startsWith('src/systems/')) continue;
      for (const match of text.matchAll(/===\s*(['"])(hp|wp)\1\s*\|\|[^\n]*===\s*(['"])(hp|wp)\3/g)) {
        offenders.push(`${path}: ${match[0].trim()}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('never writes a creature stat block with hand-spelled stat ids', () => {
    // A `systemId ===` branch with no `systemId` in it.
    //
    // `useSessionLog.logNpcCapture` wrote `stats: { hp: input.hp ?? 0, armor: 0,
    // movement: 0 }` — three Dragonbane ids, chosen by nothing, applied to every
    // ruleset. A Traveller NPC captured mid-session got a Dragonbane stat block;
    // the bestiary then showed it under Traveller's declared fields, all reading
    // 0, with the three numbers actually stored filed under "Other".
    //
    // The rule it breaks is the one `creatureStats.ts` already states: the stat
    // ids come from `system.creatures.statFields`, or from the default block
    // when a ruleset declares none. Spelling them in source is asserting which
    // ruleset is active — and the assertion is invisible to every other guard
    // here, because there is no discriminator in it to match on.
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      if (SPELLS_STAT_IDS_BY_RIGHT[path]) continue;
      for (const spelled of spelledStatIds(text)) {
        offenders.push(`${path}: stats: { ${spelled} }`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('reads a stat block the way the guard above claims to', () => {
    // The detector pinned by example, because it is invisible from the code it
    // guards and because two of its three answers are the interesting ones.
    expect(spelledStatIds('stats: { hp: n ?? 0, armor: 0, movement: 0 },')).toEqual([
      'hp, armor, movement',
    ]);
    // Accepted: keys computed from the ruleset's own ids are the fix, not the
    // defect. A guard with no accepted case is a guard nothing can satisfy.
    expect(spelledStatIds('stats: { [healthStatId]: 0, [armorStatId]: 0 },')).toEqual([]);
    expect(spelledStatIds('stats: newCreatureStatBlock(system, { health }),')).toEqual([]);
    // A type annotation pinning one ruleset's ids is the same assertion in the
    // same file, one level up, and was live in two of the three sites.
    expect(spelledStatIds('stats: { hp?: number; armor?: number },')).toEqual(['hp, armor']);
    // Unanalysable rather than absent: an unbalanced block is reported, not
    // skipped. A guard that passes when it cannot resolve what it is looking at
    // is the failure mode every gap in vault/scan2-findings.md has had.
    expect(spelledStatIds('stats: { hp: fn({ a: 1 }) ')).toEqual([
      'UNRESOLVED — the stat block has no balanced closing brace',
    ]);
    expect(spelledStatIds('stats: { hp: fn({ a: 1 }) },')).toEqual(['hp']);
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
