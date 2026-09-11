import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameIcon } from '../primitives/GameIcon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSystemEngine } from '../../features/systems/engine';
import { destinationsFor } from './navigationCatalogue';
import { SystemRulesNotice } from '../systems/SystemRulesNotice';

/** A single entry in the character sub-navigation row. */
interface CharacterTab {
  /** Stable identity for the tab — never derived from the display label. */
  id: string;
  /** Route the tab navigates to. */
  to: string;
  /** User-facing text; may vary by ruleset. */
  label: string;
  /** `GameIcon` name rendered before the label. */
  icon: string;
}

/**
 * Ruleset-independent tabs shown for every system.
 *
 * @remarks
 * Each entry carries a stable `id` distinct from its `label` so that renaming
 * user-facing text (per-system, via the {@link SystemEngine}) never changes
 * React keys or active-state matching.
 */
const CHARACTER_TAB_ICONS: Record<string, string> = {
  '/character/play': 'perspective-dice-six-faces-random',
  '/character/sheet': 'scroll-unfurled',
  '/character/skills': 'perspective-dice-six-faces-random',
  '/character/gear': 'knapsack',
  '/character/magic': 'spell-book',
};

const STATIC_CHARACTER_TABS: CharacterTab[] = destinationsFor('character')
  // The abilities tab is appended below, with the label the ruleset gives it.
  .filter((destination) => !destination.dynamicLabel)
  .map((destination) => ({
    id: destination.path.replace('/character/', ''),
    to: destination.path,
    label: destination.label,
    icon: CHARACTER_TAB_ICONS[destination.path] ?? 'scroll-unfurled',
  }));

/**
 * Horizontal sub-navigation bar for the character section using Radix Tabs.
 *
 * @remarks
 * Rendered by {@link components/shell/ShellLayout!ShellLayout | ShellLayout} only when the current route starts with
 * `/character`. Always shows Play, Sheet, Skills, and Gear; the
 * abilities/magic tab is appended only when the active system's engine
 * supplies a label for it (`engine.labels.abilitiesScreen`). Systems that set
 * that label to `null` — Traveller, for example — have no abilities screen, so
 * the tab is omitted rather than leading to a dead end.
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
  const engine = useSystemEngine();

  const abilitiesLabel = engine.labels.abilitiesScreen;

  const tabs = useMemo<CharacterTab[]>(
    () =>
      abilitiesLabel
        ? [
            ...STATIC_CHARACTER_TABS,
            { id: 'magic', to: '/character/magic', label: abilitiesLabel, icon: 'spell-book' },
          ]
        : STATIC_CHARACTER_TABS,
    [abilitiesLabel],
  );

  const activeTab =
    tabs.find(
      (t) =>
        location.pathname === t.to || location.pathname.startsWith(t.to + '/'),
    )?.to ?? tabs[0].to;

  return (
    <>
      {/*
        The one place every character screen passes through, so the one place
        worth saying it: the numbers on the sheet, in the gear list and on the
        skills screen were computed by a ruleset this character does not use.
        `getEngine` falls back to classic-fantasy for a system with no adapter,
        which is right — the alternative is a blank app — but doing it silently
        is not. The warning behind this used to be DEV-only, so in a production
        build a user-authored system ran Dragonbane's maths with nothing to say
        so.
      */}
      <SystemRulesNotice fallbackRulesFor={engine.fallbackRulesFor} />
      <Tabs
        value={activeTab}
        onValueChange={(value) => navigate(value)}
        className="bg-surface border-b border-border"
      >
      <TabsList className="w-full justify-start">
        {tabs.map(({ id, to, label, icon }) => (
          <TabsTrigger
            key={id}
            value={to}
            className="relative after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-accent after:scale-x-0 after:transition-transform after:duration-200 data-[state=active]:after:scale-x-100"
          >
            <GameIcon name={icon} size={16} />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      </Tabs>
    </>
  );
}
