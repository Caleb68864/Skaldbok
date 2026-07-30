import { describe, expect, it } from 'vitest';
import { applySuggestionToDoc } from './SuggestedLinksPanel';
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

describe('textToDoc line-ending handling', () => {
  // A tablet keyboard that sends CRLF used to round-trip a lone \r into the
  // stored body: /\n\s*\n/ only consumed the carriage returns adjacent to a
  // blank line, leaving the rest inside paragraph text.
  it('normalises CRLF without leaving stray carriage returns', () => {
    const doc = textToDoc('first line\r\nsecond line\r\n\r\nnew paragraph');
    expect(docToText(doc)).toBe('first line\nsecond line\n\nnew paragraph');
    expect(JSON.stringify(doc)).not.toContain('\r');
  });

  it('treats a CRLF blank line as a paragraph break', () => {
    const doc = textToDoc('one\r\n\r\ntwo');
    expect(doc.content).toHaveLength(2);
  });
});
