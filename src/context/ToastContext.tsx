import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer } from '../components/primitives/Toast';
import type { Toast, ToastVariant } from '../components/primitives/Toast';

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info', duration = 3000) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, variant, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}
