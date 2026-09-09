import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Toaster } from '../components/ui/toaster';
import { generateId } from '../utils/ids';
import type { ToastAction, ToastItem, ToastVariant } from '../components/ui/toaster';

/** Optional toast behaviour: auto-dismiss delay and an optional action button. */
export interface ShowToastOptions {
  duration?: number;
  action?: ToastAction;
}

/** Imperative toast API exposed to the tree. */
export interface ToastContextValue {
  /**
   * Shows a transient toast.
   *
   * @remarks
   * The third argument accepts either a raw duration in ms (legacy call sites)
   * or a {@link ShowToastOptions} object; both are handled.
   */
  showToast: (
    message: string,
    variant?: ToastVariant,
    optionsOrDuration?: number | ShowToastOptions,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Accesses the toast API; throws if used outside {@link ToastProvider}. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/** Holds the active toast queue and renders the {@link Toaster}, auto-dismissing each toast after its duration. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (
      message: string,
      variant: ToastVariant = 'info',
      optionsOrDuration?: number | ShowToastOptions,
    ) => {
      // Backwards compatible: third arg may be a raw duration number (legacy
      // call sites) or an options object. Both shapes are handled.
      const opts: ShowToastOptions =
        typeof optionsOrDuration === 'number'
          ? { duration: optionsOrDuration }
          : optionsOrDuration ?? {};
      const duration = opts.duration ?? 3000;
      const id = generateId();
      setToasts((prev) => [...prev, { id, message, variant, duration, action: opts.action }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  // A fresh object literal here made all 34 `useToast` consumers re-render on
  // every toast shown and every toast expiring — this provider holds the queue,
  // so it re-renders on a timer. `showToast` is the only member and is already
  // stable, so the memo is exact: the identity changes when the value does and
  // at no other time.
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} />
    </ToastContext.Provider>
  );
}
