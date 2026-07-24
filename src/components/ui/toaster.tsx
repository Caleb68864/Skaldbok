import { cn } from "@/lib/utils";
import { Toast } from "./toast";

/** Semantic toast severity, selecting its color. */
export type ToastVariant = "success" | "error" | "warning" | "info";

/** An optional action button rendered inside a toast; `onClick` may be async. */
export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

/** A single queued toast. `duration` is used by the toast provider to schedule dismissal, not by this component. */
export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  action?: ToastAction;
}

/** Props for {@link Toaster}: the live list of toasts to display. */
interface ToasterProps {
  toasts: ToastItem[];
}

/**
 * Fixed, centered stack that renders the active toasts above the bottom nav.
 *
 * @remarks
 * The container is `aria-live="polite"` so screen readers announce new messages,
 * and `pointer-events-none` so it never blocks the UI beneath — individual toasts
 * re-enable pointer events for their action button. Positioned clear of the bottom
 * navigation bar's height.
 */
export function Toaster({ toasts }: ToasterProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "fixed bottom-[calc(var(--touch-target-min)+var(--space-md)+56px)] left-1/2 -translate-x-1/2 z-[300]",
        "flex flex-col gap-[var(--space-sm)] pointer-events-none",
      )}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          variant={toast.variant}
          action={toast.action}
        />
      ))}
    </div>
  );
}
