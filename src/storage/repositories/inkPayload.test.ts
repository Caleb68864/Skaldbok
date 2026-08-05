import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { hasInkPage, readInkPage } from './noteRepository';
import type { Note } from '../../types/note';

/**
 * `hasInkPage` is a structural check that deliberately does NOT decode the
 * payload — the session log calls it per entry per render. These tests pin the
 * one property that makes the shortcut safe: it must agree with
 * {@link readInkPage} on whether there is anything to show.
 */

function note(typeData: unknown): Note {
  return { id: 'n1', typeData } as unknown as Note;
}

describe('hasInkPage', () => {
  it('is false for a note with no typeData at all', () => {
    expect(hasInkPage(note(undefined))).toBe(false);
    expect(hasInkPage(note(null))).toBe(false);
  });

  it('is false for a note whose typeData carries no ink key', () => {
    expect(hasInkPage(note({ somethingElse: { strokes: [[[0, 0, 1]]] } }))).toBe(false);
  });

  it('is false for an ink page with an empty stroke list', () => {
    expect(hasInkPage(note({ ink: { version: 1, strokes: [], pageHeight: 0 } }))).toBe(false);
  });

  it('is true once the page has a stroke', () => {
    const page = {
      version: 1,
      pageHeight: 100,
      strokes: [{ points: [[1, 2, 0.5]], tool: 'pen', color: '#000', width: 2 }],
    };
    expect(hasInkPage(note({ ink: page }))).toBe(true);
  });

  it('agrees with readInkPage on well-formed pages', () => {
    const page = {
      version: 1,
      pageHeight: 100,
      strokes: [{ points: [[1, 2, 0.5]], tool: 'pen', color: '#000', width: 2 }],
    };
    for (const value of [undefined, null, { ink: null }, { ink: { strokes: [] } }, { ink: page }]) {
      const n = note(value);
      expect(hasInkPage(n)).toBe(readInkPage(n).strokes.length > 0);
    }
  });

  it('reports ink for a page whose strokes are malformed', () => {
    // The caller wants "route this to the ink surface", and readInkPage then
    // drops the bad strokes permissively. Answering false here would render the
    // entry as an empty text row instead — data loss in appearance, at least.
    expect(hasInkPage(note({ ink: { version: 1, strokes: [{ nonsense: true }], pageHeight: 0 } }))).toBe(true);
  });
});
