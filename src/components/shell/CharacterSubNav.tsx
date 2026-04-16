import { useLocation, useNavigate } from 'react-router-dom';
import { GameIcon } from '../primitives/GameIcon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Secondary navigation tabs displayed below the campaign header when the user
 * is inside the `/character` section of the app.
 *
 * Each entry maps a route `to` path to a `label` rendered in the tab trigger.
 * The array is `as const` so TypeScript narrows the literal types used during
 * active-state calculation.
 */
const CHARACTER_TABS = [
  { to: '/character/sheet', label: 'Sheet', icon: 'scroll-unfurled' },
  { to: '/character/skills', label: 'Skills', icon: 'perspective-dice-six-faces-random' },
  { to: '/character/gear', label: 'Gear', icon: 'knapsack' },
  { to: '/character/magic', label: 'Abilities / Magic', icon: 'spell-book' },
] as const;

/**
 * Horizontal sub-navigation bar for the character section using Radix Tabs.
 *
 * @remarks
 * Rendered by {@link ShellLayout} only when the current route starts with
 * `/character`. Provides four tabs — Sheet, Skills, Gear, and Magic — using
 * the shadcn Tabs component backed by Radix primitives.
 *
 * The active tab uses an animated underline indicator. The row scrolls
 * horizontally on narrow viewports so all tabs remain reachable without wrapping.
 *
 * All tabs meet the 44 px minimum touch target height.
 *
 * @example
 * // Rendered automatically by ShellLayout when on a /character/* route.
 * <CharacterSubNav />
 */
export function CharacterSubNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab =
    CHARACTER_TABS.find(
      (t) =>
        location.pathname === t.to || location.pathname.startsWith(t.to + '/'),
    )?.to ?? CHARACTER_TABS[0].to;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => navigate(value)}
      className="bg-surface border-b border-border"
    >
      <TabsList className="w-full justify-start">
        {CHARACTER_TABS.map(({ to, label, icon }) => (
          <TabsTrigger
            key={to}
            value={to}
            className="relative after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-accent after:scale-x-0 after:transition-transform after:duration-200 data-[state=active]:after:scale-x-100"
          >
            <GameIcon name={icon} size={16} />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
