import { Plus, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCampaignContext } from '../../features/campaign/CampaignContext';
import { useAppState } from '../../context/AppStateContext';
import { cn } from '@/lib/utils';

/**
 * Global Floating Action Button (FAB), always mounted inside
 * {@link components/shell/ShellLayout!ShellLayout | ShellLayout} so it appears on every route.
 *
 * @remarks
 * Pressing the FAB navigates to the full-screen session log
 * (`/session/log`) rather than opening an in-place drawer. `SessionLog`
 * itself handles the no-active-session case with its own empty state and
 * Start session button, so the FAB does not need to branch on
 * `activeSession` before navigating.
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
      className={cn(
        'fixed bottom-[68px] right-4 z-40 w-14 h-14 rounded-full bg-accent text-[var(--color-on-accent,#fff)] border-none shadow-[0_4px_16px_rgba(0,0,0,0.3)] cursor-pointer flex items-center justify-center transition-transform',
      )}
    >
      {activeSession ? <Sparkles className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
    </button>
  );
}
