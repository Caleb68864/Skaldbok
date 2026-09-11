/**
 * "The numbers below are another ruleset's" — the one rendering of that notice.
 *
 * @remarks
 * `getEngine` falls back to classic-fantasy for a system with no adapter, and
 * now also for a system that **failed to load at all**. The fallback is right —
 * the alternative is a blank app — but doing it silently is not: classic-fantasy
 * is not a neutral default, it brings Dragonbane's derived stats, rest, death
 * and encumbrance rules with it.
 *
 * Shared rather than written twice, for the reason `AutosaveErrorBanner` is
 * shared: two hand-written copies drift, and the one that drifts is the one that
 * forgets `role="status"` and says nothing to a screen reader. It was one copy
 * on `CharacterSubNav` and no copy anywhere a GM works — the session, ledger and
 * route screens resolve their ruleset through `useSystemEngineFor` and had no
 * surface for this at all.
 */
export function SystemRulesNotice({ fallbackRulesFor }: { fallbackRulesFor?: string }) {
  if (!fallbackRulesFor) return null;
  return (
    <div
      role="status"
      className="px-3 py-2 text-[length:var(--font-size-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] border-b border-[var(--color-border)]"
    >
      <strong>No rules for “{fallbackRulesFor}”.</strong>{' '}
      Rules-derived values below — stats, rest, death, money and encumbrance —
      are computed with the bundled classic-fantasy rules, not this system's.
    </div>
  );
}
