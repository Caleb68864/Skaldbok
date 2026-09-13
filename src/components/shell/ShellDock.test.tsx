// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ShellDock, ShellDockProvider } from './ShellDock';

/**
 * The dock exists to take a bar *out* of the scrolling region, so the property
 * worth pinning is where its children land in the DOM — not what they look
 * like.
 *
 * @remarks
 * jsdom has no layout, so "stuck to the bottom of the screen" is not
 * measurable here. What is measurable is the thing that makes it true: the
 * docked element is a child of the shell's dock node and **not** a descendant
 * of the scroll container it was written inside. That is exactly the
 * difference between this and the `position: sticky` it replaced, which left
 * the bar inside the scrollport and let it ride up at the end of a scroll.
 */

afterEach(cleanup);

function Shell({ children }: { children: React.ReactNode }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <ShellDockProvider node={node}>
        <main>{children}</main>
      </ShellDockProvider>
      <div data-testid="dock" ref={setNode} />
    </>
  );
}

describe('ShellDock', () => {
  it('lands its children in the dock, not where they were written', () => {
    render(
      <Shell>
        <ShellDock>
          <button>Log a note…</button>
        </ShellDock>
      </Shell>,
    );

    const docked = screen.getByRole('button', { name: 'Log a note…' });
    expect(screen.getByTestId('dock').contains(docked)).toBe(true);
    expect(screen.getByRole('main').contains(docked)).toBe(false);
  });

  it('renders in place when there is no shell to dock into', () => {
    // A screen under test, or the shell-less print route. Silently rendering
    // nothing would lose the composer with no error to explain it.
    render(
      <ShellDock>
        <button>Log a note…</button>
      </ShellDock>,
    );
    expect(screen.getByRole('button', { name: 'Log a note…' })).toBeTruthy();
  });

  it('docks once the node arrives, not only on the first render', () => {
    // The node is null on the shell's first pass — a ref callback has not fired
    // yet — so a dock that read it once would never portal at all.
    render(
      <Shell>
        <ShellDock>
          <span data-testid="docked" />
        </ShellDock>
      </Shell>,
    );
    expect(screen.getByTestId('dock').contains(screen.getByTestId('docked'))).toBe(true);
  });
});
