import type { CardEntry, ComponentDefinition } from './types';

/** Maps a community component name to its definition, for recursive expansion. */
export type ComponentRegistry = Record<string, ComponentDefinition>;

/** Maximum nesting depth of component expansion before it is rejected. */
export const MAX_COMPONENT_DEPTH = 10;

/**
 * Maximum total expanded card entries. Depth alone doesn't bound *breadth*: a
 * component whose body references ten siblings, nested nine deep, stays under the
 * depth limit yet fans out to ~10^10 entries and would exhaust memory before
 * returning. This running budget caps the total and throws instead.
 */
export const MAX_COMPONENT_ENTRIES = 2000;

/** Thrown when a component (directly or transitively) references itself. */
export class ComponentCycleError extends Error {
  constructor(componentName: string, chain: string[]) {
    super(`Component cycle detected: ${[...chain, componentName].join(' -> ')}`);
    this.name = 'ComponentCycleError';
  }
}

/** Thrown when component expansion nests deeper than {@link MAX_COMPONENT_DEPTH}. */
export class ComponentDepthError extends Error {
  constructor(depth: number) {
    super(`Component expansion exceeded max depth of ${MAX_COMPONENT_DEPTH} (reached ${depth})`);
    this.name = 'ComponentDepthError';
  }
}

/** Thrown when total expansion exceeds {@link MAX_COMPONENT_ENTRIES} (breadth/fan-out bound). */
export class ComponentSizeError extends Error {
  constructor() {
    super(`Component expansion exceeded ${MAX_COMPONENT_ENTRIES} total entries`);
    this.name = 'ComponentSizeError';
  }
}

/** Thrown when a `{ "$prop": "x" }` slot has no matching value in the passed props. */
export class MissingPropError extends Error {
  constructor(propName: string, componentName: string) {
    super(`Missing required prop "${propName}" for component "${componentName}"`);
    this.name = 'MissingPropError';
  }
}

type ComponentCardEntryObject = Extract<ComponentDefinition['body'][number], { card: string }>;

function isPropSlot(value: unknown): value is { $prop: string } {
  return typeof value === 'object' && value !== null && '$prop' in value;
}

/**
 * Resolves a body entry's prop *references* against the values passed to the
 * component. Each `propsDef` value is a named slot `{ $prop: "x" }`; the result
 * maps the entry's local prop name to the invocation's `props[x]`. Resolution is
 * strict — an unsatisfied slot throws {@link MissingPropError} (CardRenderer
 * catches it and degrades). The `String(slot)` branch is defensive only:
 * componentDefinitionSchema guarantees every slot is `{ $prop }`, so it is
 * unreachable for validated input and is not a supported "literal prop" feature.
 */
function resolveProps(
  propsDef: ComponentCardEntryObject['props'],
  props: Record<string, unknown>,
  componentName: string,
): Record<string, unknown> | undefined {
  if (!propsDef) return undefined;
  const resolved: Record<string, unknown> = {};
  for (const [key, slot] of Object.entries(propsDef)) {
    const slotName = isPropSlot(slot) ? slot.$prop : String(slot);
    if (!(slotName in props) || props[slotName] === undefined) {
      throw new MissingPropError(slotName, componentName);
    }
    resolved[key] = props[slotName];
  }
  return resolved;
}

function expand(
  def: ComponentDefinition,
  props: Record<string, unknown>,
  registry: ComponentRegistry,
  stack: string[],
  depth: number,
  budget: { count: number },
): CardEntry[] {
  // Two independent stops: `stack` (below) catches self/mutual recursion by
  // name; MAX_COMPONENT_DEPTH catches unbounded *acyclic* nesting — many
  // distinct components chained deeper than we will ever legitimately render.
  if (depth > MAX_COMPONENT_DEPTH) {
    throw new ComponentDepthError(depth);
  }

  const entries: CardEntry[] = [];

  for (const raw of def.body) {
    const normalized: ComponentCardEntryObject = typeof raw === 'string' ? { card: raw } : raw;
    const resolvedProps = resolveProps(normalized.props, props, def.name);
    const childDef = registry[normalized.card];

    if (childDef) {
      if (stack.includes(normalized.card)) {
        throw new ComponentCycleError(normalized.card, stack);
      }
      const nested = expand(
        childDef,
        resolvedProps ?? {},
        registry,
        [...stack, normalized.card],
        depth + 1,
        budget,
      );
      for (const nestedEntry of nested) {
        if (++budget.count > MAX_COMPONENT_ENTRIES) throw new ComponentSizeError();
        if (!normalized.when) {
          entries.push(nestedEntry);
          continue;
        }
        entries.push(
          typeof nestedEntry === 'string'
            ? { card: nestedEntry, when: normalized.when }
            : { ...nestedEntry, when: nestedEntry.when ?? normalized.when },
        );
      }
      continue;
    }

    if (++budget.count > MAX_COMPONENT_ENTRIES) throw new ComponentSizeError();
    if (!resolvedProps && !normalized.when) {
      entries.push(normalized.card);
    } else {
      entries.push({
        card: normalized.card,
        ...(resolvedProps ? { props: resolvedProps } : {}),
        ...(normalized.when ? { when: normalized.when } : {}),
      });
    }
  }

  return entries;
}

/**
 * Expands a {@link ComponentDefinition}'s body into concrete {@link CardEntry}
 * values, substituting `{ "$prop": "x" }` slots with `props[x]` and recursively
 * inlining any nested community components found in `registry`.
 */
export function resolveComponent(
  def: ComponentDefinition,
  props: Record<string, unknown> = {},
  registry: ComponentRegistry = {},
): CardEntry[] {
  return expand(def, props, registry, [def.name], 0, { count: 0 });
}
