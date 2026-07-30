import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards against a silent handwriting regression on the {@link WritePad}
 * subtree.
 *
 * @remarks
 * `touch-action: none` (or the Tailwind `touch-none` family of utilities)
 * anywhere from `WritePad`'s root down to the app shell disables Android
 * stylus handwriting recognition with no error, no console warning, and no
 * visual change — see
 * `docs/plans/2026-07-30-pen-handwriting-notes-design.md`. The file list
 * below **is** the WritePad ancestor chain as of this writing; extend it
 * whenever a new wrapper component is introduced between `WritePad` and the
 * app root.
 */
const ANCESTOR_CHAIN = [
  'src/components/notes/WritePad.tsx',
  'src/features/session/sessionLog/SessionLog.tsx',
  'src/components/shell/ShellLayout.tsx',
  'src/components/shell/GlobalFAB.tsx',
  'src/screens/ShipsScreen.tsx',
];

const CWD = process.cwd();

function read(path: string): string {
  return readFileSync(join(CWD, path), 'utf8');
}

/**
 * Strips comments so prose *about* the rule (this very test file, or a doc
 * comment referencing `touch-action`) is not mistaken for a breach of it.
 * Not a parser — removes block comments and whole-line `//` / JSDoc lines.
 * Trailing same-line comments survive, an accepted trade-off.
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

const FILES = ANCESTOR_CHAIN.map(path => ({
  path,
  text: stripComments(read(path)),
}));

const TOUCH_ACTION_PATTERN = /touch-action|touchAction|\btouch-(none|pan-x|pan-y|pan-left|pan-right|pan-up|pan-down|pinch-zoom|manipulation|auto)\b/;

describe('WritePad handwriting regression guards', () => {
  it('finds every declared ancestor-chain file', () => {
    // Guards the guard: a missing/renamed file would make the scan vacuous.
    expect(FILES.length).toBe(ANCESTOR_CHAIN.length);
    for (const { text } of FILES) {
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('never sets touch-action anywhere on the WritePad ancestor chain', () => {
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      if (TOUCH_ACTION_PATTERN.test(text)) offenders.push(path);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('renders a real <textarea>, not a contentEditable div', () => {
    // OS handwriting recognition only targets real text fields. If WritePad
    // ever moves to a contentEditable div, this breaks silently too.
    const writePad = stripComments(read('src/components/notes/WritePad.tsx'));
    expect(writePad).toMatch(/<textarea\b/);
    expect(writePad).not.toMatch(/contentEditable/);
  });
});
