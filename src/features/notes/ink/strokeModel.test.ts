import { describe, expect, it } from 'vitest';
import {
  serializeStrokePage,
  deserializeStrokePage,
  strokeBounds,
  type StrokePage,
  type Stroke,
} from './strokeModel';

const validStroke: Stroke = {
  points: [
    [0, 0, 0.5],
    [1, 2, 0.6],
    [3, 4, 0.4],
  ],
  tool: 'pen',
  color: '#000000',
  width: 2,
};

describe('serializeStrokePage', () => {
  it('round-trips through JSON.parse(JSON.stringify(page)) as a deep equal', () => {
    const page: StrokePage = { version: 1, strokes: [validStroke], pageHeight: 500 };
    const serialized = serializeStrokePage(page);
    expect(JSON.parse(JSON.stringify(page))).toEqual(serialized);
  });

  it('refuses to serialize a stroke with zero points', () => {
    const page: StrokePage = {
      version: 1,
      strokes: [{ points: [], tool: 'pen', color: '#000', width: 1 }],
      pageHeight: 100,
    };
    expect(() => serializeStrokePage(page)).toThrow();
  });
});

describe('deserializeStrokePage', () => {
  it('drops a malformed stroke while its well-formed siblings survive', () => {
    const raw = {
      version: 1,
      pageHeight: 200,
      strokes: [
        validStroke,
        { points: [], tool: 'pen', color: '#000', width: 1 }, // zero points — malformed
        { points: [[1, 1, 0.5]], tool: 'not-a-tool', color: '#fff', width: 1 }, // bad tool
        { points: [[1, 'x', 0.5]], tool: 'pen', color: '#fff', width: 1 }, // non-finite coord
        { tool: 'pen', color: '#fff', width: 1 }, // missing points entirely
      ],
    };
    const result = deserializeStrokePage(raw);
    expect(result.strokes).toHaveLength(1);
    expect(result.strokes[0]).toEqual(validStroke);
  });

  it('returns an empty page for unusable input', () => {
    expect(deserializeStrokePage(null)).toEqual({ version: 1, strokes: [], pageHeight: 0 });
    expect(deserializeStrokePage(undefined)).toEqual({ version: 1, strokes: [], pageHeight: 0 });
    expect(deserializeStrokePage('garbage')).toEqual({ version: 1, strokes: [], pageHeight: 0 });
  });

  it('never throws even on deeply malformed input', () => {
    expect(() => deserializeStrokePage({ strokes: 'not-an-array' })).not.toThrow();
    expect(() => deserializeStrokePage({ strokes: [null, 42, 'x'] })).not.toThrow();
  });
});

describe('strokeBounds', () => {
  it('computes the axis-aligned bounding box of a stroke', () => {
    const stroke: Stroke = {
      points: [
        [0, 5, 0.5],
        [10, 0, 0.5],
        [-2, 8, 0.5],
      ],
      tool: 'pen',
      color: '#000',
      width: 2,
    };
    expect(strokeBounds(stroke)).toEqual({ minX: -2, minY: 0, maxX: 10, maxY: 8 });
  });

  it('throws for a stroke with zero points', () => {
    expect(() => strokeBounds({ points: [], tool: 'pen', color: '#000', width: 1 })).toThrow();
  });
});
