import { useEffect, useRef } from 'react';

/** Elements that can hold focus inside an overlay. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Gives a hand-rolled `role="dialog"` overlay the three behaviours a real one
 * has: **Escape closes it, Tab stays inside it, and focus goes back where it
 * came from.**
 *
 * @remarks
 * The app has a Radix-backed {@link Modal} primitive that provides all of this,
 * and new overlays should use it. Several existing ones are hand-built `<div
 * role="dialog">`s whose markup would have to be restructured to adopt it; this
 * hook gives them the behaviour without the rewrite. It is a bridge, not an
 * alternative — reach for `Modal` first.
 *
 * Without a trap, Tab walks out of the dialog and into the page behind it,
 * which on a tablet means the on-screen keyboard starts editing the ledger
 * underneath the modal that is still covering it.
 *
 * @param onClose - Called on Escape. May be an inline arrow; see below.
 * @returns A ref to put on the element that contains the dialog's controls.
 */
export function useOverlayDismiss<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
) {
  const containerRef = useRef<T>(null);

  // `onClose` is usually an inline arrow, so it is a new function every render.
  // Listing it as a dependency would re-run the effect on each one, and the
  // cleanup would then "restore" focus to whatever was focused at that moment —
  // which, once the dialog is open, is something *inside* the dialog. Holding it
  // in a ref lets the effect run exactly once, so the element captured really is
  // the one focused before the dialog appeared.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Captured during the first *render*, not in the effect. React applies
  // `autoFocus` while committing, which is before effects run — so a dialog
  // with an autofocused field had already moved focus inside itself by the time
  // an effect could look, and the hook would faithfully "restore" focus to the
  // dialog's own input. Reading `document.activeElement` here is a side-effect
  // free read that happens before the commit, so it sees the real opener.
  const previouslyFocusedRef = useRef<HTMLElement | null | undefined>(undefined);
  if (previouslyFocusedRef.current === undefined) {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    const previouslyFocused = previouslyFocusedRef.current;

    // Move focus into the dialog if nothing there has claimed it. Without this
    // a dialog with no `autoFocus` never receives focus at all, and the trap
    // below is useless: it only acts at the first and last element, so focus
    // sitting outside simply tabs on through the page behind. A trap is only a
    // trap if you are inside it.
    const root = containerRef.current;
    if (root && !root.contains(document.activeElement)) {
      const first = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).find(
        el => el.offsetParent !== null,
      );
      first?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const root = containerRef.current;
      if (!root) return;
      // `offsetParent === null` filters out anything hidden; a trap that tries
      // to focus an invisible element strands the keyboard.
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetParent !== null,
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !root.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    // Whether focus was inside the dialog immediately before teardown, tracked
    // as it happens rather than inferred afterwards. Both obvious inferences
    // fail: the dialog node is already detached by cleanup time, so asking if it
    // contains the active element always says no; and focus does not reliably
    // fall back to `body` when the focused node is removed — here it lands on a
    // tabbable scroll container, which is indistinguishable from a deliberate
    // move unless you watched it happen.
    let focusWasInside = true;
    function handleFocusIn(event: FocusEvent) {
      const root = containerRef.current;
      if (!root) return;
      focusWasInside = root.contains(event.target as Node);
    }

    // Capture phase: an input inside the dialog that stops propagation on its
    // own keydown would otherwise swallow Escape before it ever reached here.
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      // Restore only if focus was still in the dialog when it went away. If the
      // user had deliberately clicked something else first, stealing focus back
      // is the more surprising behaviour.
      if (focusWasInside) previouslyFocused?.focus?.();
    };
  }, []);

  return containerRef;
}
