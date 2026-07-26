import { describe, it, expect } from 'vitest';
import { buildTimelineFromNotesAdapter } from './notesToTimeline';
import type { Note } from '../../../types/note';

/** Minimal active note of a given type. */
const note = (type: string, id = 'n1'): Note =>
  ({
    id,
    title: `${type} note`,
    type,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    tags: [],
  }) as unknown as Note;

describe('buildTimelineFromNotesAdapter — note grouping', () => {
  it('instantiates the parent Notes track for a child note-type lane', () => {
    const ds = buildTimelineFromNotesAdapter({ notes: [note('rumor')] });
    const ids = ds.tracks.map(t => t.id);
    // The child lane exists AND its parent grouping row is created even though
    // the parent has no items of its own — otherwise nesting can't render.
    expect(ids).toContain('track-rumor');
    expect(ids).toContain('track-notes');
    expect(ds.tracks.find(t => t.id === 'track-rumor')?.parentTrackId).toBe('track-notes');
  });

  it('does not start any track collapsed (no note lane is hidden by default)', () => {
    const ds = buildTimelineFromNotesAdapter({ notes: [note('rumor'), note('loot', 'n2')] });
    expect(ds.tracks.every(t => !t.collapsed)).toBe(true);
  });

  it('gives an unknown note type its own humanized lane, not a duplicate "Notes"', () => {
    const ds = buildTimelineFromNotesAdapter({ notes: [note('weather')] });
    const track = ds.tracks.find(t => t.id === 'track-weather');
    expect(track?.label).toBe('Weather');
  });
});
