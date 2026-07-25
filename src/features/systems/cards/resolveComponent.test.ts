import { describe, it, expect } from 'vitest';
import {
  resolveComponent,
  MAX_COMPONENT_DEPTH,
  ComponentCycleError,
  ComponentDepthError,
  MissingPropError,
  type ComponentRegistry,
} from './resolveComponent';
import type { ComponentDefinition } from './types';

describe('resolveComponent', () => {
  it('resolves a component with no props into its plain body', () => {
    const def: ComponentDefinition = {
      name: 'Simple',
      body: ['vitals', { card: 'derived' }],
    };
    // A no-props / no-`when` entry normalizes to its bare-string form — `'derived'`
    // and `{ card: 'derived' }` are equivalent and render identically.
    expect(resolveComponent(def)).toEqual(['vitals', 'derived']);
  });

  it('substitutes named-slot props with the passed value', () => {
    const def: ComponentDefinition = {
      name: 'Attribute',
      props: ['attributeId'],
      body: [{ card: 'tile', props: { statId: { $prop: 'attributeId' } } }],
    };
    const result = resolveComponent(def, { attributeId: 'str' });
    expect(result).toEqual([{ card: 'tile', props: { statId: 'str' } }]);
  });

  it('preserves a when guard on a concrete entry', () => {
    const def: ComponentDefinition = {
      name: 'Guarded',
      body: [{ card: 'magic', when: 'hasMagic' }],
    };
    expect(resolveComponent(def)).toEqual([{ card: 'magic', when: 'hasMagic' }]);
  });

  it('throws a named MissingPropError when a required prop is not supplied', () => {
    const def: ComponentDefinition = {
      name: 'Attribute',
      props: ['attributeId'],
      body: [{ card: 'tile', props: { statId: { $prop: 'attributeId' } } }],
    };
    expect(() => resolveComponent(def, {})).toThrow(MissingPropError);
  });

  it('expands a nested component found in the registry', () => {
    const inner: ComponentDefinition = {
      name: 'Inner',
      props: ['label'],
      body: [{ card: 'tile', props: { title: { $prop: 'label' } } }],
    };
    const outer: ComponentDefinition = {
      name: 'Outer',
      body: [{ card: 'Inner', props: { label: { $prop: 'outerLabel' } } }],
    };
    const registry: ComponentRegistry = { Inner: inner };
    const result = resolveComponent(outer, { outerLabel: 'STR' }, registry);
    expect(result).toEqual([{ card: 'tile', props: { title: 'STR' } }]);
  });

  it('propagates a when guard from the component reference onto expanded entries', () => {
    const inner: ComponentDefinition = {
      name: 'Inner',
      body: ['vitals', 'derived'],
    };
    const outer: ComponentDefinition = {
      name: 'Outer',
      body: [{ card: 'Inner', when: 'hasMagic' }],
    };
    const registry: ComponentRegistry = { Inner: inner };
    const result = resolveComponent(outer, {}, registry);
    expect(result).toEqual([
      { card: 'vitals', when: 'hasMagic' },
      { card: 'derived', when: 'hasMagic' },
    ]);
  });

  it('rejects a component that references itself directly', () => {
    const selfRef: ComponentDefinition = {
      name: 'SelfRef',
      body: [{ card: 'SelfRef' }],
    };
    const registry: ComponentRegistry = { SelfRef: selfRef };
    expect(() => resolveComponent(selfRef, {}, registry)).toThrow(ComponentCycleError);
  });

  it('rejects a component that references itself transitively', () => {
    const a: ComponentDefinition = { name: 'A', body: [{ card: 'B' }] };
    const b: ComponentDefinition = { name: 'B', body: [{ card: 'A' }] };
    const registry: ComponentRegistry = { A: a, B: b };
    expect(() => resolveComponent(a, {}, registry)).toThrow(ComponentCycleError);
  });

  it('rejects expansion beyond the max depth bound', () => {
    const registry: ComponentRegistry = {};
    const depth = MAX_COMPONENT_DEPTH + 2;
    for (let i = 0; i < depth; i += 1) {
      const name = `Comp${i}`;
      const next = i === depth - 1 ? 'leafCard' : `Comp${i + 1}`;
      registry[name] = { name, body: [{ card: next }] };
    }
    expect(() => resolveComponent(registry.Comp0, {}, registry)).toThrow(ComponentDepthError);
  });
});
