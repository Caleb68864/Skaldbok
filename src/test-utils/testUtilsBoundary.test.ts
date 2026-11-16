import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');
const TEST_FILE = /\.test\.tsx?$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * `src/test-utils/` holds helpers no shipped code calls. A shipped module that
 * imported one would put it back in the bundle, so the boundary is checked
 * from source rather than remembered.
 */
describe('test-utils boundary', () => {
  it('no shipped module imports from src/test-utils/', () => {
    const testUtils = join(SRC, 'test-utils');
    const offenders = sourceFiles(SRC)
      .filter((path) => !TEST_FILE.test(path) && !path.startsWith(testUtils))
      .filter((path) => /from\s+['"][^'"]*test-utils\//.test(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path));
    expect(offenders).toEqual([]);
  });
});
