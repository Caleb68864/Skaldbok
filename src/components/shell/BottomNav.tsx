import { useLocation, Link } from 'react-router-dom';
import { Scroll, Flame, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Top-level navigation tabs rendered inside {@link BottomNav}.
 *
 * Each entry defines the route `to` path and the human-readable `label` shown
 * in the tab bar. The array is `as const` so TypeScript can narrow the literal
 * types when computing the active state.
 */
const NAV_TABS = [
  { to: '/character/sheet', label: 'Characters', icon: Scroll },
  { to: '/session', label: 'Session', icon: Flame },
  { to: '/reference', label: 'Reference', icon: BookOpen },
] as const;

/**
 * Persistent bottom navigation bar rendered by {@link ShellLayout} on every
 * route.
 *
 * @remarks
 * Renders three top-level tabs — Characters, Session, and Reference — as
 * React Router `<Link>` elements. The active tab is highlighted using the
 * accent colour and increased font weight.
 *
 * Active-tab detection uses path-prefix matching so that any nested route
 * under `/character/**` keeps the "Characters" tab highlighted. The "Session"
 * and "Reference" tabs match their root path exactly or as a prefix.
 *
 * All interactive targets meet the 44 × 44 px minimum touch target size.
 *
 * @example
 * // Rendered automatically by ShellLayout — no props required.
 * <BottomNav />
 */
export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="Main navigation"
      className="flex flex-row border-t border-border bg-surface/80 backdrop-blur-md"
    >
      {NAV_TABS.map(({ to, label, icon: Icon }) => {
        const isActive =
          label === 'Characters'
            ? location.pathname.startsWith('/character')
            : label === 'Session'
            ? location.pathname === '/session' || location.pathname.startsWith('/session/')
            : label === 'Reference'
            ? location.pathname === '/reference' || location.pathname.startsWith('/reference/')
            : false;

        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center min-h-[44px] min-w-[44px] no-underline text-xs py-1.5 px-1 transition-all',
              isActive
                ? 'text-accent font-semibold scale-105'
                : 'text-text-muted font-normal',
            )}
          >
            {isActive && (
              <span className="absolute top-0 left-2 right-2 h-0.5 rounded-full bg-accent" />
            )}
            <Icon className="h-5 w-5 mb-0.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
