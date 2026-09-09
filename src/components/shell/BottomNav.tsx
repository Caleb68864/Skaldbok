import { useLocation, Link } from 'react-router-dom';
import { Scroll, Flame, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SESSION_SECTION_PREFIXES } from './SessionSubNav';
import { destinationsFor } from './navigationCatalogue';

/**
 * Icon per destination. The paths and their order come from the catalogue.
 *
 * @remarks
 * Only the icon lives here: which destinations exist and in what order is a
 * navigation decision, and it was previously made independently in five files.
 */
const BOTTOM_NAV_ICONS: Record<string, typeof Scroll> = {
  '/character/sheet': Scroll,
  '/session': Flame,
  '/reference': BookOpen,
};

/**
 * The bottom bar's label for a destination.
 *
 * @remarks
 * "Characters" rather than the catalogue's "Sheet": this tab stands for the
 * whole character section, not the one screen it happens to land on.
 */
const BOTTOM_NAV_LABELS: Record<string, string> = {
  '/character/sheet': 'Characters',
};

/** Top-level navigation tabs, taken from the shared catalogue. */
const NAV_TABS = destinationsFor('bottom').map((destination) => ({
  to: destination.path,
  label: BOTTOM_NAV_LABELS[destination.path] ?? destination.label,
  icon: BOTTOM_NAV_ICONS[destination.path] ?? Scroll,
}));

/**
 * Persistent bottom navigation bar rendered by {@link components/shell/ShellLayout!ShellLayout | ShellLayout} on every
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
            ? // Not just `/session`: the ledger and the route are campaign-scoped
              // and live under this section's sub-nav, so the bottom bar has to
              // agree with the shell about where the user is.
              SESSION_SECTION_PREFIXES.some(
                p => location.pathname === p || location.pathname.startsWith(p + '/'),
              )
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
