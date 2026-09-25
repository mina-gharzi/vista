import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { controlClasses, describedBy, FieldShell, useFieldIds } from "./field";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
}

/** Select بومی مرورگر (بهترین Accessibility و تجربه Mobile)؛ فقط ظاهر آن هماهنگ شده است. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel, hint, error, id, className, required, children, ...rest },
  ref,
) {
  const ids = useFieldIds(id);
  return (
    <FieldShell
      {...ids}
      label={label}
      hideLabel={hideLabel}
      required={required}
      hint={hint}
      error={error}
    >
      <div className="relative">
        <select
          ref={ref}
          id={ids.id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, { hint, error })}
          className={cn(controlClasses(Boolean(error)), "appearance-none pe-10", className)}
          {...rest}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    </FieldShell>
  );
});
