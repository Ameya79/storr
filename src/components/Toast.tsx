import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toastsState: ToastItem[] = [];
const listeners: Set<ToastListener> = new Set();

function emit() {
  listeners.forEach((l) => l([...toastsState]));
}

export function showToast(toast: Omit<ToastItem, 'id'>) {
  const id = Math.random().toString(36).substring(2, 9);
  const newItem: ToastItem = { ...toast, id };
  toastsState = [...toastsState, newItem];
  emit();

  const duration = toast.durationMs ?? 4000;
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }
  return id;
}

export function dismissToast(id: string) {
  toastsState = toastsState.filter((t) => t.id !== id);
  emit();
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'error'
            ? AlertCircle
            : toast.type === 'success'
            ? CheckCircle2
            : Info;

        const colorClasses =
          toast.type === 'error'
            ? 'bg-rose-900/90 text-white border-rose-700'
            : toast.type === 'success'
            ? 'bg-emerald-900/90 text-white border-emerald-700'
            : 'bg-surface text-text border-border shadow-card';

        return (
          <div
            key={toast.id}
            role="status"
            className={clsx(
              'pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-card border shadow-lg backdrop-blur-md transition-all duration-180 animate-in fade-in slide-in-from-bottom-2',
              colorClasses
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className="w-5 h-5 flex-shrink-0 opacity-80" />
              <p className="text-sm font-medium leading-snug truncate">{toast.message}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    dismissToast(toast.id);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white/20 hover:bg-white/30 active:scale-95 transition-all text-white"
                >
                  {toast.actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 rounded-md hover:opacity-70 active:scale-95 transition-all"
                aria-label="Close"
              >
                <X className="w-4 h-4 opacity-70" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

