// @vitest-environment jsdom
// Before the Dexie singleton, as everywhere else that touches the real db.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../storage/db/client';
import { VaultBrowser } from '../kb/VaultBrowser';
import { VaultCard } from '../kb/VaultCard';
import type { KBNode } from '../../storage/db/client';

/**
 * A private note has to look private in the list, not only in the editor.
 *
 * @remarks
 * Marking a note private is a decision about an export that will happen later,
 * usually from a different screen. If the only place the state is visible is
 * inside the note, then the question a person actually asks — "is anything
 * being held back from the backup I am about to hand round the table?" — can
 * only be answered by opening every note one at a time, which nobody does.
 *
 * `VaultBrowser` is the note list: `/kb` renders it full, and the session
 * screen's "Session Notes" panel renders the same component compact. So it is
 * the one place this has to hold. It reads `kb_nodes`, which carry no
 * `visibility` of their own — a node is a projection of a note — so the browser
 * resolves the private set once per load and hands each card a boolean.
 *
 * Both directions are asserted. A badge on every row is as useless as a badge
 * on none.
 */

const CAMPAIGN_ID = 'camp-legibility';
const NOW = '2026-01-01T00:00:00.000Z';

vi.mock('../kb/useKBSearch', () => ({
  useKBSearch: () => [],
}));

vi.mock('../../hooks/useConfigurableDefaults', () => ({
  useKBCategoryTabs: () => [{ id: 'all', label: 'All' }],
}));

function node(over: Partial<KBNode> = {}): KBNode {
  return {
    id: 'node-x', type: 'note', label: 'A Node', scope: 'campaign',
    campaignId: CAMPAIGN_ID, sourceId: 'note-x', createdAt: NOW, updatedAt: NOW,
    ...over,
  } as KBNode;
}

async function seed(): Promise<void> {
  const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };
  for (const [id, title, visibility] of [
    ['note-hidden', 'The Reeve Sold the Ward-Stones', 'private'],
    ['note-shown', 'The Salt Road Toll House', 'public'],
  ] as const) {
    await db.notes.add({
      id, campaignId: CAMPAIGN_ID, sessionId: undefined, title, body: null, type: 'generic',
      status: 'active', pinned: false, scope: 'campaign', visibility, ...stamp,
    } as never);
    await db.kb_nodes.add({
      id: `node-${id}`, type: 'note', label: title, scope: 'campaign',
      campaignId: CAMPAIGN_ID, sourceId: id, createdAt: NOW, updatedAt: NOW,
    } as never);
  }
}

beforeEach(async () => {
  for (const table of db.tables) await table.clear();
  await seed();
});

// Globals are off, so Testing Library does not auto-clean.
afterEach(cleanup);

describe('the note list says which notes an export will leave out', () => {
  it('badges the private note and only the private note', async () => {
    render(
      <MemoryRouter>
        <VaultBrowser campaignId={CAMPAIGN_ID} />
      </MemoryRouter>,
    );

    // Both rows present first: a list that rendered nothing would satisfy
    // "exactly one badge" by accident.
    await waitFor(() => {
      expect(screen.getByText('The Reeve Sold the Ward-Stones')).toBeTruthy();
      expect(screen.getByText('The Salt Road Toll House')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Private')).toHaveLength(1);
    });

    // And it is on the right row. `closest('button')` is the card.
    const badge = screen.getByText('Private').closest('button');
    expect(badge?.textContent).toContain('The Reeve Sold the Ward-Stones');
    expect(badge?.textContent).not.toContain('The Salt Road Toll House');
  });

  it('shows no badge at all when nothing is private', async () => {
    await db.notes.update('note-hidden', { visibility: 'public' });

    render(
      <MemoryRouter>
        <VaultBrowser campaignId={CAMPAIGN_ID} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('The Reeve Sold the Ward-Stones')).toBeTruthy();
    });
    expect(screen.queryByText('Private')).toBeNull();
  });
});

describe('the card itself', () => {
  it('renders the badge when told the note is private', () => {
    render(<VaultCard node={node()} linkCount={0} isPrivate onClick={() => {}} />);
    expect(screen.getByText('Private')).toBeTruthy();
  });

  it('renders no badge otherwise, including when the flag is simply absent', () => {
    render(<VaultCard node={node()} linkCount={0} onClick={() => {}} />);
    expect(screen.queryByText('Private')).toBeNull();
  });
});
