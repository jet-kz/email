"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (title: string, description?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((title: string, description?: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 p-4 rounded-xl border shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5 backdrop-blur-md",
              t.type === "success" && "bg-zinc-950/90 border-emerald-900/60 text-emerald-200",
              t.type === "error" && "bg-zinc-950/90 border-red-900/60 text-red-200",
              t.type === "info" && "bg-zinc-950/90 border-zinc-800 text-zinc-200"
            )}
          >
            {t.type === "success" && <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />}
            {t.type === "error" && <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />}
            {t.type === "info" && <Info className="text-indigo-400 shrink-0 mt-0.5" size={18} />}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold tracking-tight">{t.title}</p>
              {t.description && <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{t.description}</p>}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 hover:bg-zinc-900 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
