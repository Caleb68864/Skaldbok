import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isFieldEditableInPlayMode, FIELD_PATHS } from './modeGuards';

describe('isFieldEditableInPlayMode', () => {
  it('allows equipping armour and a helmet during play', () => {
    // Equipping is a table action, not a character edit.
    expect(isFieldEditableInPlayMode(FIELD_PATHS.armorEquipped)).toBe(true);
    expect(isFieldEditableInPlayMode(FIELD_PATHS.helmetEquipped)).toBe(true);
  });

  it('locks every other declared field path during play', () => {
    // The whole point of play mode: a tap mid-session cannot rewrite a build.
    const locked = [
      FIELD_PATHS.identity,
      FIELD_PATHS.attributes,
      FIELD_PATHS.resourceMax,
      FIELD_PATHS.derivedOverrides,
      FIELD_PATHS.skills,
    ];
    for (const path of locked) {
      expect(isFieldEditableInPlayMode(path), `${path} should lock in play mode`).toBe(false);
    }
  });

  it('does not let a prefix match leak into an unrelated field', () => {
    // `armor.equipped` must not make `armor.rating` editable.
    expect(isFieldEditableInPlayMode('armor.rating')).toBe(false);
    expect(isFieldEditableInPlayMode('armor')).toBe(false);
  });

  it('matches fields beneath an allowed prefix', () => {
    expect(isFieldEditableInPlayMode('armor.equipped.slot')).toBe(true);
  });

  it('locks an unknown path by default', () => {
    // Fail closed: a path nobody declared must not be editable by accident.
    expect(isFieldEditableInPlayMode('something.new')).toBe(false);
  });
});

describe('field paths are declared, not invented at the call site', () => {
  /**
   * @remarks
   * The guard used to be asked about `'attributes.str'` and `'resources.hp.max'`
   * — strings that look specific but mean "any attribute" and "any resource
   * maximum", and that named Dragonbane ids in system-neutral code. Nothing
   * caught it, because any string is a valid argument.
   *
   * This walks the screens and fails on a `useFieldEditable('literal')`, forcing
   * new questions into {@link FIELD_PATHS} where they can be reviewed and named.
   */
  function walk(dir: string): string[] {
    let out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out = out.concat(walk(full));
      else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
    }
    return out;
  }

  const files = walk('src').filter(f => !f.includes('modeGuards'));

  it('scans a non-trivial number of files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no useFieldEditable call with a string literal', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const [index, line] of source.split('\n').entries()) {
        if (/useFieldEditable\(\s*['"`]/.test(line)) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      }
    }
    expect(
      offenders,
      `useFieldEditable was called with a literal. Add the path to FIELD_PATHS ` +
        `in utils/modeGuards.ts and use the constant, so the set of guarded ` +
        `fields stays enumerable and free of one ruleset's ids:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
