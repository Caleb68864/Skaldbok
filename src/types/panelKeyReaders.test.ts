import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { PANEL_KEYS } from './system';

/**
 * Which `PANEL_KEYS` a consumer of `engine.panels` actually asks about.
 *
 * @remarks
 * Seventeen keys are declared and every adapter lists most of them. Exactly two
 * production sites read `engine.panels`: `sheetPanelAvailability`
 * (`features/systems/panelOrder.ts`), which asks about eight, and
 * `CombatModule`, which asks about one of those same eight. **Six** keys —
 * `skills`, `inventory`, `combat`, `notes`, `bennies`, `powers` — are read by
 * nothing at all, so adding or removing one from an adapter's `panels` array
 * changes nothing. (This said "five" while `DECLARED_BUT_INERT` held six, and
 * said they were "declared by every adapter": `bennies` is declared only by
 * `savageWorldsEngine.ts:220`, and `powers` by no adapter at all — `system.ts`
 * records it as reserved for SWADE Arcane Background.) `bennies` is the
 * sharpest case: `BenniesModule` exists and is registered, but which cards
 * render is decided by `sheet.json` card keys, not by this array.
 *
 * They are documented rather than deleted, and the reason is in `system.ts`:
 * `panels` is data a `system.json` may override, and the Zod schema validates an
 * imported system's `panels` against these keys — so shrinking the list would
 * make a previously valid user-authored system fail validation. That is a data
 * regression in exchange for five fewer strings, on the one path where the
 * user's data is the only copy.
 *
 * What this test buys is that the inert set cannot grow in silence. A new key
 * added with no reader fails here and has to be justified in the same commit,
 * which is the same bargain `declaredCapabilities.test.ts` strikes for the rest
 * of the system contract.
 */

const SRC = join(process.cwd(), 'src');

/** Keys a `sheetPanelAvailability`-style consumer asks `engine.panels` about. */
const READ_BY_A_CONSUMER = [
  'attributes',
  'characteristics',
  'resources',
  'finances',
  'careers',
  'augments',
  'edges',
  'hindrances',
] as const;

/**
 * Keys gated on a nullable rules model instead of on `panels`.
 *
 * @remarks
 * `engine.rest === null` is how a ruleset says it has no rest procedure, and
 * `engineConsumers.test.ts` enforces that shape. The panel key is redundant
 * alongside it, not inert in the same way.
 */
const GATED_ON_A_NULLABLE_MODEL = ['magic', 'rest', 'death'] as const;

/** Keys declared by every adapter that nothing reads. See the file comment. */
const DECLARED_BUT_INERT = ['skills', 'inventory', 'combat', 'notes', 'bennies', 'powers'] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

/** Every line in non-test `src` that reads `engine.panels`. */
function panelsReaders(): string[] {
  const readers: string[] = [];
  for (const file of walk(SRC)) {
    const source = readFileSync(file, 'utf8');
    if (/\bpanels\.includes\(/.test(source)) readers.push(file);
  }
  return readers;
}

/**
 * The panel keys a consumer actually asks `engine.panels` about.
 *
 * @remarks
 * An independent source of truth, and the whole point of this function. The
 * assertion below used to be `source.includes("'" + key + "'")` over the *whole
 * file* of every reader — and the only reader is `features/systems/panelOrder.ts`,
 * which opens with `SHEET_PANEL_KEYS`, an unrelated list carrying all eight
 * members of `READ_BY_A_CONSUMER` as string literals. So the assertion compared
 * the file to itself and was tautological across its entire domain:
 *
 * > **M3.** `edges: declares('edges')` → `edges: true`, deleting that key's only
 * > reader. The guard stayed **green**, satisfied by `'edges'` in the list at
 * > the top of the same file. Re-run against this function it goes red.
 *
 * Two shapes count as asking: `panels.includes('key')` written out, and a call
 * to a local one-argument alias that forwards its parameter straight into
 * `panels.includes` — which is what `panelOrder.ts` writes
 * (`const declares = (key: string) => engine.panels.includes(key)`).
 *
 * Anything else is reported as **unresolved** and fails, rather than being
 * quietly skipped. A `panels.includes(someVariable)` this cannot follow means
 * the guard does not know what that consumer reads, and a guard that cannot
 * resolve what it is looking at must say so — every guard gap found in this
 * codebase so far has been one that passed in that situation.
 *
 * @returns The keys asked about, and every call site that could not be read.
 */
function panelKeysAsked(): { keys: Set<string>; unresolved: string[] } {
  const keys = new Set<string>();
  const unresolved: string[] = [];

  for (const file of panelsReaders()) {
    const source = readFileSync(file, 'utf8');
    const where = basename(file);

    // `const declares = (key: string) => engine.panels.includes(key);`
    // alias name → the parameter it forwards.
    const aliases = new Map<string, string>();
    const aliasPattern =
      /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\(\s*([A-Za-z_$][\w$]*)\s*(?::[^)]*)?\)\s*(?::[^=]*?)?=>\s*[^;\n]*?\bpanels\.includes\(\s*\2\s*\)/g;
    for (const match of source.matchAll(aliasPattern)) {
      aliases.set(match[1]!, match[2]!);
    }
    const aliasParams = new Set(aliases.values());

    const record = (rawArg: string): void => {
      const arg = rawArg.trim();
      const literal = /^(['"`])([A-Za-z_$][\w$]*)\1$/.exec(arg);
      if (literal) {
        keys.add(literal[2]!);
        return;
      }
      // The alias definition's own body, already accounted for by its calls.
      if (aliasParams.has(arg)) return;
      unresolved.push(`${where}: panels.includes(${arg})`);
    };

    for (const match of source.matchAll(/\bpanels\.includes\(([^)]*)\)/g)) {
      record(match[1] ?? '');
    }
    for (const alias of aliases.keys()) {
      for (const match of source.matchAll(new RegExp(`\\b${alias}\\(([^)]*)\\)`, 'g'))) {
        const arg = (match[1] ?? '').trim();
        const literal = /^(['"`])([A-Za-z_$][\w$]*)\1$/.exec(arg);
        if (literal) {
          keys.add(literal[2]!);
          continue;
        }
        unresolved.push(`${where}: ${alias}(${arg})`);
      }
    }
  }

  return { keys, unresolved };
}

describe('PANEL_KEYS', () => {
  it('is partitioned exhaustively, with no key in two groups', () => {
    const partition = [
      ...READ_BY_A_CONSUMER,
      ...GATED_ON_A_NULLABLE_MODEL,
      ...DECLARED_BUT_INERT,
    ];
    expect(new Set(partition).size, 'a key appears in two groups').toBe(partition.length);
    expect(
      [...partition].sort(),
      'A panel key was added or removed without deciding which group it is in. '
      + 'A key with no reader is inert: an adapter can list it or not and nothing '
      + 'changes. Give it a consumer, or add it to DECLARED_BUT_INERT and say why.',
    ).toEqual([...PANEL_KEYS].sort());
  });

  it('finds the consumers that read engine.panels at all', () => {
    // Guards the guard: if `panels.includes(` disappears, the partition above is
    // describing a contract nothing consults.
    const readers = panelsReaders();
    expect(readers.length, 'nothing reads engine.panels any more').toBeGreaterThan(0);
    expect(readers.some((f) => f.endsWith('panelOrder.ts'))).toBe(true);
  });

  it('can read every panels call site it finds', () => {
    // Fail loudly rather than pass an unanalysable case: a call this cannot
    // follow means the two assertions below are answering about a smaller set
    // of consumers than exists, and saying nothing about the rest.
    const { unresolved } = panelKeysAsked();
    expect(
      unresolved,
      `${unresolved.join('; ')} — this guard could not tell which panel key(s) that `
      + 'reads. Pass the key as a literal, or teach `panelKeysAsked` the shape.',
    ).toEqual([]);
  });

  it('has a reader for every key it claims is read', () => {
    const { keys } = panelKeysAsked();
    const unread = READ_BY_A_CONSUMER.filter((key) => !keys.has(key));
    expect(
      unread,
      `${unread.join(', ')} is listed as read by a panels consumer but no consumer `
      + 'asks about it. Move it to DECLARED_BUT_INERT, or restore its reader.',
    ).toEqual([]);
  });

  it('has no reader for any key it claims is inert', () => {
    // The half that rots: a key gains a reader, nobody moves it, and the next
    // reader of this file is told it does nothing when it now does.
    const { keys } = panelKeysAsked();
    const nowRead = DECLARED_BUT_INERT.filter((key) => keys.has(key));
    expect(
      nowRead,
      `${nowRead.join(', ')} is documented as inert but a panels consumer now reads `
      + 'it. Move it to READ_BY_A_CONSUMER and update the comment in system.ts.',
    ).toEqual([]);
  });
});
