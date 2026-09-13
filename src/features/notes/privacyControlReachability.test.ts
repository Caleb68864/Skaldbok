import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The privacy flag must stay reachable from the UI.
 *
 * @remarks
 * This is the guard for the bug it was written after, which was not a wrong
 * behaviour but a missing door. `Note.visibility` was honoured perfectly by the
 * export — the filter derived its exclusion set from it, the serializer scanned
 * the finished bytes for residue and refused rather than delivered, and
 * `privacyBoundary.test.ts` proved all of that over a seeded fixture. Every one
 * of those tests passed while no screen in the app could set the field and every
 * creation path defaulted it to `'public'`. A promise nobody can invoke is
 * indistinguishable from an absent one, and no behavioural test can see the
 * difference, because there is nothing to drive.
 *
 * So the check is structural, in the style of this repository's other
 * convention tests (`importReachability`, `declaredCapabilities`,
 * `engineConsumers`): does a control exist, and is it on every screen that
 * shows a note as a note?
 *
 * The second half matters as much as the first. `NoteEditorScreen` and
 * `NoteReader` are two doors onto the same row. A toggle on one of them is how
 * a note ends up private in the place someone last looked and public in the
 * place the export reads.
 */

const SRC = join(process.cwd(), 'src');

function read(...parts: string[]): string {
  return readFileSync(join(SRC, ...parts), 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Every non-test source file, as `path → source`. */
const sources = walk(SRC).map(path => ({
  path: relative(SRC, path).split('\\').join('/'),
  source: readFileSync(path, 'utf8'),
}));

describe('the privacy control is reachable', () => {
  it('finds the files it is about', () => {
    // Guards the guard: renaming any of these must fail loudly here rather than
    // making every case below vacuous.
    expect(sources.length).toBeGreaterThan(100);
    expect(() => read('features', 'notes', 'NotePrivacy.tsx')).not.toThrow();
    expect(() => read('screens', 'NoteEditorScreen.tsx')).not.toThrow();
    expect(() => read('features', 'kb', 'NoteReader.tsx')).not.toThrow();
  });

  it('offers the toggle in the note editor', () => {
    expect(
      read('screens', 'NoteEditorScreen.tsx'),
      'NoteEditorScreen no longer renders NotePrivacyToggle. `visibility` is then '
      + 'unsettable from the screen where notes are written, which is how it came '
      + 'to be unsettable everywhere.',
    ).toContain('<NotePrivacyToggle');
  });

  it('offers the same toggle in the Knowledge Base reader', () => {
    expect(
      read('features', 'kb', 'NoteReader.tsx'),
      'NoteReader no longer renders NotePrivacyToggle. It and NoteEditorScreen are '
      + 'two doors onto one note; a control on only one of them lets the state a '
      + 'person believes they set disagree with the state the export reads.',
    ).toContain('<NotePrivacyToggle');
  });

  it('uses one shared control rather than a toggle per screen', () => {
    // The rule this encodes: exactly one module in the UI layer writes
    // `visibility`. Two independently-written toggles is how two screens end up
    // disagreeing about what "private" means, and avoiding that is the whole
    // reason the control is a component rather than a snippet.
    //
    // Scoped to the UI layer on purpose. `storage/noteCreationService` writes
    // the `'public'` default, and the export modules name the literal in prose;
    // neither is a second control. Comments are stripped first so a doc comment
    // quoting the field cannot register as a writer.
    const uiLayer = sources.filter(
      f => /^(screens|components|features)\//.test(f.path)
        && f.path !== 'features/notes/NotePrivacy.tsx',
    );
    const writers = uiLayer.filter(f => {
      const code = f.source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      return /visibility:\s*(?:next|['"](?:private|public)['"])/.test(code);
    });
    expect(
      writers.map(f => f.path),
      'Something outside NotePrivacy.tsx writes visibility directly. Render '
      + '<NotePrivacyToggle> instead, so there is one write and one vocabulary.',
    ).toEqual([]);
  });

  it('marks a private note in the list, not only inside it', () => {
    expect(
      read('features', 'kb', 'VaultCard.tsx'),
      'VaultCard no longer renders PrivateBadge. VaultBrowser is the note list on '
      + 'both /kb and the session screen, so without it the only way to learn what '
      + 'an export will leave out is to open every note.',
    ).toContain('<PrivateBadge');
  });

  it('resolves the private set for the whole list rather than per card', () => {
    const browser = read('features', 'kb', 'VaultBrowser.tsx');
    expect(browser).toContain('getPrivateNoteIds');
    expect(browser).toContain('isPrivate=');
  });

  it('says how many notes the export checkbox is deciding about', () => {
    expect(
      read('components', 'shell', 'CampaignHeader.tsx'),
      'The export sheet no longer counts the private notes. "Include private '
      + 'notes" without a count is a switch whose subject the user cannot see at '
      + 'the moment they are choosing whether to hand the file to someone.',
    ).toContain('getPrivateNoteIds');
  });
});
