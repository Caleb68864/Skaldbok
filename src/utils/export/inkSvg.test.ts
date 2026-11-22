import { describe, it, expect } from 'vitest';
import { inkPageToSvg } from './inkSvg';
import { renderNoteToMarkdown } from './renderNote';
import type { Note } from '../../types/note';

const page = (strokes: unknown[]) => ({ ink: { version: 1, pageHeight: 50, strokes } });

describe('inkPageToSvg', () => {
  it('draws each stroke the way the pad does', () => {
    const svg = inkPageToSvg(page([
      { tool: 'pen', color: '#112233', width: 3, points: [[1, 2, 0.5], [10, 20, 0.5]] },
      { tool: 'highlighter', color: '#ffee00', width: 12, points: [[5, 5, 0.5], [40, 5, 0.5]] },
      { tool: 'eraser', color: '#000000', width: 8, points: [[10, 20, 0.5]] },
    ]))!;
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('d="M1 2 L10 20" fill="none" stroke="#112233" stroke-width="3"');
    expect(svg).toContain('stroke="#ffee00" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.35"');
    // The eraser paints white, and a single tap is a dot.
    expect(svg).toContain('d="M10 20 L10.01 20.01" fill="none" stroke="#ffffff"');
    expect(svg).toContain('height="50"');
  });

  it('is null for a note with no handwriting, or only malformed strokes', () => {
    expect(inkPageToSvg({})).toBeNull();
    expect(inkPageToSvg(null)).toBeNull();
    expect(inkPageToSvg(page([{ tool: 'pen', points: [] }]))).toBeNull();
  });

  it('cannot be broken out of by a colour string', () => {
    const svg = inkPageToSvg(page([{ tool: 'pen', color: '"/><script>x</script>', width: 1, points: [[0, 0, 1]] }]))!;
    expect(svg).not.toContain('<script>');
  });
});

describe('renderNoteToMarkdown with handwriting', () => {
  const note = {
    id: 'n1', campaignId: 'c', title: 'Map', type: 'generic', body: null, tags: [],
    createdAt: 'x', updatedAt: 'x', typeData: page([{ tool: 'pen', color: '#000', width: 2, points: [[0, 0, 1]] }]),
  } as unknown as Note;

  it('embeds the sidecar when the export ships one', () => {
    const md = renderNoteToMarkdown(note, [], [], undefined, 'map-n1.ink.svg');
    expect(md).toContain('![[map-n1.ink.svg]]');
    expect(md).not.toContain('not exported');
  });

  it('keeps the notice when it does not', () => {
    expect(renderNoteToMarkdown(note, [], [])).toContain('Handwriting is not exported to Markdown');
  });
});
