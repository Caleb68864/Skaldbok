import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Outside the storage layer a note is deleted with `softDeleteWithLinks`,
 * never the note-only `softDelete`.
 *
 * @remarks
 * `SkillCheckEditDrawer` deleted a session-log entry with
 * `noteRepository.softDelete`, which tombstones the note row only. The
 * session→note and encounter→note `contains` edges it was created with stayed
 * live, pointing at a deleted note, and its attachments were not tombstoned
 * with it. `softDeleteWithLinks` takes all three under one transaction id, so
 * Trash brings all three back. This fails on any non-test file outside
 * `src/storage` that imports `softDelete` from `noteRepository`.
 */

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** `import { …softDelete… } from '…/noteRepository'`, or `noteRepository.softDelete(`. */
const NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*\/noteRepository['"]/g;
const NAMESPACE_CALL = /\bnoteRepository\.softDelete\s*\(/;

describe('note deletes outside the storage layer', () => {
  it('go through softDeleteWithLinks', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file).split('\\').join('/');
      if (rel.startsWith('storage/')) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(NAMED_IMPORT)) {
        const names = match[1]!.split(',').map((n) => n.trim().split(/\s+as\s+/)[0]);
        if (names.includes('softDelete')) offenders.push(`${rel}: imports softDelete`);
      }
      if (NAMESPACE_CALL.test(source)) offenders.push(`${rel}: calls noteRepository.softDelete`);
    }
    expect(offenders, 'use noteRepository.softDeleteWithLinks, which takes edges and photos too').toEqual([]);
  });
});
