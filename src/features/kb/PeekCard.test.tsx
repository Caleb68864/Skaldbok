// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PeekCard } from './PeekCard';

/**
 * A long press that hit a storage failure looked like nothing happened.
 *
 * @remarks
 * The loader was one bare `catch { onClose() }`, so a rejected read closed the
 * card before it rendered, and a note body that failed `JSON.parse` took the
 * same exit, hiding a node that had loaded. The first three cases fail against
 * that code; the last pins the stale-link behaviour, which did not change.
 */

const getNodeById = vi.fn();
const getNoteById = vi.fn();
vi.mock('../../storage/repositories/kbNodeRepository', () => ({
  getNodeById: (...a: unknown[]) => getNodeById(...a),
}));
vi.mock('../../storage/repositories/noteRepository', () => ({
  getNoteById: (...a: unknown[]) => getNoteById(...a),
}));

const node = { id: 'n1', label: 'Grimsby', type: 'location', sourceId: 'note-1' };

beforeEach(() => {
  getNodeById.mockReset();
  getNoteById.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PeekCard', () => {
  it('says the preview could not load instead of closing on a failed node read', async () => {
    getNodeById.mockRejectedValue(new Error('IDB gone'));
    const onClose = vi.fn();
    render(<PeekCard nodeId="n1" onClose={onClose} onOpen={() => {}} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't load this preview");
    expect(alert.textContent).toContain('IDB gone');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the node on screen when the note read fails', async () => {
    getNodeById.mockResolvedValue(node);
    getNoteById.mockRejectedValue(new Error('note read failed'));
    const onClose = vi.fn();
    render(<PeekCard nodeId="n1" onClose={onClose} onOpen={() => {}} />);
    expect(await screen.findByText('Grimsby')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toContain('note read failed');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says a corrupt body is damaged rather than closing', async () => {
    getNodeById.mockResolvedValue(node);
    getNoteById.mockResolvedValue({ id: 'note-1', body: '{not json', visibility: 'public' });
    const onClose = vi.fn();
    render(<PeekCard nodeId="n1" onClose={onClose} onOpen={() => {}} />);
    expect(await screen.findByText('Grimsby')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toContain('damaged');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still closes quietly on a link whose node no longer exists', async () => {
    getNodeById.mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<PeekCard nodeId="n1" onClose={onClose} onOpen={() => {}} />);
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
