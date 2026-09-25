import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { controlClasses, describedBy, FieldShell, useFieldIds } from "./field";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** الزامی است تا هر فیلد برای Screen Reader برچسب داشته باشد */
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, hint, error, id, className, required, ...rest },
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
      <input
        ref={ref}
        id={ids.id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, { hint, error })}
        className={cn(controlClasses(Boolean(error)), className)}
        {...rest}
      />
    </FieldShell>
  );
});
