import { useState } from 'react';

/** localStorage key persisting whether the S Pen help panel is expanded. */
const STORAGE_KEY = 'skaldbok-pen-help-expanded';

/** Reads the persisted expanded state, tolerating absent or unavailable storage. */
function readExpanded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Persists the expanded state, tolerating a private-mode or full storage. */
function writeExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, expanded ? 'true' : 'false');
  } catch {
    // A storage failure must not break capture — the state simply resets
    // to collapsed on the next mount.
  }
}

/**
 * Collapsible help panel for "S Pen writing isn't working".
 *
 * @remarks
 * Handwriting failing is almost always device configuration, which the app
 * cannot detect or fix. This surfaces the ordered checks instead of failing
 * silently, collapsed to a single-line affordance by default so it costs no
 * writing area on the session log.
 */
export function PenHelpPanel() {
  const [expanded, setExpanded] = useState(readExpanded);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    writeExpanded(next);
  };

  return (
    <div className="shrink-0 border-t border-[var(--color-border,#ddd)] px-4 text-sm">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between py-1.5 text-left text-xs text-[var(--color-text-muted,#666)]"
        aria-expanded={expanded}
      >
        <span>S Pen writing isn&apos;t working?</span>
        <span>{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <ol className="list-decimal space-y-1 py-2 pl-5 text-xs text-[var(--color-text-muted,#666)]">
          <li>
            Make sure Samsung Keyboard is the active keyboard, with
            &quot;S Pen to text&quot; / DirectWriting enabled.
          </li>
          <li>Check that Settings &rarr; Advanced features &rarr; S Pen is on.</li>
          <li>
            Gboard&apos;s &quot;Write in text fields&quot; behaves differently from Samsung
            Keyboard &mdash; try switching keyboards.
          </li>
          <li>
            Try the PWA in Samsung Internet rather than Chrome &mdash; there is a
            documented case (Quill issue #3835) of S Pen writing working in
            Samsung Internet where it failed in Chrome.
          </li>
        </ol>
      )}
    </div>
  );
}
