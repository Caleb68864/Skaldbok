import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Only a screen that really destroys something may say so.
 *
 * @remarks
 * Two delete dialogs in `ReferenceScreen` read *"This cannot be undone."* Both
 * handlers soft-delete — `referenceSectionRepository.remove` writes
 * `deletedAt`/`softDeletedBy`, `referenceNoteRepository.softDelete` likewise —
 * and both types have a working, global Trash listing. The sentence was left
 * over from a genuine historical hard delete that
 * `hardDeleteReachability.test.ts` records as *fixed*: the repository was
 * corrected and the copy was not.
 *
 * It is worth a guard rather than just a fix, because the failure is one-way in
 * the direction that matters. This is a local-first app with no server copy, so
 * a user who believes a delete is permanent behaves differently — they keep a
 * second copy, or they do not press the button. Telling them recovery is
 * impossible when it is not is a smaller harm than the reverse, and still a
 * false statement in a dialog whose whole job is to describe consequences. The
 * app already says the true thing in `BestiaryScreen` and
 * `CharacterLibraryScreen`, which is what makes the two outliers a copy bug and
 * not a house tone.
 *
 * The rule is an allowlist because it has to be: the phrase is *correct* on
 * "Clear All Data", and that is the one place in the app where it is.
 */

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = sourceFiles(SRC).map(path => ({
  path: relative(SRC, path).split('\\').join('/'),
  source: readFileSync(path, 'utf8'),
}));

/** Phrasings that promise a user their data is gone for good. */
const IRREVERSIBILITY_CLAIMS = [
  /cannot be undone/i,
  /can(?:'|’)?t be undone/i,
  /permanently delete/i,
  /gone forever/i,
];

/**
 * Screens allowed to make the claim, and why it is true there.
 *
 * @remarks
 * Adding an entry asserts that the handler behind the copy really does destroy
 * user content with no Trash entry. That is the same weight as adding a name to
 * `hardDeleteReachability`'s `DOMAIN_HARD_DELETES`, and should be as rare.
 */
const TRULY_IRREVERSIBLE: Record<string, string> = {
  'screens/SettingsScreen.tsx':
    '"Clear All Data" clears every Dexie table in one transaction, Trash included. '
    + 'There is no backend and no snapshot, so this really is the end of the data — '
    + 'it is the one place in the app where the sentence is the truth.',
};

describe('a dialog may only claim irreversibility when it is telling the truth', () => {
  it('finds the copy it is meant to scan', () => {
    // Without this, a refactor that moved every dialog into a component library
    // would make the case below vacuous and silent.
    const claiming = files.filter(f => IRREVERSIBILITY_CLAIMS.some(re => re.test(f.source)));
    expect(claiming.length).toBeGreaterThan(0);
  });

  it.each(files.filter(f => IRREVERSIBILITY_CLAIMS.some(re => re.test(f.source))).map(f => f.path))(
    '%s is a screen where that is true',
    path => {
      expect(
        TRULY_IRREVERSIBLE[path],
        `${path} tells the user an action cannot be undone. Every user-facing delete `
        + 'in this app is a soft delete with a Trash listing, so that sentence is `'
        + 'almost always false — it was false in two ReferenceScreen dialogs, left '
        + 'behind when a real hard delete was fixed and the copy was not. Either the '
        + 'handler genuinely destroys data with no way back, in which case add this '
        + 'file to TRULY_IRREVERSIBLE with the reason, or the copy is wrong: say '
        + '"It moves to the Trash, where it can be restored."',
      ).toBeDefined();
    },
  );

  it('every allowlisted screen still makes the claim', () => {
    // An exemption for copy that no longer exists excuses nothing and is how an
    // allowlist stops meaning anything — the same self-check the capability
    // guard's two lists carry.
    for (const [path, reason] of Object.entries(TRULY_IRREVERSIBLE)) {
      const file = files.find(f => f.path === path);
      expect(file, `TRULY_IRREVERSIBLE names ${path}, which does not exist`).toBeDefined();
      expect(
        IRREVERSIBILITY_CLAIMS.some(re => re.test(file!.source)),
        `TRULY_IRREVERSIBLE exempts ${path} ("${reason}") but it no longer claims `
        + 'irreversibility anywhere — drop the entry.',
      ).toBe(true);
    }
  });
});
