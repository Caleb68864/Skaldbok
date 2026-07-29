import { describe, expect, it } from 'vitest';
import { applySuggestionToBody, applySuggestionToDoc } from './SuggestedLinksPanel';
import { docToText, textToDoc, type ProseMirrorNode } from './textToDoc';
import type { LinkScanSuggestion } from './linkScanner';

function suggestion(matchedText: string, entityId: string, entityType: 'creature' | 'note'): LinkScanSuggestion {
  return {
    matchedText,
    target: { entityId, entityType },
    confidence: 'exact',
    isMissingRecord: false,
    key: `${entityType}:${entityId}:${matchedText.toLowerCase()}`,
  };
}

describe('applySuggestionToBody', () => {
  it('wraps the matched span in a wikiLink node', () => {
    const doc = applySuggestionToBody('We met Ostrand at the docks.', suggestion('Ostrand', 'c1', 'creature'));
    expect(docToText(doc)).toBe('We met [[Ostrand]] at the docks.');
  });

  // Two dictionary entries can share a name — a note titled after an NPC plus
  // that NPC's creature template. They produce distinct suggestion keys but
  // identical matchedText, so both reach the panel. Applying both used to
  // corrupt the body to [[[[Name]]]], because \bName\b matches inside an
  // already-inserted [[Name]] ([ and ] are non-word characters).
  // Reachable via Approve-all AND via two sequential single-row approvals.
  it('does not double-wrap when two suggestions share the same matched text', () => {
    const first = applySuggestionToBody(
      'We met Elara Ostrand at the tavern.',
      suggestion('Elara Ostrand', 'creature-1', 'creature'),
    );
    const second = applySuggestionToBody(
      docToText(first),
      suggestion('Elara Ostrand', 'note-1', 'note'),
    );

    const text = docToText(second);
    expect(text).toBe('We met [[Elara Ostrand]] at the tavern.');
    expect(text).not.toContain('[[[[');
    expect(text).not.toContain(']]]]');
  });

  it('leaves the body unchanged when the text is not present', () => {
    const doc = applySuggestionToBody('Nothing to see here.', suggestion('Ostrand', 'c1', 'creature'));
    expect(docToText(doc)).toBe('Nothing to see here.');
  });
});

/** Collects every wikiLink node in document order. */
function wikiLinks(node: ProseMirrorNode): Array<{ label: unknown; id: unknown }> {
  if (node.type === 'wikiLink') return [{ label: node.attrs?.label, id: node.attrs?.id }];
  return (node.content ?? []).flatMap(wikiLinks);
}

describe('applySuggestionToDoc', () => {
  it('wraps the matched span in a wikiLink node carrying the id', () => {
    const doc = applySuggestionToDoc(
      textToDoc('We met Ostrand at the docks.'),
      suggestion('Ostrand', 'c1', 'creature'),
    );
    expect(docToText(doc)).toBe('We met [[Ostrand]] at the docks.');
    expect(wikiLinks(doc)).toEqual([{ label: 'Ostrand', id: 'c1' }]);
  });

  // The regression this function exists for. The text-based variant cannot be
  // chained: docToText renders a wikiLink back to a bare [[label]] and
  // textToDoc re-parses it with attrs.id = null, so approving a second
  // suggestion silently unresolved the first. "Approve all" kept an id only
  // for whichever link it handled last.
  it('preserves the ids of previously applied suggestions', () => {
    let doc = textToDoc('Ostrand met Vasquez at the docks.');
    doc = applySuggestionToDoc(doc, suggestion('Ostrand', 'c1', 'creature'));
    doc = applySuggestionToDoc(doc, suggestion('Vasquez', 'n2', 'note'));

    expect(docToText(doc)).toBe('[[Ostrand]] met [[Vasquez]] at the docks.');
    expect(wikiLinks(doc)).toEqual([
      { label: 'Ostrand', id: 'c1' },
      { label: 'Vasquez', id: 'n2' },
    ]);
  });

  // Structural application makes the double-wrap class unreachable: an applied
  // link is a wikiLink atom, not the characters [[…]], so a later suggestion
  // whose matchedText is a substring of it has no text node to match against.
  it('cannot double-wrap or nest a link inside an existing one', () => {
    let doc = textToDoc('We met Sir Aldric at the gate.');
    doc = applySuggestionToDoc(doc, suggestion('Sir Aldric', 'c1', 'creature'));
    doc = applySuggestionToDoc(doc, suggestion('Aldric', 'c2', 'creature'));

    const text = docToText(doc);
    expect(text).toBe('We met [[Sir Aldric]] at the gate.');
    expect(text).not.toContain('[[[[');
    expect(wikiLinks(doc)).toEqual([{ label: 'Sir Aldric', id: 'c1' }]);
  });

  it('replaces only the first occurrence', () => {
    const doc = applySuggestionToDoc(
      textToDoc('Ostrand spoke, then Ostrand left.'),
      suggestion('Ostrand', 'c1', 'creature'),
    );
    expect(docToText(doc)).toBe('[[Ostrand]] spoke, then Ostrand left.');
  });

  it('leaves the doc unchanged when the text is not present', () => {
    const before = textToDoc('Nothing to see here.');
    const after = applySuggestionToDoc(before, suggestion('Ostrand', 'c1', 'creature'));
    expect(after).toBe(before);
  });

  it('applies across paragraphs', () => {
    const doc = applySuggestionToDoc(
      textToDoc('First line.\n\nThen Ostrand arrived.'),
      suggestion('Ostrand', 'c1', 'creature'),
    );
    expect(docToText(doc)).toBe('First line.\n\nThen [[Ostrand]] arrived.');
    expect(wikiLinks(doc)).toEqual([{ label: 'Ostrand', id: 'c1' }]);
  });
});
