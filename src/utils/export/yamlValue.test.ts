import { describe, it, expect } from 'vitest';
import { yamlValue } from './yamlValue';

describe('yamlValue — plain scalars', () => {
  it('renders a bare string unquoted', () => {
    expect(yamlValue('Regina')).toBe('Regina');
  });

  it('renders numbers and booleans without quotes', () => {
    expect(yamlValue(42)).toBe('42');
    expect(yamlValue(0)).toBe('0');
    expect(yamlValue(-3)).toBe('-3');
    expect(yamlValue(true)).toBe('true');
    expect(yamlValue(false)).toBe('false');
  });

  it('renders null and undefined as an empty string, not the word "null"', () => {
    // `key: null` and `key: undefined` both read back as text a consumer has to
    // special-case; an empty string is simply absent.
    expect(yamlValue(null)).toBe('""');
    expect(yamlValue(undefined)).toBe('""');
  });
});

describe('yamlValue — quoting', () => {
  it.each([
    ['a colon', 'Session 3: the derelict'],
    ['a double quote', 'The "Leap"'],
    ['an apostrophe', "Milo's vault"],
    ['a hash', 'Cargo #4'],
  ])('quotes a value containing %s', (_why, input) => {
    expect(yamlValue(input).startsWith('"')).toBe(true);
    expect(yamlValue(input).endsWith('"')).toBe(true);
  });

  it('escapes embedded double quotes', () => {
    expect(yamlValue('The "Leap"')).toBe('"The \\"Leap\\""');
  });

  it('escapes backslashes before quotes, not after', () => {
    // Escaping quotes first would double the backslashes this step introduces.
    expect(yamlValue('a\\b"c')).toBe('"a\\\\b\\"c"');
  });
});

describe('yamlValue — newlines', () => {
  it('flattens a newline to a space rather than emitting a raw one', () => {
    // The bug this function was extracted to fix. A raw newline inside a
    // double-quoted scalar ends the frontmatter line, so the document breaks.
    expect(yamlValue('first\nsecond')).toBe('"first second"');
  });

  it('emits no raw newline for any multi-line input', () => {
    const out = yamlValue('a\nb\r\nc\n\n\nd');
    expect(out.includes('\n')).toBe(false);
  });

  it('collapses a run of blank lines into a single space', () => {
    expect(yamlValue('a\n\n\nb')).toBe('"a b"');
  });

  it('does not leave doubled spaces around a flattened break', () => {
    expect(yamlValue('a \n b')).toBe('"a b"');
  });

  it('quotes a value whose only special character is the newline', () => {
    // `\n` has to be in the trigger list as well as the escape list.
    expect(yamlValue('plain\ntext')).toBe('"plain text"');
  });
});

describe('yamlValue — lists', () => {
  it('renders an empty array inline', () => {
    expect(yamlValue([])).toBe('[]');
  });

  it('renders a list as indented items on their own lines', () => {
    expect(yamlValue(['ally', 'contact'])).toBe('\n  - ally\n  - contact');
  });

  it('quotes list items that need it', () => {
    expect(yamlValue(['Session 3: start'])).toBe('\n  - "Session 3: start"');
  });

  it('flattens a newline inside a list item', () => {
    expect(yamlValue(['a\nb'])).toBe('\n  - "a b"');
  });
});
