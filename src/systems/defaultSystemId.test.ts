import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DEFAULT_SYSTEM_ID } from './defaultSystemId';
import { BUNDLED_SYSTEMS, DEFAULT_SYSTEM_ID as REGISTRY_DEFAULT } from './registry';

/**
 * Roadmap D12: the default system's id was spelled as a literal in fallback
 * sites while `DEFAULT_SYSTEM_ID` existed.
 *
 * @remarks
 * Eight sites were fixed in 1411b67; three were left (`bundleParser`,
 * `bundleSerializer`, the campaign schema's default). Changing the default
 * would have changed some fallbacks and not others. This fails on a quoted
 * `'classic-fantasy'` in any non-test source file not listed below.
 */

const SRC = join(process.cwd(), 'src');
const LITERAL = /(['"`])classic-fantasy\1/;

/** Files that may spell the id, with the reason. */
const ALLOWED: Record<string, string> = {
  'systems/defaultSystemId.ts': 'the definition itself',
  'utils/importExport.ts':
    'the legacy system-id alias table: it maps old ids onto this one, which is a statement about stored data, not a fallback',
  'features/characters/characterMappers.ts':
    'blank templates keyed by system id, like the registry; `characterMappers.test.ts` checks every registered system has one',
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Code lines only: prose about the ruleset is not a fallback. */
function codeLines(source: string): string[] {
  return source.split('\n').filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line));
}

describe('DEFAULT_SYSTEM_ID', () => {
  it('names a bundled system, and the registry re-exports the same value', () => {
    expect(BUNDLED_SYSTEMS.map((s) => s.id)).toContain(DEFAULT_SYSTEM_ID);
    expect(REGISTRY_DEFAULT).toBe(DEFAULT_SYSTEM_ID);
  });

  it('is the only spelling of the default id outside the allowlist', () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file).split('\\').join('/'))
      .filter((rel) => !(rel in ALLOWED))
      .flatMap((rel) =>
        codeLines(readFileSync(join(SRC, rel), 'utf8'))
          .filter((line) => LITERAL.test(line))
          .map((line) => `${rel}: ${line.trim()}`),
      );
    expect(offenders, 'use DEFAULT_SYSTEM_ID (systems/defaultSystemId.ts) instead').toEqual([]);
  });

  it('keeps the allowlist honest', () => {
    for (const [rel, reason] of Object.entries(ALLOWED)) {
      const code = codeLines(readFileSync(join(SRC, rel), 'utf8'));
      expect(code.some((line) => LITERAL.test(line)), `${rel} no longer spells the id; drop it`).toBe(true);
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it('is what a campaign row with no system gets', async () => {
    const { campaignSchema } = await import('../types/campaign');
    const parsed = campaignSchema.parse({
      id: 'c', name: 'C', status: 'active', schemaVersion: 1, createdAt: 'x', updatedAt: 'x',
    } as never);
    expect(parsed.system).toBe(DEFAULT_SYSTEM_ID);
  });
});
