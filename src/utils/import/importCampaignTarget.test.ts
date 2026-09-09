import { describe, it, expect } from 'vitest';
import {
  CAMPAIGN_SCOPED_BUNDLE_KEYS,
  resolveImportCampaignTarget,
} from './importCampaignTarget';
import { BUNDLE_PROCESSING_ORDER } from '../../types/bundleTables';
import type { BundleEnvelope } from '../../types/bundle';

/**
 * The campaign requirement of an import.
 *
 * @remarks
 * These tests exist because the Import action used to be reachable only with a
 * campaign already active, so a genuinely fresh install had to *create* a
 * campaign before it could *restore* one — the recovery path gated on the thing
 * being recovered. The gate was `bundle.type === 'character' || 'session'`,
 * which is wrong on its own terms too: `CharacterRecord` carries no
 * `campaignId`.
 */

const NOW = '2026-01-01T00:00:00.000Z';

function envelope(partial: Partial<BundleEnvelope>): BundleEnvelope {
  return {
    version: 1,
    type: 'campaign',
    exportedAt: NOW,
    system: 'classic-fantasy',
    contents: {},
    ...partial,
  } as BundleEnvelope;
}

const campaignRow = {
  id: 'camp-1',
  name: 'The Iron Circle',
  system: 'classic-fantasy',
  status: 'active' as const,
  schemaVersion: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

const noteRow = {
  id: 'note-1',
  campaignId: 'camp-1',
  title: 'A note',
  type: 'generic',
  status: 'active' as const,
  scope: 'shared' as const,
  pinned: false,
  content: '',
  schemaVersion: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

describe('CAMPAIGN_SCOPED_BUNDLE_KEYS', () => {
  it('derives exactly the bundle groups whose rows carry a campaignId', () => {
    // Pinned explicitly. If a Zod upgrade breaks the introspection this set
    // silently empties, which would read as "nothing needs a campaign" and let
    // orphaned rows through on the one path where that is unrecoverable.
    expect([...CAMPAIGN_SCOPED_BUNDLE_KEYS].sort()).toEqual(
      [
        'attachments',
        'creatureTemplates',
        'encounters',
        'inventoryContainers',
        'kbEdges',
        'kbNodes',
        'ledgerAccounts',
        'ledgerEntries',
        'ledgerSplits',
        'notes',
        'parties',
        'recurringBills',
        'routePlans',
        'routeStops',
        'sessions',
        'ships',
      ].sort(),
    );
  });

  it('names only keys the bundle registry knows about', () => {
    for (const key of CAMPAIGN_SCOPED_BUNDLE_KEYS) {
      expect(BUNDLE_PROCESSING_ORDER).toContain(key);
    }
  });

  it('excludes the device-global tables, which is why a character needs no campaign', () => {
    expect(CAMPAIGN_SCOPED_BUNDLE_KEYS.has('characters')).toBe(false);
    expect(CAMPAIGN_SCOPED_BUNDLE_KEYS.has('systems')).toBe(false);
    expect(CAMPAIGN_SCOPED_BUNDLE_KEYS.has('campaign')).toBe(false);
  });
});

describe('resolveImportCampaignTarget', () => {
  it('restores a campaign bundle under its own campaign, asking nothing', () => {
    const bundle = envelope({
      type: 'campaign',
      contents: { campaign: campaignRow, notes: [noteRow] },
    });

    expect(resolveImportCampaignTarget(bundle, ['campaign', 'notes'])).toEqual({
      kind: 'bundled',
      campaignId: 'camp-1',
      campaignName: 'The Iron Circle',
    });
  });

  it('requires no campaign for a character-only bundle', () => {
    // The case the owner named: restoring a character onto a device with no
    // campaigns at all. `characters` is a global table, so there is nothing to
    // parent and nothing to ask.
    const bundle = envelope({
      type: 'character',
      contents: { characters: [{ id: 'char-1', name: 'Astrid' }] },
    });

    expect(resolveImportCampaignTarget(bundle, ['characters'])).toEqual({
      kind: 'not-required',
    });
  });

  it('asks for a campaign when the character brings campaign-scoped notes', () => {
    const bundle = envelope({
      type: 'character',
      contents: { characters: [{ id: 'char-1', name: 'Astrid' }], notes: [noteRow] },
    });

    const target = resolveImportCampaignTarget(bundle, ['characters', 'notes']);
    expect(target.kind).toBe('required');
    if (target.kind !== 'required') return;
    expect(target.groupLabels).toEqual(['Notes']);
  });

  it('drops back to not-required when the campaign-scoped groups are deselected', () => {
    // The escape hatch on a fresh install: keep the character, leave its notes.
    const bundle = envelope({
      type: 'character',
      contents: { characters: [{ id: 'char-1', name: 'Astrid' }], notes: [noteRow] },
    });

    expect(resolveImportCampaignTarget(bundle, ['characters'])).toEqual({
      kind: 'not-required',
    });
  });

  it('asks when the user deselects the campaign but keeps its contents', () => {
    // A real choice — taking a friend's creature templates into your own
    // campaign — so it is asked, not guessed.
    const bundle = envelope({
      type: 'campaign',
      contents: { campaign: campaignRow, notes: [noteRow] },
    });

    const target = resolveImportCampaignTarget(bundle, ['notes']);
    expect(target.kind).toBe('required');
  });

  it('ignores campaign-scoped groups that are present but empty', () => {
    const bundle = envelope({
      type: 'character',
      contents: { characters: [{ id: 'char-1', name: 'Astrid' }], notes: [] },
    });

    expect(resolveImportCampaignTarget(bundle, ['characters', 'notes'])).toEqual({
      kind: 'not-required',
    });
  });

  it('requires a campaign for a session bundle, which carries one without bringing it', () => {
    const bundle = envelope({
      type: 'session',
      contents: {
        sessions: [
          {
            id: 'sess-1',
            campaignId: 'camp-1',
            title: 'Session One',
            status: 'ended',
            date: '2026-01-01',
            startedAt: NOW,
            schemaVersion: 1,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
    });

    const target = resolveImportCampaignTarget(bundle, ['sessions']);
    expect(target.kind).toBe('required');
    if (target.kind !== 'required') return;
    expect(target.groupLabels).toEqual(['Sessions']);
  });
});
