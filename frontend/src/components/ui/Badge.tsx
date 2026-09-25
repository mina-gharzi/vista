import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant = "neutral" | "brand" | "premium" | "success" | "warning" | "danger";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-ivory-soft text-ink border border-border",
  brand: "bg-bordeaux-tint text-bordeaux",
  premium: "bg-champagne text-ink", // Accent — فقط برای جزئیات ویژه/تخفیف
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** وضعیت هرگز فقط با رنگ منتقل نمی‌شود؛ همیشه متن دارد. */
export function Badge({ variant = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
