import { describe, expect, it } from 'vitest';
import { BUNDLED_SYSTEMS } from '../../systems/registry';
import { createBlankCharacter, hasBlankTemplate } from './characterMappers';

describe('blank templates stay in lockstep with the registry', () => {
  it.each(BUNDLED_SYSTEMS.map((s) => s.id))('%s has a bundled blank template', (id) => {
    expect(hasBlankTemplate(id)).toBe(true);
  });

  it('a blank character carries the system it was asked for and its own id', () => {
    const a = createBlankCharacter('traveller');
    const b = createBlankCharacter('traveller');
    expect(a.systemId).toBe('traveller');
    expect(a.id).not.toBe(b.id);
    // Deep-cloned: mutating one must not reach the other or the template.
    a.attributes.str = 99;
    expect(b.attributes.str).not.toBe(99);
  });
});
