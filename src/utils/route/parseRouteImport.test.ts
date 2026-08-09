import { describe, it, expect } from 'vitest';
import { parseRouteImport } from './parseRouteImport';
import type { RouteFieldSpec } from '../export/renderRoute';

/** Traveller's declaration, as `system.json` gives it. */
const FIELDS: RouteFieldSpec[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'uwp', label: 'UWP', type: 'text' },
  { id: 'hex', label: 'Hex', type: 'text' },
  { id: 'jump', label: 'Jump (pc)', type: 'number' },
  { id: 'notes', label: 'Notes', type: 'textarea' },
];

const ok = (r: ReturnType<typeof parseRouteImport>) => {
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r;
};

describe('parseRouteImport — shapes a generator plausibly produces', () => {
  it('reads a bare array of stops', () => {
    const r = ok(parseRouteImport('[{"name":"Regina"},{"name":"Extolay"}]', FIELDS));
    expect(r.stops.map(s => s.name)).toEqual(['Regina', 'Extolay']);
  });

  it('reads an object wrapping a stops array', () => {
    const r = ok(parseRouteImport('{"stops":[{"name":"Regina"}]}', FIELDS));
    expect(r.stops).toHaveLength(1);
  });

  it('accepts the other names a generator might use for the list', () => {
    for (const key of ['route', 'worlds', 'legs', 'items']) {
      const r = ok(parseRouteImport(`{"${key}":[{"name":"Regina"}]}`, FIELDS));
      expect(r.stops[0].name).toBe('Regina');
    }
  });

  it('ignores unrelated top-level metadata', () => {
    const r = ok(parseRouteImport('{"title":"Feast run","author":"AI","stops":[{"name":"Zila"}]}', FIELDS));
    expect(r.stops[0].name).toBe('Zila');
  });
});

describe('parseRouteImport — field matching', () => {
  it('maps declared field ids', () => {
    const r = ok(parseRouteImport(
      '[{"name":"Regina","uwp":"A788899-C","hex":"1910","jump":2,"notes":"start"}]',
      FIELDS,
    ));
    expect(r.stops[0].values).toEqual({
      uwp: 'A788899-C', hex: '1910', jump: '2', notes: 'start',
    });
  });

  it('matches on the declared label too, so a file written from the export lands', () => {
    const r = ok(parseRouteImport('[{"Name":"Regina","UWP":"A788899-C","Jump (pc)":2}]', FIELDS));
    expect(r.stops[0].name).toBe('Regina');
    expect(r.stops[0].values.uwp).toBe('A788899-C');
    expect(r.stops[0].values.jump).toBe('2');
  });

  it('is case- and separator-insensitive about keys', () => {
    const r = ok(parseRouteImport('[{"NAME":"Regina","U_W_P":"A788899-C","jump-pc":4}]', FIELDS));
    expect(r.stops[0].name).toBe('Regina');
    expect(r.stops[0].values.uwp).toBe('A788899-C');
  });

  it('stores a numeric distance as a string, matching the record', () => {
    // Values are strings on disk regardless of declared type; readNumericField
    // is the only thing that parses them back.
    const r = ok(parseRouteImport('[{"name":"Extolay","jump":2}]', FIELDS));
    expect(r.stops[0].values.jump).toBe('2');
    expect(typeof r.stops[0].values.jump).toBe('string');
  });

  it('drops an unrecognised field and says so', () => {
    const r = ok(parseRouteImport('[{"name":"Regina","population":"9","gravity":"1.0"}]', FIELDS));
    expect(r.stops[0].values).toEqual({});
    expect(r.warnings.join(' ')).toContain('population');
    expect(r.warnings.join(' ')).toContain('gravity');
  });

  it('trims whitespace and skips blanks', () => {
    const r = ok(parseRouteImport('[{"name":"  Regina  ","uwp":"   ","notes":"ok"}]', FIELDS));
    expect(r.stops[0].name).toBe('Regina');
    expect(r.stops[0].values.uwp).toBeUndefined();
    expect(r.stops[0].values.notes).toBe('ok');
  });

  it('drops a value it cannot render as text', () => {
    const r = ok(parseRouteImport('[{"name":"Regina","notes":{"nested":true}}]', FIELDS));
    expect(r.stops[0].values.notes).toBeUndefined();
  });

  it('honours a different ruleset\'s declaration', () => {
    const hexcrawl: RouteFieldSpec[] = [
      { id: 'name', label: 'Name' },
      { id: 'region', label: 'Region' },
      { id: 'days', label: 'Days travel', type: 'number' },
    ];
    const r = ok(parseRouteImport('[{"name":"Ravenholt","region":"The Moor","days":3,"uwp":"X"}]', hexcrawl));
    expect(r.stops[0].values).toEqual({ region: 'The Moor', days: '3' });
    expect(r.warnings.join(' ')).toContain('uwp');
  });
});

describe('parseRouteImport — bad input', () => {
  it('rejects text that is not JSON', () => {
    const r = parseRouteImport('not json at all', FIELDS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('valid JSON');
  });

  it('rejects JSON with no stop list', () => {
    const r = parseRouteImport('{"campaign":"Spinward Main"}', FIELDS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('list of stops');
  });

  it('rejects an empty list', () => {
    const r = parseRouteImport('{"stops":[]}', FIELDS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('no stops');
  });

  it('rejects a file where nothing has a name', () => {
    const r = parseRouteImport('[{"uwp":"A788899-C"},{"uwp":"B55589A-A"}]', FIELDS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('had a name');
  });

  it('skips a nameless stop but keeps the rest, reporting its position', () => {
    const r = ok(parseRouteImport('[{"name":"Regina"},{"uwp":"B55589A-A"},{"name":"Zila"}]', FIELDS));
    expect(r.stops.map(s => s.name)).toEqual(['Regina', 'Zila']);
    expect(r.warnings.join(' ')).toContain('Stop 2');
  });

  it('skips entries that are not objects', () => {
    const r = ok(parseRouteImport('[{"name":"Regina"},"Extolay",42,null]', FIELDS));
    expect(r.stops.map(s => s.name)).toEqual(['Regina']);
    expect(r.warnings.join(' ')).toMatch(/not readable/);
  });

  it('refuses a runaway file rather than locking the UI rendering it', () => {
    const many = JSON.stringify(Array.from({ length: 501 }, (_, i) => ({ name: `W${i}` })));
    const r = parseRouteImport(many, FIELDS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('501');
  });

  it('accepts a file right at the limit', () => {
    const many = JSON.stringify(Array.from({ length: 500 }, (_, i) => ({ name: `W${i}` })));
    expect(ok(parseRouteImport(many, FIELDS)).stops).toHaveLength(500);
  });
});

describe('parseRouteImport — the real Session 1 route', () => {
  it('round-trips the Feast Contract route', () => {
    const json = JSON.stringify({
      title: 'The Feast Contract route',
      stops: [
        { name: 'Regina', uwp: 'A788899-C', hex: '1910', jump: 0, notes: 'Start. Deliver back here by 279-1105.' },
        { name: 'Extolay', uwp: 'B55589A-A', hex: '1711', jump: 2, notes: 'Livonia saffron. Law Level 10.' },
        { name: 'Knorbes', uwp: 'E888765-2', hex: '1807', jump: 4, notes: 'Tree kraken. No tech above TL2 outside the port.' },
        { name: 'Zila', uwp: 'E556727-7', hex: '2908', jump: 11, notes: 'Trake fruit. Deadline 235-1105.' },
        { name: 'Regina', uwp: 'A788899-C', hex: '1910', jump: 10, notes: 'Deliver to Gazelle.' },
      ],
    });
    const r = ok(parseRouteImport(json, FIELDS));
    expect(r.stops).toHaveLength(5);
    expect(r.warnings).toEqual([]);
    expect(r.stops.map(s => s.values.jump)).toEqual(['0', '2', '4', '11', '10']);
    expect(r.stops[3].values.uwp).toBe('E556727-7');
  });
});
