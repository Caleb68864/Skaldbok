// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../db/client';
import { createCampaign, getCampaignById } from './campaignRepository';
import { createNote } from './noteRepository';

/**
 * A repository failure must carry the failure underneath it.
 *
 * @remarks
 * Every rethrow in this directory used to interpolate the caught error into a
 * string and discard the object: `` throw new Error(`repo.fn failed: ${e}`) ``.
 * That renders a Dexie failure as "ConstraintError: Key already exists" and
 * throws away both the stack and — the part that matters — `err.name`.
 *
 * This is a local-first app. The user's data exists in exactly one IndexedDB
 * database on one device, so the difference between a `QuotaExceededError` (the
 * device is out of room; act now, the write did not happen) and a validation
 * failure (this one row was malformed) is the difference between a recoverable
 * bug report and an unrecoverable one. By the time a stringified message reached
 * a toast, the two were indistinguishable.
 *
 * `preserve-caught-error` is now `error` in `eslint.config.js`, which is the
 * guard for every site. These tests are the reason: they assert the chain is
 * actually walkable at runtime, not merely that a token appears in the source.
 *
 * **No number is written down here any more, and that is the fix.** The count
 * has been stated as 119 (`eslint.config.js`), 128 (the commit body), 129 (here
 * and in `O2`) and 130 (scan 2 §18) — four numbers for one set, each recorded as
 * fact, none of them re-measured. A count in prose is a claim that goes stale
 * silently, which is precisely the shape this codebase keeps finding and
 * deleting rather than correcting. The census below derives it, and the two
 * sentences that used to carry a figure now describe the change instead.
 */

const REPO_DIR = __dirname;

/** A DB failure of the shape the merge engine treats as fatal. */
function quotaExceeded(): Error {
  const err = new Error('The current transaction exceeded its quota limitations.');
  err.name = 'QuotaExceededError';
  return err;
}

/** Runs `fn`, expecting it to reject, and returns the rejection as an Error. */
async function rejection(fn: () => Promise<unknown>): Promise<Error> {
  let caught: unknown;
  try {
    await fn();
  } catch (err) {
    caught = err;
  }
  expect(caught, 'expected the repository call to reject').toBeInstanceOf(Error);
  return caught as Error;
}

describe('a repository rethrow preserves the failure underneath it', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets a caller tell a quota failure from any other write failure', async () => {
    vi.spyOn(db.campaigns, 'add').mockRejectedValue(quotaExceeded());

    const caught = await rejection(() =>
      createCampaign({ name: 'The Iron Circle', system: 'classic-fantasy', status: 'active' }),
    );

    // The message the user sees is unchanged — `cause` is purely additive.
    expect(caught.message).toContain('campaignRepository.createCampaign failed');
    // And the name is recoverable, which is the whole point.
    expect((caught.cause as Error | undefined)?.name).toBe('QuotaExceededError');
  });

  it('keeps the original stack reachable through the chain', async () => {
    vi.spyOn(db.campaigns, 'get').mockRejectedValue(quotaExceeded());

    const caught = await rejection(() => getCampaignById('camp-1'));

    expect((caught.cause as Error | undefined)?.stack).toBeTruthy();
    expect((caught.cause as Error | undefined)?.message).toContain('quota');
  });

  it('does the same for a repository that rethrows with String(err)', async () => {
    // `noteRepository` uses the other of the four rewritten shapes — a
    // user-facing quota branch plus a `${String(err)}` fallback — so both are
    // covered rather than only the dominant one.
    vi.spyOn(db.notes, 'add').mockRejectedValue(quotaExceeded());

    const caught = await rejection(() =>
      createNote({ campaignId: 'camp-1', title: 'A note', type: 'generic', content: '' } as never),
    );

    expect((caught.cause as Error | undefined)?.name).toBe('QuotaExceededError');
  });
});

/**
 * Returns each `catch (name) { … }` body in `source`, matched by balancing
 * braces so that a nested block or a brace inside a template literal cannot end
 * the region early.
 */
function catchBodies(source: string): string[] {
  const bodies: string[] = [];
  const opener = /catch\s*\(\s*[A-Za-z_$][\w$]*\s*\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    const start = match.index + match[0].length - 1;
    let depth = 0;
    let i = start;
    for (; i < source.length; i++) {
      const char = source[i];
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    bodies.push(source.slice(start, i + 1));
  }
  return bodies;
}

/** Index of the `)` closing the `(` at `open`, ignoring parens inside strings. */
function matchParen(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (char === '(') depth++;
    else if (char === ')') {
      depth--;
      if (depth === 0) return i;
    } else if (char === '`' || char === "'" || char === '"') {
      let j = i + 1;
      let braceDepth = 0;
      while (j < source.length) {
        if (source[j] === '\\') { j += 2; continue; }
        if (char === '`' && source[j] === '$' && source[j + 1] === '{') { braceDepth++; j += 2; continue; }
        if (char === '`' && braceDepth > 0 && source[j] === '}') { braceDepth--; j++; continue; }
        if (braceDepth === 0 && source[j] === char) break;
        j++;
      }
      i = j;
    }
  }
  return -1;
}

describe('every repository rethrow carries a cause', () => {
  const files = readdirSync(REPO_DIR)
    .filter((name) => name.endsWith('.ts') && !name.includes('.test.'))
    .map((name) => join(REPO_DIR, name));

  it('reads the whole repository layer', () => {
    // Guards the guard: a broken glob would otherwise pass by finding nothing.
    expect(files.length).toBeGreaterThan(20);
  });

  it('never rethrows a caught error as a bare string', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const body of catchBodies(source)) {
        let index = body.indexOf('new Error(');
        while (index !== -1) {
          const open = body.indexOf('(', index);
          const close = matchParen(body, open);
          const args = close === -1 ? body.slice(open) : body.slice(open, close);
          if (!args.includes('cause:')) {
            offenders.push(`${file.split('/').pop()}: ${args.slice(0, 70).replace(/\s+/g, ' ')}`);
          }
          index = body.indexOf('new Error(', index + 1);
        }
      }
    }

    expect(
      offenders,
      'A repository rethrew a caught error without `{ cause }`. `${e}` renders a '
      + 'Dexie failure as a message and discards `err.name`, which is how a '
      + 'QuotaExceededError on a device with one copy of the user\'s data reads '
      + 'as an ordinary validation failure. `preserve-caught-error` is `error` '
      + 'in eslint.config.js for the same reason.',
    ).toEqual([]);
  });

  it('still carries a cause chain worth the rule', () => {
    // The census, derived rather than recorded. It exists so the rule cannot
    // quietly stop applying to anything — a layer that had lost its causes
    // would leave this at a handful and fail — and so nobody writes the number
    // into a comment again.
    //
    // Comments are stripped first: two lines in `mergeEngine.ts` *discuss*
    // `{ cause: … }` in prose, and every naive `grep -c` of this pattern,
    // including the one that produced the most recent correction, counted them
    // as code.
    const SRC = join(REPO_DIR, '../..');
    const count = (dir: string): number => {
      let total = 0;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) { total += count(path); continue; }
        if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) continue;
        const code = readFileSync(path, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|\s)\/\/[^\n]*/g, '$1');
        total += [...code.matchAll(/\{\s*cause:/g)].length;
      }
      return total;
    };

    const sites = count(SRC);
    expect(
      sites,
      `only ${sites} \`{ cause: … }\` sites remain in non-test src. The rule was taken `
      + 'across the whole repository layer; a number this low means the causes have been '
      + 'unwound, not that the layer shrank.',
    ).toBeGreaterThan(100);
  });
});
