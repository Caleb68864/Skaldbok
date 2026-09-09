// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CharacterSubNav } from './CharacterSubNav';
import type { SystemEngine } from '../../features/systems/engine';

/**
 * The user-visible half of "an unknown system must not silently get
 * Dragonbane's rules". `getEngine` sets `fallbackRulesFor`; this is the one
 * place every character screen passes through, so it is where the notice goes.
 */

let engine: SystemEngine;

vi.mock('../../features/systems/engine', () => ({
  useSystemEngine: () => engine,
}));

/** Only the two fields this component reads. */
function engineWith(fallbackRulesFor?: string): SystemEngine {
  return { fallbackRulesFor, labels: { abilitiesScreen: 'Magic' } } as unknown as SystemEngine;
}

beforeEach(() => {
  engine = engineWith(undefined);
});

// Testing Library only auto-cleans when Vitest globals are on, and they are
// not; without this every render stacks up in the same document.
afterEach(cleanup);

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/character/sheet']}>
      <CharacterSubNav />
    </MemoryRouter>,
  );
}

describe('CharacterSubNav', () => {
  it('says so when the character is running another ruleset\'s maths', () => {
    engine = engineWith('my-homebrew');
    renderNav();

    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('my-homebrew');
    expect(notice.textContent).toContain('classic-fantasy');
  });

  it('shows nothing for a system that has its own rules', () => {
    renderNav();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('still renders the tabs either way', () => {
    engine = engineWith('my-homebrew');
    renderNav();
    expect(screen.getByRole('tab', { name: /Sheet/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Magic/ })).toBeTruthy();
  });
});
