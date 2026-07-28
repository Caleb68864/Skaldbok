import { describe, expect, it } from 'vitest';
import { applySuggestionToBody } from './SuggestedLinksPanel';
import { docToText } from './textToDoc';
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
