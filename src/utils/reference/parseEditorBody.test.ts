import { describe, expect, it } from 'vitest';
import { parseEditorBody } from './parseEditorBody';
import type { ReferenceSection } from '../../types/reference';

const section = (type: ReferenceSection['type']) => ({ id: 's', title: 'T', type } as ReferenceSection);

describe('parseEditorBody (roadmap B10)', () => {
  it('accepts a well-formed table', () => {
    const result = parseEditorBody(section('table'), '{"columns":["A"],"rows":[{"A":"1"}]}');
    expect(result.columns).toEqual(['A']);
    expect(result.rows).toEqual([{ A: '1' }]);
  });

  it('refuses a table whose rows are the wrong shape instead of storing a render crash', () => {
    expect(() => parseEditorBody(section('table'), '{"columns":"A","rows":7}')).toThrow(/columns/);
  });

  it('refuses a key/value body that is not a list of pairs', () => {
    expect(() => parseEditorBody(section('key_value_list'), '{"label":"x"}')).toThrow();
    expect(() => parseEditorBody(section('key_value_list'), '[{"label":1}]')).toThrow(/label/);
  });

  it('treats an empty body as empty', () => {
    expect(parseEditorBody(section('key_value_list'), '').items).toEqual([]);
    expect(parseEditorBody(section('table'), '').rows).toEqual([]);
  });

  it('splits rules text into paragraphs', () => {
    expect(parseEditorBody(section('rules_text'), 'a\n\n b ').paragraphs).toEqual(['a', 'b']);
  });
});
