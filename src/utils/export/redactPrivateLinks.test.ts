import { describe, it, expect } from 'vitest';
import { PRIVATE_LINK_TEXT, privateLinkTargets, redactPrivateLinks } from './redactPrivateLinks';

const doc = (...inline: unknown[]) => ({ type: 'doc', content: [{ type: 'paragraph', content: inline }] });

describe('redactPrivateLinks (S25)', () => {
  const targets = privateLinkTargets([{ id: 'p1', title: 'Secret Lair' }]);

  it('replaces a wikilink or mention to a private note, by id', () => {
    const out = redactPrivateLinks(doc(
      { type: 'wikiLink', attrs: { id: 'p1', label: 'Secret Lair' } },
      { type: 'mention', attrs: { id: 'p1', label: 'Secret Lair' } },
    ), targets);
    expect(JSON.stringify(out)).not.toContain('p1');
    expect(JSON.stringify(out)).not.toContain('Secret Lair');
    expect(JSON.stringify(out).split(PRIVATE_LINK_TEXT)).toHaveLength(3);
  });

  it('replaces an unresolved link by its label, case-insensitively', () => {
    const out = redactPrivateLinks(doc({ type: 'wikiLink', attrs: { id: 'unresolved', label: ' secret lair ' } }), targets);
    expect(JSON.stringify(out)).toContain(PRIVATE_LINK_TEXT);
  });

  it('leaves the prose and other links alone, and returns the same object when nothing matched', () => {
    const input = doc(
      { type: 'text', text: 'Secret Lair is typed here' },
      { type: 'wikiLink', attrs: { id: 'pub', label: 'Harbour' } },
    );
    expect(redactPrivateLinks(input, targets)).toBe(input);
  });

  it('does not match by title when a shared note has the same title', () => {
    const t = privateLinkTargets([{ id: 'p1', title: 'Harbour' }], [{ title: 'Harbour' }]);
    const input = doc({ type: 'wikiLink', attrs: { id: 'unresolved', label: 'Harbour' } });
    expect(redactPrivateLinks(input, t)).toBe(input);
    // By id it still matches.
    expect(JSON.stringify(redactPrivateLinks(doc({ type: 'wikiLink', attrs: { id: 'p1', label: 'Harbour' } }), t)))
      .toContain(PRIVATE_LINK_TEXT);
  });

  it('passes non-documents through', () => {
    expect(redactPrivateLinks(null, targets)).toBeNull();
    expect(redactPrivateLinks('text', targets)).toBe('text');
  });
});
