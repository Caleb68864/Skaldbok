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
 * **Now widened to the three persisted-record files** it deliberately stopped
 * short of — `types/character.ts`, `types/attachment.ts`, `types/campaign.ts`.
 * That was held back because naming the declared-and-unread fields in them meant
 * a decision per field, and those decisions are now made and recorded in each
 * file: `activePartyId` wired, `sizeBytes` wired, and `expandedSections`,
 * `sheetCardOrder`, `sheetCustomCards`, `sheetPanelVisibility`,
 * `combatCardOrder`, `combatPanelVisibility`, `sourceSpellId`,
 * `activeSessionId` and `METADATA_KEYS` removed.
 *
 * Widening it revealed a shape the extractor had never met, because the previous
 * three files contain nothing but declarations: **a value object**.
 * `METADATA_KEYS = { kin: 'kin', … } as const` is a *population*, and the guard
 * counted its keys as declared fields, reporting four that are not fields at
 * all. The file's own comment already stated the rule that separates them — "a
 * declaration reads `field: Type` and a population reads `field: value`" — it
 * simply was not applied. It is now: see {@link isPopulatedValue}.
 *
 * Widened no further than these three on purpose. The next files out are screens
 * and hooks, where a corpus-wide bare-name search stops meaning anything.
 */
const DECLARATION_FILES = [
  'src/types/system.ts',
  'src/features/systems/engine/types.ts',
  'schemas/system.schema.ts',
  'src/types/character.ts',
  'src/types/attachment.ts',
  'src/types/campaign.ts',
];

/**
 * Names that reach a reader by a route no bare-name search can see.
 *
 * @remarks
 * Distinct from {@link KNOWN_UNIMPLEMENTED}: an entry here **is** read, and the
 * guard cannot prove it. Recording that separately keeps the allowlist of
 * *promises* from filling up with fields that are simply working.
 *
 * `restsUsed`'s three members are read as `restsUsed[def.id]`, where `def.id`
 * comes from `engine.restTypes` — a dynamic key, which is precisely the reach a
 * grep misses. `RestModule.tsx` says so in its own comment. Had these been
 * allowlisted as unimplemented instead, the entry would have been a false
 * statement that nobody could have disproved from the guard.
 */
const READ_DYNAMICALLY: Record<string, string> = {
  stretch: 'a member of CharacterUiState.restsUsed, read as `restsUsed[def.id]` in RestModule where `def.id` comes from engine.restTypes — a key from engine data, never spelled in source',
  shift: 'the same',
};

/*
 * `round` is the third member of `restsUsed` and is **not** listed above,
 * because the self-check below disproved the entry rather than accepting it:
 * `isRead('round')` is true. Two separate reasons were found, and only the first
 * was fixable.
 *
 * 1. `Math.round(` matched `\.round` across the whole corpus — a JS built-in
 *    reporting a reader for a field of this codebase's contract. That was a live
 *    false pass: had `restsUsed.round` ever been the bug, this guard would have
 *    excused it. `isRead` now checks the receiver, and it is pinned by example.
 *
 * 2. `CombatEncounterView` reads `event.round` — a *genuinely different field
 *    with the same name*, on `CombatEvent`. Nothing distinguishes the two in a
 *    bare-name search, which is the limitation `TOO_GENERIC` exists to manage
 *    and this is one more instance of it.
 *
 * So `round` passes for a reason that has nothing to do with `round`, and
 * recording that here is worth more than an allowlist entry the self-check would
 * reject. The way out, when it matters, is the one `cards/schema.test.ts` takes:
 * ask the reader question of a *specific* declaration instead of the corpus.
 */

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
/**
 * Whether a matched member is a *populated value* rather than a *declaration*.
 *
 * @remarks
 * The distinction this file has always claimed and never enforced: a
 * declaration reads `field: Type`, a population reads `field: value`. It cost
 * nothing while every declaration file held only interfaces and Zod schemas.
 * The moment `types/character.ts` joined, `METADATA_KEYS`'s six entries —
 * `kin: 'kin'`, `profession: 'profession'`, … — were extracted as declared
 * fields and reported unread, which is true of the *object* and meaningless of
 * its keys.
 *
 * The test is the right-hand side. A string or numeric **literal** is a value;
 * a type is not. Deliberately narrow: `kind: 'die-ladder'` is a literal *type*
 * and would be misread as a value, so this only fires when the literal is
 * followed by a comma or a closing brace — object-literal punctuation — and not
 * by the `;` an interface member ends with.
 *
 * @param tail - The source following the member's colon.
 */
function isPopulatedValue(tail: string): boolean {
  return /^\s*(?:'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?|true|false)\s*(?:,|\}|$)/.test(tail);
}

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
  ]
    // A key of a value object is not a declared field. See `isPopulatedValue`.
    .filter(m => !isPopulatedValue(unparenthesised.slice(m.index + m[0].length)))
    .map(m => m[2]);
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
    // A member of a JS built-in is not a member of this codebase's contract.
    // `Math.round(` reported a reader for `restsUsed.round` — a live false pass,
    // found the moment `round` was checked deliberately rather than incidentally:
    // had that field ever been the bug, this guard would have excused it. The
    // receiver is checked, not just the name, which is the same correction the
    // `.print` / `.print-col` false positive forced on the sibling guard.
    if (/(?:^|[^\w$])(?:Math|JSON|Object|Array|Number|String|Date|Promise|Intl|Reflect)$/
      .test(corpus.slice(0, match.index))) continue;
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
    // 4. A member of a JS built-in is not a member of this contract. `round` is
    //    declared by `CharacterUiState.restsUsed` and read only as
    //    `restsUsed[def.id]`; `Math.round(` across the corpus was reporting a
    //    reader for it, so the guard was excusing a field it could not see.
    expect(isRead('round', 'const n = Math.round(value);')).toBe(false);
    expect(isRead('parse', 'const o = JSON.parse(raw);')).toBe(false);
    // The receiver is what disqualifies it, not the name — a real read of a
    // field called `round` still counts.
    expect(isRead('round', 'if (character.uiState.round) return true;')).toBe(true);
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

  it('does not mistake a value object for a set of declarations', () => {
    // The blind spot that only appeared when `types/character.ts` joined
    // DECLARATION_FILES: the three files before it held nothing but interfaces
    // and Zod schemas, so a *populated* object had never been scanned. This one
    // was real — `METADATA_KEYS`'s six keys were extracted and reported unread,
    // which is true of the object and meaningless of its keys.
    const valueObject = [
      'export const METADATA_KEYS = {',
      "  kin: 'kin',",
      '  weight: 12,',
      '  enabled: true,',
      '} as const;',
    ].join('\n');
    for (const name of ['kin', 'weight', 'enabled']) {
      expect(declaredProperties(valueObject), `${name} is a value, not a declaration`)
        .not.toContain(name);
    }

    // …and the half that matters more: narrowing it must not blind the guard to
    // a member whose *type* is a literal. `kind: 'die-ladder'` is a declaration
    // and the extractor still has to see it. This is why `isPopulatedValue`
    // requires object-literal punctuation after the literal rather than just a
    // literal.
    const literalTypes = [
      'interface Probe {',
      "  kindField: 'die-ladder';",
      '  countField: 3;',
      '  flagField: true;',
      '}',
    ].join('\n');
    for (const name of ['kindField', 'countField', 'flagField']) {
      expect(declaredProperties(literalTypes), `${name} is a declaration with a literal type`)
        .toContain(name);
    }
  });

  it('every READ_DYNAMICALLY entry is a real declaration this guard cannot follow', () => {
    // The mirror of the KNOWN_UNIMPLEMENTED self-check, and it has to exist for
    // the same reason: an entry for a name no declaration file declares excludes
    // nothing, and an entry for a name the guard *can* now see is an exemption
    // that has stopped meaning anything.
    for (const [name, reason] of Object.entries(READ_DYNAMICALLY)) {
      expect(
        declaredIncludingGeneric,
        `READ_DYNAMICALLY lists "${name}" ("${reason}"), which no declaration file declares`,
      ).toContain(name);
      expect(
        isRead(name),
        `"${name}" is listed as read only dynamically ("${reason}") but this guard `
          + 'can now see a reader for it — remove the entry rather than leaving an '
          + 'exemption that excuses nothing.',
      ).toBe(false);
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
    if (!read && READ_DYNAMICALLY[name]) {
      // Read by a route no name search can follow — a key from engine data.
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
