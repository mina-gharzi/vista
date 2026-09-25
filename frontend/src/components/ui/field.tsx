import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** شناسه‌های مرتبط با یک فیلد فرم (برای اتصال label، hint و error به کنترل) */
export function useFieldIds(providedId?: string) {
  const generated = useId();
  const id = providedId ?? generated;
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

export function describedBy(
  ids: { hintId: string; errorId: string },
  state: { hint?: string | undefined; error?: string | undefined },
): string | undefined {
  const parts = [state.error ? ids.errorId : null, state.hint ? ids.hintId : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** کلاس مشترک کنترل‌های متنی. رنگ Border عمداً ≥ ۳:۱ کنتراست دارد (WCAG 1.4.11). */
export function controlClasses(hasError: boolean): string {
  return cn(
    "block w-full rounded border bg-ivory-soft px-3 py-2.5 text-base text-ink transition-colors",
    "placeholder:text-ink-faint hover:border-ink focus:border-bordeaux",
    "disabled:cursor-not-allowed disabled:opacity-60",
    hasError ? "border-danger" : "border-ink-faint",
  );
}

interface FieldShellProps {
  id: string;
  hintId: string;
  errorId: string;
  label: string;
  hideLabel?: boolean | undefined;
  required?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}

export function FieldShell({
  id,
  hintId,
  errorId,
  label,
  hideLabel,
  required,
  hint,
  error,
  children,
}: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn("type-label", hideLabel && "sr-only")}>
        {label}
        {required && (
          <span aria-hidden="true" className="ms-1 text-danger">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="type-caption">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
