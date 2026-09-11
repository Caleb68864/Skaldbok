import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  sheetTemplateSchema,
  surfaceLayoutSchema,
  componentDefinitionSchema,
  cardEntrySchema,
} from './schema';

/**
 * Every key a `sheet.json` may declare must have a reader.
 *
 * @remarks
 * `declaredCapabilities.test.ts` enforces this for the system and engine
 * contracts, and it reads *interfaces* — so a contract declared as a Zod schema
 * is outside it entirely. Two fields sat in that gap:
 *
 * - **`sheetTemplateSchema.print`** — a whole surface, validated and cached,
 *   rendered by nothing. `/print` goes through the hardcoded `PrintableSheet`
 *   component and never asks for a template.
 * - **`surfaceLayoutSchema.layout`** — `.describe('Optional layout identifier
 *   for this surface')`, populated in all three shipped `sheet.json` files
 *   (`"three-column"` / `"two-column"`) and read by nothing. The real layout is
 *   in each region's own `columns`, so this was a second copy of one fact with
 *   no reader — this repo's signature bug, in a schema.
 *
 * `print` was honestly labelled and `layout` was not, which is the difference
 * between the two being noticed. Neither is honoured, so both were dropped
 * rather than left declared: an author who writes either gets silence today and
 * would get silence from a label too.
 *
 * The guard is derived from the schema's own `shape`, so it cannot be satisfied
 * by editing a list — adding a key to either schema and not reading it fails
 * here in the same commit.
 */
const ROOT = process.cwd();

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

/**
 * All of `src` except tests, the schema and the types it infers.
 *
 * @remarks
 * The declaration files are excluded because `print: surfaceLayoutSchema` and
 * the `@link` in a doc comment both contain the word, and a declaration is not
 * a reader. Comment lines are stripped for the same reason.
 */
const CONSUMER_SOURCE = sourceFiles(join(ROOT, 'src'))
  .filter(path => {
    const rel = relative(ROOT, path).replace(/\\/g, '/');
    return rel !== 'src/features/systems/cards/schema.ts' && rel !== 'src/features/systems/cards/types.ts';
  })
  .map(path =>
    readFileSync(path, 'utf8')
      .split('\n')
      .filter(line => {
        const t = line.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n'),
  )
  .join('\n');

/**
 * Whether anything outside the declaration reads `.<name>` or `['<name>']`.
 *
 * @remarks
 * Two refinements, both forced by a false pass on the first run, and both the
 * same failure: *a same-named identifier anywhere launders the field.*
 *
 * 1. The trailing guard is `(?![\w$-])`, not `\b`. `PrintableSheet.tsx`
 *    contains the CSS class `.print-col`, and a word boundary sits happily
 *    between `t` and `-`.
 * 2. A call is not a read of a *data* field. `PrintableSheetScreen.tsx` calls
 *    `window.print()`. Every key on these two schemas is data — a number, two
 *    objects, an array — so `.name(` is never the way one of them is consumed.
 *    That assumption is local to this file; do not copy the rule to a contract
 *    with function-typed members, where the call *is* the read.
 * 3. Indexed access needs something to index. `travellerEngine.ts` has
 *    `surfaces: ['print']` — an array literal holding the string, which is
 *    character-identical to `obj['print']` unless you require the thing being
 *    indexed. Three false passes for one field, each a different shape.
 *
 * What remains unfixable by this method: an unrelated `.play` or `.version` on
 * some other object still counts. The method is a floor, not a proof.
 */
function hasReader(name: string): boolean {
  return (
    new RegExp(`\\.${name}(?![\\w$-])(?!\\s*\\()`).test(CONSUMER_SOURCE) ||
    new RegExp(`[\\w$\\])]\\s*\\[['"]${name}['"]\\]`).test(CONSUMER_SOURCE)
  );
}

describe('every declared sheet-template key has a reader', () => {
  it('finds source to scan', () => {
    // Guards the guard: a broken walk makes every assertion below vacuous, and
    // "no offenders" and "nothing looked at" print identically.
    expect(CONSUMER_SOURCE.length).toBeGreaterThan(100_000);
  });

  it('answers the reader question the way the tests below assume', () => {
    // Pinned by example, in both directions. `regions` is read by
    // `PlayDashboardScreen`; `zzNotAField` is read by nothing anywhere.
    expect(hasReader('regions')).toBe(true);
    expect(hasReader('zzNotAField')).toBe(false);
    // The three shapes that laundered `print` on the way here, each stated as a
    // fact about this repo rather than as a rule: the CSS class `.print-col` in
    // `PrintableSheet.tsx`, the `window.print()` call in
    // `PrintableSheetScreen.tsx`, and `surfaces: ['print']` in
    // `travellerEngine.ts`. None is a reader of a field named `print`.
    expect(hasReader('print')).toBe(false);
    // Indexed access still counts when something is actually indexed.
    expect(/[\w$\])]\s*\[['"]refresh['"]\]/.test("const mode = resource['refresh'];")).toBe(true);
  });

  it.each(Object.keys(sheetTemplateSchema.shape))('sheetTemplateSchema.%s is read', key => {
    expect(
      hasReader(key),
      `sheetTemplateSchema declares "${key}" and nothing in src reads it. A sheet.json `
        + 'author who writes it gets silence. Either render it or drop it from the schema.',
    ).toBe(true);
  });

  it.each(Object.keys(surfaceLayoutSchema.shape))('surfaceLayoutSchema.%s is read', key => {
    expect(
      hasReader(key),
      `surfaceLayoutSchema declares "${key}" and nothing in src reads it.`,
    ).toBe(true);
  });
});

describe('cardEntrySchema', () => {
  it('accepts a bare string', () => {
    expect(cardEntrySchema.safeParse('AttributesCard').success).toBe(true);
  });

  it('accepts the object form with a valid guard', () => {
    const result = cardEntrySchema.safeParse({
      card: 'CurrencyCard',
      props: { compact: true },
      when: 'hasCurrency',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-enum when value', () => {
    const result = cardEntrySchema.safeParse({ card: 'CurrencyCard', when: 'hasSpaceships' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-string card value', () => {
    const result = cardEntrySchema.safeParse({ card: 123 });
    expect(result.success).toBe(false);
  });
});

describe('sheetTemplateSchema', () => {
  it('parses a valid Traveller-shaped template', () => {
    const template = {
      version: 1,
      play: {
        regions: [
          ['IdentityCard', { card: 'DamageTrackCard', when: 'hasDamageTrack' }],
          [{ card: 'CurrencyCard', props: { compact: true }, when: 'hasCurrency' }],
        ],
      },
      sheet: {
        regions: [['SkillsCard'], ['StoryBankCard', { card: 'RestCard', when: 'hasRest' }]],
      },
    };
    const result = sheetTemplateSchema.safeParse(template);
    expect(result.success).toBe(true);
  });

  it('fails on a malformed template with a bad card type', () => {
    const template = {
      version: 1,
      play: {
        regions: [[{ card: 42 }]],
      },
    };
    const result = sheetTemplateSchema.safeParse(template);
    expect(result.success).toBe(false);
  });

  it('fails on an unknown when guard value', () => {
    const template = {
      version: 1,
      play: {
        regions: [[{ card: 'CurrencyCard', when: 'notARealGuard' }]],
      },
    };
    const result = sheetTemplateSchema.safeParse(template);
    expect(result.success).toBe(false);
  });

  it('parses the grid-region form ({ columns, cells })', () => {
    const template = {
      version: 1,
      play: {
        regions: [
          { columns: '2fr 1fr', cells: [['SkillsCard'], [{ card: 'MagicCard', when: 'hasMagic' }]] },
        ],
      },
    };
    expect(sheetTemplateSchema.safeParse(template).success).toBe(true);
  });

  it('rejects a region array that exceeds the anti-abuse max', () => {
    const template = {
      version: 1,
      play: { regions: Array.from({ length: 101 }, () => ['SkillsCard']) },
    };
    expect(sheetTemplateSchema.safeParse(template).success).toBe(false);
  });
});

describe('componentDefinitionSchema', () => {
  it('accepts named-slot prop references', () => {
    const component = {
      name: 'ResourceRow',
      props: ['resourceId'],
      body: [{ card: 'ResourceCard', props: { id: { $prop: 'resourceId' } } }],
    };
    expect(componentDefinitionSchema.safeParse(component).success).toBe(true);
  });

  it('accepts a component with no props referenced', () => {
    const component = {
      name: 'StaticHeader',
      body: ['TitleCard', { card: 'SubtitleCard' }],
    };
    expect(componentDefinitionSchema.safeParse(component).success).toBe(true);
  });

  it('rejects a raw expression string as a prop reference', () => {
    const component = {
      name: 'ResourceRow',
      props: ['resourceId'],
      body: [{ card: 'ResourceCard', props: { id: 'resourceId' } }],
    };
    expect(componentDefinitionSchema.safeParse(component).success).toBe(false);
  });
});
