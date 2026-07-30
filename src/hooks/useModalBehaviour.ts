import { useEffect, useRef } from 'react';

/** Selector for the elements a user can Tab to. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Gives a hand-rolled `role="dialog"` the behaviour Radix would have provided.
 *
 * @remarks
 * The app has fourteen dialogs built as a bare overlay `<div role="dialog">`
 * rather than through the Radix `Modal`/`Drawer` wrappers. Each is visually
 * correct and each is missing the same three things: Tab escapes into the page
 * behind, Escape does nothing, and focus is not returned to whatever opened the
 * dialog when it closes. For anyone on a keyboard or a screen reader that makes
 * them a trap — the page underneath is still reachable and still interactive
 * while a modal claims to be modal.
 *
 * Rewriting all fourteen onto Radix is the better end state; this closes the
 * behavioural gap without a fourteen-file rewrite, and it is deliberately the
 * same contract, so replacing a call site with the real wrapper later is a
 * straight substitution.
 *
 * Attach the returned ref to the element carrying `role="dialog"`, and set
 * `aria-modal="true"` on it.
 *
 * @param onClose - Called on Escape. Pass `undefined` to disable Escape (a
 *   confirmation mid-write, say), which leaves the trap and restore intact.
 * @param active - Whether the dialog is currently open. Defaults to `true`, for
 *   the common case of a component that only renders while open.
 * @returns Ref to place on the dialog element.
 */
export function useModalBehaviour<T extends HTMLElement = HTMLDivElement>(
  onClose?: () => void,
  active: boolean = true,
) {
  const ref = useRef<T | null>(null);
  // Held in a ref so changing the handler does not tear down the listener and
  // re-steal focus mid-interaction.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus inside. The dialog itself is the fallback target, so focus
    // never stays on whatever was behind the overlay.
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    const initial = focusables()[0];
    if (initial) {
      initial.focus();
    } else if (node.tabIndex < 0) {
      node.tabIndex = -1;
      node.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!onCloseRef.current) return;
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      // Wrap at both ends, and pull focus back in if it has already escaped.
      if (event.shiftKey && (current === first || !node.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !node.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      // Restore focus to the opener, if it is still in the document.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return ref;
}
