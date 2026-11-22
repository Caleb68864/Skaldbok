// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { TrashEntityType } from '../features/trash/trashRegistry';

/**
 * A Trash section whose listing threw was reported by a toast only, and the
 * page then rendered from the sections that did load. With nothing else
 * deleted, that page was the empty state: "Nothing deleted", about rows it had
 * failed to read. The toast goes away; the false sentence stayed.
 */

const showToast = vi.fn();
const entities: TrashEntityType[] = [];

vi.mock('../features/trash/trashRegistry', () => ({ TRASH_ENTITY_TYPES: entities }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../features/campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeCampaign: { id: 'camp-1' } }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const { default: TrashScreen } = await import('./TrashScreen');

function entity(key: string, heading: string, load: TrashEntityType['load']): TrashEntityType {
  return { key, heading, scope: 'campaign', load };
}

beforeEach(() => {
  entities.length = 0;
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TrashScreen', () => {
  it('does not say "Nothing deleted" when a section failed to load', async () => {
    entities.push(
      entity('notes', 'Notes', async () => { throw new Error('IndexedDB read failed'); }),
      entity('ships', 'Ships & Vehicles', async () => []),
    );
    render(<TrashScreen />);

    expect((await screen.findByRole('alert')).textContent).toContain('Notes');
    expect(document.body.textContent).not.toContain('Nothing deleted');
  });

  it('keeps the failure on screen beside the sections that did load', async () => {
    entities.push(
      entity('notes', 'Notes', async () => { throw new Error('boom'); }),
      entity('ships', 'Ships & Vehicles', async () => [
        { id: 's1', title: 'The Kestrel', detail: 'Campaign vehicle', restore: async () => {} },
      ]),
    );
    render(<TrashScreen />);

    expect(await screen.findByText('The Kestrel')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain('Notes');
  });

  it('still shows the empty state when everything loaded and nothing is deleted', async () => {
    entities.push(entity('ships', 'Ships & Vehicles', async () => []));
    render(<TrashScreen />);

    expect(await screen.findByText(/Nothing deleted/)).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
