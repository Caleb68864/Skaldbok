import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Guards the engine-vocabulary rule against literal ruleset nouns creeping back
 * into shared UI.
 *
 * @remarks
 * CLAUDE.md's rule is "if a value differs between rulesets, it comes from the
 * engine", and `SystemLabels` exists precisely so a Traveller encounter does not
 * say "HP". The rule was still broken in three places at once — the combat
 * view's session-log line, its participant chip, and two participant-creation
 * forms — while `ParticipantDrawer`, opened from that very list, already read
 * `engine.labels`. Nothing failed, because a hardcoded noun is not a type error.
 *
 * Deliberately narrow. It scans only the surfaces that render *a character's or
 * creature's health*, and only for standalone health nouns. A broader sweep
 * would drown in false positives (comments, CSS class names, Dragonbane's own
 * adapter, which is entitled to say HP) and get suppressed rather than fixed.
 */

const SCAN_DIRS = ['src/features/encounters', 'src/features/playDashboard'];

/** Files entitled to say a ruleset's own words. */
const ALLOWED = [
  // Adapters state their own ruleset's vocabulary — that is their job.
  'engine/',
  // Fallback defaults live next to the prop that overrides them.
  'QuickCreateParticipantFlow.tsx',
];

/**
 * Standalone health nouns in user-visible positions: JSX text and string
 * literals. Requires a word boundary so `currentHp`, `maxHp`, `hpMax` and
 * `stats.hp` — field names, which are deliberately fixed — do not match.
 */
const BANNED = /(?<![\w.])(HP|Hit Points)(?![\w])/;

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** Strips comments and imports, which are not user-visible. */
function userVisible(source: string): string[] {
  return source
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('import ')
      );
    });
}

describe('engine vocabulary is not hardcoded in shared UI', () => {
  const files = SCAN_DIRS.flatMap(dir => walk(dir)).filter(
    file => !ALLOWED.some(allowed => file.includes(allowed)),
  );

  it('scans a non-trivial number of files', () => {
    // A broken glob silently passing is the failure mode of a lint-style test.
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)('%s uses engine.labels rather than a literal health noun', file => {
    const offenders = userVisible(readFileSync(file, 'utf8'))
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(entry => BANNED.test(entry.line));

    expect(
      offenders,
      `${relative(process.cwd(), file)} hardcodes a health noun. Read it from ` +
        `engine.labels (participantHealth / creatureHealth) so a Traveller ` +
        `encounter says END:\n` +
        offenders.map(o => `  line ${o.number}: ${o.line}`).join('\n'),
    ).toEqual([]);
  });
});
