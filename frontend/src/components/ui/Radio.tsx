import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, id, className, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="flex items-start gap-3">
      <input
        ref={ref}
        id={inputId}
        type="radio"
        className={cn("mt-1 h-4 w-4 shrink-0 accent-bordeaux", className)}
        {...rest}
      />
      <label htmlFor={inputId} className="text-base">
        {label}
      </label>
    </div>
  );
});

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface RadioGroupProps {
  /** عنوان گروه — برای Screen Reader (legend) */
  legend: string;
  name: string;
  options: RadioOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  error?: string;
}

/** گروه Radio با fieldset/legend معنایی. Controlled: value + onValueChange. */
export function RadioGroup({
  legend,
  name,
  options,
  value,
  onValueChange,
  error,
}: RadioGroupProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="type-label mb-1">{legend}</legend>
      {options.map((option) => (
        <Radio
          key={option.value}
          name={name}
          label={option.label}
          value={option.value}
          disabled={option.disabled ?? false}
          checked={value === undefined ? undefined : value === option.value}
          onChange={() => onValueChange?.(option.value)}
        />
      ))}
      {error && <p className="text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
