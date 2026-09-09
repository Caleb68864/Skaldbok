// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

/**
 * Measures what memoising a provider's `value=` prop is actually worth, rather
 * than asserting that a `useMemo` is present.
 *
 * @remarks
 * A context value built as an object literal in the provider's render body is a
 * new identity on every render of that provider, whether or not anything in it
 * changed. React compares context values by identity, so every consumer
 * re-renders — 31 files consume `CampaignContext`, 34 consume `useToast`, and
 * `ToastProvider` in particular re-renders on a timer, since it holds the toast
 * queue and each toast expires on its own `setTimeout`.
 *
 * The measurement is a render counter on a consumer, driven by a provider
 * re-render that changes nothing the consumer reads. Before the memo that
 * counter went up; after it, it must not. Revert any `useMemo` in the providers
 * and the matching case here fails.
 *
 * The risk being guarded against is the opposite mistake: a dependency array
 * that omits a member, freezing a value consumers depend on. Every provider
 * lists every member, and the second half of this file checks that a real
 * change still propagates.
 */

afterEach(cleanup);

/**
 * The measurement has to make the **provider** re-render, not its parent.
 * Re-rendering a parent does not re-render the provider at all — `children` is
 * the same element reference — so a harness built that way measures nothing and
 * passes whether or not the memo is there. `ToastProvider` holds the toast
 * queue, so showing a toast is a genuine provider re-render, and it is the
 * common one: it happens on every toast shown and again when each expires.
 */
describe('ToastProvider value identity', () => {
  it('does not re-render 20 consumers when a toast is shown', async () => {
    const renders = vi.fn();
    let show: (message: string) => void = () => {};

    function Consumer({ first }: { first: boolean }) {
      const { showToast } = useToast();
      if (first) show = showToast;
      renders();
      return null;
    }

    render(
      <ToastProvider>
        {Array.from({ length: 20 }, (_, i) => <Consumer key={i} first={i === 0} />)}
      </ToastProvider>,
    );

    const initial = renders.mock.calls.length;
    expect(initial).toBe(20);

    await act(async () => { show('a toast'); });

    // Before the memo this was 20 — every consumer re-rendered because the
    // provider handed out a new object literal, though nothing they read
    // had changed.
    expect(
      renders.mock.calls.length - initial,
      'consumers re-rendered on a provider render that changed nothing they read',
    ).toBe(0);
  });

  it('still delivers a working showToast', async () => {
    // The memo must not freeze the API it is memoising.
    let shown: string | null = null;
    function Consumer() {
      const { showToast } = useToast();
      return <button onClick={() => { showToast('hello'); shown = 'hello'; }}>go</button>;
    }
    const { getByRole } = render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>,
    );
    await act(async () => { getByRole('button', { name: 'go' }).click(); });
    expect(shown).toBe('hello');
  });
});

describe('ThemeProvider value identity', () => {
  it('still propagates a real theme change to consumers', async () => {
    // The failure mode a bad dependency array produces: consumers keep reading
    // the value the memo froze. This is the case that catches it.
    const seen: string[] = [];
    function Consumer() {
      const { theme, setTheme } = useTheme();
      seen.push(theme);
      return <button onClick={() => setTheme('parchment')}>switch</button>;
    }

    const { getByRole } = render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    const before = seen[seen.length - 1];
    await act(async () => { getByRole('button', { name: 'switch' }).click(); });
    const after = seen[seen.length - 1];

    expect(after).toBe('parchment');
    expect(after).not.toBe(before === 'parchment' ? after : before);
  });
});

/**
 * The providers that need a whole app around them to mount are covered by
 * asserting the shape that makes the memo exact instead: every member of the
 * context value appears in the dependency array. A member left out is how a
 * memoised provider hands consumers a stale value, and it is invisible at
 * runtime until someone notices the screen not updating.
 */
describe('every memoised provider lists every member', () => {
  const FILES = [
    'src/context/AppStateContext.tsx',
    'src/context/ActiveCharacterContext.tsx',
    'src/context/ToastContext.tsx',
    'src/theme/ThemeProvider.tsx',
    'src/features/campaign/CampaignContext.tsx',
    'src/features/kb/KnowledgeBaseContext.tsx',
    'src/features/session/SessionRefreshContext.tsx',
  ];

  it.each(FILES)('%s memoises its context value', async file => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(file, 'utf8');
    // The provider must not build the value inline in the JSX any more.
    expect(source, `${file} still builds its context value inline`)
      .not.toMatch(/\.Provider\s+value=\{\{/);
    expect(source).toMatch(/useMemo/);
  });

  it.each(FILES)('%s lists every value member as a dependency', async file => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(file, 'utf8');

    // Pull the `useMemo(() => ({ ... }), [ ... ])` that builds the value.
    const match = /useMemo(?:<[^>]*>)?\(\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\),\s*\[([\s\S]*?)\],?\s*\)/.exec(source);
    expect(match, `no value useMemo found in ${file}`).not.toBeNull();
    const [, body, deps] = match!;

    // Flat object literals, so splitting on commas is safe. `key` or
    // `key: value` — the dependency is the value side when the member is
    // renamed, as `getNodeById: getNodeByIdFn` is.
    const members = body
      .replace(/\/\/[^\n]*/g, '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => (part.includes(':') ? part.slice(part.indexOf(':') + 1) : part).trim())
      .filter(part => /^[A-Za-z_$][\w$]*$/.test(part));
    const declared = new Set(
      deps.split(',').map(d => d.trim()).filter(Boolean),
    );

    expect(members.length, `parsed no members out of ${file}`).toBeGreaterThan(0);
    const missing = members.filter(m => !declared.has(m));
    expect(
      missing,
      `${file}: ${missing.join(', ')} in the context value but not in the dependency array — ` +
      'consumers would keep reading the frozen value',
    ).toEqual([]);
  });
});
