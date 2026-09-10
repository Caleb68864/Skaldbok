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

/**
 * Property names declared in the given source.
 *
 * @remarks
 * The indent used to be pinned at exactly two spaces, which is the top level of
 * an interface and nothing else. Everything nested was invisible:
 * `SystemDefinition.terms.*`, `labels.*`, `currency.*`, `magic.*`,
 * `routePlanner.*`, `itemFields.hiddenBuiltIns`, `expiresOn.*` — all sit at four
 * or more. Any indent now counts.
 *
 * The second pattern catches members declared *inline* on one line, as in
 * `scale?: { kind: 'die-ladder'; ladder: number[]; allowsPlus?: boolean }`,
 * which yielded only `scale`. `allowsPlus` is one of the five original bugs
 * named in the doc comment above, and until this pattern existed the test
 * written to prevent it did not cover it.
 */
function declaredProperties(source: string): string[] {
  // Comments first, or `in \`{ denominationId: amount }\`` — prose in a
  // `@remarks` — reads as a declaration.
  const code = stripComments(source);
  // Parameter lists next, but only for the line-start scan: a wrapped parameter
  // (`    context?: SkillDisplayContext,`) is indistinguishable from an
  // interface member by indentation alone. Nested groups need the loop.
  let unparenthesised = code;
  for (;;) {
    const next = unparenthesised.replace(/\([^()]*\)/g, '()');
    if (next === unparenthesised) break;
    unparenthesised = next;
  }
  const own = [...unparenthesised.matchAll(/^\s+([a-zA-Z][a-zA-Z0-9]*)\??\s*:/gm)].map(m => m[1]);
  // The closing separator is a *lookahead*, not a consumed character.
  // `matchAll` is non-overlapping, so consuming it swallowed the `;` that
  // introduces the next member: in
  // `{ traitId: string; targetNumber: number; onCriticalFailure?: string }`
  // the first match ate `{ traitId: string;`, the scan resumed past it, and the
  // middle member was never seen. All three of those are unread; two were
  // allowlisted and the guard could not see the third at all.
  const inline = [
    ...code.matchAll(/[{;]\s*([a-zA-Z][a-zA-Z0-9]*)\??\s*:[^;{}\n]*(?=[;}])/g),
  ].map(m => m[1]);
  return [...own, ...inline];
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
  penaltyPerLevel: 'the number is single-sourced in savageWorldsEngine (pass 11); the FIELD still has no reader',
  roleFallback: 'no surface shows a profession fallback yet; the library card now uses identityFields instead',
  sectionLayouts: 'sheet layout comes from sheet.json; this predates it',
  themesSupported: 'theming is app-level, not per-system',
  // The four below were invisible until this file learned to see nested, inline
  // and shorthand-constructed fields. None is newly broken; each has been
  // declared-and-inert all along, and is written down here rather than merely
  // absent.
  traitId: 'condition.recovery is declared by savage-worlds/system.json (Shaken → Spirit 4) and no surface offers the recovery roll',
  targetNumber: 'the third member of condition.recovery, and the one the guard could not see until the inline extractor stopped consuming its own separator. Populated in shipped data (savage-worlds/system.json:109,156,170) and validated by system.schema.ts:38, so it is worse than its two line-mates, not better: the file says Shaken recovers on Spirit 4 and nothing anywhere asks for that roll',
  onCriticalFailure: 'same as traitId — the whole condition.recovery object is inert, so its consequence string is too',
  depleted: 'DamageHealModule reads resources/dealt/unassigned/status; which tracks are full is implied by status and never named',
  raises: 'accepted for forward-compatibility by the toughness comparison and deliberately unread — savageWorldsEngine.ts:287 says why',
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
  // `effect` came off this list once conditions[].effect gained a reader: it
  // was excluded as too generic to prove anything, and that exclusion is what
  // let Savage Worlds declare its condition penalties and have nothing read
  // them. `recovery` and `duration` stay: both are genuinely common words, and
  // both are separately tracked — see KNOWN_UNIMPLEMENTED.
  'layout', 'card', 'when', 'note', 'rows', 'title', 'recovery',
  'duration', 'summary', 'cost', 'ladder', 'scale', 'noop', 'tracks', 'panels',
  'terms', 'labels', 'currency', 'magic', 'rest', 'death', 'probability',
  'skill', 'armor', 'weapon', 'direction', 'surfaces', 'denominations',
]);

const declared = [
  ...new Set(DECLARATION_FILES.flatMap(f => declaredProperties(readFileSync(f, 'utf8')))),
].filter(name => !TOO_GENERIC.has(name));

/**
 * Whether the corpus genuinely *reads* a field of this name.
 *
 * @remarks
 * The third pattern used to be `\bname\s*[,}]`, and the doc comment claimed it
 * could not match a population because "a population reads `field: value`".
 * That is false for ES6 shorthand, and the false pass was live:
 * `DamageApplication.depleted` matched only
 * `return { resources, dealt, unassigned: remaining, depleted, status };` in
 * `utils/damageTrack.ts`. The field was produced, typed, and read by nothing but
 * its own test — precisely the bug this file exists to catch — and the guard
 * passed it.
 *
 * Destructuring is still a real read, so it is matched specifically: a brace
 * group containing the name and followed by `=` (`const { depleted } = …`), `:`
 * (a typed parameter) or `)` (an inline destructured parameter).
 *
 * The claim that this "excludes the object-literal construction, where the
 * closing brace is followed by `;`, `,` or a newline" was only three-quarters
 * true. `updateCampaign(id, { activePartyId: party.id })` ends `}` + `)`, which
 * the third form accepts — so writing a field counted as reading it, on
 * `campaignSchema.activePartyId`, which is written by three real UI flows and
 * read by none of them (the active party is resolved by querying `db.parties`
 * and taking the first row instead).
 *
 * A shorthand destructure has no colon after the name; a constructed key does.
 * So the `}` + `)` form is rejected when the name is followed by `:` inside the
 * braces. The `=` and `:` forms keep their looser reading, because a renamed
 * destructure (`const { activePartyId: id } = campaign`) is a genuine read and
 * does carry a colon.
 */
function isRead(name: string, corpus: string = consumerSource): boolean {
  if (new RegExp(`\\.${name}\\b`).test(corpus)) return true;
  if (new RegExp(`\\['${name}'\\]`).test(corpus)) return true;
  const groups = corpus.matchAll(
    new RegExp(`\\{[^{}\\n]*\\b${name}\\b[^{}\\n]*\\}\\s*[=:)]`, 'g'),
  );
  for (const match of groups) {
    const writesTheKey = new RegExp(`\\b${name}\\b\\s*:`).test(match[0]);
    if (writesTheKey && /\}\s*\)$/.test(match[0])) continue; // a call argument
    return true;
  }
  return false;
}

describe('declared capabilities have readers', () => {
  it('found a meaningful number of declared fields to check', () => {
    // A broken regex silently checking nothing is this test's failure mode.
    expect(declared.length).toBeGreaterThan(20);
  });

  it('sees nested and inline members, not just the top level of an interface', () => {
    // The extraction is the whole guarantee, and it is invisible from the code
    // it guards, so it gets pinned by example. Each of these was outside the
    // old `^\s{2}` pattern:
    //   allowsPlus  — inline, `scale?: { …; allowsPlus?: boolean }`
    //   printAbilities, creatureHealth — nested under `labels`, 4 spaces
    //   hiddenBuiltIns — nested under `itemFields`
    // `allowsPlus` is one of the five bugs named at the top of this file, and
    // the test written to prevent it did not cover it.
    for (const name of ['allowsPlus', 'printAbilities', 'hiddenBuiltIns', 'traitId']) {
      expect(declared, `${name} is no longer being extracted as a declared field`).toContain(name);
    }
  });

  it('sees every member of an inline object, not just the first and last', () => {
    // `recovery?: { traitId: string; targetNumber: number; onCriticalFailure?: string }`
    // — three members, all unread. `traitId` and `onCriticalFailure` were
    // allowlisted; `targetNumber` sat between them and was invisible, because
    // `matchAll` is non-overlapping and the first match consumed the `;` that
    // would have introduced the next member. The scan resumed past it and
    // matched `; onCriticalFailure?: string }`.
    //
    // Deleting the two allowlist entries made the guard name both of them and
    // say nothing about the one in the middle, which is populated in shipped
    // data (`savage-worlds/system.json:109,156,170`).
    for (const name of ['traitId', 'targetNumber', 'onCriticalFailure']) {
      expect(declared, `${name} is not being extracted — see the note above`).toContain(name);
    }
  });

  it('does not mistake writing a field for reading it', () => {
    // The corpus is a parameter so this can be pinned by example rather than
    // asserted about in a comment. `updateCampaign(id, { activePartyId: … })`
    // ends `}` + `)`, which the destructuring pattern accepted — so three real
    // UI flows *writing* `campaignSchema.activePartyId` read to this guard as
    // three readers of it, while the app resolves the active party by querying
    // `db.parties` and taking the first row.
    expect(isRead('activePartyId', 'await updateCampaign(id, { activePartyId: party.id });')).toBe(false);
    // Genuine reads, all still reads.
    expect(isRead('depleted', 'const { depleted } = applyDamage(character, 3);')).toBe(true);
    expect(isRead('activePartyId', 'const { activePartyId: chosen } = campaign;')).toBe(true);
    expect(isRead('allowsPlus', 'if (engine.scale.allowsPlus) return true;')).toBe(true);
    expect(isRead('refresh', "const mode = resource['refresh'];")).toBe(true);
  });

  it('does not mistake a parameter or a doc comment for a declaration', () => {
    // `context?: SkillDisplayContext,` is a wrapped parameter; `denominationId`
    // appears only inside a `@remarks`. Both were counted the moment the indent
    // pattern widened, and both would have been "fixed" by allowlisting fields
    // that do not exist.
    for (const name of ['context', 'denominationId']) {
      expect(declared, `${name} is a parameter/comment, not a declared field`).not.toContain(name);
    }
  });

  it.each(declared)('%s is read somewhere', name => {
    const read = isRead(name);

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
    //
    // Both checks now share `isRead`, so they cannot drift apart. They already
    // had: this one was missing the destructuring form, so a field that gained
    // a reader written as `const { name } = engine` stayed on the allowlist
    // unchallenged — the rot the test exists to prevent, in the test itself.
    for (const [name, reason] of Object.entries(KNOWN_UNIMPLEMENTED)) {
      expect(
        isRead(name),
        `"${name}" is listed as unimplemented ("${reason}") but now HAS a reader — ` +
          `remove it from KNOWN_UNIMPLEMENTED`,
      ).toBe(false);
    }
  });
});
