import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { describedBy, useFieldIds } from "./field";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  label: string;
  hint?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, error, id, className, ...rest },
  ref,
) {
  const ids = useFieldIds(id);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={ids.id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, { hint, error })}
          className={cn("mt-1 h-4 w-4 shrink-0 accent-bordeaux", className)}
          {...rest}
        />
        <label htmlFor={ids.id} className="text-base">
          {label}
        </label>
      </div>
      {hint && !error && (
        <p id={ids.hintId} className="type-caption ms-7">
          {hint}
        </p>
      )}
      {error && (
        <p id={ids.errorId} className="ms-7 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
