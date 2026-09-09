// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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
    // The test switches *to* parchment, so it only measures a change if the
    // default is something else. Stated as a precondition rather than folded
    // into the assertion: this line used to read
    // `expect(after).not.toBe(before === 'parchment' ? after : before)`, which
    // degenerates to `expect(after).not.toBe(after)` — always failing — the day
    // DEFAULT_THEME becomes 'parchment'. That would have failed for a reason
    // with nothing to do with memoisation, in the file least likely to be
    // suspected.
    expect(before, 'the default theme is now the one this test switches to').not.toBe('parchment');

    await act(async () => { getByRole('button', { name: 'switch' }).click(); });
    const after = seen[seen.length - 1];

    expect(after).toBe('parchment');
    expect(after).not.toBe(before);
  });
});

/** Every file under `src` rendering `<Something.Provider value={…}>`. */
function providerFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
        if (/\.Provider\s+value=\{/.test(readFileSync(full, 'utf8'))) {
          found.push(relative(process.cwd(), full).split('\\').join('/'));
        }
      }
    }
  };
  walk(join(process.cwd(), 'src'));
  return found.sort();
}

/** The identifier passed as `value` to the provider, e.g. `value` in `value={value}`. */
function providerValueName(source: string): string | null {
  return /\.Provider\s+value=\{\s*([A-Za-z_$][\w$]*)\s*\}/.exec(source)?.[1] ?? null;
}

/**
 * The `useMemo` that builds the named value, as `[body, deps]`.
 *
 * @remarks
 * Matched by name — `const <name> = useMemo(...)` — or, when the value comes
 * out of a hook, by `return useMemo(...)`. The previous version took the first
 * object-returning `useMemo` anywhere in the file, so in a provider with more
 * than one it checked the dependency array of something else entirely.
 */
function valueMemo(source: string, name: string | null): [string, string] | null {
  const memo = String.raw`useMemo(?:<[^>]*>)?\(\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\),\s*\[([\s\S]*?)\],?\s*\)`;
  const named = name
    ? new RegExp(String.raw`(?:const|let)\s+${name}\s*(?::[^=]+)?=\s*` + memo).exec(source)
    : null;
  const match = named ?? new RegExp(String.raw`return\s+` + memo).exec(source);
  return match ? [match[1], match[2]] : null;
}

/**
 * The providers that need a whole app around them to mount are covered by
 * asserting the shape that makes the memo exact instead: every member of the
 * context value appears in the dependency array. A member left out is how a
 * memoised provider hands consumers a stale value, and it is invisible at
 * runtime until someone notices the screen not updating.
 */
describe('every memoised provider lists every member', () => {
  /**
   * Discovered, not listed.
   *
   * @remarks
   * This was a hand-maintained array of seven paths, and there were eight
   * providers — `features/session/SessionEncounterContext.tsx` was missing, and
   * its value did come from an unmemoised object literal (one level down, in
   * `useSessionEncounter`). A parallel list guarding against parallel lists is
   * the one place the omission is least likely to be noticed, so the set is now
   * derived from the source: any file rendering `<X.Provider value={…}>`.
   */
  const PROVIDER_FILES = providerFiles();

  /**
   * Providers whose value is built by a hook rather than by a `useMemo` in the
   * provider file itself. The memoisation obligation moves to the hook, and the
   * named file is checked in its place.
   */
  const VALUE_FROM_HOOK: Record<string, string> = {
    'src/features/session/SessionEncounterContext.tsx': 'src/features/session/useSessionEncounter.ts',
  };

  /** Where the `value={…}` identifier for a provider is actually built. */
  function memoSourceFor(file: string): string {
    return VALUE_FROM_HOOK[file] ?? file;
  }

  it('found every provider in the app', () => {
    // The discovery replacing the old list has to be at least as wide as it was.
    expect(PROVIDER_FILES.length).toBeGreaterThanOrEqual(8);
    expect(PROVIDER_FILES).toContain('src/features/session/SessionEncounterContext.tsx');
  });

  it.each(PROVIDER_FILES)('%s memoises its context value', async file => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(file, 'utf8');
    // The provider must not build the value inline in the JSX any more.
    expect(source, `${file} still builds its context value inline`)
      .not.toMatch(/\.Provider\s+value=\{\{/);

    // This used to be `expect(source).toMatch(/useMemo/)`, which passes on any
    // file containing the string anywhere — a comment mentioning memoisation
    // satisfied it. What matters is that the identifier actually handed to
    // `.Provider value={…}` is the one a `useMemo` produces.
    const name = providerValueName(source);
    expect(name, `${file}: could not read the identifier out of .Provider value={…}`).not.toBeNull();

    const memoSource = readFileSync(memoSourceFor(file), 'utf8');
    const bound = new RegExp(
      `(?:const|let)\\s+${name}\\s*(?::[^=]+)?=\\s*useMemo`,
    ).test(memoSource) || (memoSourceFor(file) !== file && /return useMemo\(/.test(memoSource));
    expect(
      bound,
      `${file}: value={${name}} is not produced by a useMemo in ` +
      `${memoSourceFor(file)}. A useMemo somewhere else in the file does not ` +
      'stop consumers re-rendering on every provider render.',
    ).toBe(true);
  });

  it.each(PROVIDER_FILES)('%s lists every value member as a dependency', async file => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(memoSourceFor(file), 'utf8');

    // The `useMemo(() => ({ ... }), [ ... ])` that builds *this* value — matched
    // by the identifier the Provider is given, not simply the first one in the
    // file. `RegExp.exec` returned whichever object-returning useMemo came
    // first, with nothing tying it to `.Provider value={…}`.
    const match = valueMemo(source, providerValueName(readFileSync(file, 'utf8')));
    expect(match, `no value useMemo found in ${memoSourceFor(file)}`).not.toBeNull();
    const [body, deps] = match!;

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
