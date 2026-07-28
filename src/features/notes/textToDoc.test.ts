import { describe, expect, it } from 'vitest';
import { docToText, textToDoc } from './textToDoc';

describe('textToDoc', () => {
  it('returns a doc node, never a string', () => {
    const doc = textToDoc('x') as { type: string };
    expect(typeof doc).toBe('object');
    expect(doc.type).toBe('doc');
  });

  it('splits blank lines into separate paragraphs', () => {
    const doc = textToDoc('first\n\nsecond') as { content: Array<{ type: string }> };
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0].type).toBe('paragraph');
    expect(doc.content[1].type).toBe('paragraph');
  });

  it('parses [[label]] spans into wikiLink atom nodes', () => {
    const doc = textToDoc('a [[Ostrand]] b') as {
      content: Array<{ content: Array<{ type: string; attrs?: { id: unknown; label: string } }> }>;
    };
    const inline = doc.content[0].content;
    const wikiLink = inline.find(n => n.type === 'wikiLink');
    expect(wikiLink).toBeDefined();
    expect(wikiLink?.attrs).toEqual({ id: null, label: 'Ostrand' });
  });

  // ProseMirror rejects zero-length text nodes, so an empty commit must still
  // produce a structurally valid doc rather than a paragraph containing an
  // empty text node.
  it('returns a doc with a single empty paragraph for empty input', () => {
    const doc = textToDoc('') as { type: string; content: Array<{ type: string; content?: unknown[] }> };
    expect(doc.type).toBe('doc');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe('paragraph');
    expect(doc.content[0].content ?? []).toHaveLength(0);
  });

  it('treats unmatched brackets as literal text, not a malformed wikiLink', () => {
    const doc = textToDoc('a [[ b') as {
      content: Array<{ content: Array<{ type: string; text?: string }> }>;
    };
    const inline = doc.content[0].content;
    expect(inline.every(n => n.type === 'text')).toBe(true);
    expect(inline.map(n => n.text).join('')).toBe('a [[ b');
  });
});

describe('docToText', () => {
  it('round-trips plain text with a wikilink', () => {
    const text = 'a [[Ostrand]] b';
    expect(docToText(textToDoc(text))).toBe(text);
  });

  it('round-trips multi-paragraph text', () => {
    const text = 'first\n\nsecond';
    expect(docToText(textToDoc(text))).toBe(text);
  });

  it('round-trips simple text', () => {
    expect(docToText(textToDoc('x'))).toBe('x');
  });
});
