// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { db } from './client';
import { TABLES_WITHOUT_SOFT_DELETE, TABLES_OUTSIDE_BUNDLE } from '../../types/bundleTables';

/**
 * Which tables are soft-deletable, and whether the docs still say so.
 *
 * @remarks
 * `CLAUDE.md` and `AGENTS.md` each named nine entities as carrying `deletedAt`.
 * Twenty of the twenty-six tables declare it. Eleven were undocumented —
 * attachments, inventory containers, ships, the four ledger tables, both route
 * tables, and both reference tables — and the two files, which `CLAUDE.md`
 * itself says must stay in step, had drifted together and stayed wrong together.
 *
 * The fix was to delete the parallel list rather than correct it. The docs now
 * state a count and point at `TABLES_WITHOUT_SOFT_DELETE`, which records the
 * *five exclusions* with their reasons — the same shape as
 * `TABLES_OUTSIDE_BUNDLE`, and small enough to stay true. These tests walk the
 * live Dexie schema against that map so a new table forces a decision, and check
 * the count the docs state against what comes out.
 *
 * That apparatus was internally consistent and externally wrong for as long as
 * it existed. `SOFT_DELETE_TABLES` is derived from the exemption map, and both
 * the pinned count and the docs check are computed from that derivation — so
 * nothing anywhere checked that an exempted table *actually* lacks `deletedAt`.
 * `referenceNotes` was exempt while being soft-deleted by its own repository,
 * listed in the Trash and served by a delete button, and every count stated was
 * one short. The exemption is now checked against evidence outside the map:
 * repository writes that stamp `deletedAt` onto that table's rows.
 */

const ROOT = process.cwd();
const TYPES_DIR = join(ROOT, 'src/types');

/** Table names in the live Dexie schema. */
const TABLE_NAMES = db.tables.map((t) => t.name).sort();

/** Tables not listed as exempt — i.e. the ones expected to carry `deletedAt`. */
const SOFT_DELETE_TABLES = TABLE_NAMES.filter((name) => !(name in TABLES_WITHOUT_SOFT_DELETE));

const REPOS_DIR = join(ROOT, 'src/storage/repositories');

/**
 * Repository files that write `deletedAt` onto rows of a given table.
 *
 * @remarks
 * Evidence independent of {@link TABLES_WITHOUT_SOFT_DELETE}, which is the whole
 * point: the rest of this file derives what it checks from that map, so it can
 * only ever confirm the map agrees with itself. A repository statement that
 * updates `db.<table>` and sets `deletedAt` in the same expression is a soft
 * delete no matter what any list claims.
 */
function repositoryFilesWritingDeletedAt(table: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(REPOS_DIR).sort()) {
    if (!name.endsWith('.ts') || name.includes('.test.')) continue;
    const source = readFileSync(join(REPOS_DIR, name), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/[^\n]*/g, '$1');
    // `db.<table>.update(…)` / `.bulkUpdate(…)` / `.put(…)`, up to the closing
    // paren of that call, containing a `deletedAt:` assignment.
    const call = new RegExp(
      `\\bdb\\.${table}\\s*\\.\\s*(?:update|bulkUpdate|put|bulkPut)\\s*\\(([\\s\\S]*?)\\)\\s*;`,
      'g',
    );
    for (const match of source.matchAll(call)) {
      if (/\bdeletedAt\s*:/.test(match[1] ?? '')) {
        found.push(name);
        break;
      }
    }
  }
  return found;
}

describe('the soft-delete exemption list', () => {
  it('accounts for every Dexie table', () => {
    expect(TABLE_NAMES.length).toBeGreaterThan(20);
    for (const name of Object.keys(TABLES_WITHOUT_SOFT_DELETE)) {
      expect(TABLE_NAMES, `"${name}" is exempted but is not a Dexie table`).toContain(name);
    }
  });

  it('gives a reason for each exemption', () => {
    for (const [name, reason] of Object.entries(TABLES_WITHOUT_SOFT_DELETE)) {
      expect(reason.length, `"${name}" is exempted with no stated reason`).toBeGreaterThan(40);
    }
  });

  it('leaves twenty-one tables soft-deletable', () => {
    // Pinned so that adding a table and forgetting to decide shows up as a
    // number moving, not as silence. It read 20 until `referenceNotes` — which
    // has always been soft-deletable — came off the exemption list.
    expect(SOFT_DELETE_TABLES).toHaveLength(21);
  });

  it('exempts only tables that really have no soft delete', () => {
    // The hole this closes. `SOFT_DELETE_TABLES` above is derived from
    // `TABLES_WITHOUT_SOFT_DELETE`, and the count and the docs check are both
    // computed from that same derivation — so the whole apparatus was
    // internally consistent and nothing whatsoever checked that an exempted
    // table actually lacks `deletedAt`.
    //
    // `referenceNotes` was exempt, with a reason saying its content "lives in
    // `notes` now". It does not: the Reference screen's Notes tab still writes
    // that table, and `referenceNoteRepository` exports `getDeleted`,
    // `softDelete`, `restore` and `hardDelete` against it, with a Trash entry
    // and a delete button on screen. Every count the docs stated was one short.
    //
    // The evidence used here is the repository layer's own writes: a table
    // whose repository stamps `deletedAt` onto a row is soft-deletable, whatever
    // a map says.
    const offenders: string[] = [];
    for (const name of Object.keys(TABLES_WITHOUT_SOFT_DELETE)) {
      const writers = repositoryFilesWritingDeletedAt(name);
      if (writers.length > 0) {
        offenders.push(`${name} (${writers.join(', ')})`);
      }
    }
    expect(
      offenders,
      `${offenders.join('; ')} is exempted from soft delete but a repository `
      + 'stamps `deletedAt` onto its rows. Either the exemption is wrong — remove '
      + 'it and update the count in CLAUDE.md and AGENTS.md — or the write is.',
    ).toEqual([]);
  });

  it('does not exempt a table the bundle also leaves behind for a different reason', () => {
    // The two maps answer different questions and legitimately overlap
    // (`referenceNotes` and `metadata` are in both). What must not happen is an
    // exemption that exists only because someone copied the other map.
    for (const name of Object.keys(TABLES_WITHOUT_SOFT_DELETE)) {
      const softReason = TABLES_WITHOUT_SOFT_DELETE[name];
      const bundleReason = TABLES_OUTSIDE_BUNDLE[name];
      if (bundleReason) {
        expect(softReason, `"${name}" carries the same text in both maps`).not.toBe(bundleReason);
      }
    }
  });
});

describe('every table claimed soft-deletable declares the fields', () => {
  /** Concatenated source of `src/types`, where the row schemas live. */
  const typeSource = readdirSync(TYPES_DIR)
    .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
    .map((f) => readFileSync(join(TYPES_DIR, f), 'utf8'))
    .join('\n');

  it('declares deletedAt and softDeletedBy somewhere in src/types', () => {
    // A coarse check on purpose: it is the *count* above that pins the set, and
    // this only confirms the two field names are a live part of the type layer
    // rather than a convention that has quietly stopped being written.
    expect(typeSource).toContain('deletedAt');
    expect(typeSource).toContain('softDeletedBy');
    const declarations = [...typeSource.matchAll(/\bdeletedAt\b/g)].length;
    expect(declarations).toBeGreaterThanOrEqual(SOFT_DELETE_TABLES.length);
  });
});

describe('CLAUDE.md and AGENTS.md', () => {
  const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');

  /** The body of one `### heading` section, up to the next heading of any level. */
  function section(source: string, heading: string): string {
    const start = source.indexOf(heading);
    expect(start, `"${heading}" is missing`).toBeGreaterThan(-1);
    const rest = source.slice(start + heading.length);
    const end = rest.search(/\n#{2,3} /);
    return (end === -1 ? rest : rest.slice(0, end)).trim();
  }

  it('agree on the sections they share', () => {
    // `CLAUDE.md` states that AGENTS.md is a near-verbatim copy and that the two
    // must be kept in sync. Nothing checked it, and both drifted the same way.
    for (const heading of [
      '### Relationship types in use',
      '### Schema',
      '### Delete and restore operations',
      '### Cascade via `softDeletedBy`',
    ]) {
      expect(section(agents, heading), `"${heading}" differs between the two files`)
        .toBe(section(claude, heading));
    }
  });

  it('state the soft-delete table count the schema actually has', () => {
    const expected = `${SOFT_DELETE_TABLES.length} of the ${TABLE_NAMES.length}`;
    for (const [name, source] of [['CLAUDE.md', claude], ['AGENTS.md', agents]] as const) {
      expect(
        source,
        `${name} does not state "${expected}" tables. The list of nine entity names it `
        + 'used to carry drifted against twenty tables; it now states a count derived '
        + 'from `TABLES_WITHOUT_SOFT_DELETE`, and this test is what keeps that true.',
      ).toContain(expected);
      expect(source).toContain('TABLES_WITHOUT_SOFT_DELETE');
    }
  });
});

describe('the documented relationship types', () => {
  /**
   * Every shape this codebase writes or reads a relationship-type literal in.
   *
   * @remarks
   * The scan used to be two patterns — `relationshipType: '…'` and
   * `getLinksFrom/To(…, '…')`, single quotes only. Three shapes already present
   * in the tree were invisible to it, and the cost is not hypothetical: a new
   * relationship type introduced through any of them is documented nowhere and
   * this test says nothing.
   *
   * - **A comparison.** `collectors.ts` decides what an export carries with
   *   `link.relationshipType === 'represents'`. A type that is only ever *read*
   *   is still a type the next reader needs to know exists.
   * - **A double-quoted literal.** Nothing in the tree writes one today, which
   *   is exactly why it would slip through — the pattern's single quote was
   *   habit, not a rule.
   * - **A positional argument.** `noteCreationService.ensureLink` takes the
   *   type as its last parameter, so `ensureLink(note.id, 'note', sessionId,
   *   'session', 'introduced_in')` names a type in a position neither old
   *   pattern looked at. `introduced_in` was covered only by accident, because
   *   an unrelated `getLinksFrom` call in the export path spells it too.
   */
  const LITERAL_SHAPES: RegExp[] = [
    /relationshipType:\s*(['"])([a-z_]+)\1/g,
    /relationshipType\s*[!=]==\s*(['"])([a-z_]+)\1/g,
    /getLinks(?:From|To)\([^,]+,\s*(['"])([a-z_]+)\1/g,
    /ensureLink\([^()]*,\s*(['"])([a-z_]+)\1\s*\)/g,
  ];

  /**
   * Sites where the type is a variable, so no pattern can resolve it.
   *
   * @remarks
   * Reported rather than skipped. A guard that silently narrows its own domain
   * when it meets something it cannot parse is the failure mode every gap in
   * this codebase's guards has had — so an unresolvable site is either
   * allowlisted here with a reason, or it fails.
   */
  const UNRESOLVABLE_SHAPES: RegExp[] = [
    /relationshipType\s*[,}]/g,
    /getLinks(?:From|To)\([^,]+,\s*([A-Za-z_$][\w$]*)\s*[,)]/g,
  ];

  /** Files allowed to pass a relationship type around as a variable. */
  const PASSES_THE_TYPE_THROUGH: Record<string, string> = {
    'storage/repositories/entityLinkRepository.ts':
      '`softDeleteLinksFromEntity(fromEntityId, relationshipType, …)` forwards its own parameter '
      + 'to `getLinksFrom`. This is the repository that owns the edge table; the type it deletes '
      + 'is whatever its caller names, and its callers spell literals.',
    'storage/noteCreationService.ts':
      '`ensureLink` takes the type as a parameter and forwards it to `createLink` and '
      + '`getLinksFrom`. Every caller spells a literal, and those literals are read by the '
      + 'positional-argument shape above, so nothing is lost — the variable is the hop, not the source.',
  };

  /** Every relationship type written or read in `src`, and every site that hides one. */
  function scanSource(): { types: string[]; unresolvable: string[] } {
    const found = new Set<string>();
    const unresolvable = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) { walk(path); continue; }
        if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) continue;
        const source = readFileSync(path, 'utf8');
        const rel = relative(join(ROOT, 'src'), path).split('\\').join('/');
        for (const pattern of LITERAL_SHAPES) {
          for (const m of source.matchAll(pattern)) found.add(m[2]!);
        }
        for (const pattern of UNRESOLVABLE_SHAPES) {
          for (const m of source.matchAll(pattern)) {
            // A parameter or property *declaration* names no type — `relationshipType:
            // string` is the contract, not a write. The Dexie compound-index strings
            // (`[fromEntityId+relationshipType]`) are excluded by the same token.
            if (/^relationshipType\s*[,}]$/.test(m[0]) && /relationshipType\s*\}/.test(m[0])) continue;
            unresolvable.add(`${rel}: ${m[0].trim()}`);
          }
        }
      }
    };
    walk(join(ROOT, 'src'));
    return { types: [...found].sort(), unresolvable: [...unresolvable].sort() };
  }

  const { types, unresolvable } = scanSource();

  it('reports every site whose relationship type it cannot read', () => {
    const offenders = unresolvable.filter(
      site => !Object.keys(PASSES_THE_TYPE_THROUGH).some(file => site.startsWith(`${file}:`)),
    );
    expect(
      offenders,
      `${offenders.join('; ')} passes a relationship type this scan cannot resolve, so a `
      + 'type introduced there would be documented nowhere and this file would stay green. '
      + 'Spell the literal at the call, or record the file in PASSES_THE_TYPE_THROUGH with '
      + 'a reason saying where the literals actually are.',
    ).toEqual([]);
    // And the allowlist cannot rot: an entry describing nothing is a permission
    // left lying around for the next person to inherit.
    for (const file of Object.keys(PASSES_THE_TYPE_THROUGH)) {
      expect(
        unresolvable.some(site => site.startsWith(`${file}:`)),
        `${file} is allowlisted as passing the type through, but no longer does — remove the entry.`,
      ).toBe(true);
    }
  });
  const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');
  const repository = readFileSync(
    join(ROOT, 'src/storage/repositories/entityLinkRepository.ts'),
    'utf8',
  );

  it('finds the relationship types the app actually writes', () => {
    expect(types.length).toBeGreaterThanOrEqual(6);
    // The one that was missing from all three lists. It is written by the v6
    // upgrade (`client.ts`), so these edges exist in every database that came up
    // through v6 — the least visible kind of undocumented data.
    expect(types).toContain('migrated_from');
  });

  it('names every one of them in both docs and in the repository comment', () => {
    for (const [name, source] of [
      ['CLAUDE.md', claude],
      ['AGENTS.md', agents],
      ['entityLinkRepository.ts', repository],
    ] as const) {
      const missing = types.filter((t) => !source.includes(`\`${t}\``) && !source.includes(`'${t}'`));
      expect(
        missing,
        `${name} does not document: ${missing.join(', ')}. `
        + 'A relationship type nothing lists is one the next reader cannot know exists.',
      ).toEqual([]);
    }
  });
});
