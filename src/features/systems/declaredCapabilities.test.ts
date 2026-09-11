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

/**
 * Files whose declarations define the contract.
 *
 * @remarks
 * The Zod schema is here for the reason `CLAUDE.md` gives for keeping it in step
 * with the type: Zod strips unknown keys, so a field in the type and not the
 * schema silently vanishes for *imported* systems while working for bundled
 * ones — and the mirror mistake, a field validated by the schema and absent from
 * the type, was outside this guard entirely. Today the two agree exactly: adding
 * the schema surfaces no new name, which is what makes it a free closure of a
 * gap rather than a pile of work.
 *
 * Not widened to `types/character.ts`, `types/attachment.ts` or
 * `types/campaign.ts`. Those hold the twelve declared-and-unread fields
 * `vault/scan2-findings.md` §14 lists, and each needs a decision — wire it or
 * write down why not — that belongs to whoever owns the feature.
 */
const DECLARATION_FILES = [
  'src/types/system.ts',
  'src/features/systems/engine/types.ts',
  'schemas/system.schema.ts',
];

/**
 * A declared member's name: optionally quoted, and allowing `_`, `$` and `-`.
 *
 * @remarks
 * Group 1 is the quote (or empty), group 2 the name — the backreference keeps a
 * half-quoted key from matching.
 */
const DECLARED_NAME = "(['\"]?)([A-Za-z_$][\\w$-]*)\\1";

/**
 * Escapes a declared name for use inside a `RegExp`.
 *
 * @remarks
 * Needed since the name pattern started accepting `$` and `-`, both of which
 * mean something else in a regular expression. Without it, a field named
 * `$dollarField` would search for an anchor.
 */
function escaped(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

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
 *
 * Four more shapes the name pattern could not spell, each measured against the
 * old regex and confirmed to yield nothing:
 *
 * | shape | why it was invisible |
 * |---|---|
 * | `readonly frozenField: string` | the modifier sat where the name had to start |
 * | `methodField(id): number` | parentheses between the name and its colon |
 * | `'quoted-key': string` | quotes, and a hyphen the name class excluded |
 * | `snake_field` / `$dollarField` | `[a-zA-Z][a-zA-Z0-9]*` allows neither `_` nor `$` |
 *
 * None has a live instance today. That is the argument for closing them, not
 * against it: this file exists because five fields were declared and inert, and
 * every one of them looked like working configuration until someone checked.
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
  // `(?:\(\))?` is what makes a method signature visible: the loop above has
  // already collapsed every parameter list to `()`, so `foo(id: string): number`
  // arrives here as `foo(): number`.
  const own = [
    ...unparenthesised.matchAll(
      new RegExp(`^\\s+(?:readonly\\s+)?${DECLARED_NAME}\\s*\\??\\s*(?:\\(\\))?\\s*:`, 'gm'),
    ),
  ].map(m => m[2]);
  // The closing separator is a *lookahead*, not a consumed character.
  // `matchAll` is non-overlapping, so consuming it swallowed the `;` that
  // introduces the next member: in
  // `{ traitId: string; targetNumber: number; onCriticalFailure?: string }`
  // the first match ate `{ traitId: string;`, the scan resumed past it, and the
  // middle member was never seen. All three of those are unread; two were
  // allowlisted and the guard could not see the third at all.
  const inline = [
    ...code.matchAll(
      new RegExp(`[{;]\\s*(?:readonly\\s+)?${DECLARED_NAME}\\s*\\??\\s*:[^;{}\\n]*(?=[;}])`, 'g'),
    ),
  ].map(m => m[2]);
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
 *
 * @remarks
 * This is the guard's largest remaining blind spot and it is deliberate: a name
 * here is unchecked in both directions. Two things keep it from growing into a
 * silent exemption list — `effect` came off it the moment a real bug hid behind
 * it, and the test below fails on any entry no declaration file declares, so it
 * cannot accumulate names that exclude nothing.
 *
 * The way out, where it matters, is the one `cards/schema.test.ts` takes:
 * derive the reader question from a *specific* declaration rather than
 * searching the whole corpus for a bare name.
 */
const TOO_GENERIC = new Set([
  'id', 'name', 'label', 'value', 'type', 'min', 'max', 'key', 'mode', 'kind',
  'text', 'order', 'group', 'step', 'levels', 'apply', 'read', 'write', 'die',
  'fields', 'tone', 'range', 'display', 'character', 'resources', 'skills',
  'conditions', 'attributes', 'status', 'messages', 'prompt', 'chance',
  'abbr', 'abbrev', 'description', 'version', 'columns',
  // `effect` came off this list once conditions[].effect gained a reader: it
  // was excluded as too generic to prove anything, and that exclusion is what
  // let Savage Worlds declare its condition penalties and have nothing read
  // them. `recovery` and `duration` stay: both are genuinely common words, and
  // both are separately tracked — see KNOWN_UNIMPLEMENTED.
  'note', 'rows', 'title', 'recovery',
  'duration', 'summary', 'ladder', 'scale', 'noop', 'tracks', 'panels',
  'terms', 'labels', 'currency', 'magic', 'rest', 'death', 'probability',
  'skill', 'armor', 'weapon', 'direction', 'surfaces', 'denominations',
]);

const declaredIncludingGeneric = [
  ...new Set(DECLARATION_FILES.flatMap(f => declaredProperties(readFileSync(f, 'utf8')))),
];
const declared = declaredIncludingGeneric.filter(name => !TOO_GENERIC.has(name));

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
  // `(?![\w$-])` rather than `\b`: a word boundary sits between `h` and `-`, so
  // a hyphenated name inside a string — a CSS class, a data attribute — read as
  // a member access. The sibling guard in `cards/schema.test.ts` reported a
  // reader for `print` on exactly this, off `.print-col`.
  for (const match of corpus.matchAll(new RegExp(`\\.${escaped(name)}(?![\\w$-])`, 'g'))) {
    // An assignment is a write, and this file's whole subject is that declaring
    // and consuming are separate edits. Writing is not consuming either — the
    // same distinction the `}` + `)` rule below already makes for a constructed
    // key. One genuine read anywhere else still counts.
    if (/^\s*=(?!=)/.test(corpus.slice(match.index + match[0].length))) continue;
    return true;
  }
  // Indexed access needs something to index. `surfaces: ['print']` is an array
  // literal holding a string and is character-identical to `obj['print']`
  // otherwise. Both quote styles count; the double-quoted form used to be
  // missed, which fails loudly rather than quietly but is still wrong.
  if (new RegExp(`[\\w$\\])]\\s*\\[['"]${escaped(name)}['"]\\]`).test(corpus)) return true;
  const groups = corpus.matchAll(
    new RegExp(`\\{[^{}\\n]*\\b${escaped(name)}\\b[^{}\\n]*\\}\\s*[=:)]`, 'g'),
  );
  for (const match of groups) {
    const writesTheKey = new RegExp(`\\b${escaped(name)}\\b\\s*:`).test(match[0]);
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

  it('is not fooled by a name that merely looks like a member access', () => {
    // Three shapes, all found live in this repo by the sibling guard in
    // `cards/schema.test.ts`, which reported a reader for a schema field named
    // `print` three separate times before it stopped believing any of them.
    //
    // 1. A hyphenated name inside a string. `\b` sits between `h` and `-`, so a
    //    CSS class read as a member access.
    expect(isRead('refresh', 'const css = "resource.refresh-rate";')).toBe(false);
    // 2. An array literal holding the string, which is character-identical to
    //    an indexed read unless you require something to index.
    expect(isRead('print', "const surfaces = ['print'];")).toBe(false);
    // 3. An assignment is a write. This file's stated purpose is that declaring
    //    and consuming are separate edits; writing is not consuming either.
    expect(isRead('sizeBytes', 'record.sizeBytes = blob.size;')).toBe(false);
    // Assigned in one place and genuinely read in another is still read.
    expect(isRead('sizeBytes', 'record.sizeBytes = blob.size;\ntotal += record.sizeBytes;')).toBe(true);
    // Indexed access, both quote styles. The double-quoted form used to be a
    // false *negative* — safe, because it fails loudly, but still wrong.
    expect(isRead('refresh', 'const mode = resource["refresh"];')).toBe(true);
    // A call IS the read for a function-typed capability, and this contract has
    // many (`derivedStats()`, `chance()`, `describe()`). So `.name(` stays a
    // read here, deliberately — the sibling guard excludes it only because every
    // key on the sheet-template schema is data. Copying that rule to this file
    // would blind it to the engine's whole behavioural half.
    expect(isRead('describe', 'const row = engine.skill.describe(id);')).toBe(true);
  });

  it('sees the declaration shapes the old patterns could not spell', () => {
    // Measured, not guessed: each of these was run against the previous
    // extractor and produced *nothing*. None has a live instance in the two
    // declaration files today, which is the point — a guard is meant to see the
    // field somebody writes next week, and "no offender today" is how a blind
    // spot stays invisible until it matters.
    const sample = [
      'interface Probe {',
      '  readonly frozenField: string;',
      '  methodField(id: string): number;',
      "  'quoted-key': string;",
      '  snake_field: string;',
      '  $dollarField: string;',
      '}',
    ].join('\n');
    for (const name of ['frozenField', 'methodField', 'quoted-key', 'snake_field', '$dollarField']) {
      expect(declaredProperties(sample), `${name} is not being extracted`).toContain(name);
    }
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

  it('excludes only names the contract actually declares', () => {
    // `TOO_GENERIC` is this guard's largest blind spot — every name on it is
    // unchecked, in both directions — so it has to earn each entry. An entry
    // that no declaration file mentions excludes nothing and is simply a name
    // the guard has promised never to look at.
    //
    // Six were dead when this check was written: `cells`, `regions`, `layout`,
    // `card`, `when` and `cost`. Five of the six are keys of the *card* schema,
    // which this guard has never read — and `layout` is the sharpest of them,
    // because `surfaceLayoutSchema.layout` was a real declared-and-unread field
    // sitting in the card schema at the time. The exclusion list named the one
    // field the guard would have had to miss.
    const dead = [...TOO_GENERIC].filter(name => !declaredIncludingGeneric.includes(name));
    expect(
      dead,
      `TOO_GENERIC excludes ${dead.join(', ')}, which no declaration file declares. `
        + 'An exclusion for a field that does not exist is not a trade-off, it is a '
        + 'blind spot with no subject — delete it.',
    ).toEqual([]);
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
