'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import clsx from 'clsx';

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

  const duration = toast.durationMs ?? 3500;
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

  return (
    <div
      aria-live="polite"
      className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon =
            toast.type === 'error'
              ? AlertCircle
              : toast.type === 'success'
              ? CheckCircle2
              : Info;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', damping: 26, stiffness: 350 }}
              role="status"
              className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white text-zinc-900 border border-zinc-200/90 shadow-floating"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={clsx(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    toast.type === 'error'
                      ? 'bg-rose-600'
                      : toast.type === 'success'
                      ? 'bg-emerald-600'
                      : 'bg-zinc-800'
                  )}
                />
                <Icon
                  size={16}
                  className={clsx(
                    'flex-shrink-0',
                    toast.type === 'error'
                      ? 'text-rose-600'
                      : toast.type === 'success'
                      ? 'text-emerald-600'
                      : 'text-zinc-600'
                  )}
                />
                <p className="text-xs font-mono font-medium leading-snug truncate text-zinc-800">
                  {toast.message}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {toast.actionLabel && toast.onAction && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.onAction?.();
                      dismissToast(toast.id);
                    }}
                    className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-900 transition-colors"
                  >
                    {toast.actionLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 transition-colors"
                  aria-label="Close notification"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

