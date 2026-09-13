import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The shell's docking slot: the element sitting between the scrollable
 * `<main>` and the bottom navigation.
 *
 * @remarks
 * `node` is `null` whenever the shell is not mounted — a screen rendered
 * standalone in a test, or the shell-less `/print` route.
 *
 * An object around one element reference, because that is the shape every
 * context in this app has and `providerMemoization.test.tsx` checks the shape
 * rather than trusting a judgement call about which values are cheap.
 */
interface ShellDockValue {
  node: HTMLElement | null;
}

const ShellDockContext = createContext<ShellDockValue>({ node: null });

/** Provides the dock node to {@link ShellDock}. Rendered by `ShellLayout` only. */
export function ShellDockProvider({
  node,
  children,
}: {
  node: HTMLElement | null;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ node }), [node]);
  return <ShellDockContext.Provider value={value}>{children}</ShellDockContext.Provider>;
}

/**
 * Docks its children to the bottom of the screen, immediately above the bottom
 * navigation.
 *
 * @remarks
 * `position: sticky` is the obvious way to pin something to the bottom of a
 * screen and it is the wrong one here. A sticky element is confined to its
 * containing block, which for a screen's content is the screen's own root
 * `<div>` — and `<main>` carries `pb-[140px]` *outside* that root to clear the
 * floating session-log button. Scrolled to the end, the bar therefore unpinned
 * and rode 140px up the page: stuck to the bottom for most of a scroll and not
 * at the end of one, which is exactly the "scrolls weird" report.
 *
 * A portal into the shell's own flex column fixes the class of bug rather than
 * the instance. The dock is a *sibling* of the scroll container, so it cannot
 * scroll at all, and `<main>` shrinks by its height — content ends above the
 * bar instead of behind it, with no padding to keep in sync.
 *
 * Ownership stays with the screen: the play dashboard still renders its own
 * composer and decides when there is one. The shell only lends the position.
 *
 * Falls back to rendering in place when no shell is present, so a screen under
 * test still shows its dock rather than silently losing it.
 */
export function ShellDock({ children }: { children: ReactNode }) {
  const { node } = useContext(ShellDockContext);
  if (!node) return <>{children}</>;
  return createPortal(children, node);
}
