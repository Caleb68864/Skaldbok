/**
 * Namespaced stat keys.
 *
 * @remarks
 * A bare id like `str` is ambiguous once a system names a resource the same
 * thing as an attribute — Traveller's damage track uses `str`/`dex`/`end`,
 * which are also its characteristics. Resolution used to check attributes
 * first, so a modifier aimed at the damage track silently hit the
 * characteristic instead.
 *
 * Prefixing the namespace removes the ambiguity: `attr:str` and `res:str` are
 * distinct targets. Keys without a prefix are treated as legacy and resolved by
 * the historical precedence order, so data written before this change keeps
 * working even if it is never migrated.
 */

/** Where a stat lives on the character record. */
export type StatNamespace = 'attr' | 'res' | 'derived' | 'armor' | 'skill';

const NAMESPACES: readonly StatNamespace[] = ['attr', 'res', 'derived', 'armor', 'skill'];

/** Builds a namespaced key, e.g. `statKey('attr', 'str')` → `'attr:str'`. */
export function statKey(namespace: StatNamespace, id: string): string {
  return `${namespace}:${id}`;
}

export interface ParsedStatKey {
  /** `null` for a legacy, unprefixed key. */
  namespace: StatNamespace | null;
  id: string;
}

/**
 * Splits a stat key into its namespace and id.
 *
 * @remarks
 * An unrecognised prefix is treated as part of the id rather than a namespace,
 * so a skill literally named `foo:bar` cannot be silently mis-parsed.
 */
export function parseStatKey(key: string): ParsedStatKey {
  const separator = key.indexOf(':');
  if (separator === -1) return { namespace: null, id: key };

  const prefix = key.slice(0, separator);
  if (!NAMESPACES.includes(prefix as StatNamespace)) return { namespace: null, id: key };

  return { namespace: prefix as StatNamespace, id: key.slice(separator + 1) };
}

/** True when the key already carries a namespace. */
export function isNamespaced(key: string): boolean {
  return parseStatKey(key).namespace !== null;
}

/** Convenience builders, so call sites never assemble the string by hand. */
export const attrKey = (id: string) => statKey('attr', id);
export const resKey = (id: string) => statKey('res', id);
export const derivedKey = (id: string) => statKey('derived', id);
export const armorKey = (id: string) => statKey('armor', id);
export const skillKey = (id: string) => statKey('skill', id);
