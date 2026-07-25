import { getEngine } from '../engine';
import { GUARDS } from './guards';
import { CARD_REGISTRY, isCardKey } from './registry';
import { resolveComponent } from './resolveComponent';
import type { ComponentRegistry } from './resolveComponent';
import type { CardEntry } from './types';
import type { PlayModuleProps } from '../../playDashboard/types';

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
 * Renders nothing when the guard fails. An unknown `card` key also renders
 * nothing, logging a dev-only warning rather than throwing — a bad or
 * out-of-date template should degrade, not crash the sheet.
 */
export function CardRenderer({ entry, componentRegistry = {}, character, system, updateCharacter }: CardRendererProps) {
  const engine = getEngine(system);
  const normalized = typeof entry === 'string' ? { card: entry } : entry;

  if (normalized.when && !GUARDS[normalized.when](engine)) {
    return null;
  }

  const componentDef = componentRegistry[normalized.card];
  if (componentDef) {
    const expanded = resolveComponent(componentDef, normalized.props ?? {}, componentRegistry);
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
  return <Component character={character} system={system} updateCharacter={updateCharacter} {...(normalized.props ?? {})} />;
}
