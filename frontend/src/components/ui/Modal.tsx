"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  /** باید Idempotent باشد (ممکن است بیش از یک بار صدا زده شود) */
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** معمولاً دکمه‌های عملیات */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

/**
 * Modal بر پایه <dialog> بومی: Focus Trap، بستن با Esc، Inert شدن پس‌زمینه و
 * بازگرداندن Focus به دکمه فراخوان توسط خود مرورگر انجام می‌شود (بدون وابستگی اضافه).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    // کلیک روی Backdrop (خودِ <dialog> هدف کلیک است چون محتوا تمام فضا را پر می‌کند)
    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) onClose();
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("click", handleClick);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("click", handleClick);
    };
  }, [onClose]);

  // جلوگیری از Scroll صفحه پشت Modal
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg border border-border",
        "bg-ivory p-0 text-ink shadow-overlay backdrop:bg-ink/50",
        sizes[size],
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="type-h3">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="-me-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-ivory-soft hover:text-ink"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="m5 5 10 10M15 5 5 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {children && <div>{children}</div>}
        {footer && <div className="flex flex-wrap justify-end gap-3 pt-2">{footer}</div>}
      </div>
    </dialog>
  );
}
