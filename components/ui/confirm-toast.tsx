// Hello World
"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning";
  timeoutMs?: number;
}

interface ToastItem {
  id: string;
  isConfirm: boolean;
  type: "danger" | "warning" | "success" | "error" | "info";
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  resolve?: (value: boolean) => void;
}

interface ConfirmToastContextType {
  confirmDelete: (options: ConfirmOptions | string) => Promise<boolean>;
  showToast: (type: "success" | "error" | "info", message: string, title?: string) => void;
}

const ConfirmToastContext = createContext<ConfirmToastContextType | undefined>(undefined);

export function ConfirmToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const t = timeoutsRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const confirmDelete = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const id = `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const normalized: ConfirmOptions =
        typeof options === "string"
          ? {
              message: options,
              title: "Confirmar Exclusão",
              confirmText: "Sim, Excluir",
              cancelText: "Cancelar",
              type: "danger",
            }
          : {
              title: options.title || "Confirmar Exclusão",
              message: options.message,
              confirmText: options.confirmText || "Sim, Excluir",
              cancelText: options.cancelText || "Cancelar",
              type: options.type || "danger",
              timeoutMs: options.timeoutMs,
            };

      const newItem: ToastItem = {
        id,
        isConfirm: true,
        type: normalized.type || "danger",
        title: normalized.title,
        message: normalized.message,
        confirmText: normalized.confirmText,
        cancelText: normalized.cancelText,
        resolve,
      };

      setToasts((prev) => [...prev, newItem]);

      // Optional auto-dismiss after timeout (defaults to 15s)
      const timeoutMs = normalized.timeoutMs || 15000;
      const timer = setTimeout(() => {
        resolve(false);
        removeToast(id);
      }, timeoutMs);
      timeoutsRef.current.set(id, timer);
    });
  }, [removeToast]);

  const showToast = useCallback(
    (type: "success" | "error" | "info", message: string, title?: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newItem: ToastItem = {
        id,
        isConfirm: false,
        type,
        title,
        message,
      };

      setToasts((prev) => [...prev, newItem]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, 4500);
      timeoutsRef.current.set(id, timer);
    },
    [removeToast]
  );

  const handleUserDecision = (item: ToastItem, choice: boolean) => {
    if (item.resolve) {
      item.resolve(choice);
    }
    removeToast(item.id);
  };

  return (
    <ConfirmToastContext.Provider value={{ confirmDelete, showToast }}>
      {children}

      {/* Pilha de notificações: cartões brancos arredondados, o ponto colorido indica o tipo. */}
      <aside
        aria-live="polite"
        aria-label="Notificações"
        className="pointer-events-none fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-md flex-col gap-3 sm:right-6 sm:w-[420px]"
      >
        <AnimatePresence mode="sync">
          {toasts.map((toast) => {
            const danger = toast.isConfirm || toast.type === "danger" || toast.type === "error";
            return (
              <motion.div
                key={toast.id}
                role={toast.isConfirm ? "alertdialog" : "status"}
                aria-label={toast.title || undefined}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className="pointer-events-auto relative flex gap-3 rounded-2xl border border-[#e9e9ee] bg-white p-4 pr-12 text-[#0b0b10] shadow-[0_16px_40px_-16px_rgba(11,11,16,0.3)]"
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${danger ? "bg-[#c8102e]" : toast.type === "success" ? "bg-[#0f7b4f]" : "bg-[#6c0cf0]"}`}
                />
                <div className="min-w-0 flex-1">
                  {toast.title && <p className="text-[15px] font-semibold">{toast.title}</p>}
                  <p className={`text-sm leading-relaxed text-[#5b5b66] ${toast.title ? "mt-1" : ""}`}>{toast.message}</p>

                  {toast.isConfirm && (
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUserDecision(toast, false)}
                        className="min-h-10 flex-1 cursor-pointer rounded-full bg-[#f2f2f5] px-4 text-sm font-medium transition-colors hover:bg-[#e9e9ee]"
                      >
                        {toast.cancelText}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUserDecision(toast, true)}
                        className="min-h-10 flex-1 cursor-pointer rounded-full bg-[#c8102e] px-4 text-sm font-medium text-white transition-colors hover:bg-[#a50d26]"
                      >
                        {toast.confirmText}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleUserDecision(toast, false)}
                  aria-label="Fechar notificação"
                  className="absolute right-1.5 top-1.5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[#5b5b66] transition-colors hover:bg-[#f2f2f5] hover:text-[#0b0b10]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
                    <path d="M5 5l14 14M19 5 5 19" />
                  </svg>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </aside>
    </ConfirmToastContext.Provider>
  );
}

export function useConfirmToast() {
  const context = useContext(ConfirmToastContext);
  if (!context) {
    return {
      confirmDelete: async (options: ConfirmOptions | string) => {
        const msg = typeof options === "string" ? options : options.message;
        if (typeof window !== "undefined") {
          return window.confirm(msg);
        }
        return false;
      },
      showToast: (_type: string, _message: string) => {
        // Silencioso por padrão
      },
    };
  }
  return context;
}
