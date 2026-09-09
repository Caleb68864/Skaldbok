import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PANEL_KEYS } from './system';

/**
 * Which `PANEL_KEYS` a consumer of `engine.panels` actually asks about.
 *
 * @remarks
 * Seventeen keys are declared and every adapter lists most of them. Exactly two
 * production sites read `engine.panels`: `sheetPanelAvailability`
 * (`features/systems/panelOrder.ts`), which asks about eight, and
 * `CombatModule`, which asks about one of those same eight. Five keys —
 * `skills`, `inventory`, `combat`, `notes`, `bennies` — are declared by every
 * adapter and read by nothing at all, so adding or removing one from an
 * adapter's `panels` array changes nothing. `bennies` is the sharpest case:
 * `BenniesModule` exists and is registered, but which cards render is decided by
 * `sheet.json` card keys, not by this array.
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

  it('has a reader for every key it claims is read', () => {
    const source = panelsReaders().map((f) => readFileSync(f, 'utf8')).join('\n');
    const unread = READ_BY_A_CONSUMER.filter((key) => !source.includes(`'${key}'`));
    expect(
      unread,
      `${unread.join(', ')} is listed as read by a panels consumer but no consumer `
      + 'names it. Move it to DECLARED_BUT_INERT, or restore its reader.',
    ).toEqual([]);
  });

  it('has no reader for any key it claims is inert', () => {
    // The half that rots: a key gains a reader, nobody moves it, and the next
    // reader of this file is told it does nothing when it now does.
    const source = panelsReaders().map((f) => readFileSync(f, 'utf8')).join('\n');
    const nowRead = DECLARED_BUT_INERT.filter((key) => source.includes(`'${key}'`));
    expect(
      nowRead,
      `${nowRead.join(', ')} is documented as inert but a panels consumer now reads `
      + 'it. Move it to READ_BY_A_CONSUMER and update the comment in system.ts.',
    ).toEqual([]);
  });
});
