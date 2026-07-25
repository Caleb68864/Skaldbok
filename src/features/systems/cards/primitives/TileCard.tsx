import { SectionPanel } from '../../../../components/primitives/SectionPanel';
import { getEngine } from '../../engine';
import { parseStatKey } from '../../../../utils/statKeys';
import type { PlayModuleProps } from '../../../playDashboard/types';
import type { SystemEngine } from '../../engine/types';
import type { CharacterRecord } from '../../../../types/character';
import type { SystemDefinition } from '../../../../types/system';

/**
 * Resolves a whitelisted data path against the active character/system.
 *
 * @remarks
 * Only `quickReference.<key>`, `attr:<id>`, `res:<id>`, and `derived:<id>`
 * (where `<id>` is a declared attribute/resource/derived-field id) are
 * recognized — anything else, including arbitrary character-field access,
 * yields `undefined` rather than throwing. Shared by all three primitives.
 */
export function resolveDataPath(
  path: string,
  character: CharacterRecord,
  system: SystemDefinition | null,
  engine: SystemEngine = getEngine(system),
): unknown {
  // `path` originates in untrusted `unknown` props on some call paths; a
  // non-string can't index the whitelist, so bail before `.startsWith`/parse.
  if (typeof path !== 'string') return undefined;
  if (path.startsWith('quickReference.')) {
    const key = path.slice('quickReference.'.length);
    const cards = system?.quickReference ?? [];
    const index = Number(key);
    if (Number.isInteger(index) && index >= 0 && index < cards.length) {
      return cards[index];
    }
    const slug = (title: string) => title.trim().toLowerCase().replace(/\s+/g, '-');
    return cards.find((card) => slug(card.title) === key);
  }

  const { namespace, id } = parseStatKey(path);

  if (namespace === 'attr') {
    return engine.attributeIds.includes(id) ? character.attributes[id] : undefined;
  }
  if (namespace === 'res') {
    // Return the scalar `current` (like `attr:`/`derived:` return scalars), not
    // the whole { current, max } object — otherwise a tile renders "[object
    // Object]" and a toggle bound to it is always truthy.
    return engine.resourceIds.includes(id) ? character.resources[id]?.current : undefined;
  }
  if (namespace === 'derived') {
    const isDeclared = engine.derivedFields.some((field) => field.key === id);
    if (!isDeclared) return undefined;
    const values = engine.derivedStats(character, system ?? undefined) as unknown as Record<string, unknown>;
    return values[id];
  }

  return undefined;
}

/** Visual weight of a {@link TileCard}; purely presentational. */
export type TileIntent = 'default' | 'accent' | 'warning' | 'danger' | 'success';

/**
 * Declarative props for a single stat tile.
 *
 * @remarks
 * `value` is a literal to display as-is; `source` is a whitelisted data path
 * resolved via {@link resolveDataPath}. When both are given `value` wins.
 * No function props — templates are JSON, so nothing here can be a callback.
 */
export interface TileCardProps extends PlayModuleProps {
  title: string;
  value?: string | number;
  source?: string;
  subLabel?: string;
  intent?: TileIntent;
}

const INTENT_TEXT_CLASS: Record<TileIntent, string> = {
  default: 'text-[var(--color-text)]',
  accent: 'text-[var(--color-accent)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
  success: 'text-[var(--color-success)]',
};

/** Generic read-only stat tile: a title, a resolved or literal value, and an optional sub-label. */
export function TileCard({ title, value, source, subLabel, intent = 'default', character, system }: TileCardProps) {
  const resolved = value !== undefined ? value : source ? resolveDataPath(source, character, system) : undefined;
  const display = resolved === undefined || resolved === null ? '—' : String(resolved);
  // Fall back to the neutral intent for an unrecognized value so an authoring
  // typo can't emit a literal `undefined` className fragment.
  const intentClass = INTENT_TEXT_CLASS[intent] ?? INTENT_TEXT_CLASS.default;

  return (
    <SectionPanel title={title}>
      <div className="flex flex-col items-start gap-[var(--space-2xs)]">
        <span className={`text-[length:var(--font-size-lg)] font-semibold ${intentClass}`}>
          {display}
        </span>
        {subLabel && <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">{subLabel}</span>}
      </div>
    </SectionPanel>
  );
}
