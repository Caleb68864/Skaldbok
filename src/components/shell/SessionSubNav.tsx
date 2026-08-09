import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Flame, NotebookPen, Coins, Route as RouteIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCampaignContext } from '../../features/campaign/CampaignContext';
import { useSystemDefinition } from '../../features/systems/useSystemDefinition';

/** A single entry in the session sub-navigation row. */
interface SessionTab {
  /** Stable identity for the tab — never derived from the display label. */
  id: string;
  /** Route the tab navigates to. */
  to: string;
  /** User-facing text; may come from the active ruleset. */
  label: string;
  /** Icon component rendered before the label. */
  Icon: LucideIcon;
}

/**
 * Tabs shown for every ruleset.
 *
 * @remarks
 * Icons come from lucide, as `BottomNav`'s do, rather than from `GameIcon`.
 * `GameIcon` resolves against a fixed path map and returns `null` for an unknown
 * name — so a mistyped or absent glyph renders nothing at all, with no error and
 * no failing test. There is no money or route glyph in that map; lucide has
 * both.
 */
const STATIC_SESSION_TABS: SessionTab[] = [
  { id: 'session', to: '/session', label: 'Session', Icon: Flame },
  { id: 'log', to: '/session/log', label: 'Log', Icon: NotebookPen },
  { id: 'ledger', to: '/ledger', label: 'Ledger', Icon: Coins },
];

/**
 * Every top-level path that belongs to the campaign/session section.
 *
 * @remarks
 * Single source of truth, exported because two places need to agree: the shell
 * decides whether to render this sub-nav, and the bottom bar decides whether to
 * light "Session". If they disagree, a user on `/ledger` sees the session tabs
 * while the bottom bar shows nothing selected — the navigation contradicts
 * itself about where they are.
 *
 * `/route` is listed unconditionally. A ruleset that declares no planner never
 * routes here (the screen redirects), so there is nothing to gate.
 */
export const SESSION_SECTION_PREFIXES = ['/session', '/ledger', '/route'] as const;

/**
 * Horizontal sub-navigation for the campaign section — the Session-side
 * counterpart to {@link components/shell/CharacterSubNav!CharacterSubNav | CharacterSubNav}.
 *
 * @remarks
 * The ledger and the route are **campaign**-scoped, not character-scoped, so
 * they belong beside the session rather than in the character tab row. They were
 * previously reachable only from the campaign header's overflow sheet, which put
 * two things used constantly at the table three taps deep behind a hamburger.
 *
 * The route tab is conditional in exactly the way the abilities tab is on the
 * character row: it appears only when the active ruleset declares
 * `routePlanner`, and its label comes from that declaration — each ruleset
 * names its own travel concept, and this file names none of them. A ruleset that
 * declares nothing gets no tab at all, rather than one leading to a redirect.
 *
 * The system is resolved from the **campaign**, not from the active character.
 * `useSystemEngine` keys off the active character and would leave the tab
 * missing whenever no character is open — which is most of the time on the
 * session side.
 *
 * All tabs meet the 44 px minimum touch target height and the row scrolls
 * horizontally on narrow viewports.
 */
export function SessionSubNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeCampaign } = useCampaignContext();
  const { system } = useSystemDefinition(activeCampaign?.system ?? 'classic-fantasy');

  const planner = system?.routePlanner;

  const tabs = useMemo<SessionTab[]>(
    () =>
      planner
        ? [
            ...STATIC_SESSION_TABS,
            { id: 'route', to: '/route', label: planner.label, Icon: RouteIcon },
          ]
        : STATIC_SESSION_TABS,
    [planner],
  );

  // Longest match wins: `/session/log` must not be beaten by `/session`, which
  // is a prefix of it.
  const activeTab =
    [...tabs]
      .sort((a, b) => b.to.length - a.to.length)
      .find(t => location.pathname === t.to || location.pathname.startsWith(t.to + '/'))?.to ??
    tabs[0].to;

  return (
    <Tabs
      value={activeTab}
      onValueChange={value => navigate(value)}
      className="bg-surface border-b border-border"
    >
      <TabsList className="w-full justify-start">
        {tabs.map(({ id, to, label, Icon }) => (
          <TabsTrigger
            key={id}
            value={to}
            className="relative after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-accent after:scale-x-0 after:transition-transform after:duration-200 data-[state=active]:after:scale-x-100"
          >
            <Icon className="h-4 w-4" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
