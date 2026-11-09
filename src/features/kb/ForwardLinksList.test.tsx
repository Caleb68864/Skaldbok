// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForwardLinksList } from './ForwardLinksList';
import type { KBEdge } from '../../storage/db/client';

/**
 * One failed target read emptied the whole forward-links list, silently.
 *
 * @remarks
 * The old loop awaited `getNodeById` with no `catch`: a rejection on the first
 * edge abandoned the rest and left the list blank under its "(N)" heading. The
 * first case fails against that code (no rendered link, no alert); it was not
 * importable for testing before, because it was a private function in
 * `NoteReader`.
 */

const getNodeById = vi.fn();
vi.mock('../../storage/repositories/kbNodeRepository', () => ({
  getNodeById: (...a: unknown[]) => getNodeById(...a),
}));

const edges = [
  { id: 'e1', fromId: 'note-1', toId: 'note-bad' },
  { id: 'e2', fromId: 'note-1', toId: 'note-ok' },
] as unknown as KBEdge[];

beforeEach(() => {
  getNodeById.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ForwardLinksList', () => {
  it('keeps the readable links and reports the unreadable one', async () => {
    getNodeById.mockImplementation(async (id: string) => {
      if (id === 'note-bad') throw new Error('read failed');
      return { id, label: 'Grimsby', type: 'location' };
    });
    render(<MemoryRouter><ForwardLinksList edges={edges} /></MemoryRouter>);
    expect(await screen.findByText('Grimsby')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toBe("1 link couldn't be read.");
  });

  it('skips a target that no longer exists without an alert', async () => {
    getNodeById.mockImplementation(async (id: string) =>
      id === 'note-ok' ? { id, label: 'Grimsby', type: 'location' } : undefined,
    );
    render(<MemoryRouter><ForwardLinksList edges={edges} /></MemoryRouter>);
    expect(await screen.findByText('Grimsby')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
