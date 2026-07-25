import { Component, type ReactNode } from 'react';
import { getEngine } from '../engine';
import { GUARDS } from './guards';
import { CARD_REGISTRY, isCardKey } from './registry';
import { resolveComponent } from './resolveComponent';
import type { ComponentRegistry } from './resolveComponent';
import type { CardEntry } from './types';
import type { PlayModuleProps } from '../../playDashboard/types';

/**
 * Per-card render isolation: a single card that throws (e.g. an untrusted
 * community template with malformed props) degrades to nothing instead of
 * propagating to the app-level boundary and blanking the whole screen — the same
 * "degrade the subtree" guarantee already given to unknown keys and failed
 * component expansions.
 */
class CardErrorBoundary extends Component<{ cardKey: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    if (import.meta.env.DEV) {
      console.warn(`CardRenderer: card "${this.props.cardKey}" threw during render`, err);
    }
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Props for {@link CardRenderer}. */
export interface CardRendererProps extends PlayModuleProps {
  entry: CardEntry;
  /** Community component definitions this template may reference, keyed by name. */
  componentRegistry?: ComponentRegistry;
}

/**
 * Resolves and renders a single {@link CardEntry}: evaluates its `when` guard,
 * expands community components, looks up the card key in {@link CARD_REGISTRY},
 * and renders the component with {@link PlayModuleProps} plus its declared props.
 *
 * @remarks
 * Renders nothing when the guard fails. An unknown `card` key, an unrecognized
 * guard, or a component that fails to expand (cycle, too-deep, missing `$prop`)
 * all render nothing, logging a dev-only warning rather than throwing — a bad,
 * out-of-date, or untrusted community template should degrade, not crash the
 * sheet. Community components are resolved BEFORE built-in card keys, so a
 * community definition intentionally shadows a same-named built-in; a loader
 * that wants a key un-overridable must forbid the name there.
 */
export function CardRenderer({ entry, componentRegistry = {}, character, system, updateCharacter }: CardRendererProps) {
  const engine = getEngine(system);
  const normalized = typeof entry === 'string' ? { card: entry } : entry;

  // Fail closed: a `when` that isn't a known guard is treated as "don't render"
  // rather than throwing on `undefined(engine)`.
  if (normalized.when && !GUARDS[normalized.when]?.(engine)) {
    return null;
  }

  const componentDef = componentRegistry[normalized.card];
  if (componentDef) {
    let expanded: CardEntry[];
    try {
      expanded = resolveComponent(componentDef, normalized.props ?? {}, componentRegistry);
    } catch (err) {
      // Cyclic / too-deep / missing-$prop community template — degrade this
      // subtree instead of throwing through render (which would white-screen it).
      if (import.meta.env.DEV) {
        console.warn(`CardRenderer: failed to expand component "${normalized.card}"`, err);
      }
      return null;
    }
    return (
      <>
        {expanded.map((childEntry, index) => (
          <CardRenderer
            key={index}
            entry={childEntry}
            componentRegistry={componentRegistry}
            character={character}
            system={system}
            updateCharacter={updateCharacter}
          />
        ))}
      </>
    );
  }

  if (!isCardKey(normalized.card)) {
    if (import.meta.env.DEV) {
      console.warn(`CardRenderer: unknown card key "${normalized.card}"`);
    }
    return null;
  }

  const Component = CARD_REGISTRY[normalized.card];
  return (
    <CardErrorBoundary cardKey={normalized.card}>
      <Component character={character} system={system} updateCharacter={updateCharacter} {...(normalized.props ?? {})} />
    </CardErrorBoundary>
  );
}
