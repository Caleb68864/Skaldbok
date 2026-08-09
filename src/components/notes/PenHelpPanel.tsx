import { useState } from 'react';

/**
 * Collapsible help panel for "S Pen writing isn't working".
 *
 * @remarks
 * Handwriting failing is almost always device configuration, which the app
 * cannot detect or fix. This surfaces the ordered checks instead of failing
 * silently, collapsed to a single-line affordance so it costs no writing area
 * on the session log.
 *
 * **Always starts collapsed.** It used to persist its expanded state, which
 * sounds helpful and is not: you open it once to read the checks, and it then
 * eats the top of the session log in every session afterwards. Troubleshooting
 * is a one-off; the writing area is what you came for.
 */
export function PenHelpPanel() {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => setExpanded(o => !o);

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
