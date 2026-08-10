/**
 * Renders a value as a YAML scalar or list for export frontmatter.
 *
 * @remarks
 * This lived as six near-copies, one per renderer, and they had already
 * diverged into two variants that each carried the other's bug: four supported
 * arrays but emitted raw newlines inside double-quoted scalars, and two
 * flattened newlines but could not render a list. A raw newline inside a quoted
 * scalar ends the frontmatter line, so `title: "a\nb"` parses as a broken
 * document rather than a two-line title — the note renderers were the ones
 * exposed to it, because note titles and tags are user-typed.
 *
 * Frontmatter is single-line by construction here: a newline becomes a space.
 * That loses the line break, which is the right trade for a header field —
 * prose belongs in the body, and a corrupt document loses everything.
 */
export function yamlValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return '\n' + val.map(item => `  - ${yamlValue(item)}`).join('\n');
  }

  const str = String(val);
  // `\n` is in the trigger list as well as the escape list: a value whose only
  // special character is a line break still has to be quoted and flattened.
  const needsQuoting =
    str.includes(':') ||
    str.includes('"') ||
    str.includes("'") ||
    str.includes('\n') ||
    str.includes('#');

  if (needsQuoting) {
    // Backslash first — escaping quotes first would then double the backslashes
    // this step introduces.
    return `"${str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\s*\n+\s*/g, ' ')}"`;
  }
  return str;
}
