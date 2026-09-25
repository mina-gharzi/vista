"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** میلی‌ثانیه؛ 0 یعنی تا بسته‌شدن دستی باقی می‌ماند */
  duration?: number;
}

interface ToastItem {
  id: number;
  title: string;
  description: string | undefined;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;

const variantClasses: Record<ToastVariant, string> = {
  info: "border-border-strong",
  success: "border-success",
  warning: "border-warning",
  error: "border-danger",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    const variant = input.variant ?? "info";
    const item: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      variant,
      duration: input.duration ?? (variant === "error" ? 8000 : 5000),
    };
    setItems((current) => [...current, item].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Live Region همیشه در DOM است تا Screen Reader تغییرات آن را اعلام کند */}
      <div
        role="region"
        aria-label="اعلان‌ها"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-start"
      >
        {items.map((item) => (
          <ToastMessage key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastMessage({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { id, duration } = item;

  useEffect(() => {
    if (duration === 0) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded border-s-4 bg-ivory p-4 shadow-overlay",
        variantClasses[item.variant],
      )}
    >
      <div className="flex-1">
        <p className="type-label">{item.title}</p>
        {item.description && <p className="mt-0.5 text-sm text-ink-muted">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="بستن اعلان"
        className="-me-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-ivory-soft hover:text-ink"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="m5 5 10 10M15 5 5 15"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast باید داخل ToastProvider استفاده شود");
  }
  return context;
}
