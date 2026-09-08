import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { generateId } from './ids';

/**
 * Guards the single id source.
 *
 * @remarks
 * `generateId` exists because `crypto.randomUUID` is gated to secure contexts,
 * and the project's own documented tablet-testing flow — `npm run preview` over
 * plain `http://<lan-ip>:4173` — is not one. There the function is `undefined`
 * and calling it throws a TypeError.
 *
 * Five call sites reached past it anyway, and one of them was
 * `ToastContext.showToast`. So on the tablet flow the app threw on every toast,
 * including the toast reporting the error that caused it.
 *
 * Nothing but a habit kept the other call sites in line, and a habit is not a
 * guard. This is: the fallback only helps code that goes through it.
 */

const SCAN_ROOT = 'src';

/** The one file entitled to name the platform API: the wrapper around it. */
const ALLOWED = ['src/utils/ids.ts'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('generateId', () => {
  it('produces a well-formed v4 UUID', () => {
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('produces distinct ids', () => {
    const ids = new Set(Array.from({ length: 500 }, generateId));
    expect(ids.size).toBe(500);
  });
});

describe('no source outside ids.ts calls crypto.randomUUID', () => {
  it('finds no bypass of generateId', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SCAN_ROOT)) {
      const rel = relative('.', file).replace(/\\/g, '/');
      if (ALLOWED.includes(rel)) continue;
      const text = readFileSync(file, 'utf8');
      // Match the call, not a mention of the name in prose: a doc comment is
      // free to explain why the wrapper exists.
      if (/crypto\s*\.\s*randomUUID\s*\(/.test(text)) offenders.push(rel);
    }
    expect(
      offenders,
      'crypto.randomUUID is undefined over plain-http LAN preview, which is this '
      + "project's own documented tablet flow. Call generateId() from utils/ids instead.",
    ).toEqual([]);
  });
});
