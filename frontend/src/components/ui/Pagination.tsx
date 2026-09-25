import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** حالت Client: با کلیک صدا زده می‌شود */
  onPageChange?: (page: number) => void;
  /** حالت URL (پیشنهادی برای Catalog/SEO): آدرس هر صفحه */
  buildHref?: (page: number) => string;
  className?: string;
}

/** لیست صفحه‌ها با «…»: همیشه اول، آخر و یک صفحه اطراف صفحه فعلی. */
export function getPageItems(page: number, totalPages: number): (number | "ellipsis")[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const items: (number | "ellipsis")[] = [];
  sorted.forEach((current, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && current - previous > 1) items.push("ellipsis");
    items.push(current);
  });
  return items;
}

const baseItem =
  "inline-flex h-10 min-w-10 items-center justify-center rounded px-3 text-sm tabular-nums transition-colors";

export function Pagination({
  page,
  totalPages,
  onPageChange,
  buildHref,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const renderItem = (
    target: number,
    content: ReactNode,
    options: { label?: string; current?: boolean; disabled?: boolean },
  ) => {
    const classes = cn(
      baseItem,
      options.current ? "bg-bordeaux text-ivory" : "text-ink hover:bg-ivory-soft",
      options.disabled && "pointer-events-none opacity-40",
    );
    const common = {
      "aria-label": options.label,
      "aria-current": options.current ? ("page" as const) : undefined,
      className: classes,
    };

    if (buildHref && !options.disabled) {
      return (
        <Link href={buildHref(target)} {...common}>
          {content}
        </Link>
      );
    }
    return (
      <button
        type="button"
        disabled={options.disabled ?? false}
        onClick={() => onPageChange?.(target)}
        {...common}
      >
        {content}
      </button>
    );
  };

  const chevron = (
    <svg className="h-4 w-4 rtl:rotate-180" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m8 5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );

  return (
    <nav aria-label="صفحه‌بندی" className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {renderItem(page - 1, <span className="rotate-180">{chevron}</span>, {
            label: "صفحه قبل",
            disabled: page <= 1,
          })}
        </li>
        {getPageItems(page, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <li key={`ellipsis-${index}`} aria-hidden="true" className="px-1 text-ink-faint">
              …
            </li>
          ) : (
            <li key={item}>
              {renderItem(item, formatNumber(item), {
                label: `صفحه ${formatNumber(item)}`,
                current: item === page,
              })}
            </li>
          ),
        )}
        <li>
          {renderItem(page + 1, chevron, { label: "صفحه بعد", disabled: page >= totalPages })}
        </li>
      </ul>
    </nav>
  );
}
