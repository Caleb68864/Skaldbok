import { describe, it, expect } from 'vitest';
import { resolveSheetPanelOrder } from './panelOrder';

const FALLBACK = ['identity', 'attributes', 'resources', 'derived', 'rest', 'storyBank'];
const avail = (...keys: string[]): Record<string, boolean> =>
  Object.fromEntries(keys.map(k => [k, true]));

describe('resolveSheetPanelOrder', () => {
  it('uses the template keys (filtered to available) when the template declares any', () => {
    const { defaultOrder, panelOrder } = resolveSheetPanelOrder(
      ['identity', 'attributes', 'resources'],
      FALLBACK,
      avail('identity', 'attributes', 'resources', 'derived'),
      undefined,
    );
    expect(defaultOrder).toEqual(['identity', 'attributes', 'resources']);
    expect(panelOrder).toEqual(['identity', 'attributes', 'resources']);
  });

  it('falls back to the canonical sequence when there is no template', () => {
    const { defaultOrder } = resolveSheetPanelOrder(
      [],
      FALLBACK,
      avail('identity', 'attributes', 'derived'),
      undefined,
    );
    // Canonical order, filtered to available (resources/rest/storyBank unavailable here).
    expect(defaultOrder).toEqual(['identity', 'attributes', 'derived']);
  });

  it('falls back to canonical when a template lists only unavailable/typo keys (never blanks the sheet)', () => {
    const { defaultOrder, panelOrder } = resolveSheetPanelOrder(
      ['vitals', 'skills', 'nonsense'], // card keys / typos, none are sheet panels
      FALLBACK,
      avail('identity', 'attributes', 'resources'),
      undefined,
    );
    expect(defaultOrder).toEqual(['identity', 'attributes', 'resources']);
    expect(panelOrder).not.toHaveLength(0);
    expect(panelOrder).toContain('identity');
  });

  it('keeps the persisted drag order first, dropping now-unavailable keys', () => {
    const { panelOrder } = resolveSheetPanelOrder(
      [],
      FALLBACK,
      avail('identity', 'attributes', 'resources'),
      ['resources', 'identity', 'gone'], // user reordered; 'gone' no longer available
    );
    // Stored order wins for the available keys; 'gone' dropped; 'attributes'
    // (available but not in stored) appended in canonical order.
    expect(panelOrder).toEqual(['resources', 'identity', 'attributes']);
  });

  it('appends newly-available panels not present in the stored order', () => {
    const { panelOrder } = resolveSheetPanelOrder(
      [],
      FALLBACK,
      avail('identity', 'attributes', 'resources', 'derived'),
      ['identity', 'attributes'], // an older stored order, before derived/resources existed
    );
    expect(panelOrder).toEqual(['identity', 'attributes', 'resources', 'derived']);
  });
});
