import { useEffect, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useCampaignContext } from '../../features/campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import { SessionQuickActions } from '../../features/session/SessionQuickActions';
import { useSessionRefresh } from '../../features/session/SessionRefreshContext';
import { Drawer } from '../primitives/Drawer';
import { cn } from '@/lib/utils';

/**
 * Global Floating Action Button (FAB) that hosts the full session quick-log
 * surface (notes, NPCs, encounters, skill checks, spells, abilities, shopping,
 * and so on).
 *
 * @remarks
 * The FAB is always mounted inside {@link ShellLayout} so it appears on every
 * route. Pressing the button when no session is active shows a toast instead
 * of opening the drawer.
 *
 * When a session is active, pressing the FAB opens a bottom-sheet drawer
 * containing {@link SessionQuickActions} — the same 16-action grid that used
 * to live inside the Quick Log WorkspacePanel on the session screen. Moving
 * it into the FAB cleans up the session screen and gives every quick-log
 * action a single, consistent entry point.
 *
 * The FAB subscribes to {@link useSessionRefresh} so that logged items bump
 * the shared refresh tokens — session-scoped views (session notes, timeline)
 * re-query automatically when an item is added from anywhere in the shell.
 * That removes the "had to refresh the page" bug where notes logged from the
 * FAB didn't appear in the Session Notes list until a manual reload.
 *
 * External callers can open the drawer via `SessionRefreshContext.openQuickLog(actionId)`
 * — this powers the "Add to Timeline" button on the session timeline.
 *
 * @example
 * // Rendered automatically by ShellLayout — no props required.
 * <GlobalFAB />
 */
export function GlobalFAB() {
  const { activeSession } = useCampaignContext();
  const { showToast } = useToast();
  const {
    bumpAll,
    clearQuickLogRequest,
    requestedQuickLogAction,
    requestedQuickLogNonce,
  } = useSessionRefresh();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // When an external caller asks the FAB to open with a specific action
  // (e.g. "Add to Timeline" → openQuickLog('note')), open the drawer. The
  // requestedAction + nonce are forwarded to SessionQuickActions below so the
  // matching sub-drawer opens automatically.
  useEffect(() => {
    if (requestedQuickLogNonce === 0) return;
    if (!activeSession) {
      showToast('Start a session first');
      return;
    }
    setDrawerOpen(true);
  }, [requestedQuickLogNonce, activeSession, showToast]);

  const handleFABPress = () => {
    if (!activeSession) {
      showToast('Start a session first');
      return;
    }
    // Clear any stale requested action before a manual open so the drawer
    // shows the quick-log grid rather than jumping straight into the last
    // sub-drawer (e.g. "Add to Timeline" setting 'note').
    clearQuickLogRequest();
    setDrawerOpen((v) => !v);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    clearQuickLogRequest();
  };

  return (
    <>
      <button
        onClick={handleFABPress}
        aria-label={activeSession ? 'Open quick log' : 'Start a session first'}
        className={cn(
          'fixed bottom-[68px] right-4 z-40 w-14 h-14 rounded-full bg-accent text-[var(--color-on-accent,#fff)] border-none shadow-[0_4px_16px_rgba(0,0,0,0.3)] cursor-pointer flex items-center justify-center transition-transform',
          drawerOpen && 'rotate-45',
        )}
      >
        {activeSession ? <Sparkles className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>

      <Drawer open={drawerOpen} onClose={closeDrawer} title="Quick Log">
        <SessionQuickActions
          onLogComplete={bumpAll}
          requestedAction={requestedQuickLogAction}
          requestNonce={requestedQuickLogNonce}
        />
      </Drawer>
    </>
  );
}
