/**
 * Whether the global session-log button is withheld on this route.
 *
 * @remarks
 * One rule with two readers. `GlobalFAB` hides itself here so it never sits on
 * top of the docked writing pad, and `ShellLayout` drops the bottom padding it
 * keeps for the button — padding for a button that is not drawn is simply lost
 * height, and on the capture screen that height belongs to the entry list.
 * Keeping the rule in one place is what stops the two drifting apart.
 *
 * @param pathname - The router's current `location.pathname`.
 */
export function isFabHiddenRoute(pathname: string): boolean {
  return pathname === '/session/log';
}
