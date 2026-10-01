import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

interface RatingStarsProps {
  average: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}

/** نمایش فقط‌خواندنی امتیاز با ۵ ستاره (پر/نیم/خالی بر اساس average) — Accessible با aria-label توصیفی. */
export function RatingStars({ average, count, size = "sm", className }: RatingStarsProps) {
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        role="img"
        aria-label={
          count !== undefined
            ? `${average} از ۵ ستاره، از ${formatNumber(count)} نظر`
            : `${average} از ۵ ستاره`
        }
        className="flex"
      >
        {Array.from({ length: 5 }, (_, index) => {
          const fillRatio = Math.max(0, Math.min(1, average - index));
          return (
            <div key={index} className={cn("relative", starSize)} aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                className={cn("absolute inset-0 text-ink-faint", starSize)}
                fill="currentColor"
              >
                <path d="M10 1.5 12.5 7l6 .8-4.4 4.1 1.1 6-5.2-2.9-5.2 2.9 1.1-6L1.5 7.8l6-.8Z" />
              </svg>
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fillRatio * 100}%` }}
              >
                <svg
                  viewBox="0 0 20 20"
                  className={cn("text-champagne-dark", starSize)}
                  fill="currentColor"
                >
                  <path d="M10 1.5 12.5 7l6 .8-4.4 4.1 1.1 6-5.2-2.9-5.2 2.9 1.1-6L1.5 7.8l6-.8Z" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
      {count !== undefined && <span className="type-caption">({formatNumber(count)})</span>}
    </div>
  );
}
