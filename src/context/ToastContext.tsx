import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toaster } from '../components/ui/toaster';
import type { ToastAction, ToastItem, ToastVariant } from '../components/ui/toaster';

interface ShowToastOptions {
  duration?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (
    message: string,
    variant?: ToastVariant,
    optionsOrDuration?: number | ShowToastOptions,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

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
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant, duration, action: opts.action }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toaster toasts={toasts} />
    </ToastContext.Provider>
  );
}
