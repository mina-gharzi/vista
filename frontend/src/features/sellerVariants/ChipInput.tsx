"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

interface ChipInputProps {
  label: string;
  /** عنوان فارسی «جمع» برای نام‌گذاری دکمه‌ها (مثلاً «رنگ») */
  noun: string;
  values: string[];
  presets: readonly string[];
  onChange: (values: string[]) => void;
  dir?: "ltr" | "rtl";
}

/** مجموعه چیپ‌ها: انتخاب از پیش‌فرض‌ها یا ورود مقدار دلخواه؛ تکراری (بدون حساسیت به حروف) اضافه نمی‌شود. */
export function ChipInput({ label, noun, values, presets, onChange, dir }: ChipInputProps) {
  const [custom, setCustom] = useState("");
  const headingId = useId();
  const has = (value: string) => values.some((v) => v.toLowerCase() === value.toLowerCase());

  const add = (raw: string) => {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value || has(value)) return;
    onChange([...values, value]);
  };
  const remove = (value: string) => onChange(values.filter((v) => v !== value));

  const submitCustom = () => {
    add(custom);
    setCustom("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitCustom();
    }
  };

  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="type-label">
        {label}
      </h3>

      <ul aria-label={`${label} انتخاب‌شده`} className="flex min-h-9 flex-wrap gap-2">
        {values.length === 0 && <li className="text-sm text-ink-faint">هنوز {noun}ی انتخاب نشده است.</li>}
        {values.map((value) => (
          <li
            key={value}
            className="inline-flex items-center gap-1 rounded-full bg-bordeaux-tint px-3 py-1 text-sm text-bordeaux"
          >
            {value}
            <button
              type="button"
              aria-label={`حذف ${noun} ${value}`}
              onClick={() => remove(value)}
              className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-bordeaux hover:text-ivory"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2" role="group" aria-label={`${noun}های پیشنهادی`}>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={has(preset)}
            onClick={() => (has(preset) ? remove(values.find((v) => v.toLowerCase() === preset.toLowerCase()) ?? preset) : add(preset))}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              has(preset)
                ? "border-bordeaux bg-bordeaux text-ivory"
                : "border-border text-ink hover:border-ink",
            )}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={`${noun} دلخواه`}
            name={`custom-${noun}`}
            value={custom}
            dir={dir}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <Button variant="secondary" onClick={submitCustom}>
          افزودن {noun}
        </Button>
      </div>
    </div>
  );
}
