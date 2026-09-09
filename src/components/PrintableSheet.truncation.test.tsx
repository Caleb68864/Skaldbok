// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PrintableSheet from './PrintableSheet';
import { getEngine } from '../features/systems/engine';
import { classicFantasySystem } from '../systems/classic-fantasy';
import { createBlankCharacter } from '../features/characters/characterMappers';
import type { CharacterRecord } from '../types/character';
import type { PrintDerivedValues } from './PrintableSheet';

/**
 * The printed sheet is the artefact taken to the table, and it dropped rows
 * without saying so — twice over, by two different mechanisms.
 *
 * The renderer prints a fixed number of slots (ten inventory rows, three
 * weapons, six secondary skills) and never drew the rest. On top of that,
 * `.print-col` clips at a fixed height, so a long skills list lost its tail to
 * `overflow: hidden`. Either way the page came out looking complete, which is
 * the worst possible failure for a sheet somebody is about to play from.
 */

const engine = getEngine(classicFantasySystem);

/** A character carrying more than the sheet has slots for. */
function overloadedCharacter(): CharacterRecord {
  const base = createBlankCharacter('classic-fantasy') as unknown as CharacterRecord;
  return {
    ...base,
    inventory: Array.from({ length: 14 }, (_, i) => ({ id: `i${i}`, name: `Item ${i + 1}` })),
    weapons: Array.from({ length: 5 }, (_, i) => ({
      id: `w${i}`, name: `Weapon ${i + 1}`, grip: 'one-handed', range: '2', damage: 'd8', durability: 10,
    })),
    skills: {
      ...base.skills,
      ...Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [`homebrew-skill-${i}`, { value: 10, trained: false }]),
      ),
    },
  } as unknown as CharacterRecord;
}

/** What `PrintScreen` passes down, with the engine's own values filled in. */
function printDerived(character: CharacterRecord): PrintDerivedValues {
  const derived = engine.derivedStats(character, classicFantasySystem);
  return {
    damageBonus: derived.damageBonus ?? '',
    aglDamageBonus: derived.aglDamageBonus ?? '',
    movement: derived.movement ?? 0,
    encumbranceLimit: derived.encumbranceLimit ?? 0,
    hpMax: derived.hpMax ?? 0,
    wpMax: derived.wpMax ?? 0,
  };
}

function renderSheet(character: CharacterRecord) {
  return render(
    <PrintableSheet
      character={character}
      system={classicFantasySystem}
      derived={printDerived(character)}
      colorMode="bw"
      engine={engine}
    />,
  );
}

afterEach(cleanup);

describe('slots the renderer does not print', () => {
  it('says how many inventory items were left off', () => {
    renderSheet(overloadedCharacter());
    // 14 carried, 10 slots.
    expect(screen.getByText(/\+ 4 more items not printed/)).toBeTruthy();
  });

  it('says how many weapons were left off', () => {
    renderSheet(overloadedCharacter());
    // 5 carried, 3 rows.
    expect(screen.getByText(/\+ 2 more weapons not printed/)).toBeTruthy();
  });

  it('says how many secondary skills were left off', () => {
    renderSheet(overloadedCharacter());
    // 9 skills the system does not declare, 6 write-in rows.
    expect(screen.getByText(/\+ 3 more secondary skills not printed/)).toBeTruthy();
  });

  it('singularises a single dropped row', () => {
    const character = overloadedCharacter();
    renderSheet({
      ...character,
      inventory: Array.from({ length: 11 }, (_, i) => ({ id: `i${i}`, name: `Item ${i + 1}` })),
    } as unknown as CharacterRecord);
    expect(screen.getByText(/\+ 1 more item not printed/)).toBeTruthy();
  });

  it('says nothing at all when everything fits', () => {
    const base = createBlankCharacter('classic-fantasy') as unknown as CharacterRecord;
    renderSheet({
      ...base,
      inventory: [{ id: 'i1', name: 'Rope' }],
      weapons: [],
    } as unknown as CharacterRecord);
    expect(screen.queryByText(/not printed/)).toBeNull();
  });
});

describe('columns clipped by the fixed page height', () => {
  /**
   * jsdom performs no layout, so both heights are 0 and nothing ever reads as
   * clipped. Stubbing the two properties the measurement uses is what makes the
   * branch reachable at all; the values stand in for a column whose content is
   * twice its height.
   */
  function stubHeights(scrollHeight: number, clientHeight: number): () => void {
    const descriptors = {
      scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'),
      clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'),
    };
    const define = (name: 'scrollHeight' | 'clientHeight', value: number) => {
      Object.defineProperty(HTMLElement.prototype, name, {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList?.contains('print-col') ? value : 0;
        },
      });
    };
    define('scrollHeight', scrollHeight);
    define('clientHeight', clientHeight);
    return () => {
      for (const [name, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
        else Reflect.deleteProperty(HTMLElement.prototype, name);
      }
    };
  }

  it('marks every column whose content the page cut off', () => {
    const restore = stubHeights(800, 400);
    try {
      const { container } = renderSheet(createBlankCharacter('classic-fantasy') as unknown as CharacterRecord);
      const marks = container.querySelectorAll('.print-col-clipped');
      // Six columns: three in the body band, three in the lower band.
      expect(marks).toHaveLength(6);
      expect(marks[0]!.textContent).toContain('Cut off');
    } finally {
      restore();
    }
  });

  it('marks nothing when the content fits', () => {
    const restore = stubHeights(400, 400);
    try {
      const { container } = renderSheet(createBlankCharacter('classic-fantasy') as unknown as CharacterRecord);
      expect(container.querySelectorAll('.print-col-clipped')).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('does not report a one-pixel rounding difference as lost content', () => {
    const restore = stubHeights(401, 400);
    try {
      const { container } = renderSheet(createBlankCharacter('classic-fantasy') as unknown as CharacterRecord);
      expect(container.querySelectorAll('.print-col-clipped')).toHaveLength(0);
    } finally {
      restore();
    }
  });
});
