import { cn } from "@/lib/utils";
import { Toast } from "./toast";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  action?: ToastAction;
}

interface ToasterProps {
  toasts: ToastItem[];
}

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
