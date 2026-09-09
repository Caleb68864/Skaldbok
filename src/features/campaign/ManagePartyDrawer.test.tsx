// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { ManagePartyDrawer } from './ManagePartyDrawer';
import type { Campaign } from '../../types/campaign';

/**
 * Hook-order regression for the party drawer.
 *
 * @remarks
 * `useModalBehaviour` used to be called after `if (!activeCampaign) return null`,
 * so the drawer rendered a different number of hooks depending on whether the
 * campaign had loaded yet. Mount it before the campaign context resolves — the
 * ordinary case, since the drawer is opened from a header that renders while
 * `CampaignContext` is still reading IndexedDB — and the next render throws
 * "Rendered more hooks than during the previous render", which takes the whole
 * screen to the error boundary.
 *
 * The linter found this; nothing else could have. Move the hook back below the
 * early return and this test fails.
 */

let activeCampaign: Campaign | null = null;

vi.mock('./CampaignContext', () => ({
  useCampaignContext: () => ({
    activeCampaign,
    activeParty: null,
    refreshParty: async () => {},
  }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast: () => {} }),
}));

vi.mock('../../storage/repositories/characterRepository', () => ({
  getAll: async () => [],
}));

vi.mock('../../storage/repositories/partyRepository', () => ({
  createParty: async () => ({ id: 'p1' }),
  addPartyMember: async () => {},
  softDeletePartyMember: async () => {},
}));

vi.mock('../../storage/repositories/campaignRepository', () => ({
  updateCampaign: async () => {},
}));

function campaign(): Campaign {
  return {
    id: 'camp-1',
    name: 'The Misty Vale',
    system: 'classic-fantasy',
  } as unknown as Campaign;
}

beforeEach(() => {
  activeCampaign = null;
});

describe('ManagePartyDrawer', () => {
  it('survives the campaign arriving after the first render', async () => {
    // First render: context still loading, component returns null.
    const { rerender, container } = render(<ManagePartyDrawer onClose={() => {}} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    // Second render: the campaign has loaded. The hook count must not change.
    activeCampaign = campaign();
    await act(async () => { rerender(<ManagePartyDrawer onClose={() => {}} />); });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('survives the campaign going away while the drawer is open', async () => {
    activeCampaign = campaign();
    const { rerender, container } = render(<ManagePartyDrawer onClose={() => {}} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    activeCampaign = null;
    await act(async () => { rerender(<ManagePartyDrawer onClose={() => {}} />); });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
