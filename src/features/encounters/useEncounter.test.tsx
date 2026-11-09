// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import { useEncounter } from './useEncounter';

/**
 * `useEncounter` turned load failures into states that look like something else.
 *
 * @remarks
 * A rejected `getById` was an unhandled rejection from the mount effect and a
 * missing encounter was plain `null`; `EncounterScreen` renders "Loading
 * encounter..." for `null`, so both looked like a load that never finishes. A
 * failed attached-notes read was a bare `catch` → `[]`, rendered as "No notes
 * attached yet." The hook exposed no field that could tell these apart, so
 * every case below fails against the old hook (`loadError` and
 * `linkedNotesError` were `undefined`).
 */

const getById = vi.fn();
const getLinksFrom = vi.fn();
const getNoteById = vi.fn();

vi.mock('../../storage/repositories/encounterRepository', () => ({
  getById: (...a: unknown[]) => getById(...a),
}));
vi.mock('../../storage/repositories/entityLinkRepository', () => ({
  getLinksFrom: (...a: unknown[]) => getLinksFrom(...a),
}));
vi.mock('../../storage/repositories/noteRepository', () => ({
  getNoteById: (...a: unknown[]) => getNoteById(...a),
}));
vi.mock('../../storage/repositories/creatureTemplateRepository', () => ({}));
vi.mock('../../storage/repositories/characterRepository', () => ({ getById: vi.fn() }));

beforeEach(() => {
  getById.mockReset();
  getLinksFrom.mockReset();
  getNoteById.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useEncounter load errors', () => {
  it('reports a rejected encounter read instead of staying "loading"', async () => {
    getById.mockRejectedValue(new Error('DatabaseClosedError'));
    const { result } = renderHook(() => useEncounter('enc-1'));
    await waitFor(() => expect(result.current.loadError).toBe('DatabaseClosedError'));
    expect(result.current.encounter).toBeNull();
  });

  it('reports a missing encounter instead of staying "loading"', async () => {
    getById.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEncounter('gone'));
    await waitFor(() => expect(result.current.loadError).toBe('This encounter no longer exists.'));
  });

  it('reports a failed attached-notes read instead of "no notes"', async () => {
    getById.mockResolvedValue({ id: 'enc-1', participants: [] });
    getLinksFrom.mockRejectedValue(new Error('links: read failed'));
    const { result } = renderHook(() => useEncounter('enc-1'));
    await waitFor(() => expect(result.current.linkedNotesError).toBe('links: read failed'));
    expect(result.current.encounter).not.toBeNull();
    expect(result.current.loadError).toBeNull();
  });

  it('loads cleanly with no errors on the happy path', async () => {
    getById.mockResolvedValue({ id: 'enc-1', participants: [] });
    getLinksFrom.mockResolvedValue([{ toEntityType: 'note', toEntityId: 'n1' }]);
    getNoteById.mockResolvedValue({ id: 'n1' });
    const { result } = renderHook(() => useEncounter('enc-1'));
    await waitFor(() => expect(result.current.linkedNotes).toHaveLength(1));
    expect(result.current.linkedNotesError).toBeNull();
    expect(result.current.loadError).toBeNull();
  });
});
