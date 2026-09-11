import { describe, expect, it } from 'vitest';
import {
  applyPrivacyFilter,
  excludePrivateNotes,
  privateNoteIdsIn,
  privateResidueIn,
} from './privacyFilter';
import { BUNDLE_TABLE_ENTRIES } from '../../types/bundleTables';
import type { BundleContents } from '../../types/bundle';

/**
 * The confidentiality boundary for every export path.
 *
 * @remarks
 * This decides whether a note the user marked private leaves the device. Its
 * failure mode is silent and one-directional: a leaked note produces a bundle
 * that looks entirely normal, and the user finds out when someone else reads it.
 * That asymmetry is why these tests lean on the *keep nothing by accident* side.
 *
 * Every case below that names a table by hand is an *example*. The case that
 * makes the guarantee is `every bundle table is inside the boundary`, which
 * walks `BUNDLE_TABLE_ENTRIES` — because the defect this file was rewritten for
 * was precisely a table nobody remembered to name. The filter spread
 * `...contents` and overrode three keys, so `kbNodes` and `kbEdges` — added to
 * the bundle years later, and holding a projection whose `label` *is* the note's
 * title — shipped a private note's title and its entire edge set in a bundle the
 * user was told excluded it.
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

  it('drops the knowledge-base projection of a private note, and its edges', () => {
    // The reproduction. `kb_nodes.label` *is* the note's title and `sourceId`
    // *is* its id; `kb_edges` are one row per wiki-link, mention and tag the
    // note carries. Title plus edge set is enough to reconstruct who a character
    // secretly is or which faction a location belongs to, so "only the body was
    // withheld" was never a defence.
    const input = contents({
      notes: [note('note-secret', 'private'), note('note-open', 'public')],
      kbNodes: [
        { id: 'note-note-secret', label: 'Lady Sable is the Hierophant', sourceId: 'note-secret' },
        { id: 'note-note-open', label: 'The Harbour Inn', sourceId: 'note-open' },
        { id: 'tag:c:crimson hand', label: 'The Crimson Hand' },
      ],
      kbEdges: [
        { id: 'e-faction', fromId: 'note-note-secret', toId: 'tag:c:crimson hand' },
        { id: 'e-inn', fromId: 'note-note-secret', toId: 'note-note-open' },
        { id: 'e-open', fromId: 'note-note-open', toId: 'tag:c:crimson hand' },
      ],
    } as unknown as Partial<BundleContents>);

    const result = applyPrivacyFilter(input, false);
    // The node goes because it names the note; the edges go because they name
    // the node — two hops, neither of them enumerated anywhere.
    expect(result.kbNodes?.map(n => n.id)).toEqual(['note-note-open', 'tag:c:crimson hand']);
    expect(result.kbEdges?.map(e => e.id)).toEqual(['e-open']);
    expect(JSON.stringify(result)).not.toContain('Lady Sable');
  });

  it('every bundle table is inside the boundary', () => {
    // Derived from the registry, not restated. A table added to
    // `BUNDLE_TABLE_ENTRIES` joins this case with nothing to remember — which is
    // the property the previous filter lacked, and the reason `kbNodes` and
    // `kbEdges` were outside the boundary for as long as they were in the bundle.
    //
    // `campaign` is the one key that is a single object rather than an array,
    // and a campaign row cannot be a note nor reference one.
    const keys = BUNDLE_TABLE_ENTRIES.map(([key]) => key).filter(k => k !== 'campaign');
    expect(keys.length).toBeGreaterThan(20);

    const seeded: Record<string, unknown[]> = {
      notes: [note('secret', 'private'), note('open', 'public')],
    };
    for (const key of keys) {
      if (key === 'notes') continue;
      seeded[key] = [
        { id: `drop-${key}`, noteId: 'secret' },
        { id: `keep-${key}`, noteId: 'open' },
      ];
    }

    const result = applyPrivacyFilter(seeded as unknown as BundleContents, false) as unknown as
      Record<string, Array<{ id: string }>>;

    const leaked: string[] = [];
    const overFiltered: string[] = [];
    for (const key of keys) {
      if (key === 'notes') continue;
      const ids = result[key].map(r => r.id);
      if (ids.includes(`drop-${key}`)) leaked.push(key);
      // The control. A rule that deletes everything keeps no promise either, and
      // over-filtering is invisible in its own way — the user gets a backup that
      // silently restores less than it should.
      if (!ids.includes(`keep-${key}`)) overFiltered.push(key);
    }
    expect(leaked).toEqual([]);
    expect(overFiltered).toEqual([]);
    expect(result.notes.map(n => n.id)).toEqual(['open']);
  });

  it('follows a reference chain of any length', () => {
    // Not two hops because two is what `kbNodes`/`kbEdges` happened to need.
    // Exclusion follows references outward until it stops finding any, so a
    // future table that references a table that references a note is covered.
    const input = {
      notes: [note('n-secret', 'private')],
      kbNodes: [{ id: 'k1', sourceId: 'n-secret' }],
      kbEdges: [{ id: 'k2', fromId: 'k1' }],
      attachments: [{ id: 'k3', noteId: 'k2' }],
      entityLinks: [{ id: 'k4', fromEntityId: 'k3' }],
    } as unknown as BundleContents;
    const result = applyPrivacyFilter(input, false) as unknown as Record<string, unknown[]>;
    for (const key of ['notes', 'kbNodes', 'kbEdges', 'attachments', 'entityLinks']) {
      expect([key, result[key].length]).toEqual([key, 0]);
    }
  });
});

describe('privateNoteIdsIn', () => {
  it('names only explicitly private notes', () => {
    const input = contents({ notes: [note('a', 'private'), note('b', 'public'), note('c')] });
    expect([...privateNoteIdsIn(input)]).toEqual(['a']);
  });

  it('is empty for a bundle with no notes at all', () => {
    expect([...privateNoteIdsIn({} as BundleContents)]).toEqual([]);
  });
});

describe('privateResidueIn', () => {
  /**
   * The assertion half of the boundary: stated over the finished text rather
   * than over the filter's own bookkeeping.
   *
   * @remarks
   * A filter that misses a table leaks silently. A scan of the serialized
   * bundle cannot miss a table, because it does not know what a table is — so
   * this is what makes the guarantee hold for the next table, the next nested
   * id, and the shape nobody anticipated.
   */
  it('names a private id that survived anywhere in the text', () => {
    const json = JSON.stringify({ contents: { somethingNew: [{ ref: 'note-secret' }] } });
    expect(privateResidueIn(json, new Set(['note-secret', 'note-other']))).toEqual(['note-secret']);
  });

  it('reports nothing for a clean bundle', () => {
    const json = JSON.stringify({ contents: { notes: [{ id: 'note-open' }] } });
    expect(privateResidueIn(json, new Set(['note-secret']))).toEqual([]);
  });

  it('says nothing when no note was private', () => {
    expect(privateResidueIn('{"anything":"at all"}', new Set())).toEqual([]);
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
