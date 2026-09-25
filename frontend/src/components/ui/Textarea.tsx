import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { controlClasses, describedBy, FieldShell, useFieldIds } from "./field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hideLabel, hint, error, id, className, required, rows = 4, ...rest },
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
      <textarea
        ref={ref}
        id={ids.id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, { hint, error })}
        className={cn(controlClasses(Boolean(error)), "resize-y", className)}
        {...rest}
      />
    </FieldShell>
  );
});
