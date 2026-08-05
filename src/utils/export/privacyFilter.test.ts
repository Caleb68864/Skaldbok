import { describe, expect, it } from 'vitest';
import { applyPrivacyFilter, excludePrivateNotes } from './privacyFilter';
import type { BundleContents } from '../../types/bundle';

/**
 * The confidentiality boundary for every export path.
 *
 * @remarks
 * This decides whether a note the user marked private leaves the device. Its
 * failure mode is silent and one-directional: a leaked note produces a bundle
 * that looks entirely normal, and the user finds out when someone else reads it.
 * That asymmetry is why these tests lean on the *keep nothing by accident* side.
 */

const note = (id: string, visibility?: string) =>
  ({ id, title: id, visibility }) as unknown as NonNullable<BundleContents['notes']>[number];

const link = (
  id: string,
  fromEntityId: string,
  fromEntityType: string,
  toEntityId: string,
  toEntityType: string,
) =>
  ({ id, fromEntityId, fromEntityType, toEntityId, toEntityType, relationshipType: 'contains' }) as
    unknown as NonNullable<BundleContents['entityLinks']>[number];

const attachment = (id: string, noteId?: string) =>
  ({ id, filename: `${id}.jpg`, noteId }) as unknown as NonNullable<
    BundleContents['attachments']
  >[number];

function contents(overrides: Partial<BundleContents> = {}): BundleContents {
  return { notes: [], entityLinks: [], attachments: [], ...overrides } as BundleContents;
}

describe('applyPrivacyFilter', () => {
  it('keeps everything when includePrivate is set', () => {
    const input = contents({ notes: [note('n1', 'private'), note('n2', 'public')] });
    expect(applyPrivacyFilter(input, true).notes).toHaveLength(2);
  });

  it('drops a note explicitly marked private', () => {
    const input = contents({ notes: [note('n1', 'private'), note('n2', 'public')] });
    expect(applyPrivacyFilter(input, false).notes?.map(n => n.id)).toEqual(['n2']);
  });

  it('keeps legacy notes with no visibility field', () => {
    // Absent visibility means "written before the field existed", not "private".
    // Treating it as private would silently gut every old campaign's export.
    const input = contents({ notes: [note('n1'), note('n2', 'public')] });
    expect(applyPrivacyFilter(input, false).notes?.map(n => n.id)).toEqual(['n1', 'n2']);
  });

  it('drops entity links pointing at a private note in either direction', () => {
    const input = contents({
      notes: [note('secret', 'private'), note('open', 'public')],
      entityLinks: [
        link('l1', 'session1', 'session', 'secret', 'note'),
        link('l2', 'secret', 'note', 'session1', 'session'),
        link('l3', 'session1', 'session', 'open', 'note'),
      ],
    });
    expect(applyPrivacyFilter(input, false).entityLinks?.map(l => l.id)).toEqual(['l3']);
  });

  it('does not drop a link whose endpoint merely shares an id with a private note', () => {
    // Ids are only unique within a type. A character and a note could carry the
    // same id, and matching on id alone would silently delete unrelated edges —
    // over-filtering, which is invisible in a different way than leaking.
    const input = contents({
      notes: [note('shared-id', 'private')],
      entityLinks: [
        // Both directions: the type guard exists twice and each copy has to be
        // exercised. Testing only the `to` side let a mutation that dropped the
        // `from` side's check pass unnoticed.
        link('l1', 'session1', 'session', 'shared-id', 'character'),
        link('l2', 'shared-id', 'character', 'session1', 'session'),
      ],
    });
    expect(applyPrivacyFilter(input, false).entityLinks?.map(l => l.id)).toEqual(['l1', 'l2']);
  });

  it('drops attachments belonging to a private note', () => {
    const input = contents({
      notes: [note('secret', 'private'), note('open', 'public')],
      attachments: [attachment('a1', 'secret'), attachment('a2', 'open')],
    });
    expect(applyPrivacyFilter(input, false).attachments?.map(a => a.id)).toEqual(['a2']);
  });

  it('keeps attachments that belong to no note', () => {
    const input = contents({
      notes: [note('secret', 'private')],
      attachments: [attachment('a1', undefined)],
    });
    expect(applyPrivacyFilter(input, false).attachments?.map(a => a.id)).toEqual(['a1']);
  });

  it('leaves collections that cannot reference a note untouched', () => {
    const sessions = [{ id: 's1' }] as unknown as BundleContents['sessions'];
    const input = contents({ notes: [note('n1', 'private')], sessions });
    expect(applyPrivacyFilter(input, false).sessions).toEqual(sessions);
  });

  it('never mutates its input', () => {
    // The docstring promises this, and the collectors reuse `contents` across
    // the campaign/session/character export paths.
    const input = contents({
      notes: [note('secret', 'private'), note('open', 'public')],
      entityLinks: [link('l1', 'session1', 'session', 'secret', 'note')],
      attachments: [attachment('a1', 'secret')],
    });
    const before = JSON.parse(JSON.stringify(input));
    applyPrivacyFilter(input, false);
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
  });

  it('tolerates absent collections', () => {
    const input = { notes: [note('n1', 'private')] } as BundleContents;
    const result = applyPrivacyFilter(input, false);
    expect(result.notes).toEqual([]);
    expect(result.entityLinks ?? []).toEqual([]);
    expect(result.attachments ?? []).toEqual([]);
  });

  it('leaves a bundle with no private notes alone', () => {
    const input = contents({ notes: [note('n1', 'public'), note('n2')] });
    expect(applyPrivacyFilter(input, false).notes).toHaveLength(2);
  });
});

describe('excludePrivateNotes', () => {
  it('matches applyPrivacyFilter on which notes count as private', () => {
    // The Markdown/ZIP paths cannot build a BundleContents, so they use this
    // instead. The two must agree — a note private in one export format and
    // public in another is the same leak with extra steps.
    const notes = [note('a', 'private'), note('b', 'public'), note('c')];
    const viaBundle = applyPrivacyFilter(contents({ notes }), false).notes?.map(n => n.id);
    expect(excludePrivateNotes(notes).map(n => n.id)).toEqual(viaBundle);
  });

  it('keeps private notes when includePrivate is set', () => {
    const notes = [note('a', 'private'), note('b', 'public')];
    expect(excludePrivateNotes(notes, true)).toHaveLength(2);
  });

  it('defaults to excluding when the flag is omitted', () => {
    // The default matters: every caller that forgets the second argument must
    // get the safe behaviour, not the sharing-everything one.
    expect(excludePrivateNotes([note('a', 'private')])).toEqual([]);
  });
});
