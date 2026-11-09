// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BacklinksPanel } from './BacklinksPanel';

/**
 * A storage failure was shown as "No notes link here yet."
 *
 * @remarks
 * `useBacklinks` caught its read with `.catch(() => {})` and kept `[]`, and the
 * panel resolved each edge's source inside a bare `catch {}` that also dropped
 * the row. Both turn "the database refused" into a statement about the user's
 * notes. Every case below fails against that code: the first renders the
 * empty-state sentence, the second renders it too (the one edge's read threw,
 * leaving zero nodes), and the hook result had no `error` to read.
 */

const getEdgesToNode = vi.fn();
const getNodeById = vi.fn();

vi.mock('../../storage/repositories/kbEdgeRepository', () => ({
  getEdgesToNode: (...a: unknown[]) => getEdgesToNode(...a),
  getEdgesFromNode: vi.fn(async () => []),
}));
vi.mock('../../storage/repositories/kbNodeRepository', () => ({
  getNodeById: (...a: unknown[]) => getNodeById(...a),
  getNodesByType: vi.fn(),
  getNodeByLabel: vi.fn(),
}));

beforeEach(() => {
  getEdgesToNode.mockReset();
  getNodeById.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPanel() {
  return render(
    <MemoryRouter>
      <BacklinksPanel nodeId="note-1" />
    </MemoryRouter>,
  );
}

describe('BacklinksPanel error reporting', () => {
  it('says the edge read failed instead of claiming nothing links here', async () => {
    getEdgesToNode.mockRejectedValue(new Error('IndexedDB is closed'));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      "Couldn't load backlinks — IndexedDB is closed",
    );
    expect(screen.queryByText('No notes link here yet.')).toBeNull();
  });

  it('counts a source node whose read threw rather than silently dropping it', async () => {
    getEdgesToNode.mockResolvedValue([{ id: 'e1', fromId: 'note-2', toId: 'note-1' }]);
    getNodeById.mockRejectedValue(new Error('read failed'));
    renderPanel();
    expect((await screen.findByRole('alert')).textContent).toBe("1 backlink couldn't be read.");
    expect(screen.queryByText('No notes link here yet.')).toBeNull();
  });

  it('still skips a stale edge whose node is simply gone', async () => {
    getEdgesToNode.mockResolvedValue([{ id: 'e1', fromId: 'note-2', toId: 'note-1' }]);
    getNodeById.mockResolvedValue(undefined);
    renderPanel();
    await waitFor(() => expect(getNodeById).toHaveBeenCalled());
    expect(await screen.findByText('No notes link here yet.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
