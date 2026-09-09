import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The viewport meta tag must not disable pinch-zoom.
 *
 * @remarks
 * `maximum-scale=1.0, user-scalable=no` was set site-wide. That is a WCAG 1.4.4
 * failure — text has to be resizable to 200% — and it lands on precisely the
 * device this app targets: a tablet flat on a table, read at arm's length,
 * frequently by someone who would like the stat block bigger for a minute.
 *
 * It is also the kind of line that gets re-added by reflex, because suppressing
 * the zoom is the usual cargo-culted fix for iOS focus-zoom on inputs. The right
 * fix for that is a 16px input font size, which costs nobody their zoom.
 */
describe('index.html viewport', () => {
  const html = readFileSync('index.html', 'utf8');
  const viewport = /<meta\s+name="viewport"\s+content="([^"]*)"/.exec(html)?.[1];

  it('declares a viewport', () => {
    expect(viewport).toBeTruthy();
  });

  it('does not pin the maximum scale', () => {
    expect(viewport).not.toMatch(/maximum-scale/);
  });

  it('does not disable user scaling', () => {
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
  });
});
