import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CampaignHeader } from './CampaignHeader';
import { CharacterSubNav } from './CharacterSubNav';
import { SessionSubNav, SESSION_SECTION_PREFIXES } from './SessionSubNav';
import { BottomNav } from './BottomNav';
import { GlobalFAB } from './GlobalFAB';
import { BackupReminderBanner } from './BackupReminderBanner';
import { CampaignCreateModal } from '../../features/campaign/CampaignCreateModal';
import { ManagePartyDrawer } from '../../features/campaign/ManagePartyDrawer';
import { SessionRefreshProvider } from '../../features/session/SessionRefreshContext';
import { isFabHiddenRoute } from './fabRoutes';

/**
 * Root layout component that wraps every authenticated route in Skaldmark.
 *
 * @remarks
 * `ShellLayout` is used as the `element` for the top-level React Router route
 * so that its chrome (header, nav, FAB) is always present regardless of which
 * sub-route is active. Child routes are rendered via React Router's
 * `<Outlet />` inside the scrollable `<main>` region.
 *
 * ### Structure (top -> bottom)
 * 1. **CampaignHeader** — Campaign name, active-session indicator, and action
 *    buttons that open the campaign-create modal and party-management drawer.
 * 2. **CharacterSubNav** _(conditional)_ — Secondary tab bar shown only when
 *    the current path starts with `/character`.
 * 3. **`<main>`** — Flex-grow scrollable content area that hosts the `<Outlet>`.
 * 4. **BottomNav** — Persistent three-tab primary navigation.
 * 5. **GlobalFAB** — Floating action button that navigates to the full-screen
 *    session log (`/session/log`); it hides itself while already there.
 * 6. **CampaignCreateModal** / **ManagePartyDrawer** — Conditionally mounted
 *    modals controlled by local boolean state.
 *
 * The outer `div` uses `h-dvh` with `overflow-hidden` so the shell
 * itself never scrolls — only the `<main>` content area does.
 *
 * @example
 * // In your router definition:
 * <Route element={<ShellLayout />}>
 *   <Route path="/character/sheet" element={<CharacterSheetPage />} />
 *   <Route path="/session" element={<SessionPage />} />
 * </Route>
 */
export function ShellLayout() {
  const location = useLocation();
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showManageParty, setShowManageParty] = useState(false);
  const isCharacterTab = location.pathname.startsWith('/character');
  // The ledger and the route are campaign-scoped, so they sit under the session
  // sub-nav rather than the character one — see `SESSION_SECTION_PREFIXES`.
  const isSessionTab = SESSION_SECTION_PREFIXES.some(
    p => location.pathname === p || location.pathname.startsWith(p + '/'),
  );

  return (
    <SessionRefreshProvider>
      <div className="flex flex-col h-dvh overflow-hidden">
        <CampaignHeader
          onCreateCampaign={() => setShowCreateCampaign(true)}
          onManageParty={() => setShowManageParty(true)}
        />
        {isCharacterTab && <CharacterSubNav />}
        {isSessionTab && <SessionSubNav />}
        <BackupReminderBanner />
        {/* The shell puts a header, up to two tab rows and sometimes a banner
            ahead of the content on every route, so a keyboard or switch user
            tabbed through all of it on each navigation. There was no skip link
            anywhere in the app and `<main>` had neither a name nor an id to
            skip to. It is visually hidden until focused, which is the point:
            the first Tab on any screen now offers it. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[400] focus:m-[var(--space-sm)] focus:rounded-[var(--radius-md)] focus:bg-[var(--color-surface-raised)] focus:px-[var(--space-md)] focus:py-[var(--space-sm)] focus:text-[var(--color-text)]"
        >
          Skip to main content
        </a>
        {/* `pb-[140px]` keeps content clear of the floating session-log
            button, so it goes wherever that button does. On `/session/log`
            the button is hidden, and the padding was reserving 140px of the
            capture screen for nothing — enough, once the backup banner also
            took its share, to leave the entry list one row tall on a tablet
            in landscape. See `fabRoutes.ts`. */}
        <main
          id="main-content"
          aria-label="Main content"
          className={`flex-1 overflow-y-auto overflow-x-hidden${isFabHiddenRoute(location.pathname) ? '' : ' pb-[140px]'}`}
        >
          <Outlet />
        </main>
        <BottomNav />
        <GlobalFAB />
        {showCreateCampaign && (
          <CampaignCreateModal onClose={() => setShowCreateCampaign(false)} />
        )}
        {showManageParty && (
          <ManagePartyDrawer onClose={() => setShowManageParty(false)} />
        )}
      </div>
    </SessionRefreshProvider>
  );
}
