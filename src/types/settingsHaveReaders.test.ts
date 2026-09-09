import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Every persisted setting must change something.
 *
 * @remarks
 * `declaredCapabilities.test.ts` makes this promise for the system/engine
 * contract, and `AppSettings` was outside it. Two fields had gone inert:
 *
 * - **`bottomNavTabs`** was a user-visible Settings card — seven ON/OFF
 *   toggles, its own explanatory paragraph — writing a field that `BottomNav`
 *   and `CharacterSubNav` never consulted. It escaped every existing guard for
 *   an instructive reason: the field genuinely *was* read, by the control that
 *   wrote it. A round trip through storage and back to the same checkbox looks
 *   exactly like a working feature from every angle except the user's.
 * - **`showOtherSessionNotes`** had one hit in the entire repository: its own
 *   declaration. No writer, no reader, no default.
 *
 * So the rule here is deliberately narrower than "is it mentioned": a settings
 * field must be read somewhere that is not its declaration, its default, or the
 * screen that writes it. Shipping a control that lies is worse than shipping no
 * control, because the user changes it and then trusts the result.
 */

const SRC = join(process.cwd(), 'src');

/** Files that may only *declare*, *default* or *write* a setting. */
const NON_READERS = [
  'types/settings.ts',
  'features/settings/useAppSettings.ts',
  'screens/SettingsScreen.tsx',
];

/** Fields whose reader is, correctly, the settings plumbing itself. */
const PLUMBING = new Set(['id', 'schemaVersion']);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function stripComments(source: string): string {
  return source
    .split('\n')
    .filter(line => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

/** Field names declared on the `AppSettings` interface. */
function settingsFields(): string[] {
  const source = readFileSync(join(SRC, 'types/settings.ts'), 'utf8');
  const start = source.indexOf('export interface AppSettings');
  expect(start, 'AppSettings interface not found').toBeGreaterThan(-1);
  const end = source.indexOf('\n}', start);
  const body = stripComments(source.slice(start, end));
  return [...body.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\??\s*:/gm)]
    .map(m => m[1])
    .filter(name => !PLUMBING.has(name));
}

/** All of `src` except the declaration, the defaults and the settings screen. */
const consumerSource = sourceFiles(SRC)
  .filter(file => !NON_READERS.includes(relative(SRC, file).split('\\').join('/')))
  .map(file => stripComments(readFileSync(file, 'utf8')))
  .join('\n');

describe('persisted settings have readers', () => {
  const fields = settingsFields();

  it('found the AppSettings fields', () => {
    // The extraction failing open would make every case below pass vacuously.
    expect(fields.length).toBeGreaterThan(8);
    expect(fields).toContain('theme');
  });

  it.each(fields)('%s changes something', name => {
    // A read looks like `settings.name`, `settings['name']`, or destructuring
    // out of the settings object.
    const read =
      new RegExp(`\\.${name}\\b`).test(consumerSource) ||
      new RegExp(`\\['${name}'\\]`).test(consumerSource) ||
      new RegExp(`\\{[^{}\\n]*\\b${name}\\b[^{}\\n]*\\}\\s*[=:)]`).test(consumerSource);

    expect(
      read,
      `AppSettings.${name} is persisted and read by nothing outside ` +
      `${NON_READERS.join(', ')}. If a Settings control writes it, that control ` +
      'currently lies to the user: the value round-trips through IndexedDB and ' +
      'back to the same checkbox and changes nothing else. Wire a consumer, or ' +
      'remove the field and the control together.',
    ).toBe(true);
  });
});
