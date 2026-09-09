import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Import must be reachable with no campaign.
 *
 * @remarks
 * The Import action lived inside `{activeCampaign && ( … )}` in the overflow
 * menu, so a genuinely fresh install had to *create* a campaign before it could
 * *restore* one — the recovery path gated on the thing being recovered. It was
 * recorded as a known gap in the README rather than fixed, because from inside a
 * populated database it never shows.
 *
 * A source scan rather than a render, in the style of this repo's other
 * convention tests (`navigationCatalogue`, `engineConsumers`, `trashRegistry`):
 * `CampaignHeader` pulls in five contexts, Radix portals and an async system
 * definition, and a render harness for all that would test the harness. The
 * regression is structural — one JSX conditional moving back around one button —
 * so the guard is structural too.
 *
 * This test does not care where the button lives. It cares that no path to
 * `startImport()` is nested inside an `activeCampaign` conditional.
 */

const HEADER = join(__dirname, 'CampaignHeader.tsx');

/**
 * Returns the source with every `{activeCampaign && ( … )}` region removed,
 * matched by balancing braces and parentheses rather than by regex, so
 * reformatting the JSX cannot quietly turn the guard off.
 */
function withoutCampaignGatedRegions(source: string): string {
  const OPENER = '{activeCampaign && (';
  let out = '';
  let index = 0;

  for (;;) {
    const start = source.indexOf(OPENER, index);
    if (start === -1) {
      out += source.slice(index);
      return out;
    }
    out += source.slice(index, start);

    // Walk from the region's opening brace until it balances.
    let depth = 0;
    let cursor = start;
    for (; cursor < source.length; cursor++) {
      const char = source[cursor];
      if (char === '{' || char === '(') depth++;
      else if (char === '}' || char === ')') {
        depth--;
        if (depth === 0) { cursor++; break; }
      }
    }
    expect(depth, 'unbalanced {activeCampaign && ( … )} region in CampaignHeader.tsx').toBe(0);
    index = cursor;
  }
}

describe('the Import action is reachable without a campaign', () => {
  const source = readFileSync(HEADER, 'utf8');

  it('reads a CampaignHeader that still calls startImport', () => {
    // Guards the guard: if the button is renamed or moved to another file this
    // test would otherwise pass by finding nothing to check.
    expect(source).toContain('startImport()');
    expect(source).toContain('{activeCampaign && (');
  });

  it('calls startImport outside every activeCampaign-gated region', () => {
    const ungated = withoutCampaignGatedRegions(source);
    expect(
      ungated,
      'Import is gated on an active campaign again. A device restoring a backup '
      + 'has no campaign yet — that is the whole point of restoring one. Export '
      + 'may stay gated (there is nothing to export); Import may not.',
    ).toContain('startImport()');
  });

  it('still gates the campaign exports, which genuinely need a campaign', () => {
    const ungated = withoutCampaignGatedRegions(source);
    expect(ungated).not.toContain('exportCampaign(');
    expect(ungated).not.toContain('exportAllNotes(');
  });
});
