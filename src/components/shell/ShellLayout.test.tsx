// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * The shell's bottom padding exists for one reason — to keep content clear of
 * the floating session-log button — so it must exist exactly where that button
 * is drawn.
 *
 * @remarks
 * `<main>` carried `pb-[140px]` on every route, including `/session/log`, the
 * one route where `GlobalFAB` renders nothing. `SessionLog` is `h-full` inside
 * that padding, so on the capture screen 140px of the viewport was reserved for
 * a button that is not there. It went unnoticed until the backup reminder
 * banner joined the shell and took another ~60px: on a tablet in landscape the
 * entry list was then left about one row tall, and the sticky selection toolbar
 * covered it the moment an entry was selected — so a second entry could not be
 * picked for promotion at all. Measured in a real browser at 1024×768 before
 * this change: list area 50px, toolbar 54px.
 *
 * jsdom has no layout, so this cannot measure heights. It asserts the pairing
 * instead — padding present if and only if the button is — and it drives the
 * real `GlobalFAB`, so the two cannot drift apart by one of them changing its
 * route rule.
 */

vi.mock('./CampaignHeader', () => ({ CampaignHeader: () => null }));
vi.mock('./CharacterSubNav', () => ({ CharacterSubNav: () => null }));
vi.mock('./SessionSubNav', () => ({
  SessionSubNav: () => null,
  SESSION_SECTION_PREFIXES: ['/session', '/ledger', '/route'],
}));
vi.mock('./BottomNav', () => ({ BottomNav: () => null }));
vi.mock('./BackupReminderBanner', () => ({ BackupReminderBanner: () => null }));
vi.mock('../../features/campaign/CampaignCreateModal', () => ({ CampaignCreateModal: () => null }));
vi.mock('../../features/campaign/ManagePartyDrawer', () => ({ ManagePartyDrawer: () => null }));
vi.mock('../../features/session/SessionRefreshContext', () => ({
  SessionRefreshProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../features/campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeSession: { id: 's1' } }),
}));
vi.mock('../../context/AppStateContext', () => ({
  useAppState: () => ({ settings: {} }),
}));

const { ShellLayout } = await import('./ShellLayout');

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ShellLayout />}>
          <Route path="*" element={<div>screen</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function mainHasFabClearance(): boolean {
  return screen.getByRole('main').className.split(/\s+/).includes('pb-[140px]');
}

function fabShown(): boolean {
  return screen.queryByRole('button', { name: 'Open session log' }) !== null;
}

afterEach(() => {
  cleanup();
});

describe('ShellLayout bottom padding', () => {
  it('reserves room for the session-log button where it is drawn', () => {
    renderAt('/session');
    expect(fabShown()).toBe(true);
    expect(mainHasFabClearance()).toBe(true);
  });

  it('gives that room back to the capture screen, where the button is hidden', () => {
    renderAt('/session/log');
    expect(fabShown()).toBe(false);
    expect(mainHasFabClearance()).toBe(false);
  });

  it.each(['/character/sheet', '/character/gear', '/session', '/session/log', '/kb', '/reference', '/trash'])(
    '%s: padding if and only if the button',
    path => {
      renderAt(path);
      expect(mainHasFabClearance()).toBe(fabShown());
    },
  );
});
