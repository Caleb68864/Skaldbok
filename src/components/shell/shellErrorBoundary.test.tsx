// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ShellLayout } from './ShellLayout';

vi.mock('./CampaignHeader', () => ({ CampaignHeader: () => <header>header</header> }));
vi.mock('./CharacterSubNav', () => ({ CharacterSubNav: () => null }));
vi.mock('./SessionSubNav', () => ({ SessionSubNav: () => null, SESSION_SECTION_PREFIXES: [] }));
vi.mock('./BottomNav', () => ({ BottomNav: () => <nav>bottom nav</nav> }));
vi.mock('./GlobalFAB', () => ({ GlobalFAB: () => null }));
vi.mock('./BackupReminderBanner', () => ({ BackupReminderBanner: () => null }));
vi.mock('../../features/campaign/CampaignCreateModal', () => ({ CampaignCreateModal: () => null }));
vi.mock('../../features/campaign/ManagePartyDrawer', () => ({ ManagePartyDrawer: () => null }));
vi.mock('../../features/campaign/CampaignContext', () => ({ useCampaignContext: () => ({ activeCampaign: null }) }));

function Broken(): never {
  throw new Error('panel exploded');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a screen that throws', () => {
  it('leaves the shell standing and names the route in the report', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/ledger']}>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route path="/ledger" element={<Broken />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('bottom nav')).toBeTruthy();
    expect(screen.getByText('header')).toBeTruthy();
    expect(screen.getByText(/panel exploded/)).toBeTruthy();
    expect(screen.getByText(/\/ledger/)).toBeTruthy();
  });
});
