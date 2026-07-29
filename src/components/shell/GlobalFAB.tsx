import { Plus, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCampaignContext } from '../../features/campaign/CampaignContext';
import { useAppState } from '../../context/AppStateContext';

/**
 * Global Floating Action Button (FAB), mounted once in
 * {@link components/shell/ShellLayout!ShellLayout | ShellLayout} so it is
 * available from any route. It renders nothing in two cases: when the user has
 * turned it off via `settings.showGlobalFAB`, and while already on
 * `/session/log`.
 *
 * @remarks
 * Pressing the FAB navigates to the full-screen session log
 * (`/session/log`) rather than opening an in-place drawer. `SessionLog`
 * itself handles the no-active-session case with its own empty state and
 * Start session button, so the press behaviour is the same either way — the
 * FAB never branches on `activeSession` before navigating.
 *
 * It does read `activeSession` for one thing: the icon. A running session
 * shows {@link Sparkles}, no session shows {@link Plus}, so the shell carries
 * an at-a-glance session indicator on every route. Both icons navigate
 * identically and share one `aria-label`, so this is a visual affordance only.
 *
 * The FAB hides itself while already on `/session/log` so it never overlaps
 * the docked `WritePad` or the entry list.
 *
 * @example
 * // Rendered automatically by ShellLayout — no props required.
 * <GlobalFAB />
 */
export function GlobalFAB() {
  const { activeSession } = useCampaignContext();
  const { settings } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();

  if (settings.showGlobalFAB === false) return null;
  if (location.pathname === '/session/log') return null;

  const handleFABPress = () => {
    navigate('/session/log');
  };

  return (
    <button
      onClick={handleFABPress}
      aria-label="Open session log"
      className="fixed bottom-[68px] right-4 z-40 w-14 h-14 rounded-full bg-accent text-[var(--color-on-accent,#fff)] border-none shadow-[0_4px_16px_rgba(0,0,0,0.3)] cursor-pointer flex items-center justify-center"
    >
      {activeSession ? <Sparkles className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
    </button>
  );
}
