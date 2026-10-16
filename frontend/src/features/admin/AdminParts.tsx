"use client";

import type { ReactNode } from "react";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import type { AdminQueryState } from "./useAdminQuery";

/** نمایش یکسان حالت‌های بارگذاری/خطا/ممنوع/یافت‌نشد؛ فقط در حالت ready فرزند را می‌سازد. */
export function QueryBoundary<T>({
  state,
  reload,
  children,
  skeletonRows = 4,
  label,
  notFoundTitle = "مورد یافت نشد",
}: {
  state: AdminQueryState<T>;
  reload: () => void;
  children: (data: T) => ReactNode;
  skeletonRows?: number;
  label: string;
  notFoundTitle?: string;
}) {
  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label={`در حال بارگذاری ${label}`} className="flex flex-col gap-3">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (state.status === "error") return <ErrorState description={`دریافت ${label} انجام نشد.`} onRetry={reload} />;
  if (state.status === "forbidden") return <EmptyState title="دسترسی ندارید" description={state.message} />;
  if (state.status === "notFound") return <EmptyState title={notFoundTitle} />;
  return <>{children(state.data)}</>;
}

export interface ChipOption<V extends string> {
  value: V | "";
  label: string;
}

/** فیلتر وضعیت به‌صورت دکمه‌های aria-pressed (مثل بخش فروشنده). */
export function FilterChips<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption<V>[];
  value: V | "";
  onChange: (value: V | "") => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
              active ? "border-bordeaux bg-bordeaux text-ivory" : "border-border bg-ivory text-ink hover:bg-ivory-soft"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
